import { TextButton } from '../ui/TextButton';

interface LoadingScreenProps {
  loaded: number;
  total: number;
  error?: string;
  onRetry?: () => void;
}

export function LoadingScreen({ loaded, total, error, onRetry }: LoadingScreenProps) {
  const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4cqh] bg-ember-950 px-[8cqw] text-center">
      {error ? (
        <>
          <p role="alert" className="text-[length:3.2cqw] leading-relaxed text-lava-300">
            {error}
          </p>
          {onRetry && <TextButton onClick={onRetry}>Retry</TextButton>}
        </>
      ) : (
        <>
          <p className="text-[length:4cqw]">Loading…</p>
          <div
            role="progressbar"
            aria-label="Loading game assets"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-[2cqh] w-full border-2 border-lava-300 bg-ember-900"
          >
            <div className="h-full bg-lava-500 transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
