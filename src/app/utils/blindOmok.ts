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

/** 블라인드 오목 돌 색상 팔레트 (플레이어가 직접 선택) */
export const STONE_PALETTE = [
  { id: 'red', label: '빨강', from: '#ff4444', via: '#ff1a1a', to: '#cc0000' },
  { id: 'orange', label: '주황', from: '#ff8833', via: '#ff6600', to: '#cc4400' },
  { id: 'yellow', label: '노랑', from: '#ffdd33', via: '#ffcc00', to: '#cc9900' },
  { id: 'green', label: '초록', from: '#33ff66', via: '#00e54d', to: '#00aa33' },
  { id: 'blue', label: '파랑', from: '#4488ff', via: '#2266ff', to: '#0044cc' },
  { id: 'purple', label: '보라', from: '#bb66ff', via: '#9933ff', to: '#6600cc' },
  { id: 'pink', label: '분홍', from: '#ff66aa', via: '#ff3388', to: '#cc0066' },
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
