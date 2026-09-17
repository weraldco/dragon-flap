# Flappy Dragon: Volcanic Ascent — Design Spec

Date: 2026-09-17
Status: Approved plan, pending spec review

## 1. Goal

Recreate Flappy Bird as a volcanic-themed pixel-art game ("Flappy Dragon: Volcanic Ascent") using the assets in `assets/`. It runs in the browser on desktop and mobile. It must feel smooth (steady 60 fps physics), be fair (forgiving hitboxes), and keep the best score and settings between sessions.

**Out of scope:** online leaderboards, accounts, multiplayer, skins, backend.

## 2. Stack

- Next.js (App Router) + TypeScript (strict)
- React: menus/UI only, never the game loop
- HTML5 Canvas 2D: all gameplay rendering
- Tailwind CSS v4: menus, score screens, buttons
- Web Audio API: sounds generated in code (there are no audio files)
- localStorage: best score and settings
- Tooling: pnpm, ESLint, Vitest (unit), Playwright (one smoke test)

## 3. Assets

Move `assets/*` into `public/assets/` (same names). Compress `background.png` (1.4 MB), or convert it to WebP, during setup.

| File | Size | Use |
|---|---|---|
| `background.png` | 1428×688 | Far background, scrolls slowly (parallax) and repeats |
| `floor.png` | 2461×336 | Ground, scrolls at game speed, repeats seamlessly |
| `dragon-fly-up.png` | 194×256 | Pose while rising (just after a flap) |
| `dragon-fly-normal.png` | 235×256 | Pose around the top of the arc; also the idle/Get Ready pose |
| `dragon-fly-down.png` | 255×256 | Pose while falling. **Has a stray "and the" text fragment at the top. Erase it (make it transparent) during setup.** |
| `dragon-die.png` | 207×256 | Pose after a collision (dizzy stars) |
| `rock-tall-1/2.png` | 196×~452 | Obstacle pointing up |
| `rock-short-1/2.png` | 196×~274 | Obstacle pointing up |
| `rock-short-3.png` | 219×234 | Obstacle that already **hangs down** (stalactite) |
| `rock-short-4.png` | 219×240 | Obstacle pointing up |
| `title.png` | 528×160 | Menu logo |
| `start.png` | 563×113 | Start button |
| `menu.png` | 273×76 | Back-to-menu button |
| `restart.png` | 273×105 | Restart button |
| `gameover.png` | 440×126 | Game-over heading |

### Obstacle composition
Each obstacle is one column with a **top piece** and a **bottom piece**, separated by the gap.
- **Bottom piece:** a random upward rock (`rock-tall-*`, `rock-short-1/2/4`), with its base on the floor line.
- **Top piece:** `rock-short-3` as-is, or an upward rock flipped vertically (`ctx.scale(1, -1)`), with its base against the ceiling.
- **Sizing:** each piece is drawn at `OBSTACLE_WIDTH` wide, stretched vertically to exactly fill from its edge (ceiling or floor) to the gap. The stretch is part of the look, like pixel-art pipes. To keep distortion low, choose a sprite whose natural aspect-scaled height is close to the needed height: a tall rock for long pieces, a short rock for short ones.
- **Hitbox:** always the logical column (a rectangle from the edge to the gap), shrunk horizontally by the obstacle hitbox inset. It does not depend on sprite shape.

## 4. Architecture

```
app/
  layout.tsx            metadata, pixel font (next/font), viewport (no zoom)
  page.tsx              renders <GameRoot/> (client-only)
  globals.css           Tailwind, touch-action:none, overscroll none
components/
  GameRoot.tsx          'use client'; owns the engine; switches screens by status
  GameCanvas.tsx        <canvas>, resize/DPR handling, attaches the engine
  screens/
    LoadingScreen.tsx   asset load progress / error + retry
    MainMenu.tsx        title, start, best score, settings button
    GetReady.tsx        "Tap / Space to flap" hint
    PauseOverlay.tsx    resume / menu
    GameOver.tsx        gameover.png, score, best, NEW badge, medal, restart/menu
    SettingsPanel.tsx   mute, volume, reduced motion
  ui/
    ImageButton.tsx     accessible <button> wrapping a sprite image
    ScoreHud.tsx        large score during play (DOM overlay, updated only on score events)
game/                   plain TypeScript, no React imports
  config.ts             all tuning constants
  types.ts              GameStatus, Dragon, Obstacle, WorldState, EngineEvents
  world.ts              createWorld(), resetWorld()
  physics.ts            stepDragon(dragon, dt), flap(dragon)
  obstacles.ts          spawner, recycling pool, gap randomization, difficulty ramp
  collision.ts          AABB tests: dragon vs obstacles, floor, ceiling
  scoring.ts            pass detection, medal thresholds
  renderer.ts           draw(world, ctx, alpha): parallax, obstacles, dragon, shake
  assets.ts             loadImages(manifest, onProgress) → Promise<Sprites>
  audio.ts              AudioManager: unlock(), play('flap'|'score'|'hit'|'fall'), setVolume/setMuted
  input.ts              keyboard/pointer binding → engine commands
  storage.ts            typed, versioned, try/catch localStorage
  engine.ts             createEngine(canvas, sprites, audio, events) → { start, flap, pause, resume, reset, destroy }
```

