'use client';

import { useEffect, useRef } from 'react';
import type { Sprites } from '@/game/assets';
import type { AudioManager } from '@/game/audio';
import { createEngine, type Engine, type EngineEvents } from '@/game/engine';
import { UnsupportedCanvasError } from '@/game/renderer';

interface GameCanvasProps {
  sprites: Sprites;
  audio: AudioManager;
  events: EngineEvents;
  bestScore: number;
  reducedMotion: boolean;
  onEngineChange: (engine: Engine | null) => void;
  onUnsupported: () => void;
}

export function GameCanvas({ sprites, audio, events, bestScore, reducedMotion, onEngineChange, onUnsupported }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  // The engine tracks best score and motion itself after creation; later changes flow through commands.
  const initialRef = useRef({ bestScore, reducedMotion });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: Engine;
    try {
      engine = createEngine({ canvas, sprites, audio, events, ...initialRef.current });
    } catch (error) {
      if (error instanceof UnsupportedCanvasError) {
        onUnsupported();
        return;
      }
      throw error;
    }
    engineRef.current = engine;
    onEngineChange(engine);
    return () => {
      engine.destroy();
      engineRef.current = null;
      onEngineChange(null);
    };
  }, [sprites, audio, events, onEngineChange, onUnsupported]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return <canvas ref={canvasRef} aria-label="Flappy Dragon game" className="absolute inset-0 block size-full" />;
}
