import type { PlayMode } from '../data/games';

const PLAY_MODE_SESSION_KEY = 'games-play-mode';

export function loadSessionPlayMode(): PlayMode | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(PLAY_MODE_SESSION_KEY);
  if (raw === 'offline' || raw === 'online') return raw;
  return null;
}

export function saveSessionPlayMode(mode: PlayMode): void {
  window.sessionStorage.setItem(PLAY_MODE_SESSION_KEY, mode);
}
