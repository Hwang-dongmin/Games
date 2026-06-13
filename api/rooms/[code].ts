import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clampInt,
  getRedis,
  isValidRoomCode,
  ROOM_TTL_SECONDS,
  ROOMS_INDEX_KEY,
  roomKey,
  type StoredRoom,
} from '../_lib/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();
  if (!redis) {
    res.status(503).json({ error: 'lobby_disabled' });
    return;
  }

  const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
  if (!isValidRoomCode(code)) {
    res.status(400).json({ error: 'invalid_room_code' });
    return;
  }

  if (req.method === 'PATCH') {
    return heartbeat(redis, code, req, res);
  }
  if (req.method === 'DELETE') {
    return closeRoom(redis, code, res);
  }

  res.setHeader('Allow', 'PATCH, DELETE');
  res.status(405).json({ error: 'method_not_allowed' });
}

async function heartbeat(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  code: string,
  req: VercelRequest,
  res: VercelResponse,
) {
  const existing = (await redis.get<StoredRoom>(roomKey(code))) as StoredRoom | null;
  if (!existing) {
    res.status(410).json({ error: 'room_expired' });
    return;
  }

  const body = parseBody(req.body);
  const now = Date.now();
  const updated: StoredRoom = {
    ...existing,
    playerCount: clampInt(body.playerCount, 1, 8, existing.playerCount),
    phase: body.phase === 'playing' ? 'playing' : 'lobby',
    updatedAt: now,
  };

  await redis.set(roomKey(code), updated, { ex: ROOM_TTL_SECONDS });
  await redis.zadd(ROOMS_INDEX_KEY, {
    score: now + ROOM_TTL_SECONDS * 1000,
    member: code,
  });

  res.status(200).json({ ok: true });
}

async function closeRoom(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  code: string,
  res: VercelResponse,
) {
  await redis.del(roomKey(code));
  await redis.zrem(ROOMS_INDEX_KEY, code);
  res.status(200).json({ ok: true });
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
