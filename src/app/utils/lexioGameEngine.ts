import {
  LexioTile,
  LexioCombination,
  createDeckForPlayerCount,
  lexioHandSizeForPlayerCount,
  shuffle,
  sortHand,
  detectCombo,
  beats,
  findStarterIndex,
  roundCoinForHand,
} from './lexio';
import {
  buildDiscardPlacements,
  type DiscardPlacement,
} from './lexioDiscardLayout';

export type { DiscardPlacement };

export type OnlineLexioPlayer = {
  seat: number;
  peerId: string;
  name: string;
  hand: LexioTile[];
  passed: boolean;
  isAI?: boolean;
};

export function aiPeerId(seat: number): string {
  return `ai-seat-${seat}`;
}

export function replacePlayerWithAI(
  state: LexioGameState,
  peerId: string,
): { state: LexioGameState; nickname: string } | null {
  const idx = state.players.findIndex((p) => p.peerId === peerId);
  if (idx < 0) return null;
  const player = state.players[idx];
  const players = state.players.map((p, i) =>
    i === idx
      ? {
          ...p,
          isAI: true,
          peerId: aiPeerId(p.seat),
          name: `${player.name} (AI)`,
        }
      : p,
  );
  return { state: { ...state, players }, nickname: player.name };
}

export type LastRoundCoinRow = {
  playerId: number;
  earned: number;
  doubled: boolean;
};

export type LexioGamePhase = 'lobby' | 'playing' | 'finished';

export type LexioGameState = {
  players: OnlineLexioPlayer[];
  currentPlay: LexioCombination | null;
  trickStarterIdx: number | null;
  currentPlayerIdx: number;
  phase: LexioGamePhase;
  winnerSeat: number | null;
  discardPlacements: DiscardPlacement[];
  discardedTiles: LexioTile[];
  sessionTotalRounds: number;
  sessionCompletedRounds: number;
  sessionCoinsBySeat: Record<number, number>;
  lastRoundCoinRows: LastRoundCoinRow[];
  discardSeq: number;
};

export const MIN_ONLINE_PLAYERS = 3;
export const MAX_ONLINE_PLAYERS = 5;
export const MAX_SESSION_ROUNDS = 20;

export function createEmptyGameState(
  sessionTotalRounds: number,
): LexioGameState {
  return {
    players: [],
    currentPlay: null,
    trickStarterIdx: null,
    currentPlayerIdx: 0,
    phase: 'lobby',
    winnerSeat: null,
    discardPlacements: [],
    discardedTiles: [],
    sessionTotalRounds: Math.min(
      MAX_SESSION_ROUNDS,
      Math.max(1, sessionTotalRounds),
    ),
    sessionCompletedRounds: 0,
    sessionCoinsBySeat: {},
    lastRoundCoinRows: [],
    discardSeq: 0,
  };
}

export function dealOnlineHand(
  lobbyPlayers: { seat: number; peerId: string; name: string }[],
): OnlineLexioPlayer[] {
  const n = lobbyPlayers.length;
  const deck = shuffle(createDeckForPlayerCount(n));
  const size = lexioHandSizeForPlayerCount(n);
  const needed = n * size;
  if (deck.length < needed) {
    throw new Error(
      `타일이 부족합니다. (${n}인 · 덱 ${deck.length}장 · 필요 ${needed}장)`,
    );
  }
  return lobbyPlayers.map((p, idx) => ({
    seat: p.seat,
    peerId: p.peerId,
    name: p.name,
    hand: sortHand(deck.slice(idx * size, (idx + 1) * size)),
    passed: false,
  }));
}

export function startNewRound(state: LexioGameState): LexioGameState {
  const lobby = state.players.map((p) => ({
    seat: p.seat,
    peerId: p.peerId,
    name: p.name,
  }));
  const players = dealOnlineHand(lobby);
  const starter = findStarterIndex(
    players.map((p) => ({
      id: p.seat,
      name: p.name,
      isAI: p.isAI ?? false,
      hand: p.hand,
      passed: false,
    })),
  );
  return {
    ...state,
    players,
    currentPlay: null,
    trickStarterIdx: null,
    currentPlayerIdx: starter,
    phase: 'playing',
    winnerSeat: null,
    discardPlacements: [],
    discardedTiles: [],
    lastRoundCoinRows: [],
  };
}

function appendDiscardTiles(
  state: LexioGameState,
  tiles: LexioTile[],
): { discardPlacements: DiscardPlacement[]; discardedTiles: LexioTile[]; discardSeq: number } {
  if (tiles.length === 0) {
    return {
      discardPlacements: state.discardPlacements,
      discardedTiles: state.discardedTiles,
      discardSeq: state.discardSeq,
    };
  }
  const seq = state.discardSeq + 1;
  const additions = buildDiscardPlacements(tiles, seq, state.discardPlacements);
  return {
    discardPlacements: [...state.discardPlacements, ...additions],
    discardedTiles: [...state.discardedTiles, ...tiles],
    discardSeq: seq,
  };
}

export function nextSeatIndex(
  currentIdx: number,
  players: OnlineLexioPlayer[],
): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (currentIdx + step) % n;
    if (players[idx].hand.length > 0) return idx;
  }
  return currentIdx;
}

function finishRound(
  state: LexioGameState,
  winnerSeat: number,
): LexioGameState {
  const rows: LastRoundCoinRow[] = state.players.map((p) => {
    const { earned, doubled } = roundCoinForHand(p.hand);
    return { playerId: p.seat, earned, doubled };
  });
  const sessionCoinsBySeat = { ...state.sessionCoinsBySeat };
  for (const r of rows) {
    sessionCoinsBySeat[r.playerId] =
      (sessionCoinsBySeat[r.playerId] ?? 0) + r.earned;
  }
  return {
    ...state,
    phase: 'finished',
    winnerSeat,
    lastRoundCoinRows: rows,
    sessionCompletedRounds: state.sessionCompletedRounds + 1,
    sessionCoinsBySeat,
  };
}

