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
