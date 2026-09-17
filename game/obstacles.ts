import {
  FIRST_OBSTACLE_X,
  FLOOR_Y,
  GAP_EDGE_MARGIN,
  GAP_MAX_SHIFT,
  GAP_MIN,
  GAP_START,
  OBSTACLE_POOL_SIZE,
  OBSTACLE_SPACING,
  OBSTACLE_WIDTH,
  RAMP_EVERY,
  RAMP_GAP_STEP,
  RAMP_SPEED_STEP,
  SPEED_MAX,
  SPEED_START,
  TALL_ROCK_THRESHOLD,
} from './config';
import type { Obstacle, RockSprite, Rng, WorldState } from './types';

export type ObstacleField = Pick<WorldState, 'obstacles' | 'speed' | 'gapSize' | 'lastGapCenter'>;

const HANGING_ROCK: RockSprite = 'rock-short-3';
const SHORT_UP_ROCKS: readonly RockSprite[] = ['rock-short-1', 'rock-short-2', 'rock-short-4'];
const TALL_UP_ROCKS: readonly RockSprite[] = ['rock-tall-1', 'rock-tall-2'];
const SHORT_TOP_ROCKS: readonly RockSprite[] = [...SHORT_UP_ROCKS, HANGING_ROCK];

export function createObstacle(): Obstacle {
  return {
    active: false,
    x: 0,
    prevX: 0,
    gapCenter: 0,
    gapSize: GAP_START,
    passed: false,
    topSprite: HANGING_ROCK,
    topFlipped: false,
    bottomSprite: 'rock-short-1',
  };
}

export function createObstaclePool(size = OBSTACLE_POOL_SIZE): Obstacle[] {
  return Array.from({ length: size }, createObstacle);
}

export function difficultyFor(score: number): { gapSize: number; speed: number } {
  const level = Math.floor(score / RAMP_EVERY);
  return {
    gapSize: Math.max(GAP_MIN, GAP_START - level * RAMP_GAP_STEP),
    speed: Math.min(SPEED_MAX, SPEED_START + level * RAMP_SPEED_STEP),
  };
}

export function gapCenterRange(gapSize: number, prevGapCenter: number | null): [min: number, max: number] {
  let min = GAP_EDGE_MARGIN + gapSize / 2;
  let max = FLOOR_Y - GAP_EDGE_MARGIN - gapSize / 2;
  if (prevGapCenter !== null) {
    min = Math.max(min, prevGapCenter - GAP_MAX_SHIFT);
    max = Math.min(max, prevGapCenter + GAP_MAX_SHIFT);
  }
  return [min, max];
}

export function nextGapCenter(gapSize: number, prevGapCenter: number | null, rng: Rng): number {
  const [min, max] = gapCenterRange(gapSize, prevGapCenter);
  return min + rng() * (max - min);
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function chooseRockSprites(obstacle: Obstacle, rng: Rng): void {
  const topLength = obstacle.gapCenter - obstacle.gapSize / 2;
  const bottomLength = FLOOR_Y - (obstacle.gapCenter + obstacle.gapSize / 2);

  if (topLength > TALL_ROCK_THRESHOLD) {
    obstacle.topSprite = pick(TALL_UP_ROCKS, rng);
    obstacle.topFlipped = true;
  } else {
    obstacle.topSprite = pick(SHORT_TOP_ROCKS, rng);
    obstacle.topFlipped = obstacle.topSprite !== HANGING_ROCK;
  }

  obstacle.bottomSprite = pick(bottomLength > TALL_ROCK_THRESHOLD ? TALL_UP_ROCKS : SHORT_UP_ROCKS, rng);
}

export function spawnObstacle(
  obstacle: Obstacle,
  x: number,
  gapSize: number,
  prevGapCenter: number | null,
  rng: Rng,
): void {
  obstacle.active = true;
  obstacle.x = x;
  obstacle.prevX = x;
  obstacle.gapSize = gapSize;
  obstacle.gapCenter = nextGapCenter(gapSize, prevGapCenter, rng);
  obstacle.passed = false;
  chooseRockSprites(obstacle, rng);
}

export function updateObstacles(field: ObstacleField, dt: number, rng: Rng): void {
  let rightmost = -Infinity;
  let free: Obstacle | null = null;

  for (const obstacle of field.obstacles) {
    if (obstacle.active) {
      obstacle.x -= field.speed * dt;
      if (obstacle.x + OBSTACLE_WIDTH / 2 < 0) obstacle.active = false;
      else rightmost = Math.max(rightmost, obstacle.x);
    }
    if (!obstacle.active && free === null) free = obstacle;
  }

  const spawnX = rightmost === -Infinity ? FIRST_OBSTACLE_X : rightmost + OBSTACLE_SPACING;
  if (spawnX > FIRST_OBSTACLE_X || free === null) return;

  spawnObstacle(free, spawnX, field.gapSize, field.lastGapCenter, rng);
  field.lastGapCenter = free.gapCenter;
}
