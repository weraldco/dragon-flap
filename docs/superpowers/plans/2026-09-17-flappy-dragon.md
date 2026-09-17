# Flappy Dragon: Volcanic Ascent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser Flappy Bird remake themed as "Flappy Dragon: Volcanic Ascent" using the pixel-art sprites in `assets/`.

**Architecture:** A framework-free TypeScript game core in `game/` (pure simulation modules plus a thin browser runtime: renderer, audio, input, engine) drives an HTML5 canvas at a fixed 60 Hz timestep. React (Next.js App Router, client-only) renders menus and overlays with Tailwind and talks to the engine only through a small command API and three events.

**Tech Stack:** Next.js 16.3.5, React 19, TypeScript (strict), Tailwind CSS v4, Canvas 2D, Web Audio API, localStorage, Vitest 5.0.1, Playwright 1.63.0, pnpm 10, Pillow (asset prep script).

**Spec:** `docs/superpowers/specs/2026-09-17-flappy-dragon-design.md`

## Global Constraints

- Node 24, pnpm 10; Next.js pinned via `create-next-app@16.3.5`.
- Logical resolution 432×768 (portrait, 9:16). All game units are logical px and seconds.
- Physics steps at a fixed `STEP = 1/60 s`; frame delta capped at 250 ms; at most 5 steps per frame.
- `game/` never imports React. Pure modules (`config`, `types`, `rng`, `loop`, `physics`, `collision`, `obstacles`, `scoring`, `world`, `storage`) use no browser globals (except `getBrowserStore`, which guards `window`); randomness is injected as `rng: () => number`.
- React never runs the game loop and never re-renders per frame. Engine → React only via `onStatusChange`, `onScore`, `onGameOver`.
- Source art in `assets/` stays untouched; web-ready copies are generated into `public/assets/` by `scripts/prepare_assets.py`.
- localStorage key `flappy-dragon:v1`, shape `{ bestScore, settings: { muted, volume, reducedMotion } }`.
- Flap: Space / ArrowUp / W / primary pointerdown on the canvas; key repeat ignored. Pause toggle: Escape / P.
- Ceiling does not kill; floor and obstacles do. Game-over panel appears ≥ 0.5 s after death, once the dragon has landed.
- Medals: bronze ≥ 10, silver ≥ 20, gold ≥ 30, platinum ≥ 40.
- Tests seed randomness with `mulberry32`, never `Math.random`.
- Review gate: after every task, dispatch the `lgtm-reviewer` subagent (`.claude/agents/lgtm-reviewer.md`); proceed only on `LGTM` or `COMMENTS`.
- Commit messages end with the session attribution line provided by the environment.

**Refinement of the spec decided in this plan:** an internal `'dying'` status sits between `playing` and `gameover` (implements spec §5's fall + 0.5 s input lock). React treats it like `playing` without the pause button. The spec's engine command `reset` is split into `getReady()` and `showMenu()`.

---

## File Structure

```
scripts/prepare_assets.py         asset pipeline: erase caption, crop rocks, background → webp
public/assets/*                   generated sprites (committed)
app/layout.tsx                    font, metadata, viewport
app/page.tsx                      server page → <ClientGame/>
app/globals.css                   Tailwind + theme tokens + pixelated utility
components/ClientGame.tsx         'use client' dynamic(ssr:false) wrapper
components/GameRoot.tsx           UI state reducer, asset loading, wires engine ⇄ screens
components/GameCanvas.tsx         canvas element + engine lifecycle
components/GameFrame.tsx          9:16 scaled container (size container for cqw/cqh units)
components/ui/TextButton.tsx       pixel-styled text button
components/ui/ImageButton.tsx      sprite image button
components/ui/MedalBadge.tsx       CSS medal
components/screens/LoadingScreen.tsx
components/screens/MainMenu.tsx
components/screens/SettingsPanel.tsx
components/screens/GetReady.tsx
components/screens/ScoreHud.tsx
components/screens/PauseOverlay.tsx
components/screens/GameOver.tsx
game/config.ts                    tuning constants
game/types.ts                     shared types
game/rng.ts                       mulberry32 seeded rng
game/loop.ts                      fixed-timestep accumulator
game/storage.ts                   save data load/save
game/physics.ts                   dragon motion + pose
game/collision.ts                 hitboxes
game/obstacles.ts                 spawning, gaps, difficulty, sprite choice
game/scoring.ts                   pass detection, medals
game/world.ts                     world state + stepWorld
game/assets.ts                    sprite manifest + loader (browser)
game/renderer.ts                  canvas drawing (browser)
game/audio.ts                     AudioManager (browser)
game/input.ts                     keyboard/pointer binding (browser)
game/engine.ts                    rAF loop + command API (browser)
e2e/smoke.spec.ts                 Playwright smoke test
vitest.config.mts, playwright.config.ts, README.md
```

---

### Task 1: Scaffold Next.js app, tooling, and web-ready assets

**Files:**
- Create: Next.js scaffold (via `create-next-app`), `scripts/prepare_assets.py`, `public/assets/*`, `vitest.config.mts`
- Modify: `package.json` (scripts, devDependencies), `.gitignore`, `app/page.tsx`, `app/globals.css`
- Delete: scaffold sample files `public/*.svg`

**Interfaces:**
- Consumes: source art `assets/*.png`
- Produces: `public/assets/{background.webp, floor.png, dragon-fly-up.png, dragon-fly-normal.png, dragon-fly-down.png, dragon-die.png, rock-tall-1.png, rock-tall-2.png, rock-short-1.png, rock-short-2.png, rock-short-3.png, rock-short-4.png, title.png, start.png, menu.png, restart.png, gameover.png}`; package scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`; import alias `@/*` → repo root.

- [x] **Step 1: Scaffold into a temp directory and copy in**

`create-next-app` refuses a folder containing `assets/`, so scaffold elsewhere and copy.

```bash
cd /Users/MAC/Projects/PERSONAL/flappybirddy
SCAFFOLD="$(mktemp -d)/flappy-dragon"
pnpm create next-app@16.3.5 "$SCAFFOLD" --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-pnpm --skip-install --disable-git --yes
rsync -a --exclude node_modules --exclude .git "$SCAFFOLD"/ ./
rm -f public/*.svg
pnpm install
```

Expected: `app/`, `package.json`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts` exist at the repo root; `assets/`, `docs/`, `.claude/` untouched.

- [x] **Step 2: Add test tooling and scripts**

```bash
pnpm add -D vitest@5.0.1 @playwright/test@1.63.0
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.test="vitest run --passWithNoTests"
npm pkg set scripts.test:e2e="playwright test"
```

Create `vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['game/**/*.test.ts'],
    environment: 'node',
  },
});
```

Append to `.gitignore`:

```
# playwright
/test-results/
/playwright-report/
/playwright/.cache/
```

- [x] **Step 3: Replace the scaffold sample page and styles with a placeholder**

`app/page.tsx`:

```tsx
export default function Home() {
  return <main className="flex h-dvh items-center justify-center">Flappy Dragon</main>;
}
```

`app/globals.css`:

```css
@import "tailwindcss";
```

(Task 10 replaces both. Leave `app/layout.tsx` as scaffolded for now.)

- [x] **Step 4: Write the asset pipeline script**

Create `scripts/prepare_assets.py`:

```python
#!/usr/bin/env python3
"""Build web-ready sprites in public/assets from the source art in assets/."""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets"
OUT = ROOT / "public" / "assets"
# dragon-fly-down.png carries a stray "and the" caption in rows 0-2; the body starts at row 69.
FLY_DOWN_CAPTION_ROWS = 20


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src in sorted(SRC.glob("*.png")):
        img = Image.open(src).convert("RGBA")
        name = src.stem
        if name == "dragon-fly-down":
            img.paste((0, 0, 0, 0), (0, 0, img.width, FLY_DOWN_CAPTION_ROWS))
        if name.startswith("rock-"):
            bbox = img.getchannel("A").getbbox()
            if bbox:
                img = img.crop(bbox)
        if name == "background":
            dest = OUT / "background.webp"
            img.save(dest, "WEBP", quality=90, method=6)
        else:
            dest = OUT / f"{name}.png"
            img.save(dest, "PNG", optimize=True)
        print(f"{dest.relative_to(ROOT)}  {img.width}x{img.height}  {dest.stat().st_size // 1024} KB")

    fly_down = Image.open(OUT / "dragon-fly-down.png").getchannel("A").getbbox()
    assert fly_down is not None and fly_down[1] >= 60, f"caption not removed: bbox={fly_down}"


if __name__ == "__main__":
    main()
```

- [x] **Step 5: Run the pipeline and verify output**

Run: `python3 scripts/prepare_assets.py && ls public/assets | wc -l`
Expected: 17 `public/assets/...` lines, no assertion error, count `17`; `background.webp` well under the 1.4 MB source.

- [x] **Step 6: Verify the scaffold builds and checks pass**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all succeed (Vitest finds no test files and exits 0).

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app, test tooling, and web-ready assets"
```

- [x] **Step 8: Review gate** — dispatch `lgtm-reviewer` (mid-tier model) with this task, the implementer report, and base commit `4476ee1`.

---

### Task 2: Game constants, shared types, seeded rng, fixed-timestep loop

