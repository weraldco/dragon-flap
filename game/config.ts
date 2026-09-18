export const WIDTH = 432;
export const HEIGHT = 768;

export const STEP = 1 / 60;
export const MAX_FRAME_DT = 0.25;
export const MAX_STEPS_PER_FRAME = 5;

export const GRAVITY = 1800;
export const FLAP_VELOCITY = -540;
export const MAX_FALL_SPEED = 900;
export const FLAP_POSE_TIME = 0.12;
export const POSE_UP_VELOCITY = -150;
export const POSE_DOWN_VELOCITY = 250;
export const ROTATION_UP = (-25 * Math.PI) / 180;
export const ROTATION_DOWN = (70 * Math.PI) / 180;
export const ROTATION_EASE = 10;

export const DRAGON_X = WIDTH * 0.3;
export const DRAGON_START_Y = HEIGHT * 0.42;
export const DRAGON_DRAW_HEIGHT = 72;
export const DRAGON_BODY_WIDTH = 56;
export const DRAGON_BODY_HEIGHT = 64;
export const DRAGON_HITBOX_SCALE = 0.7;
export const BOB_AMPLITUDE = 8;
export const BOB_SPEED = 6;
export const IDLE_FLAP_RATE = 4;

export const FLOOR_DRAW_HEIGHT = 180;
export const FLOOR_Y = 680;
export const BG_PARALLAX = 0.2;

export const OBSTACLE_WIDTH = 78;
export const OBSTACLE_SPACING = 230;
export const OBSTACLE_HITBOX_INSET = 6;
export const OBSTACLE_POOL_SIZE = 4;
export const OBSTACLE_FLOOR_SINK = 40;
export const FIRST_OBSTACLE_X = WIDTH + 60;
export const TALL_ROCK_THRESHOLD = 220;

export const GAP_START = 190;
export const GAP_MIN = 150;
export const GAP_EDGE_MARGIN = 90;
export const GAP_MAX_SHIFT = 180;

export const SPEED_START = 160;
export const SPEED_MAX = 220;
export const RAMP_EVERY = 10;
export const RAMP_GAP_STEP = 8;
export const RAMP_SPEED_STEP = 8;

export const GAMEOVER_DELAY = 0.5;
export const SHAKE_TIME = 0.3;
export const SHAKE_MAGNITUDE = 6;
export const FLASH_TIME = 0.15;

export const MEDAL_THRESHOLDS = { bronze: 10, silver: 20, gold: 30, platinum: 40 } as const;
