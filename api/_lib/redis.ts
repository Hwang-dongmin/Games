import { createHash } from 'node:crypto';
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

export const ROOMS_INDEX_KEY = 'games:rooms:index';
export const roomKey = (code: string) => `games:room:${code}`;

export const LEADERBOARD_KEY = 'lexio:leaderboard';
export const RESULTS_FEED_KEY = 'lexio:results';
export const playerKey = (id: string) => `lexio:player:${id}`;

export const SUPPORTED_GAME_IDS = ['lexio'] as const;
export type GameId = (typeof SUPPORTED_GAME_IDS)[number];

export type RoomVisibility = 'public' | 'private';
export type RoomPhase = 'lobby' | 'playing';

export type StoredRoom = {
  code: string;
  gameId: GameId;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  phase: RoomPhase;
  visibility: RoomVisibility;
  passwordHash: string | null;
  createdAt: number;
  updatedAt: number;
};

const ROOM_CODE_PATTERN = /^lexio-[A-HJ-NP-Z2-9]{6}$/;

export function isValidRoomCode(code: unknown): code is string {
  return typeof code === 'string' && ROOM_CODE_PATTERN.test(code);
}

export function isValidGameId(id: unknown): id is GameId {
  return (
    typeof id === 'string' &&
    (SUPPORTED_GAME_IDS as readonly string[]).includes(id)
  );
}

export function normalizeNickname(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s.slice(0, 24);
}

export const ROOM_PASSWORD_MAX = 4;

export function normalizePassword(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function isValidRoomPassword(raw: unknown): boolean {
  const p = normalizePassword(raw);
  return p.length >= 1 && p.length <= ROOM_PASSWORD_MAX;
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function parseVisibility(raw: unknown): RoomVisibility {
  return raw === 'private' ? 'private' : 'public';
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

export function toPublicRoom(room: StoredRoom) {
  return {
    code: room.code,
    gameId: room.gameId,
    hostNickname: room.hostNickname,
    playerCount: room.playerCount,
    maxPlayers: room.maxPlayers,
    totalRounds: room.totalRounds,
    phase: room.phase,
    visibility: room.visibility,
    hasPassword: room.visibility === 'private',
    createdAt: room.createdAt,
  };
}
