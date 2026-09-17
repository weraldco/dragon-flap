export type GameStatus = 'menu' | 'ready' | 'playing' | 'paused' | 'dying' | 'gameover';

export type RockSprite =
  | 'rock-tall-1'
  | 'rock-tall-2'
  | 'rock-short-1'
  | 'rock-short-2'
  | 'rock-short-3'
  | 'rock-short-4';

export type DragonPose = 'dragon-fly-up' | 'dragon-fly-normal' | 'dragon-fly-down' | 'dragon-die';

export type SpriteKey = 'background' | 'floor' | DragonPose | RockSprite;

export type Medal = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export type Rng = () => number;

export interface Dragon {
  x: number;
  y: number;
  prevY: number;
  vy: number;
  rotation: number;
  prevRotation: number;
  flapTimer: number;
}

export interface Obstacle {
  active: boolean;
  x: number;
  prevX: number;
  gapCenter: number;
  gapSize: number;
  passed: boolean;
  topSprite: RockSprite;
  topFlipped: boolean;
  bottomSprite: RockSprite;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldState {
  status: GameStatus;
  time: number;
  score: number;
  speed: number;
  gapSize: number;
  dragon: Dragon;
  obstacles: Obstacle[];
  lastGapCenter: number | null;
  groundX: number;
  prevGroundX: number;
  bgX: number;
  prevBgX: number;
  deathTimer: number;
  landed: boolean;
  shakeTimer: number;
  flashTimer: number;
}

export interface StepEvents {
  scored: boolean;
  died: boolean;
  gameOver: boolean;
}

export interface GameOverResult {
  score: number;
  best: number;
  isNewBest: boolean;
  medal: Medal;
}
