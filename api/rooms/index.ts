import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clampInt,
  getRedis,
  hashPassword,
  isValidGameId,
  isValidRoomCode,
  isValidRoomPassword,
  normalizeNickname,
  normalizePassword,
  parseVisibility,
  ROOM_TTL_SECONDS,
  ROOMS_INDEX_KEY,
  roomKey,
  toPublicRoom,
  type StoredRoom,
} from '../_lib/redis';

const MAX_LISTED_ROOMS = 100;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const redis = getRedis();
    if (!redis) {
      res.status(503).json({ error: 'lobby_disabled' });
      return;
    }

    if (req.method === 'GET') {
      return await listRooms(redis, res);
    }
    if (req.method === 'POST') {
      return await registerRoom(redis, req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/rooms]', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

async function listRooms(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  res: VercelResponse,
) {
  const now = Date.now();
  await redis.zremrangebyscore(ROOMS_INDEX_KEY, 0, now);
  const codes = (await redis.zrange(
    ROOMS_INDEX_KEY,
    0,
    MAX_LISTED_ROOMS - 1,
  )) as string[];

  if (codes.length === 0) {
    res.status(200).json({ rooms: [] });
    return;
  }

  const raw = (await redis.mget<(StoredRoom | null)[]>(
    ...codes.map((c) => roomKey(c)),
  )) as (StoredRoom | null)[];

  const rooms = raw
    .filter((r): r is StoredRoom => Boolean(r))
    .map(toPublicRoom)
    .sort((a, b) => {
      if (a.phase !== b.phase) return a.phase === 'lobby' ? -1 : 1;
      return b.createdAt - a.createdAt;
    });

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

  const gameId = body.gameId;
  if (!isValidGameId(gameId)) {
    res.status(400).json({ error: 'invalid_game_id' });
    return;
  }

  const visibility = parseVisibility(body.visibility);
  const password = normalizePassword(body.password);
  if (visibility === 'private' && !isValidRoomPassword(password)) {
    res.status(400).json({ error: 'invalid_password' });
    return;
  }

  const now = Date.now();
  const room: StoredRoom = {
    code,
    gameId,
    hostNickname: normalizeNickname(body.hostNickname) || '호스트',
    playerCount: clampInt(body.playerCount, 1, 8, 1),
    maxPlayers: clampInt(body.maxPlayers, 2, 8, 5),
    totalRounds: clampInt(body.totalRounds, 1, 20, 5),
    phase: 'lobby',
    visibility,
    passwordHash: visibility === 'private' ? hashPassword(password) : null,
    createdAt: now,
    updatedAt: now,
  };

  await redis.set(roomKey(code), room, { ex: ROOM_TTL_SECONDS });
  await redis.zadd(ROOMS_INDEX_KEY, {
    score: now + ROOM_TTL_SECONDS * 1000,
    member: code,
  });

  res.status(200).json({ ok: true, room: toPublicRoom(room) });
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
