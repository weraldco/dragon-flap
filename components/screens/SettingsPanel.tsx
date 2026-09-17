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
