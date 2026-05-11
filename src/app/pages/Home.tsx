import { Link } from 'react-router';
import { Gamepad2, Grid3x3, Brain, Grid2x2, Zap, Spade } from 'lucide-react';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const games = [
  {
    id: 'tic-tac-toe',
    title: '틱택토',
    description: '3x3 보드에서 먼저 3개를 연결하세요',
    icon: Grid3x3,
    path: '/tic-tac-toe',
    color: 'from-blue-500 to-cyan-500',
    image: 'https://images.unsplash.com/photo-1734352749174-32c5f5919a02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aWMlMjB0YWMlMjB0b2UlMjBnYW1lfGVufDF8fHx8MTc3MTkzNzU0MXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'memory-game',
    title: '메모리 게임',
    description: '카드를 뒤집어 같은 그림을 찾으세요',
    icon: Brain,
    path: '/memory-game',
    color: 'from-purple-500 to-pink-500',
    image: 'https://images.unsplash.com/photo-1769577608140-9f91760aef04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZW1vcnklMjBjYXJkcyUyMGdhbWV8ZW58MXx8fHwxNzcxOTM3NTQxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: '2048',
    title: '2048',
    description: '숫자 타일을 합쳐 2048을 만드세요',
    icon: Grid2x2,
    path: '/2048',
    color: 'from-orange-500 to-red-500',
    image: 'https://images.unsplash.com/photo-1612385763901-68857dd4c43c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdXp6bGUlMjBnYW1lJTIwY29sb3JmdWx8ZW58MXx8fHwxNzcxOTM3MzM3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'snake',
    title: '스네이크',
    description: '뱀을 조종해서 먹이를 먹으세요',
    icon: Zap,
    path: '/snake',
    color: 'from-green-500 to-emerald-500',
    image: 'https://images.unsplash.com/photo-1567027757540-7b572280fa22?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYW1pbmclMjBjb250cm9sbGVyJTIwbmVvbnxlbnwxfHx8fDE3NzE4ODMxOTl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
  {
    id: 'holdem',
    title: '텍사스 홀덤',
    description: 'AI와 함께하는 포커 게임',
    icon: Spade,
    path: '/holdem',
    color: 'from-amber-600 to-amber-800',
    image: 'https://images.unsplash.com/photo-1541278107931-e006523892df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb2tlciUyMGNhcmRzfGVufDF8fHx8MTc0NjYzMDAwMHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-8 h-8 text-purple-400" />
            <h1 className="text-3xl font-bold text-white">게임 아케이드</h1>
          </div>
          <p className="mt-2 text-gray-300">재미있는 미니 게임을 즐겨보세요!</p>
        </div>
      </header>

      {/* Games Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {games.map((game) => {
            const Icon = game.icon;
            return (
              <Link
                key={game.id}
                to={game.path}
                className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50"
              >
                {/* Background Image */}
                <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                  <ImageWithFallback
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Gradient Overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-60 group-hover:opacity-80 transition-opacity`} />

                {/* Content */}
                <div className="relative p-6 h-full flex flex-col">
                  <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm mb-4">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">{game.title}</h3>
                  <p className="text-gray-200 text-sm flex-grow">{game.description}</p>
                  <div className="mt-4 flex items-center text-white font-medium">
                    <span>플레이하기</span>
                    <svg
                      className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
