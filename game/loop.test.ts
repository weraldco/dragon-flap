import { describe, expect, it } from 'vitest';
import { MAX_STEPS_PER_FRAME, STEP } from './config';
import { advance } from './loop';

describe('advance', () => {
  it('runs no steps when less than one step has elapsed', () => {
    const clock = { acc: 0 };
    let steps = 0;
    const alpha = advance(clock, STEP / 2, () => {
      steps++;
    });
    expect(steps).toBe(0);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('runs one fixed step per elapsed STEP and keeps the remainder', () => {
    const clock = { acc: 0 };
    const dts: number[] = [];
    const alpha = advance(clock, STEP * 2.25, (dt) => {
      dts.push(dt);
    });
    expect(dts).toEqual([STEP, STEP]);
    expect(alpha).toBeCloseTo(0.25);
  });

  it('carries the remainder into the next frame', () => {
    const clock = { acc: 0 };
    let steps = 0;
    const count = () => {
      steps++;
    };
    advance(clock, STEP * 0.6, count);
    advance(clock, STEP * 0.6, count);
    expect(steps).toBe(1);
  });

  it('caps steps per frame and drops the backlog', () => {
    const clock = { acc: 0 };
    let steps = 0;
    advance(clock, 1, () => {
      steps++;
    });
    expect(steps).toBe(MAX_STEPS_PER_FRAME);
    expect(clock.acc).toBeLessThan(STEP);
  });

  it('ignores negative frame deltas', () => {
    const clock = { acc: 0 };
    let steps = 0;
    const alpha = advance(clock, -1, () => {
      steps++;
    });
    expect(steps).toBe(0);
    expect(alpha).toBe(0);
  });
});
