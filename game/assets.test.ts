import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSprites, SPRITE_MANIFEST } from './assets';

class ControlledImage {
  static instances: ControlledImage[] = [];

  decoding = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    ControlledImage.instances.push(this);
  }

  decode(): Promise<void> {
    return Promise.resolve();
  }
}

describe('loadSprites', () => {
  afterEach(() => {
    ControlledImage.instances = [];
    vi.unstubAllGlobals();
  });

  it('stops reporting progress after an image rejects', async () => {
    vi.stubGlobal('Image', ControlledImage);
    const onProgress = vi.fn();

    const loading = loadSprites(onProgress);
    expect(ControlledImage.instances).toHaveLength(Object.keys(SPRITE_MANIFEST).length);

    ControlledImage.instances[0].onerror?.();
    await expect(loading).rejects.toThrow('Failed to load /assets/background.webp');

    ControlledImage.instances[1].onload?.();
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(onProgress).not.toHaveBeenCalled();
  });
});
