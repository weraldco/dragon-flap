import type { ComponentProps } from 'react';

export function GameFrame({ className = '', style, ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={`relative touch-none select-none overflow-hidden bg-ember-900 [container-type:size] ${className}`}
      style={{ height: 'min(100dvh, calc(100vw * 16 / 9))', aspectRatio: '9 / 16', ...style }}
    />
  );
}
