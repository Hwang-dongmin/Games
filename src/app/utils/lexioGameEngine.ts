import {
  LexioTile,
  LexioCombination,
  createDeck,
  shuffle,
  sortHand,
  detectCombo,
  beats,
  findStarterIndex,
  roundCoinForHand,
} from './lexio';

export type OnlineLexioPlayer = {
  seat: number;
  peerId: string;
  name: string;
  hand: LexioTile[];
  passed: boolean;
};

export type DiscardPlacement = {
  key: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

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
  sessionTotalRounds: number;
  sessionCompletedRounds: number;
  sessionCoinsBySeat: Record<number, number>;
  lastRoundCoinRows: LastRoundCoinRow[];
  discardSeq: number;
};

export const MIN_ONLINE_PLAYERS = 3;
export const MAX_ONLINE_PLAYERS = 5;
export const ONLINE_HAND_SIZE = 12;
export const MAX_SESSION_ROUNDS = 20;

function handSizeForCount(count: number): number {
  if (count === 4) return 13;
  return ONLINE_HAND_SIZE;
}

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
  const deck = shuffle(createDeck());
  const size = handSizeForCount(n);
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
      isAI: false,
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
    lastRoundCoinRows: [],
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function appendDiscardTiles(
  state: LexioGameState,
  tiles: LexioTile[],
): DiscardPlacement[] {
  if (tiles.length === 0) return state.discardPlacements;
  const seq = state.discardSeq + 1;
  const rnd = mulberry32(seq * 2654435761 + state.discardPlacements.length);
  const baseLayer = state.discardPlacements.length;
  const additions: DiscardPlacement[] = tiles.map((t, i) => {
    const angle = rnd() * Math.PI * 2;
    const radius = 0.22 + rnd() * 0.48;
    return {
      key: `discard-${t.id}-s${seq}-i${i}`,
      x: Math.cos(angle) * radius * 0.88 + (rnd() - 0.5) * 0.07,
      y: 0.535 + (baseLayer + i) * 0.008 + rnd() * 0.018,
      z: -0.26 + Math.sin(angle) * radius * 0.82 + (rnd() - 0.5) * 0.09,
      rx: -0.12 + (rnd() - 0.5) * 0.55,
      ry: rnd() * Math.PI * 2,
      rz: (rnd() - 0.5) * 0.5,
    };
  });
  return [...state.discardPlacements, ...additions];
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
  let discardSeq = state.discardSeq;
  if (state.currentPlay?.tiles?.length) {
    discardPlacements = appendDiscardTiles(state, state.currentPlay.tiles);
    discardSeq = state.discardSeq + 1;
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
    const discardPlacements = appendDiscardTiles(
      state,
      state.currentPlay.tiles,
    );
    const reset = players.map((p) => ({ ...p, passed: false }));
    return {
      ok: true,
      state: {
        ...state,
        players: reset,
        currentPlay: null,
        trickStarterIdx: null,
        currentPlayerIdx: next,
        discardPlacements,
        discardSeq: state.discardSeq + 1,
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
  };
}
