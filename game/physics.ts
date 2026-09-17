import {
  BOB_AMPLITUDE,
  BOB_SPEED,
  DRAGON_BODY_HEIGHT,
  DRAGON_START_Y,
  DRAGON_X,
  FLAP_POSE_TIME,
  FLAP_VELOCITY,
  GRAVITY,
  IDLE_FLAP_RATE,
  MAX_FALL_SPEED,
  POSE_DOWN_VELOCITY,
  POSE_UP_VELOCITY,
  ROTATION_DOWN,
  ROTATION_EASE,
  ROTATION_UP,
} from './config';
import type { Dragon, DragonPose, GameStatus } from './types';

export function createDragon(): Dragon {
  return {
    x: DRAGON_X,
    y: DRAGON_START_Y,
    prevY: DRAGON_START_Y,
    vy: 0,
    rotation: 0,
    prevRotation: 0,
    flapTimer: 0,
  };
}

export function flap(dragon: Dragon): void {
  dragon.vy = FLAP_VELOCITY;
  dragon.flapTimer = FLAP_POSE_TIME;
}

export function targetRotation(vy: number): number {
  if (vy < 0) return ROTATION_UP;
  const t = Math.min(vy / MAX_FALL_SPEED, 1);
  return ROTATION_UP + (ROTATION_DOWN - ROTATION_UP) * t;
}

export function stepDragon(dragon: Dragon, dt: number): void {
  dragon.vy = Math.min(dragon.vy + GRAVITY * dt, MAX_FALL_SPEED);
  dragon.y += dragon.vy * dt;

  const halfHeight = DRAGON_BODY_HEIGHT / 2;
  if (dragon.y - halfHeight < 0) {
    dragon.y = halfHeight;
    if (dragon.vy < 0) dragon.vy = 0;
  }

  dragon.flapTimer = Math.max(0, dragon.flapTimer - dt);
  const target = targetRotation(dragon.vy);
  dragon.rotation += (target - dragon.rotation) * Math.min(1, ROTATION_EASE * dt);
}

export function bobDragon(dragon: Dragon, time: number): void {
  dragon.y = DRAGON_START_Y + Math.sin(time * BOB_SPEED) * BOB_AMPLITUDE;
  dragon.vy = 0;
  dragon.rotation = 0;
}

export function poseFor(dragon: Dragon, status: GameStatus, time: number): DragonPose {
  if (status === 'dying' || status === 'gameover') return 'dragon-die';
  if (status === 'menu' || status === 'ready') {
    return Math.floor(time * IDLE_FLAP_RATE) % 2 === 0 ? 'dragon-fly-normal' : 'dragon-fly-up';
  }
  if (dragon.flapTimer > 0 || dragon.vy < POSE_UP_VELOCITY) return 'dragon-fly-up';
  if (dragon.vy > POSE_DOWN_VELOCITY) return 'dragon-fly-down';
  return 'dragon-fly-normal';
}
