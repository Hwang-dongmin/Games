import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link } from 'react-router';
import {
  Bot,
  ChevronLeft,
  Eye,
  EyeOff,
  Home,
  Info,
  RotateCcw,
  Trophy,
  Users,
  X,
} from 'lucide-react';
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

function intersectionPercent(index: number) {
  return `${(index / (BOARD_SIZE - 1)) * 100}%`;
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
  const [player1ColorId, setPlayer1ColorId] = useState(1);
  const [player2ColorId, setPlayer2ColorId] = useState(1);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const gameOver = result !== 'playing';
  const aiThinking = mode === 'single' && currentPlayer === WHITE && !gameOver;
  const canPickColor = !gameOver;
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
    (
      currentBoard: Board,
      currentColors: ColorBoard,
      countAfterPlayer: number,
      mirrorColorId: number,
    ) => {
      const aiMove = getAIMove(currentBoard);
      if (!aiMove) {
        endGame('draw', 'single');
        return;
      }

      const [aiRow, aiCol] = aiMove;
      const colorId = mirrorColorId;
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
      const colorId = owner === BLACK ? player1ColorId : player2ColorId;
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
        window.setTimeout(() => runAIMove(nextBoard, nextColors, newCount, colorId), 480);
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
      player1ColorId,
      player2ColorId,
      endGame,
      runAIMove,
      showMessage,
    ],
  );

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
      <div className="blind-omok-page blind-omok-page--lobby">
        <BlindOmokHeader
          onOpenRules={() => setShowRules(true)}
          showHome
        />
        <main className="blind-omok-lobby">
          <div className="blind-omok-hero">
            <h1>블라인드 오목</h1>
            <p>
              Netflix &lt;데블스 플랜&gt; 히든 매치 게임, 블라인드 오목을 직접 플레이하세요.
              <br />
              자신과 상대방의 돌을 모두 기억해야 하며, 기억과 심리전으로 5목을 먼저 완성하는 쪽이 승리합니다.
            </p>
          </div>

          <div className="blind-omok-mode-list">
            <button type="button" onClick={() => startGame('single')} className="blind-omok-mode-card">
              <span className="blind-omok-mode-icon" aria-hidden>
                <Bot className="w-6 h-6" strokeWidth={2} />
              </span>
              <span className="blind-omok-mode-copy">
                <strong>싱글</strong>
                <span>AI(NPC)와 대결</span>
              </span>
            </button>
            <button type="button" onClick={() => startGame('multi')} className="blind-omok-mode-card">
              <span className="blind-omok-mode-icon" aria-hidden>
                <Users className="w-6 h-6" strokeWidth={2} />
              </span>
              <span className="blind-omok-mode-copy">
                <strong>멀티 (로컬)</strong>
                <span>한 기기에서 둘이 번갈아 대결</span>
              </span>
            </button>
          </div>

          <div className="blind-omok-lobby-actions">
            <button type="button" onClick={() => setShowRules(true)} className="blind-omok-btn">
              <Info className="w-4 h-4" />
              규칙 보기
            </button>
          </div>
        </main>

        {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      </div>
    );
  }

  const resultBannerClass =
    result === 'won'
      ? 'blind-omok-result-banner--won'
      : result === 'lost'
        ? 'blind-omok-result-banner--lost'
        : 'blind-omok-result-banner--draw';

  return (
    <div className="blind-omok-page">
      <BlindOmokHeader
        onBack={() => setMode(null)}
        onOpenRules={() => setShowRules(true)}
        onToggleReveal={gameOver ? () => setRevealOwners((v) => !v) : undefined}
        revealOwners={revealOwners}
        showHome
      />

      <main className="blind-omok-main">
        <section className="blind-omok-board-section">
          {gameOver && resultLabel && (
            <div className={`blind-omok-result-banner ${resultBannerClass}`}>
              <Trophy className="w-5 h-5 shrink-0" />
              <span>{resultLabel}</span>
            </div>
          )}

          {message && <p className="blind-omok-message">{message}</p>}

          <div className="blind-omok-board-frame">
            <div className="blind-omok-board">
              <div className="blind-omok-play-area">
                <div className="blind-omok-lines-layer" aria-hidden>
                  <OmokGridLines />
                </div>
                <div className="blind-omok-points-layer">
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
                        className={`blind-omok-point${palette ? '' : ' blind-omok-point--empty'}`}
                        style={{
                          left: intersectionPercent(col),
                          top: intersectionPercent(row),
                        }}
                        aria-label={
                          palette
                            ? `${palette.label} 돌 ${coordLabel(row, col)}`
                            : `좌표 ${coordLabel(row, col)}`
                        }
                      >
                        {palette && (
                          <span
                            className={`blind-omok-stone${
                              inWinLine
                                ? ' blind-omok-stone--win'
                                : isLast
                                  ? ' blind-omok-stone--last'
                                  : ''
                            }`}
                            style={{ background: palette.via } as CSSProperties}
                          >
                            {revealOwners && (
                              <span
                                className={`blind-omok-stone-owner border ${
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
            </div>
          </div>

          {revealOwners && (
            <div className="blind-omok-owner-legend">
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-white border border-black/40" />
                {mode === 'multi' ? '플레이어 1' : '내 돌'}
              </span>
              <span>
                <span className="inline-block w-3 h-3 rounded-full bg-stone-950 border border-white/50" />
                {mode === 'multi' ? '플레이어 2' : 'NPC 돌'}
              </span>
            </div>
          )}
        </section>

        <aside className="blind-omok-sidebar">
          <div className="blind-omok-panel">
            <p className="blind-omok-panel-label">게임 상태</p>
            {!gameOver ? (
              <span
                className={`blind-omok-turn-badge ${
                  aiThinking ? 'blind-omok-turn-badge--waiting' : 'blind-omok-turn-badge--active'
                }`}
              >
                <span className="blind-omok-turn-dot" />
                {turnLabel}
              </span>
            ) : (
              <span className="blind-omok-turn-badge blind-omok-turn-badge--waiting">
                게임 종료
              </span>
            )}
          </div>

          <div className="blind-omok-panel">
            <p className="blind-omok-panel-label">돌 색상</p>
            {mode === 'multi' ? (
              <>
                <StoneColorPicker
                  className="blind-omok-color-section"
                  label="플레이어 1"
                  value={player1ColorId}
                  disabled={!canPickColor}
                  onChange={setPlayer1ColorId}
                />
                <StoneColorPicker
                  className="blind-omok-color-section"
                  label="플레이어 2"
                  value={player2ColorId}
                  disabled={!canPickColor}
                  onChange={setPlayer2ColorId}
                />
              </>
            ) : (
              <StoneColorPicker
                label="이번에 둘 돌 색"
                value={player1ColorId}
                disabled={!canPickColor}
                onChange={setPlayer1ColorId}
              />
            )}
            <p className="blind-omok-hint">
              {gameOver
                ? '게임이 끝났습니다. 새 게임을 시작하세요.'
                : mode === 'single' && aiThinking
                  ? 'NPC는 방금 둔 돌과 같은 색으로 응수합니다. 다음 착수 색도 미리 고를 수 있습니다.'
                  : mode === 'multi'
                    ? '각 플레이어가 자기 돌 색을 미리 고를 수 있습니다.'
                    : '착수 전 언제든 색을 바꿀 수 있습니다.'}
            </p>
          </div>

          {mode === 'single' && (
            <div className="blind-omok-panel">
              <p className="blind-omok-panel-label">전적</p>
              <dl className="blind-omok-stats">
                <div className="blind-omok-stat blind-omok-stat--win">
                  <dt>승</dt>
                  <dd>{stats.wins}</dd>
                </div>
                <div className="blind-omok-stat blind-omok-stat--loss">
                  <dt>패</dt>
                  <dd>{stats.losses}</dd>
                </div>
                <div className="blind-omok-stat">
                  <dt>무</dt>
                  <dd>{stats.draws}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="blind-omok-sidebar-actions">
            <button type="button" onClick={resetBoard} className="blind-omok-btn blind-omok-btn--primary">
              <RotateCcw className="w-4 h-4" />
              새 게임
            </button>
          </div>
        </aside>
      </main>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function BlindOmokHeader({
  onBack,
  onOpenRules,
  onToggleReveal,
  revealOwners,
  showHome,
}: {
  onBack?: () => void;
  onOpenRules: () => void;
  onToggleReveal?: () => void;
  revealOwners?: boolean;
  showHome?: boolean;
}) {
  return (
    <header className="blind-omok-header">
      <div className="blind-omok-header-start">
        {onBack ? (
          <button type="button" onClick={onBack} className="blind-omok-btn blind-omok-btn--ghost blind-omok-btn--icon">
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">모드 선택</span>
          </button>
        ) : showHome ? (
          <Link to="/" className="blind-omok-btn blind-omok-btn--ghost">
            <Home className="w-4 h-4" />
            홈
          </Link>
        ) : null}
      </div>

      <div className="blind-omok-header-end">
        {onToggleReveal && (
          <button type="button" onClick={onToggleReveal} className="blind-omok-btn blind-omok-btn--icon">
            {revealOwners ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{revealOwners ? '숨기기' : '공개'}</span>
          </button>
        )}
        <button type="button" onClick={onOpenRules} className="blind-omok-btn blind-omok-btn--icon">
          <Info className="w-4 h-4" />
          <span className="hidden sm:inline">규칙</span>
        </button>
      </div>
    </header>
  );
}

function StoneColorPicker({
  label,
  value,
  disabled,
  onChange,
  className,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (colorId: number) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="blind-omok-color-label">{label}</p>
      <div className="blind-omok-color-swatches">
        {STONE_PALETTE.map((color, idx) => {
          const colorId = idx + 1;
          const selected = value === colorId;

          return (
            <button
              key={color.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(colorId)}
              title={color.label}
              aria-label={color.label}
              aria-pressed={selected}
              className={`blind-omok-color-swatch${selected ? ' blind-omok-color-swatch--selected' : ''}`}
              style={{ background: color.via }}
            />
          );
        })}
      </div>
    </div>
  );
}

function OmokGridLines() {
  const span = BOARD_SIZE - 1;

  return (
    <svg viewBox={`0 0 ${span} ${span}`} preserveAspectRatio="none">
      {Array.from({ length: BOARD_SIZE }, (_, i) => (
        <g key={i}>
          <line
            x1={i}
            y1={0}
            x2={i}
            y2={span}
            stroke="#00e5ff"
            strokeWidth={0.06}
            vectorEffect="nonScalingStroke"
          />
          <line
            x1={0}
            y1={i}
            x2={span}
            y2={i}
            stroke="#00e5ff"
            strokeWidth={0.06}
            vectorEffect="nonScalingStroke"
          />
        </g>
      ))}
      {HOSHI_POINTS.map(([row, col]) => (
        <circle
          key={keyOf(row, col)}
          cx={col}
          cy={row}
          r={0.18}
          fill="#00e5ff"
        />
      ))}
    </svg>
  );
}

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="blind-omok-modal-backdrop" onClick={onClose}>
      <div className="blind-omok-modal" onClick={(e) => e.stopPropagation()}>
        <div className="blind-omok-modal-header">
          <h2>블라인드 오목 규칙</h2>
          <button type="button" onClick={onClose} className="blind-omok-modal-close" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>
        <ul className="blind-omok-rules">
          <li>
            모든 돌이 보드에 보이지만, <b>어느 돌이 누구 돌인지 표시되지 않습니다.</b> 자기가 둔 자리를 직접 기억해야 합니다.
          </li>
          <li>
            착수 전 <b>언제든 돌 색</b>을 고를 수 있습니다. 싱글에서 NPC는 직전에 내가 둔 돌과 <b>같은 색</b>으로 응수합니다.
          </li>
          <li>
            <b>자유 고모쿠 룰</b>로 3-3·4-4 금수가 없고, 6목 이상도 승리로 인정됩니다.
          </li>
          <li>자기 돌 5개를 가로·세로·대각선으로 먼저 이으면 승리합니다.</li>
          <li>
            <b>싱글</b>은 AI와, <b>멀티(로컬)</b>는 한 기기에서 둘이 번갈아 둡니다.
          </li>
          <li>게임이 끝나면 각 돌의 주인이 공개됩니다.</li>
        </ul>
        <p className="blind-omok-rules-foot">
          Netflix &lt;데블스 플랜&gt; 히든 매치 규칙 기반
        </p>
      </div>
    </div>
  );
}
