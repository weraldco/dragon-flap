import Image from 'next/image';
import { ImageButton } from '../ui/ImageButton';
import { TextButton } from '../ui/TextButton';

interface MainMenuProps {
  bestScore: number;
  onStart: () => void;
  onOpenSettings: () => void;
}

export function MainMenu({ bestScore, onStart, onOpenSettings }: MainMenuProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between py-[10cqh]">
      <Image
        src="/assets/title.png"
        alt="Flappy Dragon: Volcanic Ascent"
        width={528}
        height={160}
        priority
        unoptimized
        className="pixelated h-auto w-[85%]"
      />
      <div className="flex w-full flex-col items-center gap-[3cqh]">
        <ImageButton src="/assets/start.png" width={563} height={113} label="Start game" onClick={onStart} className="w-[70%]" />
        <p className="text-[length:3.2cqw] text-lava-300 [text-shadow:0_0.4cqh_0_#1a0d0a]">Best {bestScore}</p>
        <TextButton onClick={onOpenSettings}>Settings</TextButton>
      </div>
    </div>
  );
}
