import { describe, expect, it } from 'vitest';
import {
  BG_PARALLAX,
  BOB_AMPLITUDE,
  DRAGON_BODY_HEIGHT,
  DRAGON_HITBOX_SCALE,
  DRAGON_START_Y,
  DRAGON_X,
  FLASH_TIME,
  FLOOR_Y,
  GAMEOVER_DELAY,
  GAP_START,
  RAMP_GAP_STEP,
  RAMP_SPEED_STEP,
  SHAKE_TIME,
  SPEED_START,
  STEP,
} from './config';
import { advance } from './loop';
import { flap } from './physics';
import { mulberry32 } from './rng';
import { createStepEvents, createWorld, resetWorld, stepWorld } from './world';

function playingWorld(seed = 1) {
  const world = createWorld();
  resetWorld(world, 'ready');
  world.status = 'playing';
  return { world, rng: mulberry32(seed), events: createStepEvents() };
}

describe('createWorld', () => {
  it('starts in the menu with no active obstacles', () => {
    const world = createWorld();
    expect(world.status).toBe('menu');
    expect(world.score).toBe(0);
    expect(world.speed).toBe(SPEED_START);
    expect(world.gapSize).toBe(GAP_START);
    expect(world.obstacles.some((o) => o.active)).toBe(false);
  });
});

describe('stepWorld', () => {
  it('scrolls and bobs in the menu without spawning obstacles', () => {
    const world = createWorld();
    const rng = mulberry32(1);
    const events = createStepEvents();
    for (let i = 0; i < 60; i++) stepWorld(world, STEP, rng, events);
    expect(world.groundX).toBeCloseTo(SPEED_START);
    expect(world.bgX).toBeCloseTo(SPEED_START * BG_PARALLAX);
    expect(world.obstacles.some((o) => o.active)).toBe(false);
    expect(Math.abs(world.dragon.y - DRAGON_START_Y)).toBeLessThanOrEqual(BOB_AMPLITUDE);
  });

  it('does nothing while paused', () => {
    const { world, rng, events } = playingWorld();
    stepWorld(world, STEP, rng, events);
    world.status = 'paused';
    const { y } = world.dragon;
    const { groundX } = world;
    stepWorld(world, STEP, rng, events);
    expect(world.dragon.y).toBe(y);
    expect(world.dragon.prevY).toBe(y);
    expect(world.groundX).toBe(groundX);
  });

  it('falls to the floor, dies once, and reaches gameover after the delay', () => {
    const { world, rng, events } = playingWorld();
    let died = 0;
    let gameOvers = 0;
    for (let i = 0; i < 600 && world.status !== 'gameover'; i++) {
      stepWorld(world, STEP, rng, events);
      if (events.died) died++;
      if (events.gameOver) gameOvers++;
    }
    expect(died).toBe(1);
    expect(gameOvers).toBe(1);
    expect(world.status).toBe('gameover');
    expect(world.landed).toBe(true);
    expect(world.deathTimer).toBeGreaterThanOrEqual(GAMEOVER_DELAY);
    expect(world.dragon.y).toBeCloseTo(FLOOR_Y - (DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE) / 2);
  });

  it('stops scrolling while dying', () => {
    const { world, rng, events } = playingWorld();
    while (world.status === 'playing') stepWorld(world, STEP, rng, events);
    const { groundX } = world;
    stepWorld(world, STEP, rng, events);
    expect(world.groundX).toBe(groundX);
  });

  it('dies with shake and flash when hitting an obstacle', () => {
    const { world, rng, events } = playingWorld();
    Object.assign(world.obstacles[0], { active: true, x: DRAGON_X, prevX: DRAGON_X, gapCenter: 600, gapSize: 150 });
    stepWorld(world, STEP, rng, events);
    expect(events.died).toBe(true);
    expect(world.status).toBe('dying');
    expect(world.shakeTimer).toBe(SHAKE_TIME);
    expect(world.flashTimer).toBe(FLASH_TIME);
    expect(world.landed).toBe(false);
  });

  it('scores when passing an obstacle and ramps difficulty every 10 points', () => {
    const { world, rng, events } = playingWorld();
    world.score = 9;
    Object.assign(world.obstacles[0], {
      active: true,
      x: DRAGON_X + 1,
      prevX: DRAGON_X + 1,
      gapCenter: world.dragon.y,
      gapSize: 400,
    });
    stepWorld(world, STEP, rng, events);
    expect(events.scored).toBe(true);
    expect(world.score).toBe(10);
    expect(world.gapSize).toBe(GAP_START - RAMP_GAP_STEP);
    expect(world.speed).toBe(SPEED_START + RAMP_SPEED_STEP);
    expect(world.status).toBe('playing');
  });
});

describe('resetWorld', () => {
  it('returns to a clean state while reusing the dragon and obstacle pool', () => {
    const { world, rng, events } = playingWorld();
    const { dragon, obstacles } = world;
    for (let i = 0; i < 600 && world.status !== 'gameover'; i++) stepWorld(world, STEP, rng, events);
    resetWorld(world, 'ready');
    expect(world.dragon).toBe(dragon);
    expect(world.obstacles).toBe(obstacles);
    expect(world).toEqual({ ...createWorld(), status: 'ready' });
  });
});

describe('determinism', () => {
  it('produces the same world no matter how frame time is split', () => {
    const a = playingWorld(7);
    const b = playingWorld(7);
    const clockA = { acc: 0 };
    const clockB = { acc: 0 };
    for (let frame = 0; frame < 90; frame++) {
      if (frame % 12 === 0) {
        flap(a.world.dragon);
        flap(b.world.dragon);
      }
      advance(clockA, 4 * STEP, (dt) => stepWorld(a.world, dt, a.rng, a.events));
      advance(clockB, 2 * STEP, (dt) => stepWorld(b.world, dt, b.rng, b.events));
      advance(clockB, 2 * STEP, (dt) => stepWorld(b.world, dt, b.rng, b.events));
    }
    expect(b.world).toEqual(a.world);
  });
});
