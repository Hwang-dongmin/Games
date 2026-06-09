export const BOARD_SIZE = 15;

export type Stone = 0 | 1 | 2;
export type Board = Stone[][];
export type GameResult = 'playing' | 'won' | 'lost' | 'draw';

export const BLACK = 1 as const;
export const WHITE = 2 as const;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 0 as Stone),
  );
}

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const;

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function countDirection(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (isInBounds(r, c) && board[r][c] === stone) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

export function checkWin(board: Board, row: number, col: number, stone: Stone): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const total =
      1 +
      countDirection(board, row, col, dr, dc, stone) +
      countDirection(board, row, col, -dr, -dc, stone);
    if (total >= 5) return true;
  }
  return false;
}

/** 5목 이상이 완성되면 그 라인의 좌표들을 반환, 아니면 null (자유 고모쿠 룰) */
export function getWinningLine(
  board: Board,
  row: number,
  col: number,
  stone: Stone,
): [number, number][] | null {
  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [[row, col]];

    let r = row + dr;
    let c = col + dc;
    while (isInBounds(r, c) && board[r][c] === stone) {
      line.push([r, c]);
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (isInBounds(r, c) && board[r][c] === stone) {
      line.unshift([r, c]);
      r -= dr;
      c -= dc;
    }

    if (line.length >= 5) return line;
  }
  return null;
}

/**
 * 데블스 플랜 블라인드 오목의 돌 색상 팔레트.
 * 한 턴(플레이어 착수 + NPC 응수)은 같은 색을 공유하며 턴마다 순환한다.
 */
export const STONE_PALETTE = [
  { id: 'red', label: '빨강', from: '#fca5a5', via: '#ef4444', to: '#991b1b' },
  { id: 'orange', label: '주황', from: '#fdba74', via: '#f97316', to: '#9a3412' },
  { id: 'yellow', label: '노랑', from: '#fde68a', via: '#eab308', to: '#854d0e' },
  { id: 'green', label: '초록', from: '#86efac', via: '#22c55e', to: '#166534' },
  { id: 'blue', label: '파랑', from: '#93c5fd', via: '#3b82f6', to: '#1e40af' },
  { id: 'purple', label: '보라', from: '#c4b5fd', via: '#8b5cf6', to: '#5b21b6' },
  { id: 'pink', label: '분홍', from: '#f9a8d4', via: '#ec4899', to: '#9d174d' },
] as const;

export function paletteColorForTurn(playerMoveIndex: number) {
  return STONE_PALETTE[playerMoveIndex % STONE_PALETTE.length];
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

function getCandidateMoves(board: Board): [number, number][] {
  const hasStone = board.some((row) => row.some((cell) => cell !== 0));
  if (!hasStone) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [[center, center]];
  }

  const candidates = new Set<string>();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue;
      let nearStone = false;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (isInBounds(nr, nc) && board[nr][nc] !== 0) {
            nearStone = true;
            break;
          }
        }
        if (nearStone) break;
      }
      if (nearStone) candidates.add(`${r},${c}`);
    }
  }

  return Array.from(candidates).map((key) => {
    const [r, c] = key.split(',').map(Number);
    return [r, c] as [number, number];
  });
}

function evaluateLine(count: number, openEnds: number): number {
  if (count >= 5) return 100_000;
  if (count === 4 && openEnds === 2) return 10_000;
  if (count === 4 && openEnds === 1) return 1_000;
  if (count === 3 && openEnds === 2) return 500;
  if (count === 3 && openEnds === 1) return 50;
  if (count === 2 && openEnds === 2) return 10;
  if (count === 2 && openEnds === 1) return 2;
  return 1;
}

function analyzeLine(
  board: Board,
  row: number,
  col: number,
  dr: number,
  dc: number,
  stone: Stone,
): number {
  let count = 1;
  let openEnds = 0;

  let r = row + dr;
  let c = col + dc;
  while (isInBounds(r, c) && board[r][c] === stone) {
    count++;
    r += dr;
    c += dc;
  }
  if (isInBounds(r, c) && board[r][c] === 0) openEnds++;

  r = row - dr;
  c = col - dc;
  while (isInBounds(r, c) && board[r][c] === stone) {
    count++;
    r -= dr;
    c -= dc;
  }
  if (isInBounds(r, c) && board[r][c] === 0) openEnds++;

  return evaluateLine(count, openEnds);
}

function evaluateMove(board: Board, row: number, col: number, stone: Stone): number {
  if (board[row][col] !== 0) return -Infinity;

  board[row][col] = stone;
  let score = 0;
  for (const [dr, dc] of DIRECTIONS) {
    score += analyzeLine(board, row, col, dr, dc, stone);
  }
  board[row][col] = 0;

  const center = Math.floor(BOARD_SIZE / 2);
  const dist = Math.abs(row - center) + Math.abs(col - center);
  score += Math.max(0, 8 - dist);

  return score;
}

function wouldWin(board: Board, row: number, col: number, stone: Stone): boolean {
  if (board[row][col] !== 0) return false;
  board[row][col] = stone;
  const won = checkWin(board, row, col, stone);
  board[row][col] = 0;
  return won;
}

export function getAIMove(board: Board): [number, number] | null {
  const candidates = getCandidateMoves(board);
  if (candidates.length === 0) return null;

  for (const [r, c] of candidates) {
    if (wouldWin(board, r, c, WHITE)) return [r, c];
  }

  for (const [r, c] of candidates) {
    if (wouldWin(board, r, c, BLACK)) return [r, c];
  }

  let bestMove = candidates[0];
  let bestScore = -Infinity;

  for (const [r, c] of candidates) {
    const attack = evaluateMove(board, r, c, WHITE);
    const defense = evaluateMove(board, r, c, BLACK);
    const score = attack + defense * 0.95;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [r, c];
    }
  }

  return bestMove;
}

export function coordLabel(row: number, col: number): string {
  const letters = 'ABCDEFGHJKLMNOP';
  return `${letters[col]}${row + 1}`;
}

export const HOSHI_POINTS: [number, number][] = [
  [3, 3],
  [3, 7],
  [3, 11],
  [7, 3],
  [7, 7],
  [7, 11],
  [11, 3],
  [11, 7],
  [11, 11],
];
