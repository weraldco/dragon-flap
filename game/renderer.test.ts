import { describe, expect, it, vi } from 'vitest';
import type { Sprites } from './assets';
import { render } from './renderer';
import { createWorld } from './world';

function image(width: number, height: number): HTMLImageElement {
  return { width, height } as HTMLImageElement;
}

function sprites(): Sprites {
  const rock = image(196, 273);
  const dragon = image(235, 256);
  return {
    background: image(432, 768),
    floor: image(432, 180),
    'dragon-fly-up': dragon,
    'dragon-fly-normal': dragon,
    'dragon-fly-down': dragon,
    'dragon-die': dragon,
    'rock-tall-1': rock,
    'rock-tall-2': rock,
    'rock-short-1': rock,
    'rock-short-2': rock,
    'rock-short-3': rock,
    'rock-short-4': rock,
  };
}

function context(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('render', () => {
  it('draws the dragon at 72 pixels high while preserving its aspect ratio', () => {
    const ctx = context();
    const gameSprites = sprites();

    render(ctx, gameSprites, createWorld(), 1, { reducedMotion: true });

    const drawCalls = vi.mocked(ctx.drawImage).mock.calls;
    const dragonCall = drawCalls.find(([sprite]) => sprite === gameSprites['dragon-fly-normal']);
    expect(dragonCall).toBeDefined();
    expect(dragonCall?.[3]).toBeCloseTo((235 * 72) / 256);
    expect(dragonCall?.[4]).toBe(72);
  });
});
