import { useEffect, useRef } from 'react';
import { ImageButton } from '../ui/ImageButton';
import { TextButton } from '../ui/TextButton';

interface PauseOverlayProps {
  onResume: () => void;
  onMenu: () => void;
}

export function PauseOverlay({ onResume, onMenu }: PauseOverlayProps) {
  const resumeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    resumeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950/70"
    >
      <p className="text-[length:7cqw] text-lava-300">Paused</p>
      <TextButton ref={resumeRef} onClick={onResume}>
        Resume
      </TextButton>
      <ImageButton src="/assets/menu.png" width={273} height={76} label="Back to menu" onClick={onMenu} className="w-[45%]" />
    </div>
  );
}
