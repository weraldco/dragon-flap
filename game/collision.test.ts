import { describe, expect, it } from 'vitest';
import {
  DRAGON_BODY_HEIGHT,
  DRAGON_BODY_WIDTH,
  DRAGON_HITBOX_SCALE,
  DRAGON_X,
  FLOOR_Y,
  OBSTACLE_HITBOX_INSET,
  OBSTACLE_WIDTH,
} from './config';
import { dragonHitbox, hitsFloor, hitsObstacle } from './collision';
import { createDragon } from './physics';
import type { Obstacle } from './types';

function obstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    active: true,
    x: DRAGON_X,
    prevX: DRAGON_X,
    gapCenter: 400,
    gapSize: 190,
    passed: false,
    topSprite: 'rock-short-3',
    topFlipped: false,
    bottomSprite: 'rock-short-1',
    ...overrides,
  };
}

function dragonAt(y: number) {
  const d = createDragon();
  d.y = y;
  return dragonHitbox(d);
}

const halfHitboxHeight = (DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE) / 2;

describe('dragonHitbox', () => {
  it('is a centered box scaled down from the body size', () => {
    const box = dragonAt(300);
    expect(box.w).toBeCloseTo(DRAGON_BODY_WIDTH * DRAGON_HITBOX_SCALE);
    expect(box.h).toBeCloseTo(DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE);
    expect(box.x + box.w / 2).toBeCloseTo(DRAGON_X);
    expect(box.y + box.h / 2).toBeCloseTo(300);
  });

  it('writes into the provided rect', () => {
    const out = { x: 0, y: 0, w: 0, h: 0 };
    expect(dragonHitbox(createDragon(), out)).toBe(out);
  });
});

describe('hitsObstacle', () => {
  it('does not hit when the dragon is inside the gap', () => {
    expect(hitsObstacle(dragonAt(400), obstacle())).toBe(false);
  });

  it('hits the top column', () => {
    expect(hitsObstacle(dragonAt(320), obstacle())).toBe(true);
  });

  it('hits the bottom column', () => {
    expect(hitsObstacle(dragonAt(480), obstacle())).toBe(true);
  });

  it('hits the top column even when clamped at the ceiling', () => {
    expect(hitsObstacle(dragonAt(DRAGON_BODY_HEIGHT / 2), obstacle())).toBe(true);
  });

  it('ignores inactive obstacles', () => {
    expect(hitsObstacle(dragonAt(320), obstacle({ active: false }))).toBe(false);
  });

  it('forgives a near miss inside the horizontal inset', () => {
    const box = dragonAt(200);
    const boxRight = box.x + box.w;
    const spriteOverlapOnly = boxRight + OBSTACLE_WIDTH / 2 - OBSTACLE_HITBOX_INSET + 2;
    expect(spriteOverlapOnly - OBSTACLE_WIDTH / 2).toBeLessThan(boxRight);
    expect(hitsObstacle(box, obstacle({ x: spriteOverlapOnly }))).toBe(false);
    expect(hitsObstacle(box, obstacle({ x: spriteOverlapOnly - 4 }))).toBe(true);
  });
});

describe('hitsFloor', () => {
  it('hits when the hitbox bottom reaches the floor line', () => {
    expect(hitsFloor(dragonAt(FLOOR_Y - halfHitboxHeight + 0.01))).toBe(true);
    expect(hitsFloor(dragonAt(FLOOR_Y - halfHitboxHeight - 1))).toBe(false);
  });
});
