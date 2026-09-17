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
