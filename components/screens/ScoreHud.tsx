import type { MouseEvent } from 'react';

interface ScoreHudProps {
  score: number;
  onPause?: () => void;
}

export function ScoreHud({ score, onPause }: ScoreHudProps) {
  const handlePause = (event: MouseEvent<HTMLButtonElement>) => {
    // Drop focus so Space flaps after resuming instead of being swallowed by this button.
    event.currentTarget.blur();
    onPause?.();
  };

  return (
    <>
      <p className="pointer-events-none absolute inset-x-0 top-[6cqh] text-center text-[length:10cqw] [text-shadow:0_0.8cqh_0_#1a0d0a]">
        {score}
      </p>
      {onPause && (
        <button
          type="button"
          aria-label="Pause"
          onClick={handlePause}
          className="absolute right-[3cqw] top-[3cqh] border-4 border-ember-950 bg-lava-500 px-[2.5cqw] py-[1cqh] text-[length:3.5cqw] text-ember-950 focus-visible:outline-4 focus-visible:outline-lava-300"
        >
          II
        </button>
      )}
    </>
  );
}
