import { describe, expect, it } from 'vitest';
import {
  FIRST_OBSTACLE_X,
  FLOOR_Y,
  GAP_EDGE_MARGIN,
  GAP_MIN,
  GAP_START,
  OBSTACLE_POOL_SIZE,
  OBSTACLE_SPACING,
  OBSTACLE_WIDTH,
  SPEED_MAX,
  SPEED_START,
  STEP,
} from './config';
import {
  chooseRockSprites,
  createObstacle,
  createObstaclePool,
  difficultyFor,
  gapCenterRange,
  nextGapCenter,
  updateObstacles,
  type ObstacleField,
} from './obstacles';
import { mulberry32 } from './rng';

function field(): ObstacleField {
  return { obstacles: createObstaclePool(), speed: SPEED_START, gapSize: GAP_START, lastGapCenter: null };
}

describe('createObstaclePool', () => {
  it('creates inactive obstacles', () => {
    const pool = createObstaclePool();
    expect(pool).toHaveLength(OBSTACLE_POOL_SIZE);
    expect(pool.every((o) => !o.active)).toBe(true);
  });
});

describe('difficultyFor', () => {
  it.each([
    [0, GAP_START, SPEED_START],
    [9, GAP_START, SPEED_START],
    [10, GAP_START - 8, SPEED_START + 8],
    [25, GAP_START - 16, SPEED_START + 16],
    [1000, GAP_MIN, SPEED_MAX],
  ])('score %i → gap %i, speed %i', (score, gapSize, speed) => {
    expect(difficultyFor(score)).toEqual({ gapSize, speed });
  });
});

describe('gapCenterRange', () => {
  it('keeps gap edges away from the ceiling and floor', () => {
    expect(gapCenterRange(190, null)).toEqual([GAP_EDGE_MARGIN + 95, FLOOR_Y - GAP_EDGE_MARGIN - 95]);
  });

  it('limits how far the next gap can move from the previous one', () => {
    expect(gapCenterRange(190, 200)).toEqual([185, 380]);
    expect(gapCenterRange(190, 480)).toEqual([300, 495]);
  });
});

describe('nextGapCenter', () => {
  it('maps rng output across the allowed range', () => {
    expect(nextGapCenter(190, null, () => 0)).toBe(185);
    expect(nextGapCenter(190, null, () => 0.5)).toBe(340);
  });
});

describe('chooseRockSprites', () => {
  // gapCenter 300 / gapSize 190 → top column 205 px (short), bottom column 285 px (tall).
  it('uses a native top short rock and a bottom tall rock', () => {
    const o = createObstacle();
    o.gapCenter = 300;
    o.gapSize = 190;
    chooseRockSprites(o, () => 0.99);
    expect(o.topSprite).toBe('rock-short-3');
    expect(o.topFlipped).toBe(false);
    expect(o.bottomSprite).toBe('rock-tall-1');
  });

  it('uses rock-short-2 only on top and keeps it upright', () => {
    const o = createObstacle();
    o.gapCenter = 300;
    o.gapSize = 190;
    chooseRockSprites(o, () => 0);
    expect(o.topSprite).toBe('rock-short-2');
    expect(o.topFlipped).toBe(false);
  });

  // gapCenter 480 / gapSize 150 → top column 405 px (tall), bottom column 125 px (short).
  it('uses the native tall top rock and a bottom short rock', () => {
    const o = createObstacle();
    o.gapCenter = 480;
    o.gapSize = 150;
    chooseRockSprites(o, () => 0);
    expect(o.topSprite).toBe('rock-tall-2');
    expect(o.topFlipped).toBe(false);
    expect(o.bottomSprite).toBe('rock-short-1');
  });

  it('uses rock-short-4 only on the bottom', () => {
    const o = createObstacle();
    o.gapCenter = 480;
    o.gapSize = 150;
    chooseRockSprites(o, () => 0.99);
    expect(o.topSprite).toBe('rock-tall-2');
    expect(o.bottomSprite).toBe('rock-short-4');
  });
});

describe('updateObstacles', () => {
  it('spawns the first obstacle just off screen', () => {
    const f = field();
    updateObstacles(f, STEP, mulberry32(1));
    const active = f.obstacles.filter((o) => o.active);
    expect(active).toHaveLength(1);
    expect(active[0].x).toBe(FIRST_OBSTACLE_X);
    expect(f.lastGapCenter).toBe(active[0].gapCenter);
  });

  it('moves obstacles left and recycles them once off screen', () => {
    const f = field();
    Object.assign(f.obstacles[0], { active: true, x: -OBSTACLE_WIDTH / 2 + 1, gapCenter: 340 });
    Object.assign(f.obstacles[1], { active: true, x: 300, gapCenter: 340 });
    updateObstacles(f, STEP, mulberry32(1));
    expect(f.obstacles[0].active).toBe(false);
    expect(f.obstacles[1].x).toBeCloseTo(300 - SPEED_START * STEP);
  });

  it('keeps exact spacing, valid gaps, and never exhausts the pool over a long run', () => {
    const f = field();
    const rng = mulberry32(42);
    let spawns = 0;
    for (let i = 0; i < 60 * 20; i++) {
      const previousGap = f.lastGapCenter;
      updateObstacles(f, STEP, rng);
      if (f.lastGapCenter !== previousGap) spawns++;

      const active = f.obstacles.filter((o) => o.active);
      expect(active.length).toBeLessThanOrEqual(OBSTACLE_POOL_SIZE);
      const xs = active.map((o) => o.x).sort((a, b) => a - b);
      for (let j = 1; j < xs.length; j++) expect(xs[j] - xs[j - 1]).toBeCloseTo(OBSTACLE_SPACING, 6);
      for (const o of active) {
        expect(o.gapCenter - o.gapSize / 2).toBeGreaterThanOrEqual(GAP_EDGE_MARGIN);
        expect(o.gapCenter + o.gapSize / 2).toBeLessThanOrEqual(FLOOR_Y - GAP_EDGE_MARGIN);
      }
    }
    expect(spawns).toBeGreaterThanOrEqual(12);
  });
});
