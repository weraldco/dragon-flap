import { MEDAL_THRESHOLDS } from './config';
import type { Medal, WorldState } from './types';

export function updateScore(field: Pick<WorldState, 'obstacles' | 'score'>, dragonX: number): boolean {
  let scored = false;
  for (const obstacle of field.obstacles) {
    if (obstacle.active && !obstacle.passed && obstacle.x <= dragonX) {
      obstacle.passed = true;
      field.score += 1;
      scored = true;
    }
  }
  return scored;
}

export function medalFor(score: number): Medal {
  if (score >= MEDAL_THRESHOLDS.platinum) return 'platinum';
  if (score >= MEDAL_THRESHOLDS.gold) return 'gold';
  if (score >= MEDAL_THRESHOLDS.silver) return 'silver';
  if (score >= MEDAL_THRESHOLDS.bronze) return 'bronze';
  return 'none';
}
