import type { ComponentProps } from 'react';

export function TextButton({ className = '', type = 'button', ...props }: ComponentProps<'button'>) {
  return (
    <button
      type={type}
      {...props}
      className={`border-4 border-ember-950 bg-lava-500 px-[4cqw] py-[1.5cqh] text-[length:3.4cqw] text-ember-950 shadow-[0_0.6cqh_0_0_#1a0d0a] transition-transform hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-lava-300 active:translate-y-[0.6cqh] active:shadow-none disabled:opacity-50 ${className}`}
    />
  );
}
