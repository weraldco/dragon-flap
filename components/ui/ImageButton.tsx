import Image from 'next/image';
import type { ComponentProps } from 'react';

type ImageButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  src: string;
  width: number;
  height: number;
  label: string;
};

export function ImageButton({ src, width, height, label, className = '', type = 'button', ...props }: ImageButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      {...props}
      className={`block transition-transform hover:scale-105 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-lava-300 active:scale-95 ${className}`}
    >
      <Image src={src} alt="" width={width} height={height} unoptimized draggable={false} className="pixelated h-auto w-full" />
    </button>
  );
}
