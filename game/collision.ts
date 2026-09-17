import {
  DRAGON_BODY_HEIGHT,
  DRAGON_BODY_WIDTH,
  DRAGON_HITBOX_SCALE,
  FLOOR_Y,
  OBSTACLE_HITBOX_INSET,
  OBSTACLE_WIDTH,
} from './config';
import type { Dragon, Obstacle, Rect } from './types';

export function dragonHitbox(dragon: Dragon, out: Rect = { x: 0, y: 0, w: 0, h: 0 }): Rect {
  const w = DRAGON_BODY_WIDTH * DRAGON_HITBOX_SCALE;
  const h = DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE;
  out.x = dragon.x - w / 2;
  out.y = dragon.y - h / 2;
  out.w = w;
  out.h = h;
  return out;
}

export function hitsObstacle(box: Rect, obstacle: Obstacle): boolean {
  if (!obstacle.active) return false;
  const left = obstacle.x - OBSTACLE_WIDTH / 2 + OBSTACLE_HITBOX_INSET;
  const right = obstacle.x + OBSTACLE_WIDTH / 2 - OBSTACLE_HITBOX_INSET;
  if (box.x + box.w <= left || box.x >= right) return false;
  const gapTop = obstacle.gapCenter - obstacle.gapSize / 2;
  const gapBottom = obstacle.gapCenter + obstacle.gapSize / 2;
  return box.y < gapTop || box.y + box.h > gapBottom;
}

export function hitsFloor(box: Rect): boolean {
  return box.y + box.h >= FLOOR_Y;
}