export type PlayResult =
  | { ok: true; state: LexioGameState }
  | { ok: false; error: string };

export function applyPlay(
  state: LexioGameState,
  seat: number,
  tiles: LexioTile[],
): PlayResult {
  if (state.phase !== 'playing') {
    return { ok: false, error: '게임이 진행 중이 아닙니다.' };
  }
  if (state.currentPlayerIdx !== seat) {
    return { ok: false, error: '당신 차례가 아닙니다.' };
  }

  const combo = detectCombo(tiles);
  if (!combo) return { ok: false, error: '유효하지 않은 조합입니다.' };
  if (state.currentPlay && !beats(combo, state.currentPlay)) {
    return { ok: false, error: '현재 조합을 이기지 못합니다.' };
  }

  const player = state.players[seat];
  const tileIds = new Set(tiles.map((t) => t.id));
  for (const t of tiles) {
    if (!player.hand.some((h) => h.id === t.id)) {
      return { ok: false, error: '손에 없는 타일입니다.' };
    }
  }

  let discardPlacements = state.discardPlacements;
  let discardedTiles = state.discardedTiles;
  let discardSeq = state.discardSeq;
  if (state.currentPlay?.tiles?.length) {
    const appended = appendDiscardTiles(state, state.currentPlay.tiles);
    discardPlacements = appended.discardPlacements;
    discardedTiles = appended.discardedTiles;
    discardSeq = appended.discardSeq;
  }

  const players = state.players.map((p, idx) =>
    idx === seat
      ? {
          ...p,
          hand: p.hand.filter((t) => !tileIds.has(t.id)),
          passed: false,
        }
      : { ...p, passed: false },
  );

  let nextState: LexioGameState = {
    ...state,
    players,
    currentPlay: combo,
    trickStarterIdx: seat,
    discardPlacements,
    discardedTiles,
    discardSeq,
  };

  const winner = players[seat];
  if (winner.hand.length === 0) {
    return { ok: true, state: finishRound(nextState, seat) };
  }

  const next = nextSeatIndex(seat, players);
  nextState = { ...nextState, currentPlayerIdx: next };
  return { ok: true, state: nextState };
}

export function applyPass(state: LexioGameState, seat: number): PlayResult {
  if (state.phase !== 'playing') {
    return { ok: false, error: '게임이 진행 중이 아닙니다.' };
  }
  if (state.currentPlayerIdx !== seat) {
    return { ok: false, error: '당신 차례가 아닙니다.' };
  }
  if (!state.currentPlay) {
    return { ok: false, error: '리드 차례에는 패스할 수 없습니다.' };
  }

  const players = state.players.map((p, idx) =>
    idx === seat ? { ...p, passed: true } : p,
  );

  const next = nextSeatIndex(seat, players);
  const trickStarter = state.trickStarterIdx;

  if (
    trickStarter !== null &&
    next === trickStarter &&
    state.currentPlay !== null
  ) {
    const appended = appendDiscardTiles(state, state.currentPlay.tiles);
    const reset = players.map((p) => ({ ...p, passed: false }));
    return {
      ok: true,
      state: {
        ...state,
        players: reset,
        currentPlay: null,
        trickStarterIdx: null,
        currentPlayerIdx: next,
        discardPlacements: appended.discardPlacements,
        discardedTiles: appended.discardedTiles,
        discardSeq: appended.discardSeq,
      },
    };
  }

  return {
    ok: true,
    state: { ...state, players, currentPlayerIdx: next },
  };
}

/** 클라이언트에 보낼 공개 상태 + 본인 패만 */
export type ClientGameView = {
  players: {
    seat: number;
    name: string;
    handCount: number;
    passed: boolean;
    isYou: boolean;
    isAI: boolean;
  }[];
  currentPlay: LexioCombination | null;
  trickStarterIdx: number | null;
  currentPlayerIdx: number;
  phase: LexioGamePhase;
  winnerSeat: number | null;
  sessionTotalRounds: number;
  sessionCompletedRounds: number;
  sessionCoinsBySeat: Record<number, number>;
  lastRoundCoinRows: LastRoundCoinRow[];
  yourHand: LexioTile[];
  yourSeat: number;
  discardPlacements: DiscardPlacement[];
  /** 판 종료 시에만 — 테이블 패 공개용 */
  handsBySeat?: Record<number, LexioTile[]>;
};

export function buildClientView(
  state: LexioGameState,
  peerId: string,
): ClientGameView | null {
  const you = state.players.find((p) => p.peerId === peerId);
  if (!you) return null;
  return {
    players: state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      handCount: p.hand.length,
      passed: p.passed,
      isYou: p.peerId === peerId,
      isAI: p.isAI ?? false,
    })),
    currentPlay: state.currentPlay,
    trickStarterIdx: state.trickStarterIdx,
    currentPlayerIdx: state.currentPlayerIdx,
    phase: state.phase,
    winnerSeat: state.winnerSeat,
    sessionTotalRounds: state.sessionTotalRounds,
    sessionCompletedRounds: state.sessionCompletedRounds,
    sessionCoinsBySeat: state.sessionCoinsBySeat,
    lastRoundCoinRows: state.lastRoundCoinRows,
    yourHand: you.hand,
    yourSeat: you.seat,
    discardPlacements: state.discardPlacements,
    handsBySeat:
      state.phase === 'finished'
        ? Object.fromEntries(
            state.players.map((p) => [p.seat, p.hand] as const),
          )
        : undefined,
  };
}
