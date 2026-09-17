import { describe, expect, it } from 'vitest';
import {
  BOB_AMPLITUDE,
  BOB_SPEED,
  DRAGON_BODY_HEIGHT,
  DRAGON_START_Y,
  DRAGON_X,
  FLAP_VELOCITY,
  GRAVITY,
  MAX_FALL_SPEED,
  ROTATION_DOWN,
  STEP,
} from './config';
import { bobDragon, createDragon, flap, poseFor, stepDragon } from './physics';

describe('createDragon', () => {
  it('starts at rest at the start position', () => {
    expect(createDragon()).toEqual({
      x: DRAGON_X,
      y: DRAGON_START_Y,
      prevY: DRAGON_START_Y,
      vy: 0,
      rotation: 0,
      prevRotation: 0,
      flapTimer: 0,
    });
  });
});

describe('stepDragon', () => {
  it('accelerates downward under gravity', () => {
    const d = createDragon();
    stepDragon(d, STEP);
    expect(d.vy).toBeCloseTo(GRAVITY * STEP);
    expect(d.y).toBeCloseTo(DRAGON_START_Y + GRAVITY * STEP * STEP);
  });

  it('caps the fall speed', () => {
    const d = createDragon();
    d.vy = MAX_FALL_SPEED - 5;
    stepDragon(d, STEP);
    expect(d.vy).toBe(MAX_FALL_SPEED);
  });

  it('clamps at the ceiling and cancels upward speed', () => {
    const d = createDragon();
    d.y = DRAGON_BODY_HEIGHT / 2 + 1;
    d.vy = FLAP_VELOCITY;
    stepDragon(d, STEP);
    expect(d.y).toBe(DRAGON_BODY_HEIGHT / 2);
    expect(d.vy).toBe(0);
  });

  it('tilts nose-up while rising and nose-down when falling fast', () => {
    const d = createDragon();
    flap(d);
    for (let i = 0; i < 10; i++) stepDragon(d, STEP);
    expect(d.rotation).toBeLessThan(0);

    for (let i = 0; i < 120; i++) {
      d.vy = MAX_FALL_SPEED;
      stepDragon(d, STEP);
    }
    expect(d.rotation).toBeCloseTo(ROTATION_DOWN, 3);
  });

  it('counts the flap pose timer down to zero', () => {
    const d = createDragon();
    flap(d);
    for (let i = 0; i < 8; i++) stepDragon(d, STEP);
    expect(d.flapTimer).toBe(0);
  });
});

describe('flap', () => {
  it('sets the upward velocity instead of adding to it', () => {
    const d = createDragon();
    d.vy = 300;
    flap(d);
    expect(d.vy).toBe(FLAP_VELOCITY);
    flap(d);
    expect(d.vy).toBe(FLAP_VELOCITY);
    expect(d.flapTimer).toBeGreaterThan(0);
  });
});

describe('bobDragon', () => {
  it('floats around the start height with no velocity or tilt', () => {
    const d = createDragon();
    d.vy = 200;
    d.rotation = 1;
    bobDragon(d, Math.PI / 2 / BOB_SPEED);
    expect(d.y).toBeCloseTo(DRAGON_START_Y + BOB_AMPLITUDE);
    expect(d.vy).toBe(0);
    expect(d.rotation).toBe(0);
  });
});

describe('poseFor', () => {
  it('uses the die pose after a crash', () => {
    const d = createDragon();
    expect(poseFor(d, 'dying', 0)).toBe('dragon-die');
    expect(poseFor(d, 'gameover', 0)).toBe('dragon-die');
  });

  it('alternates wings while idle', () => {
    const d = createDragon();
    expect(poseFor(d, 'menu', 0)).toBe('dragon-fly-normal');
    expect(poseFor(d, 'ready', 0.3)).toBe('dragon-fly-up');
  });

  it('follows velocity while playing', () => {
    const d = createDragon();
    d.flapTimer = 0.05;
    expect(poseFor(d, 'playing', 0)).toBe('dragon-fly-up');
    d.flapTimer = 0;
    d.vy = -200;
    expect(poseFor(d, 'playing', 0)).toBe('dragon-fly-up');
    d.vy = 300;
    expect(poseFor(d, 'playing', 0)).toBe('dragon-fly-down');
    d.vy = 0;
    expect(poseFor(d, 'playing', 0)).toBe('dragon-fly-normal');
  });
});
