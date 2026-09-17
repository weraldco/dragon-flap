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
