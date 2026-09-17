export interface InputHandlers {
  onFlap(): void;
  onPause(): void;
  onGesture(): void;
}

const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('button, input, select, textarea, a') !== null;
}

export function bindInput(canvas: HTMLCanvasElement, handlers: InputHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (FLAP_KEYS.has(event.code)) {
      // Focused buttons (Start, Restart) keep their native Space activation.
      if (isInteractive(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      handlers.onGesture();
      handlers.onFlap();
    } else if (PAUSE_KEYS.has(event.code) && !event.repeat) {
      handlers.onPause();
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handlers.onGesture();
    handlers.onFlap();
  };

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('pointerdown', onPointerDown);
  };
}
