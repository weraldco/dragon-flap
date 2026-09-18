import { describe, expect, it, vi } from 'vitest';
import type { Sprites } from './assets';
import { render } from './renderer';
import { createWorld } from './world';

function image(width: number, height: number): HTMLImageElement {
  return { width, height } as HTMLImageElement;
}

function sprites(): Sprites {
  const dragon = image(235, 256);
  return {
    background: image(432, 768),
    floor: image(432, 180),
    'dragon-fly-up': dragon,
    'dragon-fly-normal': dragon,
    'dragon-fly-down': dragon,
    'dragon-die': dragon,
    'rock-tall-1': image(196, 454),
    'rock-tall-2': image(196, 451),
    'rock-short-1': image(196, 273),
    'rock-short-2': image(196, 275),
    'rock-short-3': image(219, 234),
    'rock-short-4': image(219, 240),
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
  it('draws the dragon at 90 pixels high while preserving its aspect ratio', () => {
    const ctx = context();
    const gameSprites = sprites();

    render(ctx, gameSprites, createWorld(), 1, { reducedMotion: true });

    const drawCalls = vi.mocked(ctx.drawImage).mock.calls;
    const dragonCall = drawCalls.find(([sprite]) => sprite === gameSprites['dragon-fly-normal']);
    expect(dragonCall).toBeDefined();
    expect(dragonCall?.[3]).toBeCloseTo((235 * 90) / 256);
    expect(dragonCall?.[4]).toBe(90);
  });

  it('extends top rocks above the canvas while keeping their tips aligned to the gap', () => {
    const ctx = context();
    const gameSprites = sprites();
    const world = createWorld();
    Object.assign(world.obstacles[0], {
      active: true,
      x: 300,
      prevX: 300,
      gapCenter: 300,
      gapSize: 190,
      topSprite: 'rock-short-3',
      topFlipped: false,
      bottomSprite: 'rock-short-1',
    });

    render(ctx, gameSprites, world, 1, { reducedMotion: true });

    const drawCalls = vi.mocked(ctx.drawImage).mock.calls;
    const topRockCall = drawCalls.find(([sprite]) => sprite === gameSprites['rock-short-3']);
    expect(topRockCall).toBeDefined();
    expect(topRockCall?.[2]).toBe(-24);
    expect(Number(topRockCall?.[2]) + Number(topRockCall?.[4])).toBe(205);
  });
});
