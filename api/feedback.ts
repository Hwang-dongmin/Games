import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getRedis,
  FEEDBACK_CAP,
  feedbackKey,
  normalizeMessage,
  normalizeNickname,
  parseFeedbackKind,
  type FeedbackEntry,
  type FeedbackKind,
} from './_lib/redis.js';

const LIST_LIMIT = 50;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const redis = getRedis();
    if (!redis) {
      res.status(503).json({ error: 'lobby_disabled' });
      return;
    }

    if (req.method === 'GET') {
      return await listFeedback(redis, req, res);
    }
    if (req.method === 'POST') {
      return await createFeedback(redis, req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/feedback]', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

async function listFeedback(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  req: VercelRequest,
  res: VercelResponse,
) {
  const kind = parseFeedbackKind(req.query.type);
  if (!kind) {
    res.status(400).json({ error: 'invalid_type' });
    return;
  }

  const raw = (await redis.lrange(
    feedbackKey(kind),
    0,
    LIST_LIMIT - 1,
  )) as unknown[];

  const entries = raw
    .map((item) => parseEntry(item))
    .filter((e): e is FeedbackEntry => e !== null);

  res.status(200).json({ entries });
}

async function createFeedback(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  req: VercelRequest,
  res: VercelResponse,
) {
  const body = parseBody(req.body);
  const kind = parseFeedbackKind(body.type);
  if (!kind) {
    res.status(400).json({ error: 'invalid_type' });
    return;
  }

  const message = normalizeMessage(body.message);
  if (message.length === 0) {
    res.status(400).json({ error: 'empty_message' });
    return;
  }

  const name = normalizeNickname(body.name) || defaultName(kind);

  const entry: FeedbackEntry = {
    id: randomUUID(),
    name,
    message,
    at: Date.now(),
  };

  const key = feedbackKey(kind);
  await redis.lpush(key, JSON.stringify(entry));
  await redis.ltrim(key, 0, FEEDBACK_CAP - 1);

  res.status(201).json({ entry });
}

function defaultName(kind: FeedbackKind): string {
  return kind === 'bug' ? '익명 제보자' : '익명';
}

function parseEntry(item: unknown): FeedbackEntry | null {
  const obj =
    typeof item === 'string' ? safeParse(item) : (item as Record<string, unknown> | null);
  if (!obj || typeof obj !== 'object') return null;

  const message = normalizeMessage((obj as Record<string, unknown>).message);
  if (!message) return null;

  const rawAt = (obj as Record<string, unknown>).at;
  const at = typeof rawAt === 'number' ? rawAt : Number(rawAt);

  return {
    id: String((obj as Record<string, unknown>).id ?? ''),
    name: normalizeNickname((obj as Record<string, unknown>).name) || '익명',
    message,
    at: Number.isFinite(at) ? at : 0,
  };
}

function safeParse(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
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
