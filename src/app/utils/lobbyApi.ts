/**
 * Vercel 서버리스 API 클라이언트.
 *
 * 서버는 "방 발견(공개 로비)"과 "전적/랭킹"만 담당하며, 실제 게임 진행은 기존
 * P2P(PeerJS) 그대로다. push 시 프론트와 함께 Vercel에 배포된다.
 * Redis 미설정(503)이거나 네트워크 오류 시 조용히 실패하여 P2P 흐름은 유지된다.
 *
 * 로컬 API 테스트: `npx vercel dev` (일반 `npm run dev`는 프론트만)
 */

export type PublicRoom = {
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  createdAt: number;
};

export type LeaderboardEntry = {
  name: string;
  wins: number;
  games: number;
  coins: number;
};

export type RegisterRoomPayload = {
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
};

export type HeartbeatPayload = {
  playerCount: number;
  phase: 'lobby' | 'playing';
};

export type ResultPayload = {
  players: { name: string; coins: number }[];
  winnerName: string;
};

export type HeartbeatResult = 'ok' | 'expired' | 'error';

async function postJson(url: string, body: unknown, keepalive = false) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  });
}

export async function listRooms(): Promise<PublicRoom[] | null> {
  try {
    const res = await fetch('/api/rooms', { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rooms?: PublicRoom[] };
    return Array.isArray(data.rooms) ? data.rooms : [];
  } catch {
    return null;
  }
}

export async function registerRoom(payload: RegisterRoomPayload): Promise<boolean> {
  try {
    const res = await postJson('/api/rooms', payload);
    return res.ok;
  } catch {
    return false;
  }
}

export async function heartbeatRoom(
  code: string,
  payload: HeartbeatPayload,
): Promise<HeartbeatResult> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return 'ok';
    if (res.status === 410) return 'expired';
    return 'error';
  } catch {
    return 'error';
  }
}

export async function closeRoom(code: string): Promise<void> {
  try {
    await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
      method: 'DELETE',
      keepalive: true,
    });
  } catch {
    /* 무시 — TTL로 자동 만료됨 */
  }
}

export async function recordResult(payload: ResultPayload): Promise<void> {
  try {
    await postJson('/api/leaderboard', payload, true);
  } catch {
    /* 무시 */
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[] | null> {
  try {
    const res = await fetch('/api/leaderboard', { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { players?: LeaderboardEntry[] };
    return Array.isArray(data.players) ? data.players : [];
  } catch {
    return null;
  }
}
