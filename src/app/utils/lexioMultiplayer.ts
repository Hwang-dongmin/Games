import Peer, { type DataConnection } from 'peerjs';
import type { ClientGameView } from './lexioGameEngine';

const ROOM_PREFIX = 'lexio-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type LobbyPlayer = {
  peerId: string;
  nickname: string;
  seat: number;
};

export type LobbySettings = {
  totalRounds: number;
  maxPlayers: number;
};

export type WireMessage =
  | { type: 'hello'; nickname: string }
  | {
      type: 'lobby';
      roomCode: string;
      you: LobbyPlayer;
      players: LobbyPlayer[];
      settings: LobbySettings;
      isHost: boolean;
    }
  | { type: 'lobby_update'; players: LobbyPlayer[]; settings: LobbySettings }
  | { type: 'start' }
  | { type: 'game'; view: ClientGameView }
  | { type: 'action'; action: 'play' | 'pass'; tileIds?: number[] }
  | { type: 'error'; message: string }
  | { type: 'host_left' }
  | { type: 'player_left'; nickname: string; replacedByAi?: boolean };

export function generateRoomCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return `${ROOM_PREFIX}${suffix}`;
}

/** 6자리 방 코드 본문만 허용 (접두사 lexio- 제외) */
const CODE_BODY_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

function sanitizeCodeBody(raw: string): string | null {
  const body = raw
    .trim()
    .toUpperCase()
    .replace(/\s/g, '')
    .replace(/^LEXIO-/, '');
  return CODE_BODY_PATTERN.test(body) ? body : null;
}

/**
 * 방 코드 입력 정규화 — URL 전체·초대 링크 붙여넣기도 6자리만 추출.
 * 유효하지 않으면 null.
 */
export function parseRoomCodeInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 초대 링크 / URL (?room=XXXXXX)
  const roomParam = trimmed.match(/[?&]room=([A-Za-z0-9]{4,12})/i);
  if (roomParam) {
    const body = sanitizeCodeBody(roomParam[1]);
    if (body) return `${ROOM_PREFIX}${body}`;
  }

  try {
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
      const url = new URL(trimmed);
      const fromQuery = url.searchParams.get('room');
      if (fromQuery) {
        const body = sanitizeCodeBody(fromQuery);
        if (body) return `${ROOM_PREFIX}${body}`;
      }
    }
  } catch {
    /* not a URL */
  }

  const body = sanitizeCodeBody(trimmed);
  return body ? `${ROOM_PREFIX}${body}` : null;
}

/** @deprecated parseRoomCodeInput 사용 */
export function normalizeRoomCode(input: string): string {
  return parseRoomCodeInput(input) ?? `${ROOM_PREFIX}${input.trim().toUpperCase().replace(/\s/g, '')}`;
}

export function displayRoomCode(roomId: string): string {
  return roomId.startsWith(ROOM_PREFIX)
    ? roomId.slice(ROOM_PREFIX.length)
    : roomId;
}

export function buildInviteUrl(roomId: string): string {
  const code = displayRoomCode(roomId);
  const base =
    typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/lexio/online?room=${code}`;
}

type MessageHandler = (msg: WireMessage, fromPeerId: string) => void;

export type LexioHostRoom = {
  roomId: string;
  myPeerId: string;
  destroy: () => void;
  broadcast: (msg: WireMessage, exceptPeerId?: string) => void;
  sendTo: (peerId: string, msg: WireMessage) => void;
};

export async function createHostRoom(
  roomId: string,
  onMessage: MessageHandler,
  onGuestConnected: (peerId: string, conn: DataConnection) => void,
  onGuestDisconnected: (peerId: string) => void,
): Promise<LexioHostRoom> {
  const connections = new Map<string, DataConnection>();

  const peer = await openPeer(roomId);

  peer.on('connection', (conn) => {
    const pid = conn.peer;
    connections.set(pid, conn);
    wireConnection(conn, (msg) => onMessage(msg, pid));
    conn.on('close', () => {
      connections.delete(pid);
      onGuestDisconnected(pid);
    });
    onGuestConnected(pid, conn);
  });

  return {
    roomId,
    myPeerId: peer.id ?? roomId,
    destroy: () => {
      connections.forEach((c) => c.close());
      connections.clear();
      peer.destroy();
    },
    broadcast: (msg, exceptPeerId) => {
      const raw = JSON.stringify(msg);
      connections.forEach((conn, pid) => {
        if (pid !== exceptPeerId && conn.open) conn.send(raw);
      });
    },
    sendTo: (peerId, msg) => {
      const conn = connections.get(peerId);
      if (conn?.open) conn.send(JSON.stringify(msg));
    },
  };
}

export type LexioGuestRoom = {
  roomId: string;
  myPeerId: string;
  hostPeerId: string;
  destroy: () => void;
  send: (msg: WireMessage) => void;
};

export async function joinGuestRoom(
  roomId: string,
  onMessage: MessageHandler,
  onDisconnected: () => void,
): Promise<LexioGuestRoom> {
  const peer = await openPeer();
  const conn = await connectToHost(peer, roomId);

  wireConnection(conn, (msg) => onMessage(msg, roomId));

  conn.on('close', onDisconnected);
  peer.on('disconnected', onDisconnected);

  return {
    roomId,
    myPeerId: peer.id ?? '',
    hostPeerId: roomId,
    destroy: () => {
      conn.close();
      peer.destroy();
    },
    send: (msg) => {
      if (conn.open) conn.send(JSON.stringify(msg));
    },
  };
}

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id
      ? new Peer(id, { debug: 0 })
      : new Peer({ debug: 0 });

    const timeout = setTimeout(() => {
      peer.destroy();
      reject(new Error('PeerJS 연결 시간이 초과되었습니다.'));
    }, 15000);

    peer.on('open', () => {
      clearTimeout(timeout);
      resolve(peer);
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function connectToHost(peer: Peer, hostId: string): Promise<DataConnection> {
  return new Promise((resolve, reject) => {
    const conn = peer.connect(hostId, { reliable: true });
    const timeout = setTimeout(() => {
      reject(new Error('방에 연결하지 못했습니다. 방 코드를 확인해주세요.'));
    }, 12000);

    conn.on('open', () => {
      clearTimeout(timeout);
      resolve(conn);
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    peer.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function wireConnection(
  conn: DataConnection,
  onMessage: (msg: WireMessage) => void,
) {
  conn.on('data', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as WireMessage;
      if (msg && typeof msg.type === 'string') onMessage(msg);
    } catch {
      /* ignore malformed */
    }
  });
}

export function peerErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const m = err.message;
    if (m.includes('unavailable') || m.includes('Lost connection')) {
      return 'PeerJS 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    if (m.includes('is taken') || m.includes('ID')) {
      return '방 코드가 이미 사용 중입니다. 새 방을 만들어주세요.';
    }
    if (m.includes('Could not connect to peer')) {
      return '방을 찾을 수 없습니다. 호스트가 방을 연 상태인지 확인하고, 6자리 방 코드만 입력해주세요. (URL 전체를 붙여넣지 마세요)';
    }
    return m;
  }
  return '연결에 실패했습니다.';
}

export function invalidRoomCodeMessage(): string {
  return '올바른 6자리 방 코드를 입력해주세요. (예: ABC234) 초대 링크는 주소창에서 열거나, 링크의 ?room= 뒤 코드만 입력하세요.';
}
