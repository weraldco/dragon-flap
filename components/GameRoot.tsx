'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AssetLoadError, loadSprites, type Sprites } from '@/game/assets';
import { AudioManager } from '@/game/audio';
import type { Engine, EngineEvents } from '@/game/engine';
import { getBrowserStore, loadSaveData, saveSaveData, type SaveData, type Settings } from '@/game/storage';
import type { GameOverResult, GameStatus } from '@/game/types';
import { GameCanvas } from './GameCanvas';
import { GameFrame } from './GameFrame';
import { GameOver } from './screens/GameOver';
import { GetReady } from './screens/GetReady';
import { LoadingScreen } from './screens/LoadingScreen';
import { MainMenu } from './screens/MainMenu';
import { PauseOverlay } from './screens/PauseOverlay';
import { ScoreHud } from './screens/ScoreHud';
import { SettingsPanel } from './screens/SettingsPanel';

type Phase =
  | { kind: 'loading'; loaded: number; total: number }
  | { kind: 'error'; message: string; retryable: boolean }
  | { kind: 'running' };

interface UiState {
  phase: Phase;
  status: GameStatus;
  score: number;
  result: GameOverResult | null;
  save: SaveData;
  settingsOpen: boolean;
}

type Action =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'loaded' }
  | { type: 'failed'; message: string; retryable: boolean }
  | { type: 'retry' }
  | { type: 'status'; status: GameStatus }
  | { type: 'score'; score: number }
  | { type: 'gameOver'; result: GameOverResult }
  | { type: 'settings'; settings: Settings }
  | { type: 'settingsOpen'; open: boolean };

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'progress':
      return { ...state, phase: { kind: 'loading', loaded: action.loaded, total: action.total } };
    case 'loaded':
      return { ...state, phase: { kind: 'running' }, status: 'menu' };
    case 'failed':
      return { ...state, phase: { kind: 'error', message: action.message, retryable: action.retryable } };
    case 'retry':
      return { ...state, phase: { kind: 'loading', loaded: 0, total: 1 } };
    case 'status': {
      const resetsScore = action.status === 'ready' || action.status === 'menu';
      return { ...state, status: action.status, score: resetsScore ? 0 : state.score, settingsOpen: false };
    }
    case 'score':
      return { ...state, score: action.score };
    case 'gameOver':
      return {
        ...state,
        result: action.result,
        save: action.result.isNewBest ? { ...state.save, bestScore: action.result.best } : state.save,
      };
    case 'settings':
      return { ...state, save: { ...state.save, settings: action.settings } };
    case 'settingsOpen':
      return { ...state, settingsOpen: action.open };
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function initState(): UiState {
  return {
    phase: { kind: 'loading', loaded: 0, total: 1 },
    status: 'menu',
    score: 0,
    result: null,
    save: loadSaveData(getBrowserStore(), prefersReducedMotion()),
    settingsOpen: false,
  };
}

export default function GameRoot() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [sprites, setSprites] = useState<Sprites | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [audio] = useState(() => new AudioManager(state.save.settings));
  const engineRef = useRef<Engine | null>(null);
  const savedRef = useRef(state.save);

  useEffect(() => {
    let cancelled = false;
    loadSprites((loaded, total) => {
      if (!cancelled) dispatch({ type: 'progress', loaded, total });
    })
      .then((loadedSprites) => {
        if (cancelled) return;
        setSprites(loadedSprites);
        dispatch({ type: 'loaded' });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const src = error instanceof AssetLoadError ? error.src : 'game assets';
        dispatch({ type: 'failed', message: `Could not load ${src}`, retryable: true });
      });
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  useEffect(() => {
    if (savedRef.current === state.save) return;
    savedRef.current = state.save;
    saveSaveData(getBrowserStore(), state.save);
  }, [state.save]);

  useEffect(() => () => audio.dispose(), [audio]);

  const events = useMemo<EngineEvents>(
    () => ({
      onStatusChange: (status) => dispatch({ type: 'status', status }),
      onScore: (score) => dispatch({ type: 'score', score }),
      onGameOver: (result) => dispatch({ type: 'gameOver', result }),
    }),
    [],
  );

  const handleEngineChange = useCallback((engine: Engine | null) => {
    engineRef.current = engine;
  }, []);

  const handleUnsupported = useCallback(() => {
    dispatch({ type: 'failed', message: 'Your browser does not support the game canvas.', retryable: false });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: 'retry' });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const startRound = useCallback(() => {
    audio.unlock();
    engineRef.current?.getReady();
  }, [audio]);

  const showMenu = useCallback(() => engineRef.current?.showMenu(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);
  const openSettings = useCallback(() => dispatch({ type: 'settingsOpen', open: true }), []);
  const closeSettings = useCallback(() => dispatch({ type: 'settingsOpen', open: false }), []);

  const changeSettings = useCallback(
    (settings: Settings) => {
      audio.setMuted(settings.muted);
      audio.setVolume(settings.volume);
      dispatch({ type: 'settings', settings });
    },
    [audio],
  );

  const { phase, status, score, result, save, settingsOpen } = state;
  const dataStatus = phase.kind === 'running' ? status : phase.kind;

  return (
    <GameFrame data-testid="game-root" data-status={dataStatus}>
      {sprites && (
        <GameCanvas
          sprites={sprites}
          audio={audio}
          events={events}
          bestScore={save.bestScore}
          reducedMotion={save.settings.reducedMotion}
          onEngineChange={handleEngineChange}
          onUnsupported={handleUnsupported}
        />
      )}

      {phase.kind === 'loading' && <LoadingScreen loaded={phase.loaded} total={phase.total} />}
      {phase.kind === 'error' && (
        <LoadingScreen loaded={0} total={0} error={phase.message} onRetry={phase.retryable ? retry : undefined} />
      )}

      {phase.kind === 'running' && (
        <>
          {status === 'menu' && !settingsOpen && (
            <MainMenu bestScore={save.bestScore} onStart={startRound} onOpenSettings={openSettings} />
          )}
          {status === 'menu' && settingsOpen && (
            <SettingsPanel settings={save.settings} onChange={changeSettings} onClose={closeSettings} />
          )}
          {status === 'ready' && <GetReady />}
          {(status === 'playing' || status === 'dying' || status === 'paused') && (
            <ScoreHud score={score} onPause={status === 'playing' ? pause : undefined} />
          )}
          {status === 'paused' && <PauseOverlay onResume={resume} onMenu={showMenu} />}
          {status === 'gameover' && result && <GameOver result={result} onRestart={startRound} onMenu={showMenu} />}
        </>
      )}
    </GameFrame>
  );
}
