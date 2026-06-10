import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link } from 'react-router';
import { Bot, Eye, EyeOff, Home, Info, RotateCcw, Trophy, Users, X } from 'lucide-react';
import {
  BLACK,
  BOARD_SIZE,
  coordLabel,
  createEmptyBoard,
  getAIMove,
  getWinningLine,
  HOSHI_POINTS,
  isBoardFull,
  STONE_PALETTE,
  type Board,
  type GameResult,
  type Stone,
  WHITE,
} from '../utils/blindOmok';

const STATS_KEY = 'blind-omok-stats';

type GameMode = 'single' | 'multi';
type Stats = { wins: number; losses: number; draws: number };

/** 0 = 빈칸, 그 외에는 STONE_PALETTE index + 1 */
type ColorBoard = number[][];

function createEmptyColorBoard(): ColorBoard {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0),
  );
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        wins: parsed.wins ?? 0,
        losses: parsed.losses ?? 0,
        draws: parsed.draws ?? 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { wins: 0, losses: 0, draws: 0 };
}

function saveStats(stats: Stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function keyOf(row: number, col: number) {
  return `${row}-${col}`;
}

/** 같은 턴(흑 착수 + 백 응수)은 같은 색을 공유하며 턴마다 순환한다 */
function colorIdForMove(moveCount: number) {
  return (Math.floor(moveCount / 2) % STONE_PALETTE.length) + 1;
}

export default function BlindOmok() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [colorBoard, setColorBoard] = useState<ColorBoard>(() => createEmptyColorBoard());
  const [result, setResult] = useState<GameResult>('playing');
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [winningLine, setWinningLine] = useState<Set<string>>(() => new Set());
  const [moveCount, setMoveCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<Stone>(BLACK);
  const [revealOwners, setRevealOwners] = useState(false);
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [message, setMessage] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOver = result !== 'playing';
  const nextColor = STONE_PALETTE[(Math.floor(moveCount / 2)) % STONE_PALETTE.length];
  const aiThinking = mode === 'single' && currentPlayer === WHITE && !gameOver;
  const inputLocked = gameOver || aiThinking;

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2000);
  }, []);

  const endGame = useCallback(
    (outcome: 'won' | 'lost' | 'draw', forMode: GameMode) => {
      setResult(outcome);
      setRevealOwners(true);
      if (forMode === 'single') {
        setStats((prev) => {
          const next: Stats = {
            wins: prev.wins + (outcome === 'won' ? 1 : 0),
            losses: prev.losses + (outcome === 'lost' ? 1 : 0),
            draws: prev.draws + (outcome === 'draw' ? 1 : 0),
          };
          saveStats(next);
          return next;
        });
      }
    },
    [],
  );

  const resetBoard = useCallback(() => {
    setBoard(createEmptyBoard());
    setColorBoard(createEmptyColorBoard());
    setResult('playing');
    setLastMove(null);
    setWinningLine(new Set());
    setMoveCount(0);
    setCurrentPlayer(BLACK);
    setRevealOwners(false);
    setMessage(null);
  }, []);

  const startGame = useCallback(
    (selected: GameMode) => {
      setMode(selected);
      resetBoard();
    },
    [resetBoard],
  );

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  const runAIMove = useCallback(
    (currentBoard: Board, currentColors: ColorBoard, countAfterPlayer: number) => {
      const aiMove = getAIMove(currentBoard);
      if (!aiMove) {
        endGame('draw', 'single');
        return;
      }

      const [aiRow, aiCol] = aiMove;
      const colorId = colorIdForMove(countAfterPlayer);
      const nextBoard = currentBoard.map((r) => [...r]);
      const nextColors = currentColors.map((r) => [...r]);
      nextBoard[aiRow][aiCol] = WHITE;
      nextColors[aiRow][aiCol] = colorId;

      setBoard(nextBoard);
      setColorBoard(nextColors);
      setLastMove([aiRow, aiCol]);
      setMoveCount(countAfterPlayer + 1);

      const aiLine = getWinningLine(nextBoard, aiRow, aiCol, WHITE);
      if (aiLine) {
        setWinningLine(new Set(aiLine.map(([r, c]) => keyOf(r, c))));
        endGame('lost', 'single');
        return;
      }

      if (isBoardFull(nextBoard)) {
        endGame('draw', 'single');
        return;
      }

      setCurrentPlayer(BLACK);
    },
    [endGame],
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (inputLocked || mode === null) return;

      if (board[row][col] !== 0) {
        showMessage('이미 돌이 놓인 자리입니다');
        return;
      }

      const owner = currentPlayer;
      const colorId = colorIdForMove(moveCount);
      const nextBoard = board.map((r) => [...r]);
      const nextColors = colorBoard.map((r) => [...r]);
      nextBoard[row][col] = owner;
      nextColors[row][col] = colorId;
      const newCount = moveCount + 1;

      setBoard(nextBoard);
      setColorBoard(nextColors);
      setLastMove([row, col]);
      setMoveCount(newCount);
      setMessage(null);

      const line = getWinningLine(nextBoard, row, col, owner);
      if (line) {
        setWinningLine(new Set(line.map(([r, c]) => keyOf(r, c))));
        endGame(owner === BLACK ? 'won' : 'lost', mode);
        return;
      }

      if (isBoardFull(nextBoard)) {
        endGame('draw', mode);
        return;
      }

      if (mode === 'single') {
        setCurrentPlayer(WHITE);
        window.setTimeout(() => runAIMove(nextBoard, nextColors, newCount), 480);
      } else {
        setCurrentPlayer(owner === BLACK ? WHITE : BLACK);
      }
    },
    [
      board,
      colorBoard,
      currentPlayer,
      inputLocked,
      mode,
      moveCount,
      endGame,
      runAIMove,
      showMessage,
    ],
  );

  const isHoshi = (row: number, col: number) =>
    HOSHI_POINTS.some(([r, c]) => r === row && c === col);

  const resultLabel =
    result === 'playing'
      ? null
      : mode === 'multi'
        ? result === 'won'
          ? '플레이어 1 승리!'
          : result === 'lost'
            ? '플레이어 2 승리!'
            : '무승부'
        : result === 'won'
          ? '승리!'
          : result === 'lost'
            ? '패배...'
            : '무승부';

  const turnLabel =
    mode === 'multi'
      ? currentPlayer === BLACK
        ? '플레이어 1 차례'
        : '플레이어 2 차례'
      : aiThinking
        ? 'NPC 생각 중...'
        : '내 차례';

  if (mode === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-950 via-emerald-950 to-stone-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">블라인드 오목</h1>
            <p className="text-emerald-200/80 text-sm">
              모든 돌이 보이지만, 누구의 돌인지는 알 수 없습니다
            </p>
          </div>

          <div className="grid gap-4 mb-6">
            <button
              type="button"
              onClick={() => startGame('single')}
              className="group flex items-center gap-4 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-emerald-400/50 rounded-2xl p-5 text-left transition-all"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 shrink-0">
                <Bot className="w-6 h-6" />
              </span>
              <span>
                <span className="block text-lg font-bold text-white">싱글</span>
                <span className="block text-sm text-zinc-400">AI(NPC)와 대결</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => startGame('multi')}
              className="group flex items-center gap-4 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-emerald-400/50 rounded-2xl p-5 text-left transition-all"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/20 text-sky-300 shrink-0">
                <Users className="w-6 h-6" />
              </span>
              <span>
                <span className="block text-lg font-bold text-white">멀티 (로컬)</span>
                <span className="block text-sm text-zinc-400">한 기기에서 둘이 번갈아 대결</span>
              </span>
            </button>
          </div>

          <div className="flex gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              홈으로
            </Link>
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
            >
              <Info className="w-4 h-4" />
              규칙 보기
            </button>
          </div>
        </div>

        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-emerald-950 to-stone-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-5">
          <h1 className="text-4xl font-bold text-white mb-2">블라인드 오목</h1>
          <p className="text-emerald-200/80 text-sm">
            {mode === 'single' ? '싱글 — AI와 대결' : '멀티 — 로컬 2인 대결'}
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            {mode === 'single' ? (
              <div className="flex gap-5">
                <div className="text-center">
                  <p className="text-xs text-zinc-400">승</p>
                  <p className="text-xl font-bold text-emerald-300">{stats.wins}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-400">패</p>
                  <p className="text-xl font-bold text-red-300">{stats.losses}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-400">무</p>
                  <p className="text-xl font-bold text-zinc-300">{stats.draws}</p>
                </div>
              </div>
            ) : (
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                <Users className="w-4 h-4 text-sky-300" />
                로컬 2인전
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                모드
              </button>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                규칙
              </button>
              {gameOver ? (
                <button
                  type="button"
                  onClick={() => setRevealOwners((v) => !v)}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
                >
                  {revealOwners ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {revealOwners ? '주인 숨기기' : '주인 공개'}
                </button>
              ) : null}
            </div>
          </div>

          {!gameOver && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
              <span
                className={`text-sm px-3 py-1 rounded-full border ${
                  !aiThinking
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-white/10 border-white/20 text-zinc-400'
                }`}
              >
                {turnLabel}
              </span>
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                이번 돌 색
                <span
                  className="inline-block w-5 h-5 rounded-full border border-white/40 shadow"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${nextColor.from}, ${nextColor.via} 55%, ${nextColor.to})`,
                  }}
                />
                <span className="text-zinc-400">{nextColor.label}</span>
              </span>
            </div>
          )}

          {message && (
            <p className="text-sm text-amber-200/90 mt-3 text-center">{message}</p>
          )}
        </div>

        {gameOver && resultLabel && (
          <div
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl mb-4 border ${
              result === 'won'
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                : result === 'lost'
                  ? 'bg-red-500/20 border-red-400/50 text-red-100'
                  : 'bg-white/10 border-white/20 text-zinc-200'
            }`}
          >
            <Trophy className="w-5 h-5" />
            <span className="font-bold">{resultLabel}</span>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 mb-4 border border-white/20">
          <div
            className="relative rounded-xl"
            style={{
              background: 'linear-gradient(145deg, #d8b974 0%, #c4a35a 45%, #a8843f 100%)',
              padding: '10px',
            }}
          >
            <div
              className="grid gap-0 relative"
              style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, idx) => {
                const row = Math.floor(idx / BOARD_SIZE);
                const col = idx % BOARD_SIZE;
                const cell = board[row][col];
                const colorIdx = colorBoard[row][col] - 1;
                const palette = colorIdx >= 0 ? STONE_PALETTE[colorIdx] : null;
                const isLast =
                  lastMove !== null && lastMove[0] === row && lastMove[1] === col;
                const inWinLine = winningLine.has(keyOf(row, col));

                return (
                  <button
                    key={keyOf(row, col)}
                    type="button"
                    disabled={inputLocked}
                    onClick={() => handleCellClick(row, col)}
                    className={`relative aspect-square transition-colors duration-150 ${
                      !inputLocked && cell === 0
                        ? 'cursor-pointer hover:bg-black/10'
                        : 'cursor-default'
                    }`}
                    aria-label={
                      palette
                        ? `${palette.label} 돌 ${coordLabel(row, col)}`
                        : `좌표 ${coordLabel(row, col)}`
                    }
                  >
                    <span className="pointer-events-none absolute left-0 top-1/2 h-px w-1/2 -translate-y-1/2 bg-stone-900/40" />
                    <span className="pointer-events-none absolute right-0 top-1/2 h-px w-1/2 -translate-y-1/2 bg-stone-900/40" />
                    <span className="pointer-events-none absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-stone-900/40" />
                    <span className="pointer-events-none absolute left-1/2 bottom-0 h-1/2 w-px -translate-x-1/2 bg-stone-900/40" />
                    {isHoshi(row, col) && cell === 0 && (
                      <span className="pointer-events-none absolute inset-0 m-auto w-[20%] h-[20%] rounded-full bg-stone-900/60" />
                    )}

                    {palette && (
                      <span
                        className={`absolute inset-0 m-auto w-[80%] h-[80%] rounded-full shadow-md transition-transform duration-200 ${
                          inWinLine
                            ? 'ring-2 ring-amber-300 scale-110 z-10'
                            : isLast
                              ? 'ring-2 ring-white/80 scale-105 z-10'
                              : ''
                        }`}
                        style={
                          {
                            background: `radial-gradient(circle at 32% 28%, ${palette.from}, ${palette.via} 55%, ${palette.to})`,
                          } as CSSProperties
                        }
                      >
                        {revealOwners && (
                          <span
                            className={`absolute inset-0 m-auto w-[34%] h-[34%] rounded-full border ${
                              cell === BLACK
                                ? 'bg-white border-black/40'
                                : 'bg-stone-950 border-white/50'
                            }`}
                          />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {revealOwners && (
            <div className="flex items-center justify-center gap-5 mt-3 text-xs text-zinc-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-white border border-black/40" />
                {mode === 'multi' ? '플레이어 1' : '내 돌'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-stone-950 border border-white/50" />
                {mode === 'multi' ? '플레이어 2' : 'NPC 돌'}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
          <button
            type="button"
            onClick={resetBoard}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <RotateCcw className="w-4 h-4" />
            새 게임
          </button>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-stone-900 border border-white/15 rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">블라인드 오목 규칙</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="space-y-3 text-sm text-zinc-300 leading-relaxed">
          <li>
            · 모든 돌이 보드에 보이지만, <b className="text-white">어느 돌이 누구 돌인지 표시되지 않습니다.</b> 자기가 둔 자리를 직접 기억해야 합니다.
          </li>
          <li>
            · 돌마다 색이 있고, <b className="text-white">한 턴의 두 돌은 같은 색</b>을 공유합니다. 색은 턴마다 순환합니다.
          </li>
          <li>
            · <b className="text-white">자유 고모쿠 룰</b>로 3-3·4-4 금수가 없고, 6목 이상도 승리로 인정됩니다.
          </li>
          <li>· 자기 돌 5개를 가로·세로·대각선으로 먼저 이으면 승리합니다.</li>
          <li>
            · <b className="text-white">싱글</b>은 AI와, <b className="text-white">멀티(로컬)</b>는 한 기기에서 둘이 번갈아 둡니다.
          </li>
          <li>· 게임이 끝나면 각 돌의 주인이 공개됩니다.</li>
        </ul>
        <p className="text-xs text-zinc-500 mt-4">
          Netflix &lt;데블스 플랜&gt; 히든 매치 규칙 기반
        </p>
      </div>
    </div>
  );
}
