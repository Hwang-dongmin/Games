import { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import GameHomeCard from '../components/home/GameHomeCard';
import HomeSfxToggle from '../components/home/HomeSfxToggle';
import PlayModeToggle from '../components/home/PlayModeToggle';
import {
  getGamePath,
  getGamesForMode,
  type PlayMode,
} from '../data/games';
import { startHomeBgm, stopHomeBgm } from '../utils/homeBgm';
import {
  loadSessionPlayMode,
  saveSessionPlayMode,
} from '../utils/playModeSession';
import { isLexioSfxMuted, unlockLexioAudio } from '../utils/lexioSounds';

const gridClassByMode: Record<PlayMode, string> = {
  offline: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  online: 'grid-cols-1 sm:max-w-md lg:max-w-xl xl:max-w-2xl sm:mx-auto w-full',
};

const pageShellClass =
  'mx-auto w-full max-w-6xl px-5 sm:px-8 lg:max-w-7xl lg:px-10 xl:max-w-[85rem] xl:px-12 2xl:max-w-[96rem] 2xl:px-16';

export default function Home() {
  const [mode, setMode] = useState<PlayMode>(
    () => loadSessionPlayMode() ?? 'offline',
  );
  const visibleGames = getGamesForMode(mode);

  const handleModeChange = (next: PlayMode) => {
    setMode(next);
    saveSessionPlayMode(next);
  };

  useEffect(() => {
    const onPointerDown = () => {
      unlockLexioAudio();
      if (!isLexioSfxMuted()) startHomeBgm();
    };
    window.addEventListener('pointerdown', onPointerDown, { once: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => () => stopHomeBgm(), []);

  return (
    <div className="home-page relative min-h-screen overflow-hidden bg-[#08070e]">
      <div className="home-page-ambient pointer-events-none absolute inset-0" aria-hidden>
        <div className="home-page-blob home-page-blob-a" />
        <div className="home-page-blob home-page-blob-b" />
        <div className="home-page-blob home-page-blob-c" />
      </div>

      <header className="home-header relative z-10 border-b border-white/[0.07] bg-[#08070e]/80 backdrop-blur-xl">
        <div className={`${pageShellClass} flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-600/10 shadow-[0_0_28px_-6px_rgba(139,92,246,0.55)] ring-1 ring-violet-400/25">
              <Gamepad2 className="h-5 w-5 text-violet-200" strokeWidth={2.25} />
            </div>
            <h1 className="home-title text-[1.35rem] font-bold tracking-tight sm:text-2xl">
              게임 아케이드
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <HomeSfxToggle />
            <PlayModeToggle mode={mode} onChange={handleModeChange} />
          </div>
        </div>
      </header>

      <main className={`relative z-10 py-10 sm:py-14 ${pageShellClass}`}>
        <div
          key={mode}
          className={`home-game-grid grid gap-5 ${gridClassByMode[mode]}`}
        >
          {visibleGames.map((game, index) => (
            <GameHomeCard
              key={game.id}
              game={game}
              to={getGamePath(game, mode)}
              index={index}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
