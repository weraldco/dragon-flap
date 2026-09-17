import type { Sprites } from './assets';
import {
  DRAGON_DRAW_HEIGHT,
  FLASH_TIME,
  FLOOR_DRAW_HEIGHT,
  FLOOR_Y,
  HEIGHT,
  OBSTACLE_FLOOR_SINK,
  OBSTACLE_WIDTH,
  SHAKE_MAGNITUDE,
  SHAKE_TIME,
  WIDTH,
} from './config';
import { poseFor } from './physics';
import type { Obstacle, WorldState } from './types';

export class UnsupportedCanvasError extends Error {
  constructor() {
    super('Canvas 2D is not supported in this browser');
    this.name = 'UnsupportedCanvasError';
  }
}

export interface RenderOptions {
  reducedMotion: boolean;
}

const LETTERBOX_COLOR = '#1a0d0a';

export function setupCanvas(canvas: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D {
  canvas.width = Math.round(WIDTH * dpr);
  canvas.height = Math.round(HEIGHT * dpr);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new UnsupportedCanvasError();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

// Background tiles alternate mirrored copies so the non-seamless edges always meet their reflection.
function drawBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scrollX: number): void {
  const w = Math.ceil((img.width * HEIGHT) / img.height);
  const period = w * 2;
  const offset = ((scrollX % period) + period) % period;
  for (let i = 0; i * w - offset < WIDTH; i++) {
    const x = Math.round(i * w - offset);
    if (x + w <= 0) continue;
    if (i % 2 === 0) {
      ctx.drawImage(img, x, 0, w + 1, HEIGHT);
    } else {
      ctx.save();
      ctx.translate(x + w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -1, 0, w + 1, HEIGHT);
      ctx.restore();
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scrollX: number): void {
  const w = Math.ceil((img.width * FLOOR_DRAW_HEIGHT) / img.height);
  const offset = scrollX % w;
  const y = HEIGHT - FLOOR_DRAW_HEIGHT;
  for (let i = 0; i * w - offset < WIDTH; i++) {
    ctx.drawImage(img, Math.round(i * w - offset), y, w + 1, FLOOR_DRAW_HEIGHT);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, sprites: Sprites, obstacle: Obstacle, x: number): void {
  const left = Math.round(x - OBSTACLE_WIDTH / 2);
  const gapTop = Math.round(obstacle.gapCenter - obstacle.gapSize / 2);
  const gapBottom = Math.round(obstacle.gapCenter + obstacle.gapSize / 2);

  const top = sprites[obstacle.topSprite];
  if (obstacle.topFlipped) {
    ctx.save();
    ctx.translate(left, gapTop);
    ctx.scale(1, -1);
    ctx.drawImage(top, 0, 0, OBSTACLE_WIDTH, gapTop);
    ctx.restore();
  } else {
    ctx.drawImage(top, left, 0, OBSTACLE_WIDTH, gapTop);
  }

  const bottomHeight = FLOOR_Y - gapBottom + OBSTACLE_FLOOR_SINK;
  ctx.drawImage(sprites[obstacle.bottomSprite], left, gapBottom, OBSTACLE_WIDTH, bottomHeight);
}

function drawDragon(ctx: CanvasRenderingContext2D, sprites: Sprites, world: WorldState, alpha: number): void {
  const { dragon } = world;
  const img = sprites[poseFor(dragon, world.status, world.time)];
  const h = DRAGON_DRAW_HEIGHT;
  const w = (img.width * h) / img.height;
  ctx.save();
  ctx.translate(Math.round(dragon.x), Math.round(lerp(dragon.prevY, dragon.y, alpha)));
  ctx.rotate(lerp(dragon.prevRotation, dragon.rotation, alpha));
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  world: WorldState,
  alpha: number,
  options: RenderOptions,
): void {
  ctx.fillStyle = LETTERBOX_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  if (!options.reducedMotion && world.shakeTimer > 0) {
    const magnitude = SHAKE_MAGNITUDE * (world.shakeTimer / SHAKE_TIME);
    ctx.translate((Math.random() * 2 - 1) * magnitude, (Math.random() * 2 - 1) * magnitude);
  }

  drawBackground(ctx, sprites.background, lerp(world.prevBgX, world.bgX, alpha));
  for (const obstacle of world.obstacles) {
    if (obstacle.active) drawObstacle(ctx, sprites, obstacle, lerp(obstacle.prevX, obstacle.x, alpha));
  }
  drawFloor(ctx, sprites.floor, lerp(world.prevGroundX, world.groundX, alpha));
  drawDragon(ctx, sprites, world, alpha);
  ctx.restore();

  if (world.flashTimer > 0) {
    const strength = options.reducedMotion ? 0.3 : 0.7;
    ctx.fillStyle = `rgba(255, 236, 200, ${(world.flashTimer / FLASH_TIME) * strength})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
