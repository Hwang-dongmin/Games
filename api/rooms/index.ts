import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clampInt,
  getRedis,
  isValidRoomCode,
  normalizeNickname,
  ROOM_TTL_SECONDS,
  ROOMS_INDEX_KEY,
  roomKey,
  type StoredRoom,
} from '../_lib/redis';

const MAX_LISTED_ROOMS = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  if (!redis) {
    res.status(503).json({ error: 'lobby_disabled' });
    return;
  }

  if (req.method === 'GET') {
    return listRooms(redis, res);
  }
  if (req.method === 'POST') {
    return registerRoom(redis, req, res);
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'method_not_allowed' });
}

async function listRooms(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  res: VercelResponse,
) {
  const now = Date.now();
  await redis.zremrangebyscore(ROOMS_INDEX_KEY, 0, now);
  const codes = (await redis.zrange(ROOMS_INDEX_KEY, 0, MAX_LISTED_ROOMS - 1)) as string[];

  if (codes.length === 0) {
    res.status(200).json({ rooms: [] });
    return;
  }

  const raw = (await redis.mget<(StoredRoom | null)[]>(
    ...codes.map((c) => roomKey(c)),
  )) as (StoredRoom | null)[];

  const rooms = raw
    .filter((r): r is StoredRoom => Boolean(r) && r!.phase === 'lobby')
    .map((r) => ({
      code: r.code,
      hostNickname: r.hostNickname,
      playerCount: r.playerCount,
      maxPlayers: r.maxPlayers,
      totalRounds: r.totalRounds,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  res.status(200).json({ rooms });
}

async function registerRoom(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  req: VercelRequest,
  res: VercelResponse,
) {
  const body = parseBody(req.body);
  const code = body.code;
  if (!isValidRoomCode(code)) {
    res.status(400).json({ error: 'invalid_room_code' });
    return;
  }

  const now = Date.now();
  const room: StoredRoom = {
    code,
    hostNickname: normalizeNickname(body.hostNickname) || '호스트',
    playerCount: clampInt(body.playerCount, 1, 8, 1),
    maxPlayers: clampInt(body.maxPlayers, 2, 8, 5),
    totalRounds: clampInt(body.totalRounds, 1, 20, 5),
    phase: 'lobby',
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(roomKey(code), room, { ex: ROOM_TTL_SECONDS });
  await redis.zadd(ROOMS_INDEX_KEY, {
    score: now + ROOM_TTL_SECONDS * 1000,
    member: code,
  });

  res.status(200).json({ ok: true, room });
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body as Record<string, unknown>;
}