### Boundaries
- The `game/` folder has no React imports. Only `renderer.ts`, `input.ts`, `audio.ts`, `assets.ts`, `storage.ts` and `engine.ts` touch browser APIs. `physics`, `collision`, `obstacles`, `scoring` and `world` are pure and unit-testable. Randomness is passed in as an `rng: () => number` so tests can be deterministic.
- React talks to the engine **only** through its command API (`start/flap/pause/resume/reset/destroy`).
- The engine talks to React **only** through events: `onStatusChange(status)`, `onScore(score)`, `onGameOver({ score, best, isNewBest, medal })`.
- React does not re-render during frames. The HUD re-renders at most once per point scored.
- Client-only rendering: `GameRoot` is loaded with `next/dynamic(..., { ssr: false })` from a small client wrapper (Next's App Router doesn't allow `ssr:false` directly in a server component).

## 5. Game states

```
loading → menu → ready → playing ⇄ paused
          ↑        ↑        ↓
          │        └──── gameover
          └───────────────┘
```

- **loading:** preload all images with a progress bar. If an image fails, show which one and a Retry button.
- **menu:** background and floor scroll, the dragon bobs (`fly-normal`), the title, start button and best score show.
- **ready:** the dragon bobs in place, no gravity, no obstacles. The first flap switches to `playing` and applies that flap.
- **playing:** gravity, obstacles and scoring are active. A pause button is visible.
- **paused:** the simulation is frozen, with the last frame and an overlay shown. Triggered by Esc/P, the pause button, or `visibilitychange` (tab hidden). Resuming happens only by explicit user action.
- **gameover:** on collision, play the hit sound, switch to the `die` pose, and flash plus a short shake (the shake is skipped if reduced motion is on). Scrolling stops and the dragon falls to the floor. The game-over panel appears ~500 ms later, and input is ignored during that delay. Restart goes to `ready` and Menu goes to `menu`.

## 6. Engine loop

- `requestAnimationFrame` with a **fixed-timestep accumulator**: `STEP = 1/60 s`. Each frame's delta is capped at 250 ms, and at most 5 steps run per frame.
- Rendering blends dragon and obstacle positions between the previous and current state (`alpha = accumulator / STEP`), for smooth motion on high refresh-rate screens.
- One loop per engine instance. `destroy()` cancels the rAF and removes all listeners, which is safe under React StrictMode double-mounting.

## 7. Physics & tuning (`config.ts`, initial values)

The logical resolution is **432×768** (portrait). Units are logical pixels and seconds. The values are starting points to tune while playtesting.

