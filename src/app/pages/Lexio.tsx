import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { Link } from 'react-router';
import {
  Home,
  RotateCcw,
  BookOpen,
  X,
  Users,
  Settings,
  ChevronLeft,
  Crown,
} from 'lucide-react';
import {
  LexioTile,
  LexioPlayer,
  LexioCombination,
  createDeckForPlayerCount,
  lexioHandSizeForPlayerCount,
  shuffle,
  sortHand,
  detectCombo,
  beats,
  comboKorean,
  aiFindMove,
  aiLeadFallbackTile,
  findStarterIndex,
  roundCoinForHand,
  type LexioAIDifficulty,
} from '../utils/lexio';
import LexioFirstPersonScene from './lexio/LexioFirstPersonScene';
import LexioOfflineSetup from './lexio/LexioOfflineSetup';
import LexioRulesContent from './lexio/LexioRulesContent';
import LexioSessionRankingPanel from './lexio/LexioSessionRankingPanel';
import {
  buildDiscardPlacements,
  type DiscardPlacement,
} from '../utils/lexioDiscardLayout';

type GamePhase = 'setup' | 'playing' | 'finished';
type UiPlayer = LexioPlayer;
type LastRoundCoinRow = {
  playerId: number;
  earned: number;
  doubled: boolean;
};

type PersistedLexioState = {
  players: UiPlayer[];
  currentPlay: LexioCombination | null;
  trickStarterIdx: number | null;
  currentPlayerIdx: number;
  phase: GamePhase;
  winnerId: number | null;
  selectedIds: number[];
  message: string;
  lastPlayedByIdx: number | null;
  discardPlacements: DiscardPlacement[];
  sessionTotalRounds: number;
  sessionCompletedRounds: number;
  sessionCoinsByPlayerId: Record<string, number>;
  lastRoundCoinRows: LastRoundCoinRow[];
  discardedTiles?: LexioTile[];
  offlineAiDifficulty?: LexioAIDifficulty;
  /** v2 이하 마이그레이션용 */
  humanCoinTotal?: number;
  lastRoundCoinEarned?: number;
  lastRoundCoinDouble?: boolean;
};

const MIN_OFFLINE_AI = 2;
const MAX_OFFLINE_AI = 4;
const LEXIO_STORAGE_KEY = 'lexio-state-v3';
const MAX_SESSION_ROUNDS = 20;

/** 테이블 위(+Y)에서 볼 때 반시계방향 차례: 남(0)→서(1)→북서(3)→북동(4)→동(2) */
const PLAYER_TURN_ORDER = [0, 1, 3, 4, 2] as const;

function nextTurnPlayerIndex(
  currentIdx: number,
  playersList: LexioPlayer[],
): number {
  const n = playersList.length;
  const order =
    n === 5
      ? PLAYER_TURN_ORDER
      : Array.from({ length: n }, (_, i) => i);
  const start = order.indexOf(currentIdx);
  if (start === -1) {
    let nxt = (currentIdx + 1) % n;
    let safety = 0;
    while (playersList[nxt].hand.length === 0 && safety < n) {
      nxt = (nxt + 1) % n;
      safety++;
    }
    return nxt;
  }
  for (let step = 1; step <= n; step++) {
    const idx = order[(start + step) % order.length];
    if (playersList[idx].hand.length > 0) return idx;
  }
  return currentIdx;
}

function makePlayers(numAI: number): UiPlayer[] {
  const players: UiPlayer[] = [
    {
      id: 0,
      name: '플레이어',
      isAI: false,
      hand: [],
      passed: false,
    },
  ];
  for (let i = 0; i < numAI; i++) {
    players.push({
      id: i + 1,
      name: `AI ${i + 1}`,
      isAI: true,
      hand: [],
      passed: false,
    });
  }
  return players;
}

function dealHands(players: UiPlayer[]): UiPlayer[] {
  const playerCount = players.length;
  const deck = shuffle(createDeckForPlayerCount(playerCount));
  const handSize = lexioHandSizeForPlayerCount(playerCount);
  return players.map((p, idx) => ({
    ...p,
    hand: sortHand(deck.slice(idx * handSize, (idx + 1) * handSize)),
    passed: false,
  }));
}

