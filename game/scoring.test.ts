import { describe, expect, it } from 'vitest';
import { DRAGON_X } from './config';
import { createObstaclePool } from './obstacles';
import { medalFor, updateScore } from './scoring';

describe('updateScore', () => {
  it('scores each obstacle exactly once when its center passes the dragon', () => {
    const field = { obstacles: createObstaclePool(), score: 0 };
    const o = field.obstacles[0];
    o.active = true;
    o.x = DRAGON_X + 1;

    expect(updateScore(field, DRAGON_X)).toBe(false);
    expect(field.score).toBe(0);

    o.x = DRAGON_X;
    expect(updateScore(field, DRAGON_X)).toBe(true);
    expect(field.score).toBe(1);

    o.x = DRAGON_X - 50;
    expect(updateScore(field, DRAGON_X)).toBe(false);
    expect(field.score).toBe(1);
  });

  it('ignores inactive obstacles', () => {
    const field = { obstacles: createObstaclePool(), score: 0 };
    field.obstacles[0].x = 0;
    expect(updateScore(field, DRAGON_X)).toBe(false);
  });
});

describe('medalFor', () => {
  it.each([
    [0, 'none'],
    [9, 'none'],
    [10, 'bronze'],
    [19, 'bronze'],
    [20, 'silver'],
    [30, 'gold'],
    [40, 'platinum'],
    [99, 'platinum'],
  ] as const)('score %i → %s', (score, medal) => {
    expect(medalFor(score)).toBe(medal);
  });
});
