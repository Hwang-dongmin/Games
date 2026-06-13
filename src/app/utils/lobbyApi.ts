/**
 * Vercel 서버리스 API 클라이언트.
 */

export type RoomPhase = 'lobby' | 'playing';
export type RoomVisibility = 'public' | 'private';

export type LobbyRoom = {
  code: string;
  gameId: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  phase: RoomPhase;
  visibility: RoomVisibility;
  hasPassword: boolean;
  createdAt: number;
};

/** @deprecated use LobbyRoom */
export type PublicRoom = LobbyRoom;

export type LeaderboardEntry = {
  name: string;
  wins: number;
  games: number;
  coins: number;
};

export type RegisterRoomPayload = {
  code: string;
  gameId: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  totalRounds: number;
  visibility: RoomVisibility;
  password?: string;
};

export type HeartbeatPayload = {
  playerCount: number;
  phase: RoomPhase;
};

export type ResultPayload = {
  players: { name: string; coins: number }[];
  winnerName: string;
};

export type HeartbeatResult = 'ok' | 'expired' | 'error';

export type ListRoomsResult =
  | { status: 'ok'; rooms: LobbyRoom[] }
  | { status: 'disabled' }
  | { status: 'error' };

export const ROOM_PASSWORD_MAX = 4;

export function grantRoomAccess(code: string): void {
  try {
    sessionStorage.setItem(`${ROOM_ACCESS_PREFIX}${code}`, '1');
  } catch {
    /* ignore */
  }
}

export function hasRoomAccess(code: string): boolean {
  try {
    return sessionStorage.getItem(`${ROOM_ACCESS_PREFIX}${code}`) === '1';
  } catch {
    return false;
  }
}

async function postJson(url: string, body: unknown, keepalive = false) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  });
}

export async function listRooms(): Promise<ListRoomsResult> {
  try {
    const res = await fetch('/api/rooms', { headers: { Accept: 'application/json' } });
    if (res.status === 503) return { status: 'disabled' };
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as { rooms?: LobbyRoom[] };
    return {
      status: 'ok',
      rooms: Array.isArray(data.rooms) ? data.rooms : [],
    };
  } catch {
    return { status: 'error' };
  }
}

export async function fetchRoom(code: string): Promise<LobbyRoom | null> {
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { room?: LobbyRoom };
    return data.room ?? null;
  } catch {
    return null;
  }
}

export async function verifyRoomPassword(
  code: string,
  password: string,
): Promise<boolean> {
  try {
    const res = await postJson(`/api/rooms/${encodeURIComponent(code)}`, {
      password,
    });
    return res.ok;
  } catch {
    return false;
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
    /* 무시 */
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
    const res = await fetch('/api/leaderboard', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { players?: LeaderboardEntry[] };
    return Array.isArray(data.players) ? data.players : [];
  } catch {
    return null;
  }
}
