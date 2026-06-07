export type PlayMode = 'offline' | 'online';

export type GameDefinition = {
  id: string;
  title: string;
  description: string;
  color: string;
  image: string;
  offlinePath: string;
  onlinePath?: string;
  offline: boolean;
  online: boolean;
};

export const games: GameDefinition[] = [
  {
    id: 'lexio',
    title: '렉시오',
    description: 'AI와 오프라인 플레이, 또는 친구와 온라인 멀티플레이',
    offlinePath: '/lexio',
    onlinePath: '/lexio/online',
    color: 'from-purple-600 to-indigo-700',
    image:
      'https://images.unsplash.com/photo-1742343886931-14ea96977531?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    offline: true,
    online: true,
  },
  {
    id: 'holdem',
    title: '텍사스 홀덤',
    description: 'AI와 함께하는 포커 게임',
    offlinePath: '/holdem',
    color: 'from-amber-600 to-amber-800',
    image:
      'https://images.unsplash.com/photo-1541278107931-e006523892df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb2tlciUyMGNhcmRzfGVufDF8fHx8MTc0NjYzMDAwMHww&ixlib=rb-4.1.0&q=80&w=1080',
    offline: true,
    online: false,
  },
  {
    id: '2048',
    title: '2048',
    description: '숫자 타일을 합쳐 2048을 만드세요',
    offlinePath: '/2048',
    color: 'from-orange-500 to-red-500',
    image:
      'https://images.unsplash.com/photo-1769577608140-9f91760aef04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    offline: true,
    online: false,
  },
];

export function getGamesForMode(mode: PlayMode): GameDefinition[] {
  return games
    .filter((game) => (mode === 'offline' ? game.offline : game.online))
    .map((game) => {
      if (mode === 'online' && game.id === 'lexio') {
        return {
          ...game,
          description: '친구와 함께하는 온라인 멀티플레이',
        };
      }
      return game;
    });
}

export function getGamePath(game: GameDefinition, mode: PlayMode): string {
  if (mode === 'online') {
    return game.onlinePath ?? game.offlinePath;
  }
  return game.offlinePath;
}
