import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clampInt,
  getRedis,
  hashPassword,
  isValidRoomCode,
  normalizePassword,
  ROOM_TTL_SECONDS,
  ROOMS_INDEX_KEY,
  roomKey,
  toPublicRoom,
  type StoredRoom,
} from '../_lib/redis.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
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

    if (req.method === 'GET') {
      return await getRoom(redis, code, res);
    }
    if (req.method === 'POST') {
      return await verifyPassword(redis, code, req, res);
    }
    if (req.method === 'PATCH') {
      return await heartbeat(redis, code, req, res);
    }
    if (req.method === 'DELETE') {
      return await closeRoom(redis, code, res);
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/rooms/[code]]', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

async function getRoom(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  code: string,
  res: VercelResponse,
) {
  const room = (await redis.get<StoredRoom>(roomKey(code))) as StoredRoom | null;
  if (!room) {
    res.status(404).json({ error: 'room_not_found' });
    return;
  }
  res.status(200).json({ room: toPublicRoom(room) });
}

async function verifyPassword(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  code: string,
  req: VercelRequest,
  res: VercelResponse,
) {
  const room = (await redis.get<StoredRoom>(roomKey(code))) as StoredRoom | null;
  if (!room) {
    res.status(404).json({ error: 'room_not_found' });
    return;
  }
  if (room.visibility !== 'private' || !room.passwordHash) {
    res.status(200).json({ ok: true });
    return;
  }

  const password = normalizePassword(parseBody(req.body).password);
  if (!password || hashPassword(password) !== room.passwordHash) {
    res.status(403).json({ error: 'wrong_password' });
    return;
  }
  res.status(200).json({ ok: true });
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
