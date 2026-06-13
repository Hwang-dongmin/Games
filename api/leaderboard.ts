import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getRedis,
  LEADERBOARD_KEY,
  normalizeNickname,
  playerKey,
  RESULTS_FEED_KEY,
  toInt,
} from './_lib/redis';

const TOP_N = 20;
const RESULTS_FEED_CAP = 100;

type PlayerStat = {
  name: string;
  wins: number;
  games: number;
  coins: number;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const redis = getRedis();
    if (!redis) {
      res.status(503).json({ error: 'lobby_disabled' });
      return;
    }

    if (req.method === 'GET') {
      return await getLeaderboard(redis, res);
    }
    if (req.method === 'POST') {
      return await recordResult(redis, req, res);
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('[api/leaderboard]', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

async function getLeaderboard(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  res: VercelResponse,
) {
  const flat = (await redis.zrange(LEADERBOARD_KEY, 0, TOP_N - 1, {
    rev: true,
    withScores: true,
  })) as (string | number)[];

  const ids: string[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    ids.push(String(flat[i]));
  }

  const players: PlayerStat[] = [];
  for (const id of ids) {
    const hash = (await redis.hgetall(playerKey(id))) as Record<
      string,
      string | number
    > | null;
    if (!hash) continue;
    players.push({
      name: String(hash.name ?? id),
      wins: toInt(hash.wins),
      games: toInt(hash.games),
      coins: toInt(hash.coins),
    });
  }

  players.sort((a, b) => b.wins - a.wins || b.coins - a.coins);
  res.status(200).json({ players });
}

async function recordResult(
  redis: NonNullable<ReturnType<typeof getRedis>>,
  req: VercelRequest,
  res: VercelResponse,
) {
  const body = parseBody(req.body);
  const rawPlayers = Array.isArray(body.players) ? body.players : [];
  const winnerName = normalizeNickname(body.winnerName);

  const entries = rawPlayers
    .map((p) => {
      const obj = (p ?? {}) as Record<string, unknown>;
      const name = normalizeNickname(obj.name);
      const coins = toInt(obj.coins);
      return name ? { name, coins } : null;
    })
    .filter((p): p is { name: string; coins: number } => p !== null);

  if (entries.length === 0) {
    res.status(400).json({ error: 'no_players' });
    return;
  }

  for (const p of entries) {
    const key = playerKey(p.name);
    const isWinner = p.name === winnerName;
    await redis.hset(key, { name: p.name });
    await redis.hincrby(key, 'games', 1);
    await redis.hincrby(key, 'coins', p.coins);
    if (isWinner) await redis.hincrby(key, 'wins', 1);
    await redis.zincrby(LEADERBOARD_KEY, isWinner ? 1 : 0, p.name);
  }

  await redis.lpush(
    RESULTS_FEED_KEY,
    JSON.stringify({ players: entries, winnerName, at: Date.now() }),
  );
  await redis.ltrim(RESULTS_FEED_KEY, 0, RESULTS_FEED_CAP - 1);

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
