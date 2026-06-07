import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import type { GameDefinition } from '../../data/games';
import { ImageWithFallback } from './ImageWithFallback';

type GameHomeCardProps = {
  game: GameDefinition;
  to: string;
  index?: number;
};

const gameAccent: Record<string, { bar: string; glow: string }> = {
  lexio: { bar: 'bg-violet-500', glow: '139, 92, 246' },
  holdem: { bar: 'bg-amber-400', glow: '245, 158, 11' },
  '2048': { bar: 'bg-orange-500', glow: '249, 115, 22' },
};

export default function GameHomeCard({ game, to, index = 0 }: GameHomeCardProps) {
  const accent = gameAccent[game.id] ?? { bar: 'bg-white', glow: '255, 255, 255' };

  return (
    <Link
      to={to}
      className="home-game-card group relative flex min-h-[18rem] overflow-hidden rounded-2xl sm:min-h-[19.5rem]"
      style={
        {
          '--card-index': index,
          '--card-glow': accent.glow,
        } as CSSProperties
      }
    >
      <div className="home-game-card-border pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />

      <ImageWithFallback
        src={game.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
      />

      <div
        className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-35 transition-opacity duration-500 group-hover:opacity-50`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/5 transition-opacity duration-500 group-hover:from-black/90" />

      <div className="home-game-card-sheen pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mt-auto w-full p-5 sm:p-6">
        <h3 className="text-xl font-bold tracking-tight text-white transition-all duration-300 group-hover:-translate-y-0.5 sm:text-[1.35rem]">
          {game.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-400 transition-colors duration-300 group-hover:text-zinc-300">
          {game.description}
        </p>
      </div>

      <div
        className={`absolute bottom-0 left-0 h-[3px] w-full origin-left scale-x-[0.35] ${accent.bar} transition-transform duration-500 ease-out group-hover:scale-x-100`}
        aria-hidden
      />
    </Link>
  );
}
