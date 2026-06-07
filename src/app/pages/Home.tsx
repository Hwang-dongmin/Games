import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import GameHomeCard from '../components/GameHomeCard';
import PlayModeToggle from '../components/PlayModeToggle';
import {
  getGamePath,
  getGamesForMode,
  type PlayMode,
} from '../data/games';

const gridClassByMode: Record<PlayMode, string> = {
  offline: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  online: 'grid-cols-1 max-w-sm mx-auto w-full',
};

export default function Home() {
  const [mode, setMode] = useState<PlayMode>('offline');
  const visibleGames = getGamesForMode(mode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:py-6">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 ring-1 ring-white/10">
                <Gamepad2 className="h-5 w-5 text-violet-300" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
                  게임 아케이드
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 sm:justify-end">
              <PlayModeToggle mode={mode} onChange={setMode} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <div
          key={mode}
          className={`home-game-grid grid gap-5 ${gridClassByMode[mode]}`}
        >
          {visibleGames.map((game) => (
            <GameHomeCard
              key={game.id}
              game={game}
              to={getGamePath(game, mode)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
