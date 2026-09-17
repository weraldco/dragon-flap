import { MAX_FRAME_DT, MAX_STEPS_PER_FRAME, STEP } from './config';

export interface FixedClock {
  acc: number;
}

// Tolerance so float error in the accumulator never drops a whole step.
const EPSILON = 1e-9;

export function advance(clock: FixedClock, frameDt: number, step: (dt: number) => void): number {
  clock.acc += Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  let steps = 0;
  while (clock.acc >= STEP - EPSILON && steps < MAX_STEPS_PER_FRAME) {
    step(STEP);
    clock.acc -= STEP;
    steps++;
  }
  if (clock.acc >= STEP) clock.acc = 0;
  return Math.min(Math.max(clock.acc / STEP, 0), 1);
}
