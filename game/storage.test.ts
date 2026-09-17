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
