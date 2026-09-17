'use client';

import dynamic from 'next/dynamic';
import { GameFrame } from './GameFrame';
import { LoadingScreen } from './screens/LoadingScreen';

const GameRoot = dynamic(() => import('./GameRoot'), {
  ssr: false,
  loading: () => (
    <GameFrame data-testid="game-root" data-status="loading">
      <LoadingScreen loaded={0} total={1} />
    </GameFrame>
  ),
});

export default function ClientGame() {
  return <GameRoot />;
}