| Constant | Initial |
|---|---|
| `GRAVITY` | 1800 px/s² |
| `FLAP_VELOCITY` | −540 px/s (sets velocity, doesn't add to it) |
| `MAX_FALL_SPEED` | 900 px/s |
| `DRAGON_DRAW_HEIGHT` | 64 px (width follows each sprite's aspect ratio) |
| `DRAGON_X` | 30% of logical width |
| Rotation | −25° when rising, easing toward +70° while falling fast |
| `SCROLL_SPEED` | 160 px/s (floor & obstacles); background at 0.2× |
| `OBSTACLE_WIDTH` | 78 px |
| `OBSTACLE_SPACING` | 230 px horizontal, center to center |
| `GAP_SIZE` | 190 px start, 150 px minimum |
| Gap limits | gap edges ≥ 90 px from the ceiling and from the floor line; next gap center within ±180 px of the previous |
| `FLOOR_HEIGHT` | 120 px drawn |
| Hitbox inset | dragon hitbox = 70% of drawn size, centered; obstacle hitbox inset 6 px on each side horizontally |
| Difficulty ramp | every 10 points: gap −8 px (floor 150), speed +8 px/s (cap 220) |

### Dragon pose selection
- `die` when status is gameover
- `fly-up` for 120 ms after a flap, or when velocity < −150
- `fly-down` when velocity > 250
- otherwise `fly-normal`

### Collision rules
- Hitting the floor or an obstacle ends the game.
- The ceiling does **not** end the game. The dragon's top is clamped to y ≥ 0 and upward velocity is set to 0.

### Scoring
- +1 when the dragon's center x passes an obstacle's center x (a `passed` flag ensures it counts once).
- Medals: bronze ≥ 10, silver ≥ 20, gold ≥ 30, platinum ≥ 40. Medals are drawn with Tailwind, since there are no medal assets.

## 8. Rendering

- The canvas backing store is `432×768 × devicePixelRatio`, with one `setTransform(dpr, 0, 0, dpr, 0, 0)` call. `imageSmoothingEnabled = false`.
- The container is scaled with CSS to fit the viewport at 432:768 and centered, with a dark volcanic letterbox color.
- Draw order: background (parallax, repeated) → obstacles → floor (repeated) → dragon (rotated around its center) → hit flash.
- Obstacles come from a fixed-size pool, with no objects created per frame during play. Images are decoded up front (`img.decode()`).

## 9. Audio (Web Audio API)

- One `AudioContext`, created or resumed on the **first user gesture**. All sounds go through a master `GainNode` (volume/mute).
- Sounds generated in code:
  - **flap:** band-passed noise burst, ~80 ms
  - **score:** two rising square-wave notes (880 → 1320 Hz), ~150 ms
  - **hit:** low noise burst + falling sine thud, ~200 ms
  - **fall:** falling tone, starting 150 ms after hit
- The noise buffer is created once and reused. Without Web Audio support, all calls silently do nothing.

## 10. Persistence (localStorage)

- Key `flappy-dragon:v1`. Value: `{ bestScore: number, settings: { muted: boolean, volume: number /* 0–1 */, reducedMotion: boolean } }`.
- Reads use try/catch plus a type guard. Invalid, missing or throwing storage falls back to defaults.
- The `reducedMotion` default comes from `matchMedia('(prefers-reduced-motion: reduce)')`.
- Writes happen on a new best score (at game over) and on every setting change.

## 11. Input

- **Flap:** Space, ArrowUp, W, or `pointerdown` on the game area. `e.repeat` is ignored.
- **Pause toggle:** Esc or P while playing or paused, plus the on-screen button.
- `preventDefault` is called on handled keys and on pointerdown over the canvas. The container uses `touch-action: none` and `user-select: none`.
- Pointer events on overlay buttons don't reach the canvas (overlays sit above it and stop propagation).

## 12. UI (React + Tailwind)

- Overlays are absolutely positioned inside the same scaled container as the canvas.
- `ImageButton` is a `<button>` with `aria-label`, a visible focus ring, and hover and active scale feedback.
- Pixel font "Press Start 2P" via `next/font/google` for the HUD and labels.
- On game over, focus moves to Restart (so Enter restarts). The panel shows score, best, a "NEW" badge and a medal.

## 13. Error handling

- Asset load failure: named asset plus a Retry button on the loading screen.
- No 2D canvas context: an "unsupported browser" message.
- Storage and audio failures: silent fallback (§9, §10).

## 14. Testing

- **Vitest unit tests** (`game/**/*.test.ts`):
  - physics: gravity builds up, flap sets velocity, fall speed is capped, ceiling clamps
  - collision: overlap, floor hit, a near-miss inside the inset is not a hit
  - obstacles: gap within limits (seeded rng), spacing, recycling, ramp and caps
  - scoring: each obstacle scores exactly once; medal thresholds
  - storage: defaults when missing, corrupt or throwing; save/load round-trip
  - engine timing: the same total elapsed time produces the same world state whether it's delivered as one frame or split across several
- **Playwright smoke test:** load → start → flap → wait for game over → panel visible → restart → ready.
- The gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.

## 15. Deliverable

A Next.js app in the repo root that runs with `pnpm dev`, can be deployed to Vercel, and includes a README with controls and scripts.
