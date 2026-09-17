import Image from 'next/image';
import { useEffect, useRef } from 'react';
import type { GameOverResult } from '@/game/types';
import { ImageButton } from '../ui/ImageButton';
import { MedalBadge } from '../ui/MedalBadge';

interface GameOverProps {
  result: GameOverResult;
  onRestart: () => void;
  onMenu: () => void;
}

export function GameOver({ result, onRestart, onMenu }: GameOverProps) {
  const restartRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    restartRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950/60 px-[8cqw]"
    >
      <h2 id="gameover-title" className="w-[85%]">
        <Image src="/assets/gameover.png" alt="Game over" width={440} height={126} unoptimized className="pixelated h-auto w-full" />
      </h2>
      <div className="flex w-full items-center gap-[5cqw] border-4 border-ember-950 bg-ember-700 p-[4cqw] shadow-[0_0.8cqh_0_0_#1a0d0a]">
        <MedalBadge medal={result.medal} />
        <dl className="flex flex-1 flex-col gap-[2cqh] text-right">
          <div>
            <dt className="text-[length:2.8cqw] text-lava-300">Score</dt>
            <dd className="text-[length:6cqw]">{result.score}</dd>
          </div>
          <div>
            <dt className="text-[length:2.8cqw] text-lava-300">
              {result.isNewBest && <span className="mr-[1.5cqw] bg-lava-500 px-[1cqw] text-ember-950">NEW</span>}
              Best
            </dt>
            <dd className="text-[length:6cqw]">{result.best}</dd>
          </div>
        </dl>
      </div>
      <div className="flex w-full items-center justify-center gap-[4cqw]">
        <ImageButton ref={restartRef} src="/assets/restart.png" width={273} height={105} label="Restart" onClick={onRestart} className="w-[45%]" />
        <ImageButton src="/assets/menu.png" width={273} height={76} label="Back to menu" onClick={onMenu} className="w-[45%]" />
      </div>
    </div>
  );
}
