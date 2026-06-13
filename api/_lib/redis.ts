import { Redis } from '@upstash/redis';

let cached: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  cached = url && token ? new Redis({ url, token }) : null;
  return cached;
}

export const ROOM_TTL_SECONDS = 45;

export const ROOMS_INDEX_KEY = 'lexio:rooms:index';
export const roomKey = (code: string) => `lexio:room:${code}`;

export const LEADERBOARD_KEY = 'lexio:leaderboard';
export const RESULTS_FEED_KEY = 'lexio:results';
export const playerKey = (id: string) => `lexio:player:${id}`;

export type StoredRoom = {
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  phase: 'lobby' | 'playing';
  createdAt: number;
  updatedAt: number;
};

const ROOM_CODE_PATTERN = /^lexio-[A-HJ-NP-Z2-9]{6}$/;

export function isValidRoomCode(code: unknown): code is string {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}

export function normalizeNickname(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s.slice(0, 24);
}

export function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
