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