**Files:**
- Create: `game/config.ts`, `game/types.ts`, `game/rng.ts`, `game/loop.ts`
- Test: `game/rng.test.ts`, `game/loop.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `game/types.ts`: `GameStatus`, `RockSprite`, `DragonPose`, `SpriteKey`, `Medal`, `Rng`, `Dragon`, `Obstacle`, `Rect`, `WorldState`, `StepEvents`, `GameOverResult` (definitions below)
  - `game/config.ts`: all constants below
  - `game/rng.ts`: `mulberry32(seed: number): Rng`
  - `game/loop.ts`: `interface FixedClock { acc: number }`; `advance(clock: FixedClock, frameDt: number, step: (dt: number) => void): number` (returns interpolation alpha in [0, 1])

- [x] **Step 1: Write the types**

`game/types.ts`:

```ts
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
```

- [x] **Step 2: Write the config**

`game/config.ts`:

```ts
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
export const DRAGON_DRAW_HEIGHT = 64;
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
```

- [x] **Step 3: Write failing tests for rng and loop**

`game/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });

  it('produces different sequences for different seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('returns values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
```

`game/loop.test.ts`:

```ts
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
```

- [x] **Step 4: Run tests to verify they fail**

Run: `pnpm vitest run game/rng.test.ts game/loop.test.ts`
Expected: FAIL — cannot resolve `./rng` and `./loop`.

- [x] **Step 5: Implement rng and loop**

`game/rng.ts`:

```ts
import type { Rng } from './types';

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`game/loop.ts`:

```ts
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
```

- [x] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run game/rng.test.ts game/loop.test.ts && pnpm typecheck`
Expected: 8 tests PASS; typecheck clean.

- [x] **Step 7: Commit**

```bash
git add game/config.ts game/types.ts game/rng.ts game/rng.test.ts game/loop.ts game/loop.test.ts
git commit -m "feat(game): add config, shared types, seeded rng, and fixed-timestep loop"
```

- [x] **Step 8: Review gate** — dispatch `lgtm-reviewer` (most capable model: engine loop).

---

### Task 3: Save data storage

**Files:**
- Create: `game/storage.ts`
- Test: `game/storage.test.ts`

**Interfaces:**
- Produces:
  - `interface Settings { muted: boolean; volume: number; reducedMotion: boolean }`
  - `interface SaveData { bestScore: number; settings: Settings }`
  - `type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>`
  - `const STORAGE_KEY = 'flappy-dragon:v1'`
  - `defaultSaveData(prefersReducedMotion: boolean): SaveData`
  - `isSaveData(value: unknown): value is SaveData`
  - `loadSaveData(store: KeyValueStore | undefined, prefersReducedMotion: boolean): SaveData`
  - `saveSaveData(store: KeyValueStore | undefined, data: SaveData): boolean`
  - `getBrowserStore(): KeyValueStore | undefined` (guards `window`; returns `undefined` if access throws)

- [x] **Step 1: Write the failing tests**

`game/storage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  defaultSaveData,
  isSaveData,
  loadSaveData,
  saveSaveData,
  STORAGE_KEY,
  type KeyValueStore,
  type SaveData,
} from './storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const throwingStore: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

const sample: SaveData = { bestScore: 12, settings: { muted: true, volume: 0.5, reducedMotion: false } };

describe('defaultSaveData', () => {
  it('starts at zero with sound on and follows the reduced motion preference', () => {
    expect(defaultSaveData(true)).toEqual({
      bestScore: 0,
      settings: { muted: false, volume: 0.8, reducedMotion: true },
    });
  });
});

describe('isSaveData', () => {
  it('accepts a valid save', () => {
    expect(isSaveData(sample)).toBe(true);
  });

  it.each([
    ['null', null],
    ['negative score', { ...sample, bestScore: -1 }],
    ['fractional score', { ...sample, bestScore: 1.5 }],
    ['string score', { ...sample, bestScore: '3' }],
    ['volume above 1', { ...sample, settings: { ...sample.settings, volume: 3 } }],
    ['missing settings', { bestScore: 1 }],
    ['non-boolean muted', { ...sample, settings: { ...sample.settings, muted: 'yes' } }],
  ])('rejects %s', (_label, value) => {
    expect(isSaveData(value)).toBe(false);
  });
});

describe('loadSaveData', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSaveData(memoryStore(), false)).toEqual(defaultSaveData(false));
  });

  it('returns defaults when storage is unavailable', () => {
    expect(loadSaveData(undefined, true)).toEqual(defaultSaveData(true));
  });

  it('returns defaults when the stored JSON is corrupt', () => {
    expect(loadSaveData(memoryStore({ [STORAGE_KEY]: '{nope' }), false)).toEqual(defaultSaveData(false));
  });

  it('returns defaults when the stored shape is invalid', () => {
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify({ bestScore: 'high' }) });
    expect(loadSaveData(store, false)).toEqual(defaultSaveData(false));
  });

  it('returns defaults when reading throws', () => {
    expect(loadSaveData(throwingStore, false)).toEqual(defaultSaveData(false));
  });
});