export default function Lexio() {
  const [players, setPlayers] = useState<UiPlayer[]>([]);
  const [currentPlay, setCurrentPlay] = useState<LexioCombination | null>(null);
  const [trickStarterIdx, setTrickStarterIdx] = useState<number | null>(null);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [phase, setPhase] = useState<GamePhase>('setup');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [lexioMenuOpen, setLexioMenuOpen] = useState(false);
  const [lexioMenuClosing, setLexioMenuClosing] = useState(false);
  const lexioMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [lexioModalView, setLexioModalView] = useState<
    'home' | 'rules' | 'newGame'
  >('home');
  const [lastPlayedByIdx, setLastPlayedByIdx] = useState<number | null>(null);
  const [discardPlacements, setDiscardPlacements] = useState<
    DiscardPlacement[]
  >([]);
  const [discardedTiles, setDiscardedTiles] = useState<LexioTile[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const discardSeqRef = useRef(0);
  const [pendingSessionRounds, setPendingSessionRounds] = useState(5);
  const [pendingAiCount, setPendingAiCount] = useState(MAX_OFFLINE_AI);
  const [pendingAiDifficulty, setPendingAiDifficulty] =
    useState<LexioAIDifficulty>('easy');
  const [offlineAiCount, setOfflineAiCount] = useState(MAX_OFFLINE_AI);
  const [offlineAiDifficulty, setOfflineAiDifficulty] =
    useState<LexioAIDifficulty>('easy');
  const [sessionTotalRounds, setSessionTotalRounds] = useState(5);
  const [sessionCompletedRounds, setSessionCompletedRounds] = useState(0);
  const [sessionCoinsByPlayerId, setSessionCoinsByPlayerId] = useState<
    Record<number, number>
  >({});
  const [lastRoundCoinRows, setLastRoundCoinRows] = useState<
    LastRoundCoinRow[]
  >([]);

  const humanPlayer = players.find((p) => !p.isAI);

  const appendDiscardTiles = useCallback((tiles: LexioTile[]) => {
    if (tiles.length === 0) return;
    discardSeqRef.current += 1;
    const seq = discardSeqRef.current;
    setDiscardedTiles((prev) => [...prev, ...tiles]);
    setDiscardPlacements((prev) => [
      ...prev,
      ...buildDiscardPlacements(tiles, seq, prev),
    ]);
  }, []);

  /** 새 판만 시작 (세션 코인·완료 판 수는 유지) */
  const dealNewHand = useCallback(() => {
    setLastRoundCoinRows([]);
    const dealt = dealHands(makePlayers(offlineAiCount));
    const starter = findStarterIndex(dealt);
    setPlayers(dealt);
    setCurrentPlay(null);
    setTrickStarterIdx(null);
    setCurrentPlayerIdx(starter);
    setPhase('playing');
    setWinnerId(null);
    setSelectedIds([]);
    setLastPlayedByIdx(null);
    setDiscardPlacements([]);
    setDiscardedTiles([]);
    setMessage('');
  }, [offlineAiCount]);

  /** 첫 화면에서 판 수 정한 뒤 세션 시작 */
  const beginNewSessionFromSetup = useCallback(() => {
    const rounds = Math.min(
      MAX_SESSION_ROUNDS,
      Math.max(1, Math.floor(pendingSessionRounds)),
    );
    const aiCount = Math.min(
      MAX_OFFLINE_AI,
      Math.max(MIN_OFFLINE_AI, Math.floor(pendingAiCount)),
    );
    setOfflineAiCount(aiCount);
    setOfflineAiDifficulty(pendingAiDifficulty);
    setSessionTotalRounds(rounds);
    setSessionCompletedRounds(0);
    setSessionCoinsByPlayerId({});
    setLastRoundCoinRows([]);
    const dealt = dealHands(makePlayers(aiCount));
    const starter = findStarterIndex(dealt);
    setPlayers(dealt);
    setCurrentPlay(null);
    setTrickStarterIdx(null);
    setCurrentPlayerIdx(starter);
    setPhase('playing');
    setWinnerId(null);
    setSelectedIds([]);
    setLastPlayedByIdx(null);
    setDiscardPlacements([]);
    setDiscardedTiles([]);
    setMessage('');
  }, [pendingSessionRounds, pendingAiCount, pendingAiDifficulty]);

  const resetSessionToSetup = useCallback(() => {
    setPlayers([]);
    setCurrentPlay(null);
    setTrickStarterIdx(null);
    setCurrentPlayerIdx(0);
    setPhase('setup');
    setWinnerId(null);
    setSelectedIds([]);
    setLastPlayedByIdx(null);
    setDiscardPlacements([]);
    setDiscardedTiles([]);
    setMessage('');
    setSessionCompletedRounds(0);
    setSessionCoinsByPlayerId({});
    setLastRoundCoinRows([]);
  }, []);

  // 선택된 타일들
  const selectedTiles = useMemo(() => {
    if (!humanPlayer) return [];
    return humanPlayer.hand.filter((t) => selectedIds.includes(t.id));
  }, [humanPlayer, selectedIds]);

  const selectedCombo = useMemo(
    () => detectCombo(selectedTiles),
    [selectedTiles],
  );

  // 플레이어가 한 명만 남았는지 (이미 처리됨이지만 안전망)
  const checkWinner = useCallback(
    (updatedPlayers: UiPlayer[], lastPlayerIdx: number): boolean => {
      const p = updatedPlayers[lastPlayerIdx];
      if (p && p.hand.length === 0) {
        setWinnerId(p.id);
        setPhase('finished');
        setMessage('');

        const rows: LastRoundCoinRow[] = updatedPlayers.map((pl) => {
          const { earned, doubled } = roundCoinForHand(pl.hand);
          return { playerId: pl.id, earned, doubled };
        });
        setLastRoundCoinRows(rows);
        setSessionCoinsByPlayerId((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            next[r.playerId] = (next[r.playerId] ?? 0) + r.earned;
          }
          return next;
        });
        setSessionCompletedRounds((c) => c + 1);

        return true;
      }
      return false;
    },
    [],
  );

  // 한 명이 플레이/패스 한 뒤 다음 차례로 진행
  const advanceTurn = useCallback(
    (
      updatedPlayers: UiPlayer[],
      newTrickStarterIdx: number | null,
      newCurrentPlay: LexioCombination | null,
      playerWhoActedIdx: number,
    ) => {
      const next = nextTurnPlayerIndex(
        playerWhoActedIdx,
        updatedPlayers,
      );

      // 트릭 시작자에게 다시 차례가 돌아오면 → 모든 다른 플레이어가 패스했음
      if (
        newTrickStarterIdx !== null &&
        next === newTrickStarterIdx &&
        newCurrentPlay !== null
      ) {
        appendDiscardTiles(newCurrentPlay.tiles);
        // 트릭 리셋: 트릭 시작자가 새 트릭을 리드
        const reset = updatedPlayers.map((p) => ({ ...p, passed: false }));
        setPlayers(reset);
        setCurrentPlay(null);
        setTrickStarterIdx(null);
        setCurrentPlayerIdx(next);
        setMessage('');
        return;
      }

      setCurrentPlayerIdx(next);
    },
    [appendDiscardTiles],
  );

  // 한 명이 플레이
  const doPlay = useCallback(
    (playerIdx: number, tiles: LexioTile[]) => {
      const combo = detectCombo(tiles);
      if (!combo) return false;
      if (currentPlay && !beats(combo, currentPlay)) return false;

      const tileIds = new Set(tiles.map((t) => t.id));
      const updated = players.map((p, idx) =>
        idx === playerIdx
          ? {
              ...p,
              hand: p.hand.filter((t) => !tileIds.has(t.id)),
              passed: false,
            }
          : { ...p, passed: false },
      );
      if (currentPlay?.tiles?.length) {
        appendDiscardTiles(currentPlay.tiles);
      }
      setPlayers(updated);
      setCurrentPlay(combo);
      setTrickStarterIdx(playerIdx);
      setLastPlayedByIdx(playerIdx);

      if (checkWinner(updated, playerIdx)) return true;

      advanceTurn(updated, playerIdx, combo, playerIdx);
      return true;
    },
    [players, currentPlay, advanceTurn, checkWinner, appendDiscardTiles],
  );

  // 한 명이 패스
  const doPass = useCallback(
    (playerIdx: number) => {
      if (!currentPlay) return false; // 리드 차례엔 패스 불가
      const updated = players.map((p, idx) =>
        idx === playerIdx ? { ...p, passed: true } : p,
      );
      setPlayers(updated);
      advanceTurn(updated, trickStarterIdx, currentPlay, playerIdx);
      return true;
    },
    [players, currentPlay, trickStarterIdx, advanceTurn],
  );

  // 사람 플레이어가 내기 버튼 클릭
  const handleHumanPlay = () => {
    if (!humanPlayer) return;
    const humanIdx = players.findIndex((p) => !p.isAI);
    if (currentPlayerIdx !== humanIdx) return;
    if (selectedTiles.length === 0) {
      setMessage('타일을 선택해주세요.');
      return;
    }
    const ok = doPlay(humanIdx, selectedTiles);
    if (!ok) {
      const combo = detectCombo(selectedTiles);
      if (!combo && selectedTiles.length > 0) {
        setMessage('유효하지 않은 조합입니다.');
        return;
      }
      setMessage('유효하지 않은 조합이거나 현재 조합을 이기지 못합니다.');
      return;
    }
    setSelectedIds([]);
  };

  const handleHumanPass = () => {
    const humanIdx = players.findIndex((p) => !p.isAI);
    if (currentPlayerIdx !== humanIdx) return;
    if (!currentPlay) {
      setMessage('리드 차례에는 패스할 수 없습니다.');
      return;
    }
    doPass(humanIdx);
    setSelectedIds([]);
  };

  const toggleSelect = (tileId: number) => {
    setSelectedIds((prev) =>
      prev.includes(tileId)
        ? prev.filter((id) => id !== tileId)
        : [...prev, tileId],
    );
  };

  // 새로고침 복원
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LEXIO_STORAGE_KEY);
      if (!raw) {
        setHasHydrated(true);
        return;
      }
      const saved: PersistedLexioState = JSON.parse(raw);
      setPlayers(saved.players ?? []);
      setCurrentPlay(saved.currentPlay ?? null);
      setTrickStarterIdx(saved.trickStarterIdx ?? null);
      setCurrentPlayerIdx(saved.currentPlayerIdx ?? 0);
      setPhase(saved.phase ?? 'setup');
      setWinnerId(saved.winnerId ?? null);
      setSelectedIds(saved.selectedIds ?? []);
      setMessage(saved.message ?? '');
      setLastPlayedByIdx(saved.lastPlayedByIdx ?? null);
      setDiscardPlacements(saved.discardPlacements ?? []);
      setDiscardedTiles(
        Array.isArray(saved.discardedTiles) ? saved.discardedTiles : [],
      );
      const tr =
        typeof saved.sessionTotalRounds === 'number'
          ? Math.min(
              MAX_SESSION_ROUNDS,
              Math.max(1, Math.floor(saved.sessionTotalRounds)),
            )
          : 5;
      setSessionTotalRounds(tr);
      setSessionCompletedRounds(
        typeof saved.sessionCompletedRounds === 'number'
          ? Math.max(0, saved.sessionCompletedRounds)
          : 0,
      );
      const scRaw = saved.sessionCoinsByPlayerId;
      if (scRaw && typeof scRaw === 'object') {
        const sc: Record<number, number> = {};
        for (const [k, v] of Object.entries(scRaw)) {
          const id = Number(k);
          if (!Number.isFinite(id) || typeof v !== 'number') continue;
          sc[id] = v;
        }
        setSessionCoinsByPlayerId(sc);
      } else if (typeof saved.humanCoinTotal === 'number') {
        setSessionCoinsByPlayerId({ 0: saved.humanCoinTotal });
      } else {
        setSessionCoinsByPlayerId({});
      }
      setLastRoundCoinRows(
        Array.isArray(saved.lastRoundCoinRows)
          ? saved.lastRoundCoinRows.filter(
              (r): r is LastRoundCoinRow =>
                r &&
                typeof r.playerId === 'number' &&
                typeof r.earned === 'number' &&
                typeof r.doubled === 'boolean',
            )
          : [],
      );
      if (
        saved.offlineAiDifficulty === 'easy' ||
        saved.offlineAiDifficulty === 'medium' ||
        saved.offlineAiDifficulty === 'hard'
      ) {
        setOfflineAiDifficulty(saved.offlineAiDifficulty);
        setPendingAiDifficulty(saved.offlineAiDifficulty);
      }
    } catch {
      window.localStorage.removeItem(LEXIO_STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  // 상태 저장
  useEffect(() => {
    if (!hasHydrated) return;
    const toSave: PersistedLexioState = {
      players,
      currentPlay,
      trickStarterIdx,
      currentPlayerIdx,
      phase,
      winnerId,
      selectedIds,
      message,
      lastPlayedByIdx,
      discardPlacements,
      discardedTiles,
      sessionTotalRounds,
      sessionCompletedRounds,
      sessionCoinsByPlayerId,
      lastRoundCoinRows,
      offlineAiDifficulty,
    };
    window.localStorage.setItem(LEXIO_STORAGE_KEY, JSON.stringify(toSave));
  }, [
    hasHydrated,
    players,
    currentPlay,
    trickStarterIdx,
    currentPlayerIdx,
    phase,
    winnerId,
    selectedIds,
    message,
    lastPlayedByIdx,
    discardPlacements,
    discardedTiles,
    sessionTotalRounds,
    sessionCompletedRounds,
    sessionCoinsByPlayerId,
    lastRoundCoinRows,
    offlineAiDifficulty,
  ]);

  const aiMoveOptions = useMemo(
    () => ({
      difficulty: offlineAiDifficulty,
      currentPlayerId: players[currentPlayerIdx]?.id,
      players: players.map((p) => ({ id: p.id, handCount: p.hand.length })),
      discardedTiles,
      tablePlay: currentPlay,
      playerCount: players.length,
    }),
    [
      offlineAiDifficulty,
      players,
      currentPlayerIdx,
      discardedTiles,
      currentPlay,
    ],
  );

  // AI 자동 진행
  useEffect(() => {
    if (phase !== 'playing') return;
    const current = players[currentPlayerIdx];
    if (!current || !current.isAI) return;

    const timer = setTimeout(() => {
      const move = aiFindMove(current.hand, currentPlay, aiMoveOptions);
      if (move === null) {
        if (currentPlay) {
          doPass(currentPlayerIdx);
        } else if (current.hand.length > 0) {
          doPlay(currentPlayerIdx, [
            aiLeadFallbackTile(current.hand, aiMoveOptions),
          ]);
        }
      } else {
        doPlay(currentPlayerIdx, move);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [
    currentPlayerIdx,
    phase,
    players,
    currentPlay,
    trickStarterIdx,
    doPlay,
    doPass,
    aiMoveOptions,
  ]);

  const humanIdx = players.findIndex((p) => !p.isAI);
  const humanSessionCoins =
    humanIdx >= 0
      ? (sessionCoinsByPlayerId[players[humanIdx]?.id ?? -1] ?? 0)
      : 0;
  const isHumanTurn = humanIdx === currentPlayerIdx && phase === 'playing';

  const canHumanPlay =
    isHumanTurn &&
    selectedCombo !== null &&
    (currentPlay === null || beats(selectedCombo, currentPlay));

  const isTableView = phase === 'playing' || phase === 'finished';

  const winnerPlayer = players.find((p) => p.id === winnerId);
  const sessionHasNextHand = sessionCompletedRounds < sessionTotalRounds;

  /** 판 종료 후 다음 판: Enter로 계속 */
  useEffect(() => {
    if (phase !== 'finished' || !sessionHasNextHand) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        dealNewHand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, sessionHasNextHand, dealNewHand]);

  const finishTableUi = useMemo(() => {
    if (phase !== 'finished') return null;
    const playersCoins = players.map((p) => {
      const row = lastRoundCoinRows.find((r) => r.playerId === p.id);
      return {
        playerId: p.id,
        name: p.name,
        roundEarned: row?.earned ?? 0,
        sessionTotal: sessionCoinsByPlayerId[p.id] ?? 0,
        doubledThisRound: row?.doubled ?? false,
      };
    });
    return {
      playersCoins,
      completedRounds: sessionCompletedRounds,
      totalRounds: sessionTotalRounds,
      winnerName: winnerPlayer?.name ?? null,
      hasNextHand: sessionHasNextHand,
      onNextHand: dealNewHand,
      onBackToSetup: resetSessionToSetup,
    };
  }, [
    phase,
    players,
    lastRoundCoinRows,
    sessionCoinsByPlayerId,
    sessionCompletedRounds,
    sessionTotalRounds,
    winnerPlayer?.name,
    sessionHasNextHand,
    dealNewHand,
    resetSessionToSetup,
  ]);

  const closeLexioMenu = useCallback(() => {
    if (lexioMenuClosing) return;
    setLexioMenuClosing(true);
    if (lexioMenuCloseTimerRef.current) {
      clearTimeout(lexioMenuCloseTimerRef.current);
    }
    lexioMenuCloseTimerRef.current = setTimeout(() => {
      setLexioMenuOpen(false);
      setLexioMenuClosing(false);
      setLexioModalView('home');
      lexioMenuCloseTimerRef.current = null;
    }, 200);
  }, [lexioMenuClosing]);

  const openLexioOptions = useCallback(() => {
    if (lexioMenuCloseTimerRef.current) {
      clearTimeout(lexioMenuCloseTimerRef.current);
      lexioMenuCloseTimerRef.current = null;
    }
    setLexioMenuClosing(false);
    setLexioModalView('home');
    setLexioMenuOpen(true);
  }, []);

  const openLexioRules = useCallback(() => {
    if (lexioMenuCloseTimerRef.current) {
      clearTimeout(lexioMenuCloseTimerRef.current);
      lexioMenuCloseTimerRef.current = null;
    }
    setLexioMenuClosing(false);
    setLexioModalView('rules');
    setLexioMenuOpen(true);
  }, []);

  useEffect(
    () => () => {
      if (lexioMenuCloseTimerRef.current) {
        clearTimeout(lexioMenuCloseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!lexioMenuOpen || lexioMenuClosing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLexioMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lexioMenuOpen, lexioMenuClosing, closeLexioMenu]);

  return (
    <div
      className={`min-h-screen text-slate-100 ${isTableView ? 'p-0' : 'p-4'}`}
      style={
        isTableView
          ? { background: '#0a0a23' }
          : {
              background:
                'radial-gradient(ellipse at top, #2e1065 0%, #1e1b4b 45%, #0a0a23 100%)',
            }
      }
    >
      {/* 옵션: 중앙 모달 — 규칙 / 새 게임 */}
      {lexioMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`lexio-menu-overlay absolute inset-0 bg-black/75 backdrop-blur-md${lexioMenuClosing ? ' lexio-menu-closing' : ''}`}
            aria-label="메뉴 닫기"
            onClick={closeLexioMenu}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lexio-modal-title"
            className={`lexio-rules-panel lexio-menu-dialog relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl shadow-2xl${
              lexioMenuClosing ? ' lexio-menu-closing' : ''
            } ${lexioModalView === 'home' ? 'max-w-md' : 'max-w-3xl'}`}
            style={{
              background:
                'linear-gradient(180deg, #1e1b4b 0%, #0a0a23 100%)',
              boxShadow:
                '0 0 0 1px rgba(168,85,247,0.4), 0 30px 60px -20px rgba(0,0,0,0.8)',
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between gap-3 p-5 backdrop-blur-md sm:p-6"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.95) 0%, rgba(30,27,75,0.85) 100%)',
                borderBottom: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {lexioModalView !== 'home' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (phase === 'setup' && lexioModalView === 'rules') {
                        closeLexioMenu();
                      } else {
                        setLexioModalView('home');
                      }
                    }}
                    className="shrink-0 rounded-full p-1.5 text-slate-300/80 transition-colors hover:bg-white/[0.08] hover:text-purple-200"
                    aria-label={
                      phase === 'setup' && lexioModalView === 'rules'
                        ? '닫기'
                        : '옵션으로 돌아가기'
                    }
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.4em] text-purple-300/80">
                    {lexioModalView === 'home'
                      ? 'Options'
                      : lexioModalView === 'rules'
                        ? 'Guide'
                        : 'Game'}
                  </p>
                  <h2
                    id="lexio-modal-title"
                    className="flex items-center gap-2.5 font-serif text-lg tracking-wide text-purple-100 sm:text-2xl"
                  >
                    {lexioModalView === 'home' && (
                      <>
                        <Settings className="h-5 w-5 shrink-0 text-purple-300/80" />
                        옵션
                      </>
                    )}
                    {lexioModalView === 'rules' && (
                      <>
                        <BookOpen className="h-5 w-5 shrink-0 text-purple-300/80" />
                        렉시오 게임 규칙
                      </>
                    )}
                    {lexioModalView === 'newGame' && (
                      <>
                        <RotateCcw className="h-5 w-5 shrink-0 text-purple-300/80" />
                        새 게임
                      </>
                    )}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={closeLexioMenu}
                className="shrink-0 rounded-full p-1.5 text-slate-300/70 transition-colors hover:bg-white/[0.05] hover:text-purple-200"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {lexioModalView === 'home' && (
              <div className="grid grid-cols-2 gap-3 p-5 sm:gap-4 sm:p-6">
                <button
                  type="button"
                  onClick={() => setLexioModalView('rules')}
                  className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-4 text-center text-sm font-semibold leading-snug tracking-wide text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.45)] transition-colors duration-200 hover:bg-white/[0.12] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(168,85,247,0.7)] sm:min-h-[6.25rem] sm:px-4"
                >
                  <BookOpen className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                  게임 규칙
                </button>
                <button
                  type="button"
                  onClick={() => setLexioModalView('newGame')}
                  className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-purple-500/45 to-violet-800/55 px-3 py-4 text-center text-sm font-semibold leading-snug tracking-wide text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.7),0_8px_20px_-10px_rgba(168,85,247,0.45)] transition-colors duration-200 hover:from-purple-400/55 hover:to-violet-700/65 hover:text-white sm:min-h-[6.25rem] sm:px-4"
                >
                  <RotateCcw className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                  새 게임
                </button>
              </div>
            )}

            {lexioModalView === 'rules' && (
              <LexioRulesContent
                mode="offline"
                playerCount={
                  phase === 'setup'
                    ? pendingAiCount + 1
                    : players.length || undefined
                }
                maxSessionRounds={MAX_SESSION_ROUNDS}
              />
            )}

            {lexioModalView === 'newGame' && (
            <div
              className="shrink-0 space-y-3 border-t p-5 backdrop-blur-md sm:p-6"
              style={{
                borderColor: 'rgba(168,85,247,0.25)',
                background:
                  'linear-gradient(0deg, rgba(10,10,35,0.98) 0%, rgba(30,27,75,0.92) 100%)',
              }}
            >
              {phase === 'playing' ? (
                <>
                  <p className="text-center text-sm leading-relaxed text-purple-100/80">
                    정말로 새 게임을 시작하시겠습니까?
                    <br />
                    <span className="text-purple-100/50">
                      진행 중인 판·세션 코인이 초기화되며 처음 화면으로
                      돌아갑니다.
                    </span>
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={closeLexioMenu}
                      className="flex-1 rounded-full bg-white/[0.04] px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] transition-colors duration-200 hover:bg-white/10 hover:text-white"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeLexioMenu();
                        resetSessionToSetup();
                      }}
                      className="flex-1 rounded-full bg-gradient-to-b from-purple-500/40 to-violet-800/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.65),0_8px_20px_-10px_rgba(168,85,247,0.5)] transition-colors duration-200 hover:from-purple-400/50 hover:to-violet-700/60 hover:text-white"
                    >
                      확인
                    </button>
                  </div>
                </>
              ) : phase === 'setup' ? (
                <button
                  type="button"
                  onClick={() => {
                    closeLexioMenu();
                    beginNewSessionFromSetup();
                  }}
                  className="w-full rounded-full bg-gradient-to-b from-purple-500/40 to-violet-800/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.65),0_8px_20px_-10px_rgba(168,85,247,0.5)] transition-colors duration-200 hover:from-purple-400/50 hover:to-violet-700/60 hover:text-white"
                >
                  게임 시작
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    closeLexioMenu();
                    resetSessionToSetup();
                  }}
                  className="w-full rounded-full bg-white/[0.06] px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] transition-colors duration-200 hover:bg-white/10 hover:text-white"
                >
                  처음 화면으로
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      )}

      <div
        className={
          isTableView
            ? ''
            : phase === 'setup'
              ? 'lexio-offline-setup-page mx-auto w-full max-w-6xl px-4 sm:px-6 lg:max-w-7xl lg:px-8'
              : 'mx-auto max-w-7xl'
        }
      >
        {/* Header — setup은 미니 바, 테이블 뷰는 캔버스 오버레이 */}
        {phase === 'setup' && !isTableView ? (
          <header className="lexio-setup-topbar pointer-events-auto mb-6 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-white/5 px-4 py-2.5 text-sm font-semibold uppercase tracking-widest text-purple-100 hover:bg-white/10"
            >
              <Home className="h-4 w-4" />
              홈
            </Link>
            <div className="text-center">
              <p className="text-base uppercase tracking-[0.45em] text-purple-300/70 sm:text-lg">
                렉시오 오프라인
              </p>
              <h1 className="font-serif text-4xl tracking-wider text-purple-100 sm:text-5xl">
                Lexio Offline
              </h1>
            </div>
            <div className="w-[5.5rem] shrink-0" aria-hidden />
          </header>
        ) : (
          <div
            className={`flex items-center justify-between pointer-events-auto ${
              isTableView
                ? 'fixed top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-[#0a0a23]/95 to-transparent'
                : 'mb-4'
            }`}
          >
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.4)] transition-colors duration-200 hover:bg-white/[0.12] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(168,85,247,0.7)]"
            >
              <Home className="w-4 h-4" />
              홈
            </Link>
            <div className="text-center">
              <p
                className={`uppercase text-purple-300/70 ${
                  isTableView
                    ? 'text-[10px] tracking-[0.5em]'
                    : 'text-sm tracking-[0.4em] sm:text-base sm:tracking-[0.45em]'
                }`}
              >
                {isTableView ? '렉시오' : '렉시오 오프라인'}
              </p>
              <h1
                className={`font-serif tracking-wider text-purple-100 ${
                  isTableView ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'
                }`}
              >
                {isTableView ? 'Lexio' : 'Lexio Offline'}
              </h1>
              {isTableView && (
                <p className="mt-1 text-[11px] tracking-wide text-purple-200/80">
                  코인 {humanSessionCoins} · {sessionCompletedRounds}/
                  {sessionTotalRounds}판
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openLexioOptions}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-purple-500/35 to-violet-800/45 px-3 py-2 text-xs font-semibold tracking-[0.25em] text-purple-100 shadow-[inset_0_0_0_1px_rgba(168,85,247,0.55),0_8px_20px_-10px_rgba(168,85,247,0.45)] transition-colors duration-200 hover:from-purple-400/45 hover:to-violet-700/55 hover:text-white sm:px-4"
                aria-label="옵션"
              >
                <Settings className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]" />
                <span className="hidden sm:inline">옵션</span>
              </button>
            </div>
          </div>
        )}

        {/* Setup Phase */}
        {phase === 'setup' && (
          <LexioOfflineSetup
            pendingSessionRounds={pendingSessionRounds}
            maxSessionRounds={MAX_SESSION_ROUNDS}
            onSessionRoundsChange={setPendingSessionRounds}
            pendingAiCount={pendingAiCount}
            minAiCount={MIN_OFFLINE_AI}
            maxAiCount={MAX_OFFLINE_AI}
            onAiCountChange={setPendingAiCount}
            pendingAiDifficulty={pendingAiDifficulty}
            onAiDifficultyChange={setPendingAiDifficulty}
            onStart={beginNewSessionFromSetup}
            onOpenRules={openLexioRules}
          />
        )}

        {/* Playing / Finished — 전체 화면 3D 1인칭 테이블 */}
        {(phase === 'playing' || phase === 'finished') && (
          <div className="relative h-[100dvh] w-full overflow-hidden">
            <div className="absolute inset-0 z-0">
              <LexioFirstPersonScene
                players={players}
                currentPlayerIdx={currentPlayerIdx}
                humanPlayer={humanPlayer}
                currentPlay={currentPlay}
                selectedIds={selectedIds}
                onToggleTile={toggleSelect}
                phase={phase}
                discardPlacements={discardPlacements}
                finishTableUi={finishTableUi}
                sessionCoinsByPlayerId={sessionCoinsByPlayerId}
              />
            </div>

            {phase === 'finished' &&
              !sessionHasNextHand &&
              finishTableUi && (
                <LexioSessionRankingPanel
                  playersCoins={finishTableUi.playersCoins}
                  humanPlayerId={humanPlayer?.id}
                />
              )}

            {/* HUD: 중앙 메시지 — 사용자 액션 가이드/에러가 있을 때만 표시 */}
            {message && (
              <div className="pointer-events-none absolute left-0 right-0 top-20 z-10 flex justify-center px-4">
                <p
                  className="pointer-events-none max-w-xl rounded-full px-5 py-2 text-center text-xs tracking-wider text-purple-100 shadow-lg sm:text-sm"
                  style={{
                    background: 'rgba(10,10,35,0.72)',
                    boxShadow:
                      'inset 0 0 0 1px rgba(168,85,247,0.35), 0 8px 32px rgba(0,0,0,0.45)',
                  }}
                >
                  {message}
                </p>
              </div>
            )}

            {/* 하단 조작 — 손패는 3D에서 클릭 */}
            {humanPlayer && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-[#0a0a23]/95 via-[#0a0a23]/55 to-transparent px-4 pb-6 pt-16"
              >
                <div className="pointer-events-none mx-auto flex max-w-2xl flex-col items-center gap-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-purple-200/90">
                      <Users className="h-3.5 w-3.5 text-purple-300" />
                      <span className="font-semibold">{humanPlayer.name}</span>
                      <span className="text-purple-300/75">
                        ({humanPlayer.hand.length}장)
                      </span>
                      {isHumanTurn && phase === 'playing' && (
                        <span
                          className="ml-1 rounded-full px-2 py-0.5 text-[10px] tracking-[0.25em] uppercase"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.8)',
                          }}
                        >
                          당신 차례
                        </span>
                      )}
                    </div>
                    {(phase === 'playing' || phase === 'finished') && (
                      <span className="text-[11px] font-medium tabular-nums text-amber-200/90">
                        🪙 {sessionCoinsByPlayerId[humanPlayer.id] ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {phase === 'playing' && selectedTiles.length > 0 && selectedCombo && (
                      <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs text-purple-100">
                        선택: {comboKorean(selectedCombo.type)} (
                        {selectedTiles.length}장)
                      </span>
                    )}
                    {phase === 'playing' && selectedTiles.length > 0 && !selectedCombo && (
                      <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs text-rose-200">
                        유효하지 않은 조합
                      </span>
                    )}
                  </div>
                  {phase === 'finished' ? (
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
                      {sessionHasNextHand ? (
                        <button
                          type="button"
                          onClick={dealNewHand}
                          className="rounded-full px-10 py-2.5 text-xs font-bold tracking-[0.25em] text-purple-100 transition-all hover:-translate-y-0.5"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                            boxShadow:
                              'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 24px -8px rgba(168,85,247,0.55)',
                          }}
                        >
                          계속하기
                          <span className="ml-2.5 font-mono text-[10px] font-semibold tracking-normal text-purple-200/90">
                            Enter
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={resetSessionToSetup}
                          className="rounded-full px-10 py-2.5 text-xs font-bold tracking-[0.25em] text-slate-100 transition-all hover:-translate-y-0.5"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
                          }}
                        >
                          처음으로
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
                      {isHumanTurn && phase === 'playing' && (
                        <>
                          <button
                            type="button"
                            onClick={handleHumanPass}
                            disabled={!currentPlay}
                            className="rounded-full px-6 py-2 text-xs tracking-[0.3em] font-semibold uppercase text-rose-100 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(159,18,57,0.4) 0%, rgba(76,5,25,0.55) 100%)',
                              boxShadow:
                                'inset 0 0 0 1px rgba(244,63,94,0.55), 0 8px 20px -10px rgba(244,63,94,0.4)',
                            }}
                          >
                            패스
                          </button>
                          <button
                            type="button"
                            onClick={handleHumanPlay}
                            disabled={!canHumanPlay}
                            className="rounded-full px-8 py-2 text-xs tracking-[0.3em] font-bold uppercase text-purple-100 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                              boxShadow:
                                'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 24px -8px rgba(168,85,247,0.55)',
                            }}
                          >
                            내기
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
