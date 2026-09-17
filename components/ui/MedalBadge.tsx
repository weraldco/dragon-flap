import type { Medal } from '@/game/types';

const MEDAL_COLORS: Record<Exclude<Medal, 'none'>, string> = {
  bronze: 'bg-[#cd7f32]',
  silver: 'bg-[#c0c0c0]',
  gold: 'bg-[#ffd700]',
  platinum: 'bg-[#e5f4ff]',
};

export function MedalBadge({ medal }: { medal: Medal }) {
  return (
    <div className="flex flex-col items-center gap-[1cqh]">
      <p className="text-[length:2.8cqw] text-lava-300">Medal</p>
      {medal === 'none' ? (
        <div role="img" aria-label="No medal" className="size-[16cqw] rounded-full border-4 border-dashed border-ember-950/60" />
      ) : (
        <div
          role="img"
          aria-label={`${medal} medal`}
          className={`size-[16cqw] rounded-full border-4 border-ember-950 shadow-[inset_0_-1cqw_0_rgba(0,0,0,0.25)] ${MEDAL_COLORS[medal]}`}
        />
      )}
    </div>
  );
}