describe('saveSaveData', () => {
  it('round-trips through loadSaveData', () => {
    const store = memoryStore();
    expect(saveSaveData(store, sample)).toBe(true);
    expect(loadSaveData(store, false)).toEqual(sample);
  });

  it('returns false when writing throws', () => {
    expect(saveSaveData(throwingStore, sample)).toBe(false);
  });

  it('returns false when storage is unavailable', () => {
    expect(saveSaveData(undefined, sample)).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run game/storage.test.ts`
Expected: FAIL — cannot resolve `./storage`.

- [x] **Step 3: Implement storage**

`game/storage.ts`:

```ts
export interface Settings {
  muted: boolean;
  volume: number;
  reducedMotion: boolean;
}

export interface SaveData {
  bestScore: number;
  settings: Settings;
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export const STORAGE_KEY = 'flappy-dragon:v1';

export function defaultSaveData(prefersReducedMotion: boolean): SaveData {
  return { bestScore: 0, settings: { muted: false, volume: 0.8, reducedMotion: prefersReducedMotion } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSaveData(value: unknown): value is SaveData {
  if (!isRecord(value) || !isRecord(value.settings)) return false;
  const { bestScore, settings } = value;
  return (
    typeof bestScore === 'number' &&
    Number.isInteger(bestScore) &&
    bestScore >= 0 &&
    typeof settings.muted === 'boolean' &&
    typeof settings.reducedMotion === 'boolean' &&
    typeof settings.volume === 'number' &&
    Number.isFinite(settings.volume) &&
    settings.volume >= 0 &&
    settings.volume <= 1
  );
}

export function loadSaveData(store: KeyValueStore | undefined, prefersReducedMotion: boolean): SaveData {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return defaultSaveData(prefersReducedMotion);
    const parsed: unknown = JSON.parse(raw);
    return isSaveData(parsed) ? parsed : defaultSaveData(prefersReducedMotion);
  } catch {
    return defaultSaveData(prefersReducedMotion);
  }
}

export function saveSaveData(store: KeyValueStore | undefined, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getBrowserStore(): KeyValueStore | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run game/storage.test.ts && pnpm typecheck`
Expected: 17 tests PASS; typecheck clean.

- [x] **Step 5: Commit**

```bash
git add game/storage.ts game/storage.test.ts
git commit -m "feat(game): add validated localStorage save data"
```

- [x] **Step 6: Review gate** — dispatch `lgtm-reviewer` (mid-tier model).

---

### Task 4: Dragon physics and pose

**Files:**
- Create: `game/physics.ts`
- Test: `game/physics.test.ts`

**Interfaces:**
- Consumes: `Dragon`, `DragonPose`, `GameStatus` (`game/types.ts`); constants (`game/config.ts`)
- Produces:
  - `createDragon(): Dragon`
  - `flap(dragon: Dragon): void`
  - `targetRotation(vy: number): number`
  - `stepDragon(dragon: Dragon, dt: number): void`
  - `bobDragon(dragon: Dragon, time: number): void`
  - `poseFor(dragon: Dragon, status: GameStatus, time: number): DragonPose`

- [x] **Step 1: Write the failing tests**

`game/physics.test.ts`:

```ts
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run game/physics.test.ts`
Expected: FAIL — cannot resolve `./physics`.

- [x] **Step 3: Implement physics**

`game/physics.ts`:

```ts
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
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run game/physics.test.ts && pnpm typecheck`
Expected: 11 tests PASS; typecheck clean.

- [x] **Step 5: Commit**

```bash
git add game/physics.ts game/physics.test.ts
git commit -m "feat(game): add dragon physics, tilt, and pose selection"
```

- [x] **Step 6: Review gate** — dispatch `lgtm-reviewer` (most capable model: physics).

---

### Task 5: Collision

**Files:**
- Create: `game/collision.ts`
- Test: `game/collision.test.ts`

**Interfaces:**
- Consumes: `Dragon`, `Obstacle`, `Rect` (`game/types.ts`); `createDragon` (`game/physics.ts`, tests)
- Produces:
  - `dragonHitbox(dragon: Dragon, out?: Rect): Rect` (writes into `out` when given, to avoid per-step allocation)
  - `hitsObstacle(box: Rect, obstacle: Obstacle): boolean` (inactive obstacles never hit; the top column extends infinitely upward, the bottom column infinitely downward)
  - `hitsFloor(box: Rect): boolean` (hitbox bottom ≥ `FLOOR_Y`)

- [x] **Step 1: Write the failing tests**

`game/collision.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DRAGON_BODY_HEIGHT,
  DRAGON_BODY_WIDTH,
  DRAGON_HITBOX_SCALE,
  DRAGON_X,
  FLOOR_Y,
  OBSTACLE_HITBOX_INSET,
  OBSTACLE_WIDTH,
} from './config';
import { dragonHitbox, hitsFloor, hitsObstacle } from './collision';
import { createDragon } from './physics';
import type { Obstacle } from './types';

function obstacle(overrides: Partial<Obstacle> = {}): Obstacle {
  return {
    active: true,
    x: DRAGON_X,
    prevX: DRAGON_X,
    gapCenter: 400,
    gapSize: 190,
    passed: false,
    topSprite: 'rock-short-3',
    topFlipped: false,
    bottomSprite: 'rock-short-1',
    ...overrides,
  };
}

function dragonAt(y: number) {
  const d = createDragon();
  d.y = y;
  return dragonHitbox(d);
}

const halfHitboxHeight = (DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE) / 2;

describe('dragonHitbox', () => {
  it('is a centered box scaled down from the body size', () => {
    const box = dragonAt(300);
    expect(box.w).toBeCloseTo(DRAGON_BODY_WIDTH * DRAGON_HITBOX_SCALE);
    expect(box.h).toBeCloseTo(DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE);
    expect(box.x + box.w / 2).toBeCloseTo(DRAGON_X);
    expect(box.y + box.h / 2).toBeCloseTo(300);
  });

  it('writes into the provided rect', () => {
    const out = { x: 0, y: 0, w: 0, h: 0 };
    expect(dragonHitbox(createDragon(), out)).toBe(out);
  });
});

describe('hitsObstacle', () => {
  it('does not hit when the dragon is inside the gap', () => {
    expect(hitsObstacle(dragonAt(400), obstacle())).toBe(false);
  });

  it('hits the top column', () => {
    expect(hitsObstacle(dragonAt(320), obstacle())).toBe(true);
  });

  it('hits the bottom column', () => {
    expect(hitsObstacle(dragonAt(480), obstacle())).toBe(true);
  });

  it('hits the top column even when clamped at the ceiling', () => {
    expect(hitsObstacle(dragonAt(DRAGON_BODY_HEIGHT / 2), obstacle())).toBe(true);
  });

  it('ignores inactive obstacles', () => {
    expect(hitsObstacle(dragonAt(320), obstacle({ active: false }))).toBe(false);
  });

  it('forgives a near miss inside the horizontal inset', () => {
    const box = dragonAt(200);
    const boxRight = box.x + box.w;
    const spriteOverlapOnly = boxRight + OBSTACLE_WIDTH / 2 - OBSTACLE_HITBOX_INSET + 2;
    expect(spriteOverlapOnly - OBSTACLE_WIDTH / 2).toBeLessThan(boxRight);
    expect(hitsObstacle(box, obstacle({ x: spriteOverlapOnly }))).toBe(false);
    expect(hitsObstacle(box, obstacle({ x: spriteOverlapOnly - 4 }))).toBe(true);
  });
});

describe('hitsFloor', () => {
  it('hits when the hitbox bottom reaches the floor line', () => {
    expect(hitsFloor(dragonAt(FLOOR_Y - halfHitboxHeight + 0.01))).toBe(true);
    expect(hitsFloor(dragonAt(FLOOR_Y - halfHitboxHeight - 1))).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run game/collision.test.ts`
Expected: FAIL — cannot resolve `./collision`.

- [x] **Step 3: Implement collision**

`game/collision.ts`:

```ts
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
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run game/collision.test.ts && pnpm typecheck`
Expected: 9 tests PASS; typecheck clean.

- [x] **Step 5: Commit**

```bash
git add game/collision.ts game/collision.test.ts
git commit -m "feat(game): add forgiving hitbox collision"
```

- [x] **Step 6: Review gate** — dispatch `lgtm-reviewer` (most capable model: collision).

---

### Task 6: Obstacles, difficulty, and scoring

**Files:**
- Create: `game/obstacles.ts`, `game/scoring.ts`
- Test: `game/obstacles.test.ts`, `game/scoring.test.ts`

**Interfaces:**
- Consumes: `Obstacle`, `RockSprite`, `Rng`, `WorldState`, `Medal` (`game/types.ts`); `mulberry32` (`game/rng.ts`, tests)
- Produces:
  - `game/obstacles.ts`:
    - `type ObstacleField = Pick<WorldState, 'obstacles' | 'speed' | 'gapSize' | 'lastGapCenter'>`
    - `createObstacle(): Obstacle`
    - `createObstaclePool(size?: number): Obstacle[]`
    - `difficultyFor(score: number): { gapSize: number; speed: number }`
    - `gapCenterRange(gapSize: number, prevGapCenter: number | null): [min: number, max: number]`
    - `nextGapCenter(gapSize: number, prevGapCenter: number | null, rng: Rng): number`
    - `chooseRockSprites(obstacle: Obstacle, rng: Rng): void`
    - `spawnObstacle(obstacle: Obstacle, x: number, gapSize: number, prevGapCenter: number | null, rng: Rng): void`
    - `updateObstacles(field: ObstacleField, dt: number, rng: Rng): void`
  - `game/scoring.ts`:
    - `updateScore(field: Pick<WorldState, 'obstacles' | 'score'>, dragonX: number): boolean`
    - `medalFor(score: number): Medal`

- [x] **Step 1: Write the failing obstacle tests**

`game/obstacles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  FIRST_OBSTACLE_X,
  FLOOR_Y,
  GAP_EDGE_MARGIN,
  GAP_MIN,
  GAP_START,
  OBSTACLE_POOL_SIZE,
  OBSTACLE_SPACING,
  OBSTACLE_WIDTH,
  SPEED_MAX,
  SPEED_START,
  STEP,
} from './config';
import {
  chooseRockSprites,
  createObstacle,
  createObstaclePool,
  difficultyFor,
  gapCenterRange,
  nextGapCenter,
  updateObstacles,
  type ObstacleField,
} from './obstacles';
import { mulberry32 } from './rng';

function field(): ObstacleField {
  return { obstacles: createObstaclePool(), speed: SPEED_START, gapSize: GAP_START, lastGapCenter: null };
}

describe('createObstaclePool', () => {
  it('creates inactive obstacles', () => {
    const pool = createObstaclePool();
    expect(pool).toHaveLength(OBSTACLE_POOL_SIZE);
    expect(pool.every((o) => !o.active)).toBe(true);
  });
});

describe('difficultyFor', () => {
  it.each([
    [0, GAP_START, SPEED_START],
    [9, GAP_START, SPEED_START],
    [10, GAP_START - 8, SPEED_START + 8],
    [25, GAP_START - 16, SPEED_START + 16],
    [1000, GAP_MIN, SPEED_MAX],
  ])('score %i → gap %i, speed %i', (score, gapSize, speed) => {
    expect(difficultyFor(score)).toEqual({ gapSize, speed });
  });
});

describe('gapCenterRange', () => {
  it('keeps gap edges away from the ceiling and floor', () => {
    expect(gapCenterRange(190, null)).toEqual([GAP_EDGE_MARGIN + 95, FLOOR_Y - GAP_EDGE_MARGIN - 95]);
  });

  it('limits how far the next gap can move from the previous one', () => {
    expect(gapCenterRange(190, 200)).toEqual([185, 380]);
    expect(gapCenterRange(190, 480)).toEqual([300, 495]);
  });
});

describe('nextGapCenter', () => {
  it('maps rng output across the allowed range', () => {
    expect(nextGapCenter(190, null, () => 0)).toBe(185);
    expect(nextGapCenter(190, null, () => 0.5)).toBe(340);
  });
});

describe('chooseRockSprites', () => {
  // gapCenter 300 / gapSize 190 → top column 205 px (short), bottom column 285 px (tall).
  it('uses short rocks for short columns and tall rocks for long ones', () => {
    const o = createObstacle();
    o.gapCenter = 300;
    o.gapSize = 190;
    chooseRockSprites(o, () => 0.99);
    expect(o.topSprite).toBe('rock-short-3');
    expect(o.topFlipped).toBe(false);
    expect(o.bottomSprite).toBe('rock-tall-2');
  });

  it('flips upward rocks used on top', () => {
    const o = createObstacle();
    o.gapCenter = 300;
    o.gapSize = 190;
    chooseRockSprites(o, () => 0);
    expect(o.topSprite).toBe('rock-short-1');
    expect(o.topFlipped).toBe(true);
  });

  // gapCenter 480 / gapSize 150 → top column 405 px (tall), bottom column 125 px (short).
  it('flips tall rocks used on top', () => {
    const o = createObstacle();
    o.gapCenter = 480;
    o.gapSize = 150;
    chooseRockSprites(o, () => 0);
    expect(o.topSprite).toBe('rock-tall-1');
    expect(o.topFlipped).toBe(true);
    expect(o.bottomSprite).toBe('rock-short-1');
  });
});

describe('updateObstacles', () => {
  it('spawns the first obstacle just off screen', () => {
    const f = field();
    updateObstacles(f, STEP, mulberry32(1));
    const active = f.obstacles.filter((o) => o.active);
    expect(active).toHaveLength(1);
    expect(active[0].x).toBe(FIRST_OBSTACLE_X);
    expect(f.lastGapCenter).toBe(active[0].gapCenter);
  });

  it('moves obstacles left and recycles them once off screen', () => {
    const f = field();
    Object.assign(f.obstacles[0], { active: true, x: -OBSTACLE_WIDTH / 2 + 1, gapCenter: 340 });
    Object.assign(f.obstacles[1], { active: true, x: 300, gapCenter: 340 });
    updateObstacles(f, STEP, mulberry32(1));
    expect(f.obstacles[0].active).toBe(false);
    expect(f.obstacles[1].x).toBeCloseTo(300 - SPEED_START * STEP);
  });

  it('keeps exact spacing, valid gaps, and never exhausts the pool over a long run', () => {
    const f = field();
    const rng = mulberry32(42);
    let spawns = 0;
    for (let i = 0; i < 60 * 20; i++) {
      const previousGap = f.lastGapCenter;
      updateObstacles(f, STEP, rng);
      if (f.lastGapCenter !== previousGap) spawns++;

      const active = f.obstacles.filter((o) => o.active);
      expect(active.length).toBeLessThanOrEqual(OBSTACLE_POOL_SIZE);
      const xs = active.map((o) => o.x).sort((a, b) => a - b);
      for (let j = 1; j < xs.length; j++) expect(xs[j] - xs[j - 1]).toBeCloseTo(OBSTACLE_SPACING, 6);
      for (const o of active) {
        expect(o.gapCenter - o.gapSize / 2).toBeGreaterThanOrEqual(GAP_EDGE_MARGIN);
        expect(o.gapCenter + o.gapSize / 2).toBeLessThanOrEqual(FLOOR_Y - GAP_EDGE_MARGIN);
      }
    }
    expect(spawns).toBeGreaterThanOrEqual(12);
  });
});
```

- [x] **Step 2: Write the failing scoring tests**

`game/scoring.test.ts`:

```ts
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
```

- [x] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run game/obstacles.test.ts game/scoring.test.ts`
Expected: FAIL — cannot resolve `./obstacles` and `./scoring`.

- [x] **Step 4: Implement obstacles**

`game/obstacles.ts`:

```ts
import {
  FIRST_OBSTACLE_X,
  FLOOR_Y,
  GAP_EDGE_MARGIN,
  GAP_MAX_SHIFT,
  GAP_MIN,
  GAP_START,
  OBSTACLE_POOL_SIZE,
  OBSTACLE_SPACING,
  OBSTACLE_WIDTH,
  RAMP_EVERY,
  RAMP_GAP_STEP,
  RAMP_SPEED_STEP,
  SPEED_MAX,
  SPEED_START,
  TALL_ROCK_THRESHOLD,
} from './config';
import type { Obstacle, RockSprite, Rng, WorldState } from './types';

export type ObstacleField = Pick<WorldState, 'obstacles' | 'speed' | 'gapSize' | 'lastGapCenter'>;

const HANGING_ROCK: RockSprite = 'rock-short-3';
const SHORT_UP_ROCKS: readonly RockSprite[] = ['rock-short-1', 'rock-short-2', 'rock-short-4'];
const TALL_UP_ROCKS: readonly RockSprite[] = ['rock-tall-1', 'rock-tall-2'];
const SHORT_TOP_ROCKS: readonly RockSprite[] = [...SHORT_UP_ROCKS, HANGING_ROCK];

export function createObstacle(): Obstacle {
  return {
    active: false,
    x: 0,
    prevX: 0,
    gapCenter: 0,
    gapSize: GAP_START,
    passed: false,
    topSprite: HANGING_ROCK,
    topFlipped: false,
    bottomSprite: 'rock-short-1',
  };
}

export function createObstaclePool(size = OBSTACLE_POOL_SIZE): Obstacle[] {
  return Array.from({ length: size }, createObstacle);
}

export function difficultyFor(score: number): { gapSize: number; speed: number } {
  const level = Math.floor(score / RAMP_EVERY);
  return {
    gapSize: Math.max(GAP_MIN, GAP_START - level * RAMP_GAP_STEP),
    speed: Math.min(SPEED_MAX, SPEED_START + level * RAMP_SPEED_STEP),
  };
}

export function gapCenterRange(gapSize: number, prevGapCenter: number | null): [min: number, max: number] {
  let min = GAP_EDGE_MARGIN + gapSize / 2;
  let max = FLOOR_Y - GAP_EDGE_MARGIN - gapSize / 2;
  if (prevGapCenter !== null) {
    min = Math.max(min, prevGapCenter - GAP_MAX_SHIFT);
    max = Math.min(max, prevGapCenter + GAP_MAX_SHIFT);
  }
  return [min, max];
}

export function nextGapCenter(gapSize: number, prevGapCenter: number | null, rng: Rng): number {
  const [min, max] = gapCenterRange(gapSize, prevGapCenter);
  return min + rng() * (max - min);
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function chooseRockSprites(obstacle: Obstacle, rng: Rng): void {
  const topLength = obstacle.gapCenter - obstacle.gapSize / 2;
  const bottomLength = FLOOR_Y - (obstacle.gapCenter + obstacle.gapSize / 2);

  if (topLength > TALL_ROCK_THRESHOLD) {
    obstacle.topSprite = pick(TALL_UP_ROCKS, rng);
    obstacle.topFlipped = true;
  } else {
    obstacle.topSprite = pick(SHORT_TOP_ROCKS, rng);
    obstacle.topFlipped = obstacle.topSprite !== HANGING_ROCK;
  }

  obstacle.bottomSprite = pick(bottomLength > TALL_ROCK_THRESHOLD ? TALL_UP_ROCKS : SHORT_UP_ROCKS, rng);
}

export function spawnObstacle(
  obstacle: Obstacle,
  x: number,
  gapSize: number,
  prevGapCenter: number | null,
  rng: Rng,
): void {
  obstacle.active = true;
  obstacle.x = x;
  obstacle.prevX = x;
  obstacle.gapSize = gapSize;
  obstacle.gapCenter = nextGapCenter(gapSize, prevGapCenter, rng);
  obstacle.passed = false;
  chooseRockSprites(obstacle, rng);
}

export function updateObstacles(field: ObstacleField, dt: number, rng: Rng): void {
  let rightmost = -Infinity;
  let free: Obstacle | null = null;

  for (const obstacle of field.obstacles) {
    if (obstacle.active) {
      obstacle.x -= field.speed * dt;
      if (obstacle.x + OBSTACLE_WIDTH / 2 < 0) obstacle.active = false;
      else rightmost = Math.max(rightmost, obstacle.x);
    }
    if (!obstacle.active && free === null) free = obstacle;
  }

  const spawnX = rightmost === -Infinity ? FIRST_OBSTACLE_X : rightmost + OBSTACLE_SPACING;
  if (spawnX > FIRST_OBSTACLE_X || free === null) return;

  spawnObstacle(free, spawnX, field.gapSize, field.lastGapCenter, rng);
  field.lastGapCenter = free.gapCenter;
}
```

- [x] **Step 5: Implement scoring**

`game/scoring.ts`:

```ts
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
```

- [x] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run game/obstacles.test.ts game/scoring.test.ts && pnpm typecheck`
Expected: obstacles 15 PASS, scoring 10 PASS; typecheck clean.

- [x] **Step 7: Commit**

```bash
git add game/obstacles.ts game/obstacles.test.ts game/scoring.ts game/scoring.test.ts
git commit -m "feat(game): add obstacle spawning, difficulty ramp, scoring, and medals"
```

- [x] **Step 8: Review gate** — dispatch `lgtm-reviewer` (most capable model: simulation).

---

### Task 7: World simulation

**Files:**
- Create: `game/world.ts`
- Test: `game/world.test.ts`

**Interfaces:**
- Consumes: `createDragon`, `stepDragon`, `bobDragon`, `flap` (tests) from `game/physics.ts`; `dragonHitbox`, `hitsObstacle`, `hitsFloor` from `game/collision.ts`; `createObstacle`, `createObstaclePool`, `updateObstacles`, `difficultyFor` from `game/obstacles.ts`; `updateScore` from `game/scoring.ts`; `advance` from `game/loop.ts` (tests); `mulberry32` (tests)
- Produces:
  - `createWorld(): WorldState` (status `'menu'`)
  - `resetWorld(world: WorldState, status: 'menu' | 'ready'): void` (keeps the same `dragon` and `obstacles` objects)
  - `createStepEvents(): StepEvents`
  - `stepWorld(world: WorldState, dt: number, rng: Rng, events: StepEvents): void`

  `stepWorld` behavior: clears `events`, then snapshots `prev*` fields on every call. `paused` → nothing else. Otherwise `shakeTimer`/`flashTimer` tick down. `gameover` → nothing else. `menu`/`ready` → time, scroll, bob. `playing` → time, scroll, physics, obstacles, score (+ difficulty on score), collision → `dying` with `events.died` (landing immediately if the floor was hit). `dying` → no scroll; the dragon falls with rotation held at 0 until landed; once landed and `deathTimer ≥ GAMEOVER_DELAY` → `gameover` with `events.gameOver`. Transitions `ready → playing` and `playing ⇄ paused` are made by the engine, not by `stepWorld`.

- [x] **Step 1: Write the failing tests**

`game/world.test.ts`:

```ts
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run game/world.test.ts`
Expected: FAIL — cannot resolve `./world`.

- [x] **Step 3: Implement the world**

`game/world.ts`:

```ts
import { dragonHitbox, hitsFloor, hitsObstacle } from './collision';
import {
  BG_PARALLAX,
  DRAGON_BODY_HEIGHT,
  DRAGON_HITBOX_SCALE,
  FLASH_TIME,
  FLOOR_Y,
  GAMEOVER_DELAY,
  GAP_START,
  SHAKE_TIME,
  SPEED_START,
} from './config';
import { createObstacle, createObstaclePool, difficultyFor, updateObstacles } from './obstacles';
import { bobDragon, createDragon, stepDragon } from './physics';
import { updateScore } from './scoring';
import type { Rect, Rng, StepEvents, WorldState } from './types';

const hitbox: Rect = { x: 0, y: 0, w: 0, h: 0 };

export function createWorld(): WorldState {
  return {
    status: 'menu',
    time: 0,
    score: 0,
    speed: SPEED_START,
    gapSize: GAP_START,
    dragon: createDragon(),
    obstacles: createObstaclePool(),
    lastGapCenter: null,
    groundX: 0,
    prevGroundX: 0,
    bgX: 0,
    prevBgX: 0,
    deathTimer: 0,
    landed: false,
    shakeTimer: 0,
    flashTimer: 0,
  };
}

export function resetWorld(world: WorldState, status: 'menu' | 'ready'): void {
  const { dragon, obstacles } = world;
  Object.assign(dragon, createDragon());
  for (const obstacle of obstacles) Object.assign(obstacle, createObstacle());
  Object.assign(world, createWorld(), { status, dragon, obstacles });
}

export function createStepEvents(): StepEvents {
  return { scored: false, died: false, gameOver: false };
}

function scroll(world: WorldState, dt: number): void {
  world.groundX += world.speed * dt;
  world.bgX += world.speed * BG_PARALLAX * dt;
}

function landDragon(world: WorldState): void {
  world.dragon.y = FLOOR_Y - (DRAGON_BODY_HEIGHT * DRAGON_HITBOX_SCALE) / 2;
  world.dragon.vy = 0;
  world.landed = true;
}

function die(world: WorldState, events: StepEvents): void {
  world.status = 'dying';
  world.deathTimer = 0;
  world.shakeTimer = SHAKE_TIME;
  world.flashTimer = FLASH_TIME;
  world.dragon.rotation = 0;
  events.died = true;
}

export function stepWorld(world: WorldState, dt: number, rng: Rng, events: StepEvents): void {
  events.scored = false;
  events.died = false;
  events.gameOver = false;

  const { dragon } = world;
  dragon.prevY = dragon.y;
  dragon.prevRotation = dragon.rotation;
  world.prevGroundX = world.groundX;
  world.prevBgX = world.bgX;
  for (const obstacle of world.obstacles) obstacle.prevX = obstacle.x;

  if (world.status === 'paused') return;

  world.shakeTimer = Math.max(0, world.shakeTimer - dt);
  world.flashTimer = Math.max(0, world.flashTimer - dt);

  switch (world.status) {
    case 'gameover':
      return;

    case 'menu':
    case 'ready':
      world.time += dt;
      scroll(world, dt);
      bobDragon(dragon, world.time);
      return;

    case 'playing': {
      world.time += dt;
      scroll(world, dt);
      stepDragon(dragon, dt);
      updateObstacles(world, dt, rng);

      if (updateScore(world, dragon.x)) {
        events.scored = true;
        const difficulty = difficultyFor(world.score);
        world.gapSize = difficulty.gapSize;
        world.speed = difficulty.speed;
      }

      dragonHitbox(dragon, hitbox);
      const hitFloor = hitsFloor(hitbox);
      let hitRock = false;
      for (const obstacle of world.obstacles) {
        if (hitsObstacle(hitbox, obstacle)) {
          hitRock = true;
          break;
        }
      }
      if (hitFloor || hitRock) die(world, events);
      if (hitFloor) landDragon(world);
      return;
    }

    case 'dying':
      world.time += dt;
      world.deathTimer += dt;
      if (!world.landed) {
        stepDragon(dragon, dt);
        dragon.rotation = 0;
        if (hitsFloor(dragonHitbox(dragon, hitbox))) landDragon(world);
      }
      if (world.landed && world.deathTimer >= GAMEOVER_DELAY) {
        world.status = 'gameover';
        events.gameOver = true;
      }
      return;
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run game/world.test.ts && pnpm typecheck`
Expected: 9 tests PASS; typecheck clean.

- [x] **Step 5: Run the whole unit suite**

Run: `pnpm test`
Expected: all 8 `game/*.test.ts` files PASS (79 tests).

- [x] **Step 6: Commit**

```bash
git add game/world.ts game/world.test.ts
git commit -m "feat(game): add deterministic world simulation with dying and gameover states"
```

- [x] **Step 7: Review gate** — dispatch `lgtm-reviewer` (most capable model: simulation).

---

### Task 8: Sprite loading and canvas renderer

**Files:**
- Create: `game/assets.ts`, `game/renderer.ts`

**Interfaces:**
- Consumes: `SpriteKey`, `WorldState`, `Obstacle` (`game/types.ts`); `poseFor` (`game/physics.ts`); config constants
- Produces:
  - `game/assets.ts`:
    - `type Sprites = Record<SpriteKey, HTMLImageElement>`
    - `const SPRITE_MANIFEST: Record<SpriteKey, string>`
    - `class AssetLoadError extends Error { readonly src: string }`
    - `loadSprites(onProgress?: (loaded: number, total: number) => void): Promise<Sprites>`
  - `game/renderer.ts`:
    - `class UnsupportedCanvasError extends Error`
    - `interface RenderOptions { reducedMotion: boolean }`
    - `setupCanvas(canvas: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D` (throws `UnsupportedCanvasError`)
    - `render(ctx: CanvasRenderingContext2D, sprites: Sprites, world: WorldState, alpha: number, options: RenderOptions): void`

These are browser modules without unit tests (spec §14). They are verified by typecheck/lint here and visually in Task 10.

- [x] **Step 1: Implement the sprite loader**

`game/assets.ts`:

```ts
import type { SpriteKey } from './types';

export type Sprites = Record<SpriteKey, HTMLImageElement>;

export const SPRITE_MANIFEST: Record<SpriteKey, string> = {
  background: '/assets/background.webp',
  floor: '/assets/floor.png',
  'dragon-fly-up': '/assets/dragon-fly-up.png',
  'dragon-fly-normal': '/assets/dragon-fly-normal.png',
  'dragon-fly-down': '/assets/dragon-fly-down.png',
  'dragon-die': '/assets/dragon-die.png',
  'rock-tall-1': '/assets/rock-tall-1.png',
  'rock-tall-2': '/assets/rock-tall-2.png',
  'rock-short-1': '/assets/rock-short-1.png',
  'rock-short-2': '/assets/rock-short-2.png',
  'rock-short-3': '/assets/rock-short-3.png',
  'rock-short-4': '/assets/rock-short-4.png',
};

export class AssetLoadError extends Error {
  readonly src: string;

  constructor(src: string) {
    super(`Failed to load ${src}`);
    this.name = 'AssetLoadError';
    this.src = src;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      img.decode().then(
        () => resolve(img),
        () => resolve(img),
      );
    };
    img.onerror = () => reject(new AssetLoadError(src));
    img.src = src;
  });
}

export async function loadSprites(onProgress?: (loaded: number, total: number) => void): Promise<Sprites> {
  const entries = Object.entries(SPRITE_MANIFEST) as [SpriteKey, string][];
  let loaded = 0;
  const images = await Promise.all(
    entries.map(async ([key, src]) => {
      const img = await loadImage(src);
      loaded += 1;
      onProgress?.(loaded, entries.length);
      return [key, img] as const;
    }),
  );
  return Object.fromEntries(images) as Sprites;
}
```

- [x] **Step 2: Implement the renderer**

`game/renderer.ts`:

```ts
import type { Sprites } from './assets';
import {
  DRAGON_DRAW_HEIGHT,
  FLASH_TIME,
  FLOOR_DRAW_HEIGHT,
  FLOOR_Y,
  HEIGHT,
  OBSTACLE_FLOOR_SINK,
  OBSTACLE_WIDTH,
  SHAKE_MAGNITUDE,
  SHAKE_TIME,
  WIDTH,
} from './config';
import { poseFor } from './physics';
import type { Obstacle, WorldState } from './types';

export class UnsupportedCanvasError extends Error {
  constructor() {
    super('Canvas 2D is not supported in this browser');
    this.name = 'UnsupportedCanvasError';
  }
}

export interface RenderOptions {
  reducedMotion: boolean;
}

const LETTERBOX_COLOR = '#1a0d0a';

export function setupCanvas(canvas: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D {
  canvas.width = Math.round(WIDTH * dpr);
  canvas.height = Math.round(HEIGHT * dpr);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new UnsupportedCanvasError();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

// Background tiles alternate mirrored copies so the non-seamless edges always meet their reflection.
function drawBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scrollX: number): void {
  const w = Math.ceil((img.width * HEIGHT) / img.height);
  const period = w * 2;
  const offset = ((scrollX % period) + period) % period;
  for (let i = 0; i * w - offset < WIDTH; i++) {
    const x = Math.round(i * w - offset);
    if (x + w <= 0) continue;
    if (i % 2 === 0) {
      ctx.drawImage(img, x, 0, w + 1, HEIGHT);
    } else {
      ctx.save();
      ctx.translate(x + w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -1, 0, w + 1, HEIGHT);
      ctx.restore();
    }
  }
}

function drawFloor(ctx: CanvasRenderingContext2D, img: HTMLImageElement, scrollX: number): void {
  const w = Math.ceil((img.width * FLOOR_DRAW_HEIGHT) / img.height);
  const offset = scrollX % w;
  const y = HEIGHT - FLOOR_DRAW_HEIGHT;
  for (let i = 0; i * w - offset < WIDTH; i++) {
    ctx.drawImage(img, Math.round(i * w - offset), y, w + 1, FLOOR_DRAW_HEIGHT);
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, sprites: Sprites, obstacle: Obstacle, x: number): void {
  const left = Math.round(x - OBSTACLE_WIDTH / 2);
  const gapTop = Math.round(obstacle.gapCenter - obstacle.gapSize / 2);
  const gapBottom = Math.round(obstacle.gapCenter + obstacle.gapSize / 2);

  const top = sprites[obstacle.topSprite];
  if (obstacle.topFlipped) {
    ctx.save();
    ctx.translate(left, gapTop);
    ctx.scale(1, -1);
    ctx.drawImage(top, 0, 0, OBSTACLE_WIDTH, gapTop);
    ctx.restore();
  } else {
    ctx.drawImage(top, left, 0, OBSTACLE_WIDTH, gapTop);
  }

  const bottomHeight = FLOOR_Y - gapBottom + OBSTACLE_FLOOR_SINK;
  ctx.drawImage(sprites[obstacle.bottomSprite], left, gapBottom, OBSTACLE_WIDTH, bottomHeight);
}

function drawDragon(ctx: CanvasRenderingContext2D, sprites: Sprites, world: WorldState, alpha: number): void {
  const { dragon } = world;
  const img = sprites[poseFor(dragon, world.status, world.time)];
  const h = DRAGON_DRAW_HEIGHT;
  const w = (img.width * h) / img.height;
  ctx.save();
  ctx.translate(Math.round(dragon.x), Math.round(lerp(dragon.prevY, dragon.y, alpha)));
  ctx.rotate(lerp(dragon.prevRotation, dragon.rotation, alpha));
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  sprites: Sprites,
  world: WorldState,
  alpha: number,
  options: RenderOptions,
): void {
  ctx.fillStyle = LETTERBOX_COLOR;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  if (!options.reducedMotion && world.shakeTimer > 0) {
    const magnitude = SHAKE_MAGNITUDE * (world.shakeTimer / SHAKE_TIME);
    ctx.translate((Math.random() * 2 - 1) * magnitude, (Math.random() * 2 - 1) * magnitude);
  }

  drawBackground(ctx, sprites.background, lerp(world.prevBgX, world.bgX, alpha));
  for (const obstacle of world.obstacles) {
    if (obstacle.active) drawObstacle(ctx, sprites, obstacle, lerp(obstacle.prevX, obstacle.x, alpha));
  }
  drawFloor(ctx, sprites.floor, lerp(world.prevGroundX, world.groundX, alpha));
  drawDragon(ctx, sprites, world, alpha);
  ctx.restore();

  if (world.flashTimer > 0) {
    const strength = options.reducedMotion ? 0.3 : 0.7;
    ctx.fillStyle = `rgba(255, 236, 200, ${(world.flashTimer / FLASH_TIME) * strength})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}
```

- [x] **Step 3: Verify types and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: both clean.

- [x] **Step 4: Commit**

```bash
git add game/assets.ts game/renderer.ts
git commit -m "feat(game): add sprite loader and pixel-art canvas renderer"
```

- [x] **Step 5: Review gate** — dispatch `lgtm-reviewer` (mid-tier model).

---

### Task 9: Audio, input, and engine

**Files:**
- Create: `game/audio.ts`, `game/input.ts`, `game/engine.ts`

**Interfaces:**
- Consumes: `advance`, `FixedClock` (`game/loop.ts`); `createWorld`, `resetWorld`, `createStepEvents`, `stepWorld` (`game/world.ts`); `flap` (`game/physics.ts`); `medalFor` (`game/scoring.ts`); `setupCanvas`, `render` (`game/renderer.ts`); `Sprites` (`game/assets.ts`); `GameStatus`, `GameOverResult`, `Rng` (`game/types.ts`)
- Produces:
  - `game/audio.ts`: `type SoundName = 'flap' | 'score' | 'hit' | 'fall'`; `class AudioManager { constructor(options: { volume: number; muted: boolean }); unlock(): void; setVolume(volume: number): void; setMuted(muted: boolean): void; play(name: SoundName, delay?: number): void; dispose(): void }`
  - `game/input.ts`: `interface InputHandlers { onFlap(): void; onPause(): void; onGesture(): void }`; `bindInput(canvas: HTMLCanvasElement, handlers: InputHandlers): () => void`
  - `game/engine.ts`:
    - `interface EngineEvents { onStatusChange(status: GameStatus): void; onScore(score: number): void; onGameOver(result: GameOverResult): void }`
    - `interface EngineOptions { canvas: HTMLCanvasElement; sprites: Sprites; audio: AudioManager; events: EngineEvents; bestScore: number; reducedMotion: boolean; rng?: Rng }`
    - `interface Engine { getReady(): void; showMenu(): void; flap(): void; pause(): void; resume(): void; togglePause(): void; setReducedMotion(value: boolean): void; destroy(): void }`
    - `createEngine(options: EngineOptions): Engine` (throws `UnsupportedCanvasError` from `setupCanvas`; starts the rAF loop in `menu`)
  - Event order on game over: `onGameOver(result)` then `onStatusChange('gameover')`.

- [x] **Step 1: Implement audio**

`game/audio.ts`:

```ts
export type SoundName = 'flap' | 'score' | 'hit' | 'fall';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  return window.AudioContext ?? legacy ?? null;
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volume: number;
  private muted: boolean;

  constructor(options: { volume: number; muted: boolean }) {
    this.volume = clampVolume(options.volume);
    this.muted = options.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor = getAudioContextConstructor();
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.noise = createNoiseBuffer(this.ctx);
      this.applyGain();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  setVolume(volume: number): void {
    this.volume = clampVolume(volume);
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  play(name: SoundName, delay = 0): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.muted || ctx.state === 'closed') return;
    const t = ctx.currentTime + delay;
    switch (name) {
      case 'flap':
        noiseBurst(ctx, master, noise, t, 0.08, 0.5, 'bandpass', 1200);
        tone(ctx, master, 'triangle', 520, 780, t, 0.06, 0.15);
        return;
      case 'score':
        tone(ctx, master, 'square', 880, 880, t, 0.07, 0.15);
        tone(ctx, master, 'square', 1320, 1320, t + 0.07, 0.09, 0.15);
        return;
      case 'hit':
        noiseBurst(ctx, master, noise, t, 0.2, 0.8, 'lowpass', 600);
        tone(ctx, master, 'sine', 180, 50, t, 0.2, 0.7);
        return;
      case 'fall':
        tone(ctx, master, 'sawtooth', 600, 120, t, 0.45, 0.12);
        return;
    }
  }

  dispose(): void {
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
    this.noise = null;
  }

  private applyGain(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(ctx: AudioContext, destination: AudioNode, t: number, peak: number, duration: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.005 + duration);
  gain.connect(destination);
  return gain;
}

function tone(
  ctx: AudioContext,
  destination: AudioNode,
  type: OscillatorType,
  fromHz: number,
  toHz: number,
  t: number,
  duration: number,
  peak: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, t);
  if (toHz !== fromHz) osc.frequency.exponentialRampToValueAtTime(toHz, t + duration);
  osc.connect(envelope(ctx, destination, t, peak, duration));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function noiseBurst(
  ctx: AudioContext,
  destination: AudioNode,
  noise: AudioBuffer,
  t: number,
  duration: number,
  peak: number,
  filterType: BiquadFilterType,
  frequency: number,
): void {
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  source.connect(filter).connect(envelope(ctx, destination, t, peak, duration));
  source.start(t);
  source.stop(t + duration + 0.05);
}
```

- [x] **Step 2: Implement input**

`game/input.ts`:

```ts
export interface InputHandlers {
  onFlap(): void;
  onPause(): void;
  onGesture(): void;
}

const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, input, select, textarea, a') !== null;
}

export function bindInput(canvas: HTMLCanvasElement, handlers: InputHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (FLAP_KEYS.has(event.code)) {
      // Focused buttons (Start, Restart) keep their native Space activation.
      if (isInteractive(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      handlers.onGesture();
      handlers.onFlap();
    } else if (PAUSE_KEYS.has(event.code) && !event.repeat) {
      handlers.onPause();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handlers.onGesture();
    handlers.onFlap();
  };

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('pointerdown', onPointerDown);
  };
}
```

- [x] **Step 3: Implement the engine**

`game/engine.ts`:

```ts
import type { Sprites } from './assets';
import type { AudioManager } from './audio';
import { bindInput } from './input';
import { advance, type FixedClock } from './loop';
import { flap as flapDragon } from './physics';
import { render, setupCanvas } from './renderer';
import { medalFor } from './scoring';
import type { GameOverResult, GameStatus, Rng } from './types';
import { createStepEvents, createWorld, resetWorld, stepWorld } from './world';

export interface EngineEvents {
  onStatusChange(status: GameStatus): void;
  onScore(score: number): void;
  onGameOver(result: GameOverResult): void;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  sprites: Sprites;
  audio: AudioManager;
  events: EngineEvents;
  bestScore: number;
  reducedMotion: boolean;
  rng?: Rng;
}

export interface Engine {
  getReady(): void;
  showMenu(): void;
  flap(): void;
  pause(): void;
  resume(): void;
  togglePause(): void;
  setReducedMotion(value: boolean): void;
  destroy(): void;
}

export function createEngine(options: EngineOptions): Engine {
  const { canvas, sprites, audio, events } = options;
  const ctx = setupCanvas(canvas, window.devicePixelRatio || 1);
  const rng = options.rng ?? Math.random;
  const world = createWorld();
  const stepEvents = createStepEvents();
  const clock: FixedClock = { acc: 0 };
  let best = options.bestScore;
  let reducedMotion = options.reducedMotion;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  const setStatus = (status: GameStatus) => {
    world.status = status;
    events.onStatusChange(status);
  };

  const step = (dt: number) => {
    stepWorld(world, dt, rng, stepEvents);
    if (stepEvents.scored) {
      audio.play('score');
      events.onScore(world.score);
    }
    if (stepEvents.died) {
      audio.play('hit');
      audio.play('fall', 0.15);
      events.onStatusChange('dying');
    }
    if (stepEvents.gameOver) {
      const isNewBest = world.score > best;
      if (isNewBest) best = world.score;
      events.onGameOver({ score: world.score, best, isNewBest, medal: medalFor(world.score) });
      events.onStatusChange('gameover');
    }
  };

  const frame = (now: number) => {
    if (destroyed) return;
    const dt = lastTime === null ? 0 : (now - lastTime) / 1000;
    lastTime = now;
    const alpha = world.status === 'paused' ? 1 : advance(clock, dt, step);
    render(ctx, sprites, world, alpha, { reducedMotion });
    rafId = requestAnimationFrame(frame);
  };

  const engine: Engine = {
    getReady() {
      resetWorld(world, 'ready');
      clock.acc = 0;
      events.onStatusChange('ready');
    },
    showMenu() {
      resetWorld(world, 'menu');
      clock.acc = 0;
      events.onStatusChange('menu');
    },
    flap() {
      if (world.status === 'ready') {
        flapDragon(world.dragon);
        audio.play('flap');
        setStatus('playing');
      } else if (world.status === 'playing') {
        flapDragon(world.dragon);
        audio.play('flap');
      }
    },
    pause() {
      if (world.status === 'playing') setStatus('paused');
    },
    resume() {
      if (world.status !== 'paused') return;
      lastTime = null;
      clock.acc = 0;
      setStatus('playing');
    },
    togglePause() {
      if (world.status === 'playing') engine.pause();
      else if (world.status === 'paused') engine.resume();
    },
    setReducedMotion(value) {
      reducedMotion = value;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unbindInput();
    },
  };

  const onVisibilityChange = () => {
    if (document.hidden) engine.pause();
    lastTime = null;
  };

  const unbindInput = bindInput(canvas, {
    onFlap: () => engine.flap(),
    onPause: () => engine.togglePause(),
    onGesture: () => audio.unlock(),
  });
  document.addEventListener('visibilitychange', onVisibilityChange);
  rafId = requestAnimationFrame(frame);

  return engine;
}
```

- [x] **Step 4: Verify types, lint, and unit suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all clean; unit suite still PASS.

- [x] **Step 5: Commit**

```bash
git add game/audio.ts game/input.ts game/engine.ts
git commit -m "feat(game): add synthesized audio, input binding, and fixed-step engine"
```

- [x] **Step 6: Review gate** — dispatch `lgtm-reviewer` (most capable model: engine loop).

---

### Task 10: React UI shell and screens

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Create: `components/ClientGame.tsx`, `components/GameRoot.tsx`, `components/GameCanvas.tsx`, `components/GameFrame.tsx`, `components/ui/TextButton.tsx`, `components/ui/ImageButton.tsx`, `components/ui/MedalBadge.tsx`, `components/screens/LoadingScreen.tsx`, `components/screens/MainMenu.tsx`, `components/screens/SettingsPanel.tsx`, `components/screens/GetReady.tsx`, `components/screens/ScoreHud.tsx`, `components/screens/PauseOverlay.tsx`, `components/screens/GameOver.tsx`

**Interfaces:**
- Consumes: `createEngine`, `Engine`, `EngineEvents` (`game/engine.ts`); `AudioManager` (`game/audio.ts`); `loadSprites`, `AssetLoadError`, `Sprites` (`game/assets.ts`); `UnsupportedCanvasError` (`game/renderer.ts`); `loadSaveData`, `saveSaveData`, `getBrowserStore`, `SaveData`, `Settings` (`game/storage.ts`); `GameStatus`, `GameOverResult`, `Medal` (`game/types.ts`)
- Produces (DOM contract used by Task 11):
  - Root element `data-testid="game-root"` with `data-status` = `loading` | `error` | a `GameStatus`
  - Buttons with accessible names: `Start game`, `Settings`, `Pause`, `Resume`, `Back to menu`, `Restart`, `Done`, `Retry`
  - Dialogs with accessible names: `Paused`, `Game over`, `Settings`

- [x] **Step 1: Theme, layout, and page**

`app/globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --font-pixel: var(--font-press-start), ui-monospace, monospace;
  --color-ember-950: #1a0d0a;
  --color-ember-900: #2b1410;
  --color-ember-700: #5a2a1c;
  --color-lava-500: #f26b1d;
  --color-lava-300: #ffb347;
}

html,
body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

.pixelated {
  image-rendering: pixelated;
}
```

`app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pixelFont = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Flappy Dragon: Volcanic Ascent',
  description: 'Guide your dragon through the volcanic rocks.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a0d0a',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={pixelFont.variable}>
      <body className="bg-ember-950 font-pixel text-amber-50 antialiased">{children}</body>
    </html>
  );
}
```

`app/page.tsx`:

```tsx
import ClientGame from '@/components/ClientGame';

export default function Home() {
  return (
    <main className="flex h-dvh w-full items-center justify-center bg-ember-950">
      <ClientGame />
    </main>
  );
}
```

- [x] **Step 2: Frame and client-only wrapper**

`components/GameFrame.tsx`:

```tsx
import type { ComponentProps } from 'react';

export function GameFrame({ className = '', style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={`relative touch-none select-none overflow-hidden bg-ember-900 [container-type:size] ${className}`}
      style={{ height: 'min(100dvh, calc(100vw * 16 / 9))', aspectRatio: '9 / 16', ...style }}
    />
  );
}
```

`components/ClientGame.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { GameFrame } from './GameFrame';
import { LoadingScreen } from './screens/LoadingScreen';

const GameRoot = dynamic(() => import('./GameRoot'), {
  ssr: false,
  loading: () => (
    <GameFrame data-testid="game-root" data-status="loading">
      <LoadingScreen loaded={0} total={1} />
    </GameFrame>
  ),
});

export default function ClientGame() {
  return <GameRoot />;
}
```

- [x] **Step 3: UI primitives**

`components/ui/TextButton.tsx`:

```tsx
import type { ComponentProps } from 'react';

export function TextButton({ className = '', type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      {...props}
      className={`border-4 border-ember-950 bg-lava-500 px-[4cqw] py-[1.5cqh] text-[length:3.4cqw] text-ember-950 shadow-[0_0.6cqh_0_0_#1a0d0a] transition-transform hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-lava-300 active:translate-y-[0.6cqh] active:shadow-none disabled:opacity-50 ${className}`}
    />
  );
}
```

`components/ui/ImageButton.tsx`:

```tsx
import Image from 'next/image';
import type { ComponentProps } from 'react';

type ImageButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  src: string;
  width: number;
  height: number;
  label: string;
};

export function ImageButton({ src, width, height, label, className = '', type = 'button', ...props }: ImageButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      {...props}
      className={`block transition-transform hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-lava-300 active:scale-95 ${className}`}
    >
      <Image src={src} alt="" width={width} height={height} unoptimized draggable={false} className="pixelated h-auto w-full" />
    </button>
  );
}
```

`components/ui/MedalBadge.tsx`:

```tsx
import type { Medal } from '@/game/types';

const MEDAL_COLORS: Record<Exclude<Medal, 'none'>, string> = {
  bronze: 'bg-[#cd7f32]',
  silver: 'bg-[#c0c0c0]',
  gold: 'bg-[#ffd700]',
  platinum: 'bg-[#e5f4ff]',
};

export function MedalBadge({ medal }: { medal: Medal }) {
  return (
    <div className="flex flex-col items-center gap-[1cqh]">
      <p className="text-[length:2.8cqw] text-lava-300">Medal</p>
      {medal === 'none' ? (
        <div role="img" aria-label="No medal" className="size-[16cqw] rounded-full border-4 border-dashed border-ember-950/60" />
      ) : (
        <div
          role="img"
          aria-label={`${medal} medal`}
          className={`size-[16cqw] rounded-full border-4 border-ember-950 shadow-[inset_0_-1cqw_0_rgba(0,0,0,0.25)] ${MEDAL_COLORS[medal]}`}
        />
      )}
    </div>
  );
}
```

- [x] **Step 4: Screens**

`components/screens/LoadingScreen.tsx`:

```tsx
import { TextButton } from '../ui/TextButton';

interface LoadingScreenProps {
  loaded: number;
  total: number;
  error?: string;
  onRetry?: () => void;
}

export function LoadingScreen({ loaded, total, error, onRetry }: LoadingScreenProps) {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950 px-[8cqw] text-center">
      {error ? (
        <>
          <p role="alert" className="text-[length:3.2cqw] leading-relaxed text-lava-300">
            {error}
          </p>
          {onRetry && <TextButton onClick={onRetry}>Retry</TextButton>}
        </>
      ) : (
        <>
          <p className="text-[length:4cqw]">Loading…</p>
          <div
            role="progressbar"
            aria-label="Loading game assets"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-[2cqh] w-full border-2 border-lava-300 bg-ember-900"
          >
            <div className="h-full bg-lava-500 transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
```

`components/screens/MainMenu.tsx`:

```tsx
import Image from 'next/image';
import { ImageButton } from '../ui/ImageButton';
import { TextButton } from '../ui/TextButton';

interface MainMenuProps {
  bestScore: number;
  onStart: () => void;
  onOpenSettings: () => void;
}

export function MainMenu({ bestScore, onStart, onOpenSettings }: MainMenuProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between py-[10cqh]">
      <Image
        src="/assets/title.png"
        alt="Flappy Dragon: Volcanic Ascent"
        width={528}
        height={160}
        priority
        unoptimized
        className="pixelated h-auto w-[85%]"
      />
      <div className="flex w-full flex-col items-center gap-[3cqh]">
        <ImageButton src="/assets/start.png" width={563} height={113} label="Start game" onClick={onStart} className="w-[70%]" />
        <p className="text-[length:3.2cqw] text-lava-300 [text-shadow:0_0.4cqh_0_#1a0d0a]">Best {bestScore}</p>
        <TextButton onClick={onOpenSettings}>Settings</TextButton>
      </div>
    </div>
  );
}
```

`components/screens/SettingsPanel.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { Settings } from '@/game/storage';
import { TextButton } from '../ui/TextButton';

interface SettingsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    doneRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const volumePercent = Math.round(settings.volume * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="absolute inset-0 flex items-center justify-center bg-ember-950/80 px-[8cqw]"
    >
      <div className="flex w-full flex-col gap-[3cqh] border-4 border-ember-950 bg-ember-700 p-[5cqw] text-[length:3cqw]">
        <h2 id="settings-title" className="text-center text-[length:5cqw] text-lava-300">
          Settings
        </h2>
        <label className="flex items-center justify-between gap-[3cqw]">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={!settings.muted}
            onChange={(event) => onChange({ ...settings, muted: !event.target.checked })}
            className="size-[5cqw] accent-lava-500"
          />
        </label>
        <label className="flex flex-col gap-[1.5cqh]">
          <span>Volume {volumePercent}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumePercent}
            disabled={settings.muted}
            onChange={(event) => onChange({ ...settings, volume: Number(event.target.value) / 100 })}
            className="w-full accent-lava-500"
          />
        </label>
        <label className="flex items-center justify-between gap-[3cqw]">
          <span>Reduce motion</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(event) => onChange({ ...settings, reducedMotion: event.target.checked })}
            className="size-[5cqw] accent-lava-500"
          />
        </label>
        <TextButton ref={doneRef} onClick={onClose}>
          Done
        </TextButton>
      </div>
    </div>
  );
}
```

`components/screens/GetReady.tsx`:

```tsx
export function GetReady() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[3cqh] pb-[30cqh] text-center [text-shadow:0_0.4cqh_0_#1a0d0a]">
      <p className="text-[length:6cqw] text-lava-300">Get Ready</p>
      <p className="text-[length:3cqw] leading-loose">
        Tap, click or press Space
        <br />
        to flap
      </p>
    </div>
  );
}
```

`components/screens/ScoreHud.tsx`:

```tsx
import type { MouseEvent } from 'react';

interface ScoreHudProps {
  score: number;
  onPause?: () => void;
}

export function ScoreHud({ score, onPause }: ScoreHudProps) {
  const handlePause = (event: MouseEvent<HTMLButtonElement>) => {
    // Drop focus so Space flaps after resuming instead of being swallowed by this button.
    event.currentTarget.blur();
    onPause?.();
  };

  return (
    <>
      <p className="pointer-events-none absolute inset-x-0 top-[6cqh] text-center text-[length:10cqw] [text-shadow:0_0.8cqh_0_#1a0d0a]">
        {score}
      </p>
      {onPause && (
        <button
          type="button"
          aria-label="Pause"
          onClick={handlePause}
          className="absolute right-[3cqw] top-[3cqh] border-4 border-ember-950 bg-lava-500 px-[2.5cqw] py-[1cqh] text-[length:3.5cqw] text-ember-950 focus-visible:outline-4 focus-visible:outline-lava-300"
        >
          II
        </button>
      )}
    </>
  );
}
```

`components/screens/PauseOverlay.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { ImageButton } from '../ui/ImageButton';
import { TextButton } from '../ui/TextButton';

interface PauseOverlayProps {
  onResume: () => void;
  onMenu: () => void;
}

export function PauseOverlay({ onResume, onMenu }: PauseOverlayProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950/70"
    >
      <p className="text-[length:7cqw] text-lava-300">Paused</p>
      <TextButton ref={resumeRef} onClick={onResume}>
        Resume
      </TextButton>
      <ImageButton src="/assets/menu.png" width={273} height={76} label="Back to menu" onClick={onMenu} className="w-[45%]" />
    </div>
  );
}
```

`components/screens/GameOver.tsx`:

```tsx
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { GameOverResult } from '@/game/types';
import { ImageButton } from '../ui/ImageButton';
import { MedalBadge } from '../ui/MedalBadge';

interface GameOverProps {
  result: GameOverResult;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOver({ result, onRestart, onMenu }: GameOverProps) {
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    restartRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950/60 px-[8cqw]"
    >
      <h2 id="gameover-title" className="w-[85%]">
        <Image src="/assets/gameover.png" alt="Game over" width={440} height={126} unoptimized className="pixelated h-auto w-full" />
      </h2>
      <div className="flex w-full items-center gap-[5cqw] border-4 border-ember-950 bg-ember-700 p-[4cqw] shadow-[0_0.8cqh_0_0_#1a0d0a]">
        <MedalBadge medal={result.medal} />
        <dl className="flex flex-1 flex-col gap-[2cqh] text-right">
          <div>
            <dt className="text-[length:2.8cqw] text-lava-300">Score</dt>
            <dd className="text-[length:6cqw]">{result.score}</dd>
          </div>
          <div>
            <dt className="text-[length:2.8cqw] text-lava-300">
              {result.isNewBest && <span className="mr-[1.5cqw] bg-lava-500 px-[1cqw] text-ember-950">NEW</span>}
              Best
            </dt>
            <dd className="text-[length:6cqw]">{result.best}</dd>
          </div>
        </dl>
      </div>
      <div className="flex w-full items-center justify-center gap-[4cqw]">
        <ImageButton ref={restartRef} src="/assets/restart.png" width={273} height={105} label="Restart" onClick={onRestart} className="w-[45%]" />
        <ImageButton src="/assets/menu.png" width={273} height={76} label="Back to menu" onClick={onMenu} className="w-[45%]" />
      </div>
    </div>
  );
}
```

- [x] **Step 5: Canvas component**

`components/GameCanvas.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { Sprites } from '@/game/assets';
import type { AudioManager } from '@/game/audio';
import { createEngine, type Engine, type EngineEvents } from '@/game/engine';
import { UnsupportedCanvasError } from '@/game/renderer';

interface GameCanvasProps {
  sprites: Sprites;
  audio: AudioManager;
  events: EngineEvents;
  bestScore: number;
  reducedMotion: boolean;
  onEngineChange: (engine: Engine | null) => void;
  onUnsupported: () => void;
}

export function GameCanvas({ sprites, audio, events, bestScore, reducedMotion, onEngineChange, onUnsupported }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // The engine tracks best score and motion itself after creation; later changes flow through commands.
  const initialRef = useRef({ bestScore, reducedMotion });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine;
    try {
      engine = createEngine({ canvas, sprites, audio, events, ...initialRef.current });
    } catch (error) {
      if (error instanceof UnsupportedCanvasError) {
        onUnsupported();
        return;
      }
      throw error;
    }
    engineRef.current = engine;
    onEngineChange(engine);
    return () => {
      engine.destroy();
      engineRef.current = null;
      onEngineChange(null);
    };
  }, [sprites, audio, events, onEngineChange, onUnsupported]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return <canvas ref={canvasRef} aria-label="Flappy Dragon game" className="absolute inset-0 block size-full" />;
}
```

- [x] **Step 6: Root component**

`components/GameRoot.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AssetLoadError, loadSprites, type Sprites } from '@/game/assets';
import { AudioManager } from '@/game/audio';
import type { Engine, EngineEvents } from '@/game/engine';
import { getBrowserStore, loadSaveData, saveSaveData, type SaveData, type Settings } from '@/game/storage';
import type { GameOverResult, GameStatus } from '@/game/types';
import { GameCanvas } from './GameCanvas';
import { GameFrame } from './GameFrame';
import { GameOver } from './screens/GameOver';
import { GetReady } from './screens/GetReady';
import { LoadingScreen } from './screens/LoadingScreen';
import { MainMenu } from './screens/MainMenu';
import { PauseOverlay } from './screens/PauseOverlay';
import { ScoreHud } from './screens/ScoreHud';
import { SettingsPanel } from './screens/SettingsPanel';

type Phase =
  | { kind: 'loading'; loaded: number; total: number }
  | { kind: 'error'; message: string; retryable: boolean }
  | { kind: 'running' };

interface UiState {
  phase: Phase;
  status: GameStatus;
  score: number;
  result: GameOverResult | null;
  save: SaveData;
  settingsOpen: boolean;
}

type Action =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'loaded' }
  | { type: 'failed'; message: string; retryable: boolean }
  | { type: 'retry' }
  | { type: 'status'; status: GameStatus }
  | { type: 'score'; score: number }
  | { type: 'gameOver'; result: GameOverResult }
  | { type: 'settings'; settings: Settings }
  | { type: 'settingsOpen'; open: boolean };

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'progress':
      return { ...state, phase: { kind: 'loading', loaded: action.loaded, total: action.total } };
    case 'loaded':
      return { ...state, phase: { kind: 'running' }, status: 'menu' };
    case 'failed':
      return { ...state, phase: { kind: 'error', message: action.message, retryable: action.retryable } };
    case 'retry':
      return { ...state, phase: { kind: 'loading', loaded: 0, total: 1 } };
    case 'status': {
      const resetsScore = action.status === 'ready' || action.status === 'menu';
      return { ...state, status: action.status, score: resetsScore ? 0 : state.score, settingsOpen: false };
    }
    case 'score':
      return { ...state, score: action.score };
    case 'gameOver':
      return {
        ...state,
        result: action.result,
        save: action.result.isNewBest ? { ...state.save, bestScore: action.result.best } : state.save,
      };
    case 'settings':
      return { ...state, save: { ...state.save, settings: action.settings } };
    case 'settingsOpen':
      return { ...state, settingsOpen: action.open };
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function initState(): UiState {
  return {
    phase: { kind: 'loading', loaded: 0, total: 1 },
    status: 'menu',
    score: 0,
    result: null,
    save: loadSaveData(getBrowserStore(), prefersReducedMotion()),
    settingsOpen: false,
  };
}

export default function GameRoot() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [sprites, setSprites] = useState<Sprites | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [audio] = useState(() => new AudioManager(state.save.settings));
  const engineRef = useRef<Engine | null>(null);
  const savedRef = useRef(state.save);

  useEffect(() => {
    let cancelled = false;
    loadSprites((loaded, total) => {
      if (!cancelled) dispatch({ type: 'progress', loaded, total });
    })
      .then((loadedSprites) => {
        if (cancelled) return;
        setSprites(loadedSprites);
        dispatch({ type: 'loaded' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const src = error instanceof AssetLoadError ? error.src : 'game assets';
        dispatch({ type: 'failed', message: `Could not load ${src}`, retryable: true });
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (savedRef.current === state.save) return;
    savedRef.current = state.save;
    saveSaveData(getBrowserStore(), state.save);
  }, [state.save]);

  useEffect(() => () => audio.dispose(), [audio]);

  const events = useMemo<EngineEvents>(
    () => ({
      onStatusChange: (status) => dispatch({ type: 'status', status }),
      onScore: (score) => dispatch({ type: 'score', score }),
      onGameOver: (result) => dispatch({ type: 'gameOver', result }),
    }),
    [],
  );

  const handleEngineChange = useCallback((engine: Engine | null) => {
    engineRef.current = engine;
  }, []);

  const handleUnsupported = useCallback(() => {
    dispatch({ type: 'failed', message: 'Your browser does not support the game canvas.', retryable: false });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: 'retry' });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const startRound = useCallback(() => {
    audio.unlock();
    engineRef.current?.getReady();
  }, [audio]);

  const showMenu = useCallback(() => engineRef.current?.showMenu(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const openSettings = useCallback(() => dispatch({ type: 'settingsOpen', open: true }), []);
  const closeSettings = useCallback(() => dispatch({ type: 'settingsOpen', open: false }), []);

  const changeSettings = useCallback(
    (settings: Settings) => {
      audio.setMuted(settings.muted);
      audio.setVolume(settings.volume);
      dispatch({ type: 'settings', settings });
    },
    [audio],
  );

  const { phase, status, score, result, save, settingsOpen } = state;
  const dataStatus = phase.kind === 'running' ? status : phase.kind;

  return (
    <GameFrame data-testid="game-root" data-status={dataStatus}>
      {sprites && (
        <GameCanvas
          sprites={sprites}
          audio={audio}
          events={events}
          bestScore={save.bestScore}
          reducedMotion={save.settings.reducedMotion}
          onEngineChange={handleEngineChange}
          onUnsupported={handleUnsupported}
        />
      )}

      {phase.kind === 'loading' && <LoadingScreen loaded={phase.loaded} total={phase.total} />}
      {phase.kind === 'error' && (
        <LoadingScreen loaded={0} total={0} error={phase.message} onRetry={phase.retryable ? retry : undefined} />
      )}

      {phase.kind === 'running' && (
        <>
          {status === 'menu' && !settingsOpen && (
            <MainMenu bestScore={save.bestScore} onStart={startRound} onOpenSettings={openSettings} />
          )}
          {status === 'menu' && settingsOpen && (
            <SettingsPanel settings={save.settings} onChange={changeSettings} onClose={closeSettings} />
          )}
          {status === 'ready' && <GetReady />}
          {(status === 'playing' || status === 'dying' || status === 'paused') && (
            <ScoreHud score={score} onPause={status === 'playing' ? pause : undefined} />
          )}
          {status === 'paused' && <PauseOverlay onResume={resume} onMenu={showMenu} />}
          {status === 'gameover' && result && <GameOver result={result} onRestart={startRound} onMenu={showMenu} />}
        </>
      )}
    </GameFrame>
  );
}
```

- [x] **Step 7: Verify checks**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all clean. If a React hooks lint rule flags a specific line, change that line to satisfy the rule without changing behavior, and note it in the report.

- [x] **Step 8: Play-test in the browser**

Run `pnpm dev`, open `http://localhost:3000`, and confirm each item (record results in the report):
1. Loading bar → menu with scrolling volcanic background and floor, bobbing dragon, title, Start, Best, Settings.
2. Start → "Get Ready"; Space or click starts play and flaps; flap sound plays.
3. Rocks spawn with gaps and top pieces point down; passing a column increments the score with a chime.
4. Holding Space flaps only once.
5. Hitting a rock: flash + shake, die pose, falls to the floor; Game Over panel ~0.5 s later with score, best, NEW badge, and a medal at ≥ 10.
6. Enter or Restart → Get Ready; Back to menu → menu. Best score persists after reload.
7. Esc/P and the II button pause; switching tabs pauses; Resume continues without a jump.
8. Settings: Sound off silences audio; volume changes loudness; Reduce motion removes shake; all persist after reload.
9. Phone viewport (DevTools 390×844): game fills the height at 9:16, text readable, taps flap, no page scroll or zoom.
10. `dragon-fly-down` shows no caption text.

Tune `game/config.ts` only if something is clearly off (e.g. `FLOOR_Y` not matching the drawn ground surface). List each change and why in the report, and re-run `pnpm test`.

- [x] **Step 9: Commit**

```bash
git add app components game/config.ts
git commit -m "feat(ui): add React menus, HUD, overlays, and game shell"
```

- [x] **Step 10: Review gate** — dispatch `lgtm-reviewer` (mid-tier model).

---

### Task 11: Playwright smoke test and README

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`
- Modify: `README.md` (replace the scaffold README)

**Interfaces:**
- Consumes: Task 10 DOM contract (`data-testid="game-root"`, `data-status`, button and dialog names)

- [x] **Step 1: Configure Playwright**

```bash
pnpm exec playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [x] **Step 2: Write the smoke test**

`e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('plays a round, dies, and restarts', async ({ page }) => {
  await page.goto('/');
  const root = page.getByTestId('game-root');

  await expect(root).toHaveAttribute('data-status', 'menu', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(root).toHaveAttribute('data-status', 'ready');

  await page.keyboard.press('Space');
  await expect(root).toHaveAttribute('data-status', /playing|dying|gameover/);
  await page.keyboard.press('Space');

  await expect(root).toHaveAttribute('data-status', 'gameover', { timeout: 10_000 });
  await expect(page.getByRole('dialog', { name: 'Game over' })).toBeVisible();

  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(root).toHaveAttribute('data-status', 'ready');
});
```

- [x] **Step 3: Run the smoke test**

Run: `pnpm test:e2e`
Expected: `1 passed`.

If it fails, follow superpowers:systematic-debugging and inspect the trace in `test-results/`. Do not weaken assertions to make it pass.

- [x] **Step 4: Write the README**

`README.md`:

````markdown
# Flappy Dragon: Volcanic Ascent

A Flappy Bird remake built with Next.js, TypeScript, HTML5 Canvas, Tailwind CSS, and the Web Audio API.

## Controls

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Flap | Space, ↑, W | Click or tap the game |
| Pause / resume | Esc, P | II button |

Holding a key flaps once; tap again to flap again. The game pauses when the tab is hidden.

## Scripts

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build        # production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm test         # Vitest unit tests (game/)
pnpm test:e2e     # Playwright smoke test (builds and serves on :3100)
python3 scripts/prepare_assets.py   # regenerate public/assets from assets/ (needs Pillow)
```

## Project layout

- `game/` — framework-free game core: pure simulation (`physics`, `collision`, `obstacles`, `scoring`, `world`, `loop`, `storage`) plus the browser runtime (`renderer`, `audio`, `input`, `engine`).
- `components/` — React UI: menus, HUD, overlays, and the canvas host.
- `assets/` — source art; `public/assets/` — generated web-ready sprites.
- `docs/superpowers/` — design spec and implementation plan.

Tuning values (gravity, gap size, speed, difficulty ramp) live in `game/config.ts`.
````

- [x] **Step 5: Full gate**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts README.md
git commit -m "test: add Playwright smoke test and project README"
```

- [ ] **Step 7: End-of-plan review gate** — dispatch `lgtm-reviewer` (most capable model) in end-of-plan mode over `4476ee1..HEAD`, including the full gate run.
