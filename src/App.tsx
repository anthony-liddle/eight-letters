import { useEffect, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { loadGameData, type GameData } from '@/data/gameData.ts';
import { WebAudioEngine } from '@/audio/WebAudioEngine.ts';
import { GameStorage } from '@/persistence/storage.ts';
import { Game } from '@/ui/Game.tsx';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: GameData }
  | { status: 'error'; message: string };

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const audio = useMemo(() => new WebAudioEngine(), []);
  const storage = useMemo(() => new GameStorage(), []);

  useEffect(() => {
    let active = true;
    loadGameData()
      .then((data) => active && setLoad({ status: 'ready', data }))
      .catch(
        (err: unknown) =>
          active &&
          setLoad({
            status: 'error',
            message: err instanceof Error ? err.message : 'Could not load.',
          }),
      );
    return () => {
      active = false;
    };
  }, []);

  if (load.status === 'loading') {
    return (
      <div className="app">
        <div className="loading">
          <p>Setting the type.</p>
        </div>
        <Analytics />
      </div>
    );
  }

  if (load.status === 'error') {
    return (
      <div className="app">
        <div className="error">
          <p>The word lists did not load. Reload to try again.</p>
          <p className="found__empty">{load.message}</p>
        </div>
        <Analytics />
      </div>
    );
  }

  return (
    <>
      <Game data={load.data} audio={audio} storage={storage} />
      <Analytics />
    </>
  );
}
