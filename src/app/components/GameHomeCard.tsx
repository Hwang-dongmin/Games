import { Link } from 'react-router';
import type { GameDefinition } from '../data/games';
import { ImageWithFallback } from './figma/ImageWithFallback';

type GameHomeCardProps = {
  game: GameDefinition;
  to: string;
};

export default function GameHomeCard({ game, to }: GameHomeCardProps) {
  const Icon = game.icon;

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/[0.09] hover:shadow-xl hover:shadow-purple-500/15 active:scale-[0.99]"
    >
      <div className="absolute inset-0 opacity-[0.18] transition-opacity duration-300 group-hover:opacity-[0.28]">
        <ImageWithFallback
          src={game.image}
          alt={game.title}
          className="w-full h-full object-cover"
        />
      </div>

      <div
        className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-55 transition-opacity duration-300 group-hover:opacity-70`}
      />

      <div className="relative flex h-full min-h-[13.5rem] flex-col p-6">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/10 backdrop-blur-sm">
          <Icon className="h-7 w-7 text-white" strokeWidth={2} />
        </div>
        <h3 className="mb-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
          {game.title}
        </h3>
        <p className="flex-grow text-sm leading-relaxed text-white/70">{game.description}</p>
        <div className="mt-5 flex items-center text-sm font-medium text-white/90">
          <span>플레이하기</span>
          <svg
            className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </Link>
  );
}
