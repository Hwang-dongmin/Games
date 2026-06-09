import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Link } from 'react-router';
import { Eye, EyeOff, Home, Info, RotateCcw, Trophy, X } from 'lucide-react';
import {
  BLACK,
  BOARD_SIZE,
  coordLabel,
  createEmptyBoard,
  getAIMove,
  getWinningLine,
  HOSHI_POINTS,
  isBoardFull,
  paletteColorForTurn,
  STONE_PALETTE,
  type Board,
  type GameResult,
  WHITE,
} from '../utils/blindOmok';

const STATS_KEY = 'blind-omok-stats';

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

export default function BlindOmok() {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [colorBoard, setColorBoard] = useState<ColorBoard>(() => createEmptyColorBoard());
  const [result, setResult] = useState<GameResult>('playing');
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [winningLine, setWinningLine] = useState<Set<string>>(() => new Set());
  const [playerMoves, setPlayerMoves] = useState(0);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [revealOwners, setRevealOwners] = useState(false);
  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [message, setMessage] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOver = result !== 'playing';
  const nextColor = paletteColorForTurn(playerMoves);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 2000);
  }, []);

  const endGame = useCallback(
    (
      outcome: 'won' | 'lost' | 'draw',
      setStatsFn: Dispatch<SetStateAction<Stats>>,
    ) => {
      setResult(outcome);
      setRevealOwners(true);
      setStatsFn((prev) => {
        const next: Stats = {
          wins: prev.wins + (outcome === 'won' ? 1 : 0),
          losses: prev.losses + (outcome === 'lost' ? 1 : 0),
          draws: prev.draws + (outcome === 'draw' ? 1 : 0),
        };
        saveStats(next);
        return next;
      });
    },
    [],
  );

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setColorBoard(createEmptyColorBoard());
    setResult('playing');
    setLastMove(null);
    setWinningLine(new Set());
    setPlayerMoves(0);
    setIsPlayerTurn(true);
    setRevealOwners(false);
    setMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  const runAIMove = useCallback(
    (currentBoard: Board, currentColors: ColorBoard, sharedColorId: number) => {
      const aiMove = getAIMove(currentBoard);
      if (!aiMove) {
        endGame('draw', setStats);
        return;
      }

      const [aiRow, aiCol] = aiMove;
      const nextBoard = currentBoard.map((r) => [...r]);
      const nextColors = currentColors.map((r) => [...r]);
      nextBoard[aiRow][aiCol] = WHITE;
      nextColors[aiRow][aiCol] = sharedColorId;

      setBoard(nextBoard);
      setColorBoard(nextColors);
      setLastMove([aiRow, aiCol]);

      const aiLine = getWinningLine(nextBoard, aiRow, aiCol, WHITE);
      if (aiLine) {
        setWinningLine(new Set(aiLine.map(([r, c]) => keyOf(r, c))));
        endGame('lost', setStats);
        return;
      }

      if (isBoardFull(nextBoard)) {
        endGame('draw', setStats);
        return;
      }

      setIsPlayerTurn(true);
    },
    [endGame],
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!isPlayerTurn || gameOver) return;

      if (board[row][col] !== 0) {
        showMessage('이미 돌이 놓인 자리입니다');
        return;
      }

      const colorId = (playerMoves % STONE_PALETTE.length) + 1;
      const nextBoard = board.map((r) => [...r]);
      const nextColors = colorBoard.map((r) => [...r]);
      nextBoard[row][col] = BLACK;
      nextColors[row][col] = colorId;

      setBoard(nextBoard);
      setColorBoard(nextColors);
      setLastMove([row, col]);
      setPlayerMoves((n) => n + 1);
      setIsPlayerTurn(false);
      setMessage(null);

      const line = getWinningLine(nextBoard, row, col, BLACK);
      if (line) {
        setWinningLine(new Set(line.map(([r, c]) => keyOf(r, c))));
        endGame('won', setStats);
        return;
      }

      if (isBoardFull(nextBoard)) {
        endGame('draw', setStats);
        return;
      }

      window.setTimeout(() => runAIMove(nextBoard, nextColors, colorId), 480);
    },
    [board, colorBoard, gameOver, isPlayerTurn, playerMoves, endGame, runAIMove, showMessage],
  );

  const isHoshi = (row: number, col: number) =>
    HOSHI_POINTS.some(([r, c]) => r === row && c === col);

  const resultLabel =
    result === 'won'
      ? '승리!'
      : result === 'lost'
        ? '패배...'
        : result === 'draw'
          ? '무승부'
          : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-emerald-950 to-stone-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-5">
          <h1 className="text-4xl font-bold text-white mb-2">블라인드 오목</h1>
          <p className="text-emerald-200/80 text-sm">
            모든 돌이 보이지만, 누구의 돌인지는 알 수 없습니다
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center gap-4 flex-wrap">
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

            <div className="flex items-center gap-2">
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
                  isPlayerTurn
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-white/10 border-white/20 text-zinc-400'
                }`}
              >
                {isPlayerTurn ? '내 차례' : 'NPC 생각 중...'}
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
                    disabled={!isPlayerTurn || gameOver}
                    onClick={() => handleCellClick(row, col)}
                    className={`relative aspect-square transition-colors duration-150 ${
                      isPlayerTurn && !gameOver && cell === 0
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
                <span className="w-3 h-3 rounded-full bg-white border border-black/40" />내 돌
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-stone-950 border border-white/50" />NPC 돌
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
            onClick={resetGame}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <RotateCcw className="w-4 h-4" />
            새 게임
          </button>
        </div>
      </div>

      {showRules && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowRules(false)}
        >
          <div
            className="bg-stone-900 border border-white/15 rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">블라인드 오목 규칙</h2>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300 leading-relaxed">
              <li>
                · 모든 돌이 보드에 보이지만, <b className="text-white">어느 돌이 내 돌인지 표시되지 않습니다.</b> 내가 둔 자리를 직접 기억해야 합니다.
              </li>
              <li>
                · 돌마다 색이 있고, NPC는 직전에 내가 둔 돌과 <b className="text-white">같은 색</b>으로 응수합니다. 색은 턴마다 순환합니다.
              </li>
              <li>
                · 플레이어 선공입니다. <b className="text-white">자유 고모쿠 룰</b>로 3-3·4-4 금수가 없고, 6목 이상도 승리로 인정됩니다.
              </li>
              <li>· 내 돌 5개를 가로·세로·대각선으로 먼저 이으면 승리합니다.</li>
              <li>· 게임이 끝나면 각 돌의 주인이 공개됩니다.</li>
            </ul>
            <p className="text-xs text-zinc-500 mt-4">
              Netflix &lt;데블스 플랜&gt; 히든 매치 규칙 기반
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
