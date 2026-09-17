import { dragonHitbox, hitsFloor, hitsObstacle } from './collision';
import {
  BG_PARALLAX,
  DRAGON_BODY_HEIGHT,
  DRAGON_HITBOX_SCALE,
  FLASH_TIME,
  FLOOR_Y,
  GAMEOVER_DELAY,
  GAP_START,
  SHAKE_TIME,
  SPEED_START,
} from './config';
import { createObstacle, createObstaclePool, difficultyFor, updateObstacles } from './obstacles';
import { bobDragon, createDragon, stepDragon } from './physics';
import { updateScore } from './scoring';
import type { Rect, Rng, StepEvents, WorldState } from './types';

const hitbox: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function createWorld(): WorldState {
  return {
    status: 'menu',
    time: 0,
    score: 0,
    speed: SPEED_START,
    gapSize: GAP_START,
    dragon: createDragon(),
    obstacles: createObstaclePool(),
    lastGapCenter: null,
    groundX: 0,
    prevGroundX: 0,
    bgX: 0,
    prevBgX: 0,
    deathTimer: 0,
    landed: false,
    shakeTimer: 0,
    flashTimer: 0,
  };
}

export function resetWorld(world: WorldState, status: 'menu' | 'ready'): void {
  const { dragon, obstacles } = world;
  Object.assign(dragon, createDragon());
  for (const obstacle of obstacles) Object.assign(obstacle, createObstacle());
  Object.assign(world, createWorld(), { status, dragon, obstacles });
}

export function createStepEvents(): StepEvents {
  return { scored: false, died: false, gameOver: false };
}

function scroll(world: WorldState, dt: number): void {
  world.groundX += world.speed * dt;
  world.bgX += world.speed * BG_PARALLAX * dt;
}

function landDragon(world: WorldState): void {
  world.dragon.y = FLOOR_Y - (DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE) / 2;
  world.dragon.vy = 0;
  world.landed = true;
}

function die(world: WorldState, events: StepEvents): void {
  world.status = 'dying';
  world.deathTimer = 0;
  world.shakeTimer = SHAKE_TIME;
  world.flashTimer = FLASH_TIME;
  world.dragon.rotation = 0;
  events.died = true;
}

export function stepWorld(world: WorldState, dt: number, rng: Rng, events: StepEvents): void {
  events.scored = false;
  events.died = false;
  events.gameOver = false;

  const { dragon } = world;
  dragon.prevY = dragon.y;
  dragon.prevRotation = dragon.rotation;
  world.prevGroundX = world.groundX;
  world.prevBgX = world.bgX;
  for (const obstacle of world.obstacles) obstacle.prevX = obstacle.x;

  if (world.status === 'paused') return;

  world.shakeTimer = Math.max(0, world.shakeTimer - dt);
  world.flashTimer = Math.max(0, world.flashTimer - dt);

  switch (world.status) {
    case 'gameover':
      return;

    case 'menu':
    case 'ready':
      world.time += dt;
      scroll(world, dt);
      bobDragon(dragon, world.time);
      return;

    case 'playing': {
      world.time += dt;
      scroll(world, dt);
      stepDragon(dragon, dt);
      updateObstacles(world, dt, rng);

      if (updateScore(world, dragon.x)) {
        events.scored = true;
        const difficulty = difficultyFor(world.score);
        world.gapSize = difficulty.gapSize;
        world.speed = difficulty.speed;
      }

      dragonHitbox(dragon, hitbox);
      const hitFloor = hitsFloor(hitbox);
      let hitRock = false;
      for (const obstacle of world.obstacles) {
        if (hitsObstacle(hitbox, obstacle)) {
          hitRock = true;
          break;
        }
      }
      if (hitFloor || hitRock) die(world, events);
      if (hitFloor) landDragon(world);
      return;
    }

    case 'dying':
      world.time += dt;
      world.deathTimer += dt;
      if (!world.landed) {
        stepDragon(dragon, dt);
        dragon.rotation = 0;
        if (hitsFloor(dragonHitbox(dragon, hitbox))) landDragon(world);
      }
      if (world.landed && world.deathTimer >= GAMEOVER_DELAY) {
        world.status = 'gameover';
        events.gameOver = true;
      }
      return;
  }
}
