import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw, BookOpen, X, Users, Crown, Sparkles } from 'lucide-react';
import {
  LexioTile,
  LexioPlayer,
  LexioCombination,
  COLOR_HEX,
  COLOR_KOREAN,
  createDeck,
  shuffle,
  sortHand,
  detectCombo,
  beats,
  comboKorean,
  aiFindMove,
  findStarterIndex,
  hasLowestTile,
  tileStrength,
} from '../utils/lexio';

type GamePhase = 'setup' | 'playing' | 'finished';
type UiPlayer = LexioPlayer;
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
  isFirstTrick: boolean;
};

const NUM_PLAYERS = 5;
const HAND_SIZE = 12;
const LEXIO_STORAGE_KEY = 'lexio-state-v1';

/** 2 타일은 금색 베이스라 밝은 색(특히 황)이 묻힘 → 글자·한글 라벨용 진한 톤 */
const TWO_TILE_INK: Record<LexioTile['color'], string> = {
  green: '#166534',
  blue: '#1e3a8a',
  yellow: '#713f12',
  red: '#991b1b',
};

function Tile({
  tile,
  selected,
  onClick,
  small,
  highlight,
}: {
  tile: LexioTile;
  selected?: boolean;
  onClick?: () => void;
  small?: boolean;
  highlight?: boolean;
}) {
  const color = COLOR_HEX[tile.color];
  const sizeCls = small ? 'w-9 h-12 text-base' : 'w-14 h-20 text-2xl';
  const isTwo = tile.number === 2;
  const isOne = tile.number === 1;
  const inkColor = isTwo ? TWO_TILE_INK[tile.color] : color;

  // 2 타일: 골드 베이스 + 색상 보더 + 광채
  // 1 타일: 미세하게 강조된 베이스
  // 그 외: 일반 흰 베이스
  const baseBackground = isTwo
    ? `radial-gradient(ellipse at 30% 20%, #fff8d4 0%, #fde68a 30%, #f59e0b 65%, #b45309 100%)`
    : isOne
      ? 'linear-gradient(180deg, #fefce8 0%, #fde68a 100%)'
      : 'linear-gradient(180deg, #fafaf9 0%, #e7e5e4 100%)';

  const baseShadow = selected
    ? `0 0 0 2px ${color}, 0 10px 20px -6px rgba(0,0,0,0.6)`
    : highlight
      ? `0 0 0 2px rgba(255,255,255,0.6), 0 8px 18px -6px rgba(0,0,0,0.55)`
      : isTwo
        ? `0 0 0 2px ${color}, 0 0 14px ${color}88, 0 8px 18px -4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.5)`
        : isOne
          ? `0 6px 14px -6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(245,158,11,0.4)`
          : '0 6px 14px -6px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.1)';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative ${sizeCls} rounded-md shrink-0 transition-all duration-150 overflow-hidden ${
        onClick ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
      } ${selected ? '-translate-y-3' : ''} ${
        isTwo ? 'animate-[lexioGlow_2.4s_ease-in-out_infinite]' : ''
      }`}
      style={{
        background: baseBackground,
        boxShadow: baseShadow,
      }}
    >
      {/* 2 타일 전용 화려한 배경 장식 */}
      {isTwo && (
        <>
          {/* 빛나는 광채 */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 45%)',
            }}
          />
          {/* 골드 보더 안쪽 라인 */}
          <span
            className="absolute inset-[3px] rounded-[3px] pointer-events-none"
            style={{
              boxShadow:
                'inset 0 0 0 1px rgba(180,83,9,0.5), inset 0 0 0 2px rgba(255,255,255,0.4)',
            }}
          />
          {/* 십자 다이아몬드 무늬 */}
          <span
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, rgba(180,83,9,0.18) 0px, rgba(180,83,9,0.18) 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, rgba(180,83,9,0.18) 0px, rgba(180,83,9,0.18) 1px, transparent 1px, transparent 6px)',
              mixBlendMode: 'overlay',
            }}
          />
          {/* 왕관 아이콘 (large only) */}
          {!small && (
            <Crown
              className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3"
              style={{
                color: '#7c2d12',
                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.7))',
              }}
              strokeWidth={2.5}
            />
          )}
          {/* 별 장식 */}
          <Sparkles
            className={`absolute ${
              small ? 'top-0 right-0 w-2 h-2' : 'top-1 right-1 w-2.5 h-2.5'
            }`}
            style={{
              color: '#fffbeb',
              filter: 'drop-shadow(0 0 2px rgba(255,200,50,0.9))',
            }}
            strokeWidth={2.5}
          />
          <Sparkles
            className={`absolute ${
              small ? 'bottom-0 left-0 w-2 h-2' : 'bottom-1 left-1 w-2.5 h-2.5'
            } rotate-180`}
            style={{
              color: '#fffbeb',
              filter: 'drop-shadow(0 0 2px rgba(255,200,50,0.9))',
            }}
            strokeWidth={2.5}
          />
        </>
      )}

      {/* 1 타일: 살짝 화려한 곡선 장식 */}
      {isOne && !small && (
        <span
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 60%)',
          }}
        />
      )}

      {/* 좌측 상단 숫자 */}
      <span
        className={`absolute top-0.5 left-1 ${
          small ? 'text-[10px]' : 'text-xs'
        } font-bold leading-none z-10`}
        style={{
          color: inkColor,
          textShadow: isTwo
            ? '0 0 1px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.35)'
            : undefined,
        }}
      >
        {tile.number}
      </span>

      {/* 중앙 큰 숫자 */}
      <span
        className={`absolute inset-0 flex items-center justify-center font-extrabold z-10 ${
          small ? 'text-base' : isTwo ? 'text-3xl' : 'text-2xl'
        }`}
        style={{
          color: inkColor,
          textShadow: isTwo
            ? '0 0 1px rgba(255,255,255,0.95), 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(0,0,0,0.35)'
            : undefined,
          fontFamily: isTwo ? 'Georgia, serif' : undefined,
          fontStyle: isTwo ? 'italic' : undefined,
        }}
      >
        {tile.number}
      </span>

      {/* 우측 하단 숫자 */}
      <span
        className={`absolute bottom-0.5 right-1 ${
          small ? 'text-[10px]' : 'text-xs'
        } font-bold leading-none rotate-180 z-10`}
        style={{
          color: inkColor,
          textShadow: isTwo
            ? '0 0 1px rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.35)'
            : undefined,
        }}
      >
        {tile.number}
      </span>

      {/* 좌측 하단 색상 한글 */}
      <span
        className={`absolute bottom-0.5 left-1 tracking-wider font-semibold z-10 ${
          isTwo && !small ? 'text-[10px]' : 'text-[8px]'
        }`}
        style={{
          color: inkColor,
          textShadow: isTwo
            ? '0 0 1px rgba(255,255,255,0.85), 0 1px 2px rgba(0,0,0,0.3)'
            : undefined,
        }}
      >
        {COLOR_KOREAN[tile.color]}
      </span>
    </button>
  );
}

function TileBack({ small }: { small?: boolean }) {
  const sizeCls = small ? 'w-7 h-10' : 'w-9 h-12';
  return (
    <div
      className={`${sizeCls} rounded-md shrink-0`}
      style={{
        background:
          'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)',
        boxShadow:
          '0 4px 10px -2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(168,85,247,0.5)',
        backgroundImage:
          'repeating-linear-gradient(45deg, rgba(168,85,247,0.18) 0px, rgba(168,85,247,0.18) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(168,85,247,0.18) 0px, rgba(168,85,247,0.18) 2px, transparent 2px, transparent 6px)',
      }}
    />
  );
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
  const deck = shuffle(createDeck());
  return players.map((p, idx) => ({
    ...p,
    hand: sortHand(deck.slice(idx * HAND_SIZE, (idx + 1) * HAND_SIZE)),
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
  const [message, setMessage] = useState('게임을 시작하세요!');
  const [showRules, setShowRules] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [lastPlayedByIdx, setLastPlayedByIdx] = useState<number | null>(null);
  const [isFirstTrick, setIsFirstTrick] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  const humanPlayer = players.find((p) => !p.isAI);

  // 게임 시작
  const startGame = useCallback(() => {
    const dealt = dealHands(makePlayers(NUM_PLAYERS - 1));
    const starter = findStarterIndex(dealt);
    setPlayers(dealt);
    setCurrentPlay(null);
    setTrickStarterIdx(null);
    setCurrentPlayerIdx(starter);
    setPhase('playing');
    setWinnerId(null);
    setSelectedIds([]);
    setLastPlayedByIdx(null);
    setIsFirstTrick(true);
    setMessage(
      `${dealt[starter].name}이(가) 가장 낮은 타일을 가지고 있어 먼저 시작합니다.`,
    );
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
        setMessage(
          `${p.name}이(가) 모든 타일을 내고 승리했습니다! 🎉`,
        );
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
      // 다음 플레이어
      let next = (playerWhoActedIdx + 1) % updatedPlayers.length;
      // 빈 손 플레이어 스킵 (이론상 게임 종료 직전 외에는 없음)
      let safety = 0;
      while (updatedPlayers[next].hand.length === 0 && safety < NUM_PLAYERS) {
        next = (next + 1) % updatedPlayers.length;
        safety++;
      }

      // 트릭 시작자에게 다시 차례가 돌아오면 → 모든 다른 플레이어가 패스했음
      if (
        newTrickStarterIdx !== null &&
        next === newTrickStarterIdx &&
        newCurrentPlay !== null
      ) {
        // 트릭 리셋: 트릭 시작자가 새 트릭을 리드
        const reset = updatedPlayers.map((p) => ({ ...p, passed: false }));
        setPlayers(reset);
        setCurrentPlay(null);
        setTrickStarterIdx(null);
        setCurrentPlayerIdx(next);
        setMessage(`모두 패스했습니다. ${reset[next].name}이(가) 새 라운드를 시작합니다.`);
        return;
      }

      setCurrentPlayerIdx(next);
    },
    [],
  );

  // 한 명이 플레이
  const doPlay = useCallback(
    (playerIdx: number, tiles: LexioTile[]) => {
      const combo = detectCombo(tiles);
      if (!combo) return false;
      if (currentPlay && !beats(combo, currentPlay)) return false;

      // 첫 트릭은 가장 낮은 타일을 포함해야 함
      if (isFirstTrick) {
        let lowestStrength = Infinity;
        let lowestId = -1;
        for (const p of players) {
          for (const t of p.hand) {
            const s = tileStrength(t);
            if (s < lowestStrength) {
              lowestStrength = s;
              lowestId = t.id;
            }
          }
        }
        if (!tiles.some((t) => t.id === lowestId)) return false;
      }

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
      setPlayers(updated);
      setCurrentPlay(combo);
      setTrickStarterIdx(playerIdx);
      setLastPlayedByIdx(playerIdx);
      setIsFirstTrick(false);
      setMessage(
        `${updated[playerIdx].name}이(가) ${comboKorean(combo.type)}를 냈습니다.`,
      );

      if (checkWinner(updated, playerIdx)) return true;

      advanceTurn(updated, playerIdx, combo, playerIdx);
      return true;
    },
    [players, currentPlay, isFirstTrick, advanceTurn, checkWinner],
  );

  // 한 명이 패스
  const doPass = useCallback(
    (playerIdx: number) => {
      if (!currentPlay) return false; // 리드 차례엔 패스 불가
      const updated = players.map((p, idx) =>
        idx === playerIdx ? { ...p, passed: true } : p,
      );
      setPlayers(updated);
      setMessage(`${updated[playerIdx].name}이(가) 패스했습니다.`);
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
      setMessage(saved.message ?? '게임을 시작하세요!');
      setLastPlayedByIdx(saved.lastPlayedByIdx ?? null);
      setIsFirstTrick(saved.isFirstTrick ?? false);
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
      isFirstTrick,
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
    isFirstTrick,
  ]);

  // AI 자동 진행
  useEffect(() => {
    if (phase !== 'playing') return;
    const current = players[currentPlayerIdx];
    if (!current || !current.isAI) return;

    const timer = setTimeout(() => {
      const mustIncludeLowest = isFirstTrick && trickStarterIdx === null;
      const move = aiFindMove(current.hand, currentPlay, mustIncludeLowest);
      if (move === null) {
        // 패스 (리드 차례엔 패스 불가이지만 mustInclude 케이스 외 대부분 정상)
        if (currentPlay) {
          doPass(currentPlayerIdx);
        } else {
          // 리드인데 못 만들 경우 (사실상 없음) - 가장 낮은 단일
          if (current.hand.length > 0) {
            doPlay(currentPlayerIdx, [sortHand(current.hand)[0]]);
          }
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
    isFirstTrick,
    trickStarterIdx,
    doPlay,
    doPass,
  ]);

  const humanIdx = players.findIndex((p) => !p.isAI);
  const isHumanTurn = humanIdx === currentPlayerIdx && phase === 'playing';

  const canHumanPlay =
    isHumanTurn &&
    selectedCombo !== null &&
    (currentPlay === null || beats(selectedCombo, currentPlay)) &&
    (!isFirstTrick || (humanPlayer && hasLowestTileInSelection()));

  function hasLowestTileInSelection(): boolean {
    if (!isFirstTrick || !humanPlayer) return true;
    let lowestStrength = Infinity;
    let lowestId = -1;
    for (const p of players) {
      for (const t of p.hand) {
        const s = tileStrength(t);
        if (s < lowestStrength) {
          lowestStrength = s;
          lowestId = t.id;
        }
      }
    }
    return selectedTiles.some((t) => t.id === lowestId);
  }

  const aiPlayers = players.filter((p) => p.isAI);
  // (5인 게임: 사람 1 + AI 4)

  return (
    <div
      className="min-h-screen p-4 text-slate-100"
      style={{
        background:
          'radial-gradient(ellipse at top, #2e1065 0%, #1e1b4b 45%, #0a0a23 100%)',
      }}
    >
      {/* New Game Confirmation Modal */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className="rounded-2xl max-w-md w-full p-7"
            style={{
              background:
                'linear-gradient(180deg, #1e1b4b 0%, #0a0a23 100%)',
              boxShadow:
                '0 0 0 1px rgba(168,85,247,0.4), 0 30px 60px -20px rgba(0,0,0,0.8)',
            }}
          >
            <p className="text-[10px] tracking-[0.4em] text-purple-300/80 uppercase text-center mb-2">
              Confirm
            </p>
            <h2 className="text-2xl font-serif tracking-wide text-purple-100 mb-4 text-center">
              새 게임 시작
            </h2>
            <p className="text-purple-100/80 text-center mb-7 text-sm leading-relaxed">
              정말로 새 게임을 시작하시겠습니까?
              <br />
              <span className="text-purple-100/50">
                현재 진행 중인 게임이 초기화됩니다.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewGameConfirm(false)}
                className="flex-1 rounded-full px-6 py-3 text-xs tracking-[0.3em] uppercase font-semibold text-slate-200 transition-all hover:-translate-y-0.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowNewGameConfirm(false);
                  startGame();
                }}
                className="flex-1 rounded-full px-6 py-3 text-xs tracking-[0.3em] uppercase font-semibold text-purple-100 transition-all hover:-translate-y-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(168,85,247,0.4) 0%, rgba(91,33,182,0.5) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(168,85,247,0.65), 0 8px 20px -10px rgba(168,85,247,0.5)',
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className="lexio-rules-panel rounded-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col"
            style={{
              background:
                'linear-gradient(180deg, #1e1b4b 0%, #0a0a23 100%)',
              boxShadow:
                '0 0 0 1px rgba(168,85,247,0.4), 0 30px 60px -20px rgba(0,0,0,0.8)',
            }}
          >
            <div
              className="p-6 flex items-center justify-between backdrop-blur-md shrink-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.95) 0%, rgba(30,27,75,0.85) 100%)',
                borderBottom: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              <div>
                <p className="text-[10px] tracking-[0.4em] text-purple-300/80 uppercase mb-1">
                  Game Guide
                </p>
                <h2 className="text-2xl font-serif tracking-wide text-purple-100 flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-purple-300/80" />
                  렉시오 게임 규칙
                </h2>
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="text-slate-300/70 hover:text-purple-200 transition-colors rounded-full p-1.5 hover:bg-white/[0.05]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="lexio-rules-scroll p-6 space-y-4 text-slate-100 overflow-y-auto">
              <section className="lexio-rule-section">
                <h3 className="text-xs tracking-[0.3em] uppercase text-purple-300/80 mb-3">
                  게임 개요
                </h3>
                <p className="text-purple-100/85 leading-relaxed text-sm">
                  렉시오는 5명이 즐기는 한국식 셰딩(Shedding) 게임입니다.
                  각 플레이어는 12장의 타일을 받으며,
                  손에 든 타일을 가장 먼저 모두 내려놓는 사람이 승리합니다.
                  돌아가며 한 명씩 같은 종류의 더 강한 조합을 내거나 패스합니다.
                </p>
              </section>

              <section className="lexio-rule-section">
                <h3 className="text-xs tracking-[0.3em] uppercase text-purple-300/80 mb-3">
                  타일 구성
                </h3>
                <ul className="text-purple-100/85 text-sm space-y-1.5 list-disc list-inside">
                  <li>총 60장: 1~15 숫자 × 4색(녹/청/황/홍)</li>
                  <li>
                    <strong>숫자 강도</strong>(약 → 강): 3 &lt; 4 &lt; ... &lt;
                    15 &lt; 1 &lt; 2
                  </li>
                  <li>
                    <strong>색상 강도</strong>(약 → 강):{' '}
                    <span style={{ color: COLOR_HEX.blue }}>청</span> &lt;{' '}
                    <span style={{ color: COLOR_HEX.yellow }}>황</span> &lt;{' '}
                    <span style={{ color: COLOR_HEX.green }}>녹</span> &lt;{' '}
                    <span style={{ color: COLOR_HEX.red }}>홍</span>
                  </li>
                  <li>가장 약한 타일은 <strong>3-청</strong>, 가장 강한 타일은 <strong>2-홍</strong>입니다.</li>
                </ul>
              </section>

              <section className="lexio-rule-section">
                <h3 className="text-xs tracking-[0.3em] uppercase text-purple-300/80 mb-3">
                  조합 종류
                </h3>
                <ul className="text-purple-100/85 text-sm space-y-1.5 list-disc list-inside">
                  <li><strong>싱글</strong>: 타일 1장</li>
                  <li><strong>페어</strong>: 같은 숫자 2장</li>
                  <li><strong>트리플</strong>: 같은 숫자 3장</li>
                  <li><strong>스트레이트</strong>: 5장 연속 숫자(강도 기준 연속)</li>
                  <li><strong>플러시</strong>: 같은 색 5장</li>
                  <li><strong>풀하우스</strong>: 트리플 + 페어</li>
                  <li><strong>포카드</strong>: 같은 숫자 4장 + 아무 1장</li>
                  <li><strong>스트레이트 플러시</strong>: 같은 색 연속 5장</li>
                </ul>
                <p className="text-purple-100/70 leading-relaxed text-xs mt-3">
                  5장 조합 강도: 스트레이트 &lt; 플러시 &lt; 풀하우스 &lt;
                  포카드 &lt; 스트레이트 플러시
                </p>
              </section>

              <section className="lexio-rule-section">
                <h3 className="text-xs tracking-[0.3em] uppercase text-purple-300/80 mb-3">
                  진행 방식
                </h3>
                <ul className="text-purple-100/85 text-sm space-y-1.5 list-disc list-inside">
                  <li>가장 약한 타일(3-청 등)을 가진 사람이 첫 라운드를 시작합니다.</li>
                  <li>첫 트릭에서는 반드시 가장 약한 타일을 포함해서 내야 합니다.</li>
                  <li>이후 같은 장수의 더 강한 조합을 내거나 패스합니다.</li>
                  <li>1, 2, 3장 조합은 같은 종류끼리만 비교합니다.</li>
                  <li>5장 조합은 종류가 달라도 강도에 따라 이길 수 있습니다.</li>
                  <li>나머지 모두가 패스하면 마지막에 낸 사람이 새 트릭을 리드합니다.</li>
                  <li>가장 먼저 손에 든 타일을 모두 내려놓으면 승리!</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.3em] uppercase font-semibold text-purple-100 transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(255,255,255,0.05)',
              boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.4)',
            }}
          >
            <Home className="w-4 h-4" />
            홈
          </Link>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.5em] text-purple-300/70 uppercase">
              Lexio
            </p>
            <h1 className="text-3xl font-serif tracking-wider text-purple-100">
              렉 시 오
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRules(true)}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.3em] uppercase font-semibold text-purple-100 transition-all hover:-translate-y-0.5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.4)',
              }}
            >
              <BookOpen className="w-4 h-4" />
              규칙
            </button>
            <button
              onClick={() => {
                if (phase === 'setup' || phase === 'finished') startGame();
                else setShowNewGameConfirm(true);
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs tracking-[0.3em] uppercase font-semibold text-purple-100 transition-all hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(180deg, rgba(168,85,247,0.4) 0%, rgba(91,33,182,0.5) 100%)',
                boxShadow:
                  'inset 0 0 0 1px rgba(168,85,247,0.65), 0 8px 20px -10px rgba(168,85,247,0.5)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              새 게임
            </button>
          </div>
        </div>

        {/* Setup Phase */}
        {phase === 'setup' && (
          <div className="flex flex-col items-center justify-center py-24">
            <div
              className="rounded-2xl p-10 max-w-md w-full text-center"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.7) 0%, rgba(10,10,35,0.85) 100%)',
                boxShadow:
                  'inset 0 0 0 1px rgba(168,85,247,0.4), 0 30px 60px -20px rgba(0,0,0,0.7)',
              }}
            >
              <p className="text-[10px] tracking-[0.5em] text-purple-300/80 uppercase mb-3">
                Welcome
              </p>
              <h2 className="text-2xl font-serif tracking-wide text-purple-100 mb-3">
                렉시오에 오신 것을 환영합니다
              </h2>
              <p className="text-purple-100/70 text-sm mb-8 leading-relaxed">
                4명의 AI 상대와 함께 즐기는 5인 한국식 셰딩 게임.
                <br />
                각자 12장의 타일을 받아 가장 먼저 손패를 모두 비우면 승리합니다.
              </p>
              <button
                onClick={startGame}
                className="rounded-full px-8 py-3 text-xs tracking-[0.4em] uppercase font-bold text-purple-100 transition-all hover:-translate-y-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 30px -8px rgba(168,85,247,0.6)',
                }}
              >
                게임 시작
              </button>
            </div>
          </div>
        )}

        {/* Playing / Finished */}
        {(phase === 'playing' || phase === 'finished') && (
          <div
            className="relative rounded-3xl p-6"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(76,29,149,0.45) 0%, rgba(30,27,75,0.5) 60%, rgba(10,10,35,0.7) 100%)',
              boxShadow:
                'inset 0 0 0 1px rgba(168,85,247,0.3), 0 20px 60px -20px rgba(0,0,0,0.7)',
              minHeight: '720px',
            }}
          >
            {/* Top row: 4 AI players */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {aiPlayers.map((ai) => (
                <PlayerCard
                  key={ai.id}
                  player={ai}
                  isActive={currentPlayerIdx === players.indexOf(ai)}
                  position="top"
                />
              ))}
            </div>

            {/* Center play area */}
            <div className="flex justify-center mb-5">
              <div
                className="rounded-2xl px-6 py-5 min-w-[340px] max-w-2xl w-full"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(15,12,40,0.7) 0%, rgba(8,7,25,0.8) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(168,85,247,0.3), 0 12px 30px -10px rgba(0,0,0,0.6)',
                }}
              >
                <p className="text-center text-[10px] tracking-[0.4em] text-purple-300/70 uppercase mb-3">
                  Current Play
                </p>
                {currentPlay ? (
                  <>
                    <div className="flex justify-center gap-1.5 flex-wrap mb-3">
                      {currentPlay.tiles.map((t) => (
                        <Tile key={t.id} tile={t} highlight />
                      ))}
                    </div>
                    <p className="text-center text-purple-100/90 text-xs">
                      <span className="font-semibold text-purple-200">
                        {lastPlayedByIdx !== null
                          ? players[lastPlayedByIdx]?.name
                          : ''}
                      </span>
                      {' · '}
                      <span className="text-purple-300/80">
                        {comboKorean(currentPlay.type)}
                      </span>
                    </p>
                  </>
                ) : (
                  <div className="text-center text-purple-100/40 text-xs tracking-[0.3em] uppercase py-8">
                    {phase === 'finished' ? 'Game Over' : 'Lead the trick'}
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="text-center mb-5">
              <p
                className="inline-block rounded-full px-5 py-2 text-xs tracking-wider text-purple-100"
                style={{
                  background: 'rgba(168,85,247,0.12)',
                  boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.35)',
                }}
              >
                {message}
              </p>
            </div>

            {/* Human player area */}
            {humanPlayer && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(15,12,40,0.8) 0%, rgba(8,7,25,0.92) 100%)',
                  boxShadow: isHumanTurn
                    ? 'inset 0 0 0 1px rgba(168,85,247,0.65), 0 0 30px -2px rgba(168,85,247,0.4)'
                    : 'inset 0 0 0 1px rgba(168,85,247,0.25)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-300" />
                    <span className="text-purple-100 font-semibold text-sm">
                      {humanPlayer.name}
                    </span>
                    <span className="text-purple-300/70 text-xs">
                      ({humanPlayer.hand.length}장)
                    </span>
                    {isHumanTurn && (
                      <span
                        className="ml-2 text-[10px] tracking-[0.3em] uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.8)',
                        }}
                      >
                        Your Turn
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-purple-200/80">
                    {selectedTiles.length > 0 && selectedCombo && (
                      <span>
                        선택: <strong>{comboKorean(selectedCombo.type)}</strong>{' '}
                        ({selectedTiles.length}장)
                      </span>
                    )}
                    {selectedTiles.length > 0 && !selectedCombo && (
                      <span className="text-rose-300/80">
                        유효하지 않은 조합
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1.5 flex-wrap justify-center mb-4 min-h-[5rem]">
                  {humanPlayer.hand.map((t) => (
                    <Tile
                      key={t.id}
                      tile={t}
                      selected={selectedIds.includes(t.id)}
                      onClick={
                        phase === 'playing'
                          ? () => toggleSelect(t.id)
                          : undefined
                      }
                    />
                  ))}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setSelectedIds([])}
                    disabled={!isHumanTurn || selectedIds.length === 0}
                    className="rounded-full px-5 py-2 text-xs tracking-[0.3em] uppercase font-semibold text-slate-200 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                    }}
                  >
                    선택 취소
                  </button>
                  <button
                    onClick={handleHumanPass}
                    disabled={!isHumanTurn || !currentPlay}
                    className="rounded-full px-6 py-2 text-xs tracking-[0.3em] uppercase font-semibold text-rose-100 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                    onClick={handleHumanPlay}
                    disabled={!canHumanPlay}
                    className="rounded-full px-8 py-2 text-xs tracking-[0.3em] uppercase font-bold text-purple-100 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                      boxShadow:
                        'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 24px -8px rgba(168,85,247,0.55)',
                    }}
                  >
                    내기
                  </button>
                </div>
              </div>
            )}

            {/* Winner overlay */}
            {phase === 'finished' && winnerId !== null && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-3xl">
                <div
                  className="rounded-2xl p-8 max-w-md w-full text-center"
                  style={{
                    background:
                      'linear-gradient(180deg, #1e1b4b 0%, #0a0a23 100%)',
                    boxShadow:
                      '0 0 0 1px rgba(168,85,247,0.45), 0 30px 60px -20px rgba(0,0,0,0.8)',
                  }}
                >
                  <p className="text-[10px] tracking-[0.4em] text-purple-300/80 uppercase mb-2">
                    Game Over
                  </p>
                  <h2 className="text-3xl font-serif tracking-wide text-purple-100 mb-2">
                    {winnerId === humanPlayer?.id ? '🎉 승리!' : '패배'}
                  </h2>
                  <p className="text-purple-100/80 mb-7 text-sm">
                    {players.find((p) => p.id === winnerId)?.name}이(가) 모든
                    타일을 내려놓았습니다.
                  </p>
                  <button
                    onClick={startGame}
                    className="rounded-full px-8 py-3 text-xs tracking-[0.4em] uppercase font-bold text-purple-100"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                      boxShadow:
                        'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 30px -8px rgba(168,85,247,0.6)',
                    }}
                  >
                    한 판 더
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerCard({
  player,
  isActive,
  position,
}: {
  player: UiPlayer;
  isActive: boolean;
  position: 'top' | 'left' | 'right';
}) {
  const showCount = Math.min(player.hand.length, 15);
  return (
    <div
      className={`rounded-2xl px-4 py-3 min-w-[180px] transition-all duration-300 ${
        position === 'top' ? '' : ''
      } ${player.passed ? 'opacity-70' : ''}`}
      style={{
        background:
          'linear-gradient(180deg, rgba(15,12,40,0.85) 0%, rgba(8,7,25,0.92) 100%)',
        boxShadow: isActive
          ? '0 0 0 1px rgba(168,85,247,0.85), 0 0 26px -2px rgba(168,85,247,0.55), 0 10px 30px -10px rgba(0,0,0,0.7)'
          : 'inset 0 0 0 1px rgba(168,85,247,0.25), 0 8px 22px -10px rgba(0,0,0,0.6)',
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 text-purple-300/80 shrink-0" />
          <span className="text-purple-100 text-xs font-semibold tracking-wide truncate">
            {player.name}
          </span>
        </div>
        <span className="text-[10px] tracking-wide text-purple-300/80">
          {player.hand.length}장
        </span>
      </div>
      <div className="flex flex-wrap gap-0.5 justify-center">
        {Array.from({ length: showCount }).map((_, i) => (
          <TileBack key={i} small />
        ))}
        {player.hand.length === 0 && (
          <span className="text-[10px] tracking-[0.3em] uppercase text-purple-300/60 py-2">
            손패 없음
          </span>
        )}
      </div>
      {player.passed && (
        <p className="text-[10px] tracking-[0.3em] uppercase text-rose-300/80 text-center mt-2">
          Pass
        </p>
      )}
    </div>
  );
}
