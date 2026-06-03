// 렉시오(Lexio) 게임 로직
// 60장 타일: 1~15 × 4색(초/파/노/빨)
// 숫자 강도: 3(약) < 4 < ... < 15 < 1 < 2(강)
// 색상 강도: 파(약) < 노 < 초 < 빨(강)

export type LexioColor = 'green' | 'blue' | 'yellow' | 'red';

export interface LexioTile {
  id: number;
  number: number; // 1 ~ 15
  color: LexioColor;
}

export type LexioComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'flush'
  | 'fullhouse'
  | 'fourkind'
  | 'straightflush';

export interface LexioCombination {
  type: LexioComboType;
  tiles: LexioTile[];
  value: number;
}

export interface LexioPlayer {
  id: number;
  name: string;
  isAI: boolean;
  hand: LexioTile[];
  passed: boolean; // 현재 트릭에서 패스 여부
}

const COLORS: LexioColor[] = ['green', 'blue', 'yellow', 'red'];
const COLOR_RANK: Record<LexioColor, number> = {
  blue: 1,
  yellow: 2,
  green: 3,
  red: 4,
};

export const COLOR_KOREAN: Record<LexioColor, string> = {
  green: '초',
  blue: '파',
  yellow: '노',
  red: '빨',
};

export const COLOR_HEX: Record<LexioColor, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  red: '#ef4444',
};

// 숫자 강도: 3->1, 4->2, ..., 15->13, 1->14, 2->15
export function numberStrength(n: number): number {
  if (n === 1) return 14;
  if (n === 2) return 15;
  return n - 2;
}

export function tileStrength(t: LexioTile): number {
  return numberStrength(t.number) * 10 + COLOR_RANK[t.color];
}

export function compareTiles(a: LexioTile, b: LexioTile): number {
  return tileStrength(a) - tileStrength(b);
}

export function createDeck(): LexioTile[] {
  return createDeckForPlayerCount(5);
}

/** 보드게임 인원별 타일 구성 (3·4·5인) */
export function createDeckForPlayerCount(playerCount: number): LexioTile[] {
  const n = Math.min(5, Math.max(3, Math.floor(playerCount)));
  const maxNumber = n <= 3 ? 9 : n === 4 ? 13 : 15;
  const deck: LexioTile[] = [];
  let id = 0;
  for (const color of COLORS) {
    for (let num = 1; num <= maxNumber; num++) {
      deck.push({ id: id++, number: num, color });
    }
  }
  return deck;
}

/** 인원별 초기 패 수: 3·5인 12장, 4인 13장 */
export function lexioHandSizeForPlayerCount(playerCount: number): number {
  const n = Math.min(5, Math.max(3, Math.floor(playerCount)));
  return n === 4 ? 13 : 12;
}

export function lexioDeckTileCount(playerCount: number): number {
  const n = Math.min(5, Math.max(3, Math.floor(playerCount)));
  const maxNumber = n <= 3 ? 9 : n === 4 ? 13 : 15;
  return maxNumber * COLORS.length;
}

export function lexioRulesLabelForPlayerCount(playerCount: number): string {
  const n = Math.min(5, Math.max(3, Math.floor(playerCount)));
  const hand = lexioHandSizeForPlayerCount(n);
  if (n === 3) {
    return `3인: 숫자 1~9 타일만 · 각 ${hand}장 (총 ${lexioDeckTileCount(n)}장)`;
  }
  if (n === 4) {
    return `4인: 숫자 1~13 · 각 ${hand}장 (총 ${lexioDeckTileCount(n)}장)`;
  }
  return `5인: 전체 60장 · 각 ${hand}장`;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sortHand(hand: LexioTile[]): LexioTile[] {
  return [...hand].sort(compareTiles);
}

// 선택한 타일들로 유효한 조합을 만들 수 있으면 반환, 아니면 null
export function detectCombo(tiles: LexioTile[]): LexioCombination | null {
  if (tiles.length === 0) return null;

  if (tiles.length === 1) {
    return { type: 'single', tiles, value: tileStrength(tiles[0]) };
  }

  if (tiles.length === 2) {
    if (tiles[0].number !== tiles[1].number) return null;
    const top = tiles.reduce((a, b) =>
      tileStrength(a) > tileStrength(b) ? a : b,
    );
    return { type: 'pair', tiles, value: tileStrength(top) };
  }

  if (tiles.length === 3) {
    if (!tiles.every((t) => t.number === tiles[0].number)) return null;
    const top = tiles.reduce((a, b) =>
      tileStrength(a) > tileStrength(b) ? a : b,
    );
    return { type: 'triple', tiles, value: tileStrength(top) };
  }

  if (tiles.length === 5) {
    return detectFiveCardCombo(tiles);
  }

  return null;
}

function detectFiveCardCombo(tiles: LexioTile[]): LexioCombination | null {
  const sortedByStrength = [...tiles].sort(
    (a, b) => numberStrength(a.number) - numberStrength(b.number),
  );
  const strengths = sortedByStrength.map((t) => numberStrength(t.number));

  // 같은 색?
  const allSameColor = tiles.every((t) => t.color === tiles[0].color);

  // 스트레이트(연속): 강도 기준으로 5개 연속 (3..15..1..2 순서)
  let isStraight = true;
  const seen = new Set<number>();
  for (const s of strengths) {
    if (seen.has(s)) {
      isStraight = false;
      break;
    }
    seen.add(s);
  }
  if (isStraight) {
    for (let i = 1; i < strengths.length; i++) {
      if (strengths[i] !== strengths[i - 1] + 1) {
        isStraight = false;
        break;
      }
    }
  }

  // 숫자별 개수
  const numCounts = new Map<number, number>();
  for (const t of tiles) {
    numCounts.set(t.number, (numCounts.get(t.number) ?? 0) + 1);
  }
  const counts = [...numCounts.values()].sort((a, b) => b - a);

  const topTile = sortedByStrength[sortedByStrength.length - 1];
  const topColor = COLOR_RANK[topTile.color];
  const topNumStrength = strengths[strengths.length - 1];

  // 스트레이트 플러시 (가장 강함)
  if (isStraight && allSameColor) {
    return {
      type: 'straightflush',
      tiles,
      value: 8_000_000 + topNumStrength * 10 + topColor,
    };
  }

  // 포카드
  if (counts[0] === 4) {
    const fourEntry = [...numCounts.entries()].find(([, c]) => c === 4)!;
    return {
      type: 'fourkind',
      tiles,
      value: 7_000_000 + numberStrength(fourEntry[0]) * 10,
    };
  }

  // 풀하우스
  if (counts[0] === 3 && counts[1] === 2) {
    const tripleEntry = [...numCounts.entries()].find(([, c]) => c === 3)!;
    return {
      type: 'fullhouse',
      tiles,
      value: 6_000_000 + numberStrength(tripleEntry[0]) * 10,
    };
  }

  // 플러시
  if (allSameColor) {
    return {
      type: 'flush',
      tiles,
      value: 5_000_000 + topNumStrength * 10 + topColor,
    };
  }

  // 스트레이트
  if (isStraight) {
    return {
      type: 'straight',
      tiles,
      value: 4_000_000 + topNumStrength * 10 + topColor,
    };
  }

  return null;
}

// 새 조합이 기존 조합을 이기는지 (같은 장수 필요)
export function beats(
  next: LexioCombination,
  current: LexioCombination,
): boolean {
  if (next.tiles.length !== current.tiles.length) return false;
  // 1,2,3장은 같은 타입끼리만 비교
  if (next.tiles.length < 5) {
    if (next.type !== current.type) return false;
    return next.value > current.value;
  }
  // 5장은 서로 다른 5장 타입끼리도 비교 가능 (value 자체에 타입 가중치가 포함됨)
  return next.value > current.value;
}

// 조합 한글명
export function comboKorean(type: LexioComboType): string {
  const map: Record<LexioComboType, string> = {
    single: '싱글',
    pair: '페어',
    triple: '트리플',
    straight: '스트레이트',
    flush: '플러시',
    fullhouse: '풀하우스',
    fourkind: '포카드',
    straightflush: '스트레이트 플러시',
  };
  return map[type];
}

// n개를 뽑는 조합 생성 (제너레이터)
function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  const n = arr.length;
  if (k > n) return;
  const indices = Array.from({ length: k }, (_, i) => i);
  yield indices.map((i) => arr[i]);
  while (true) {
    let i = k - 1;
    while (i >= 0 && indices[i] === i + n - k) i--;
    if (i < 0) return;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
    yield indices.map((idx) => arr[idx]);
  }
}

// 손패에서 size개 카드로 만들 수 있는 모든 유효 조합 찾기
export function enumerateCombos(
  hand: LexioTile[],
  size: number,
): LexioCombination[] {
  const result: LexioCombination[] = [];
  for (const combo of combinations(hand, size)) {
    const c = detectCombo(combo);
    if (c) result.push(c);
  }
  return result;
}

export type LexioAIDifficulty = 'easy' | 'medium' | 'hard';

export const LEXIO_AI_DIFFICULTY_OPTIONS: {
  id: LexioAIDifficulty;
  label: string;
  description: string;
  available: boolean;
}[] = [
  {
    id: 'easy',
    label: '이지',
    description: '기본 AI — 약한 패부터 내고 조합은 확률적으로 사용',
    available: true,
  },
  {
    id: 'medium',
    label: '중간',
    description:
      '상대 잔여 패 위협(3→2→1장)에 따라 조합·큰 싱글 우선, 비싼 패로 이기기는 자제',
    available: true,
  },
  {
    id: 'hard',
    label: '하드',
    description:
      '숫자 카운팅·승리 직전 차단·5장 조합 타이밍·손패 유연성까지 고려',
    available: true,
  },
];

export type AiPlayerSnapshot = {
  id: number;
  handCount: number;
};

export type AiFindMoveOptions = {
  difficulty?: LexioAIDifficulty;
  currentPlayerId?: number;
  players?: AiPlayerSnapshot[];
  discardedTiles?: LexioTile[];
  tablePlay?: LexioCombination | null;
  playerCount?: number;
};

type AiThreatLevel = 'none' | 'low' | 'medium' | 'high';

type AiThreatInfo = {
  level: AiThreatLevel;
  minOpponentCards: number;
};

type LeadCombos = {
  singles: LexioCombination[];
  pairs: LexioCombination[];
  triples: LexioCombination[];
  fives: LexioCombination[];
};

function gatherLeadCombos(sorted: LexioTile[]): LeadCombos {
  return {
    singles: enumerateCombos(sorted, 1).sort((a, b) => a.value - b.value),
    pairs: enumerateCombos(sorted, 2).sort((a, b) => a.value - b.value),
    triples: enumerateCombos(sorted, 3).sort((a, b) => a.value - b.value),
    fives: enumerateCombos(sorted, 5).sort((a, b) => a.value - b.value),
  };
}

function getAiThreatInfo(
  players: AiPlayerSnapshot[] | undefined,
  currentPlayerId: number | undefined,
): AiThreatInfo {
  if (!players?.length) {
    return { level: 'none', minOpponentCards: Infinity };
  }
  const opponents = players.filter(
    (p) => p.handCount > 0 && p.id !== currentPlayerId,
  );
  if (opponents.length === 0) {
    return { level: 'none', minOpponentCards: Infinity };
  }
  const minOpponentCards = Math.min(...opponents.map((p) => p.handCount));
  if (minOpponentCards <= 1) return { level: 'high', minOpponentCards };
  if (minOpponentCards === 2) return { level: 'medium', minOpponentCards };
  if (minOpponentCards === 3) return { level: 'low', minOpponentCards };
  return { level: 'none', minOpponentCards };
}

function maxNumberForPlayerCount(playerCount: number): number {
  const n = Math.min(5, Math.max(3, Math.floor(playerCount)));
  return n <= 3 ? 9 : n === 4 ? 13 : 15;
}

/** 숫자별로 상대 손에 남아 있을 수 있는 장수 (0~4) */
export function buildRemainingCountByNumber(
  hand: LexioTile[],
  discardedTiles: LexioTile[],
  tablePlay: LexioCombination | null | undefined,
  playerCount: number,
): Map<number, number> {
  const maxNum = maxNumberForPlayerCount(playerCount);
  const seen = new Map<number, number>();
  const mark = (t: LexioTile) => {
    seen.set(t.number, (seen.get(t.number) ?? 0) + 1);
  };
  for (const t of hand) mark(t);
  for (const t of discardedTiles) mark(t);
  if (tablePlay) for (const t of tablePlay.tiles) mark(t);

  const remaining = new Map<number, number>();
  for (let num = 1; num <= maxNum; num++) {
    remaining.set(num, Math.max(0, 4 - (seen.get(num) ?? 0)));
  }
  return remaining;
}

function comboUsesPremiumTile(combo: LexioCombination): boolean {
  return combo.tiles.some((t) => t.number === 1 || t.number === 2);
}

function countLeadFlexibility(hand: LexioTile[]): number {
  if (hand.length === 0) return 0;
  const singles = enumerateCombos(hand, 1).length;
  const pairs = enumerateCombos(hand, 2).length;
  const triples = enumerateCombos(hand, 3).length;
  return singles + pairs * 2 + triples * 3;
}

function remainingAfterLead(
  hand: LexioTile[],
  lead: LexioCombination,
): LexioTile[] {
  const ids = new Set(lead.tiles.map((t) => t.id));
  return hand.filter((t) => !ids.has(t.id));
}

function pickMostFlexibleLead(
  hand: LexioTile[],
  candidates: LexioCombination[],
): LexioTile[] {
  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const score = countLeadFlexibility(remainingAfterLead(hand, c));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best.tiles;
}

function shouldSpendFiveCombo(
  handLength: number,
  threat: AiThreatLevel,
  difficulty: LexioAIDifficulty,
): boolean {
  if (threat === 'high' || threat === 'medium') return true;
  if (handLength <= 4) return true;
  if (difficulty === 'hard') return false;
  return handLength <= 6;
}

function aiLeadMoveEasy(sorted: LexioTile[]): LexioTile[] | null {
  const { singles, pairs, triples, fives } = gatherLeadCombos(sorted);

  if (fives.length > 0 && Math.random() < 0.35) {
    return fives[0].tiles;
  }
  if (triples.length > 0 && Math.random() < 0.55) {
    return triples[0].tiles;
  }
  if (pairs.length > 0 && Math.random() < 0.65) {
    return pairs[0].tiles;
  }

  if (singles.length > 0) return singles[0].tiles;
  if (pairs.length > 0) return pairs[0].tiles;
  if (triples.length > 0) return triples[0].tiles;
  if (fives.length > 0) return fives[0].tiles;
  return null;
}

/** 손패가 많을 때 큰 조합 보존 */
function aiLeadMoveEasyConserving(sorted: LexioTile[]): LexioTile[] | null {
  const { singles, pairs, triples, fives } = gatherLeadCombos(sorted);

  if (fives.length > 0 && Math.random() < 0.15) return fives[0].tiles;
  if (triples.length > 0 && Math.random() < 0.3) return triples[0].tiles;
  if (pairs.length > 0 && Math.random() < 0.45) return pairs[0].tiles;

  if (singles.length > 0) return singles[0].tiles;
  if (pairs.length > 0) return pairs[0].tiles;
  if (triples.length > 0) return triples[0].tiles;
  if (fives.length > 0) return fives[0].tiles;
  return null;
}

function aiLeadMoveThreatBlock(
  sorted: LexioTile[],
  threat: AiThreatLevel,
  difficulty: LexioAIDifficulty,
): LexioTile[] | null {
  const { singles, pairs, triples, fives } = gatherLeadCombos(sorted);
  const useFives = shouldSpendFiveCombo(sorted.length, threat, difficulty);

  if (threat === 'high') {
    if (useFives && fives.length > 0) return fives[0].tiles;
    if (triples.length > 0) return triples[0].tiles;
    if (pairs.length > 0) return pairs[0].tiles;
    if (singles.length > 0) return singles[singles.length - 1].tiles;
    return null;
  }

  if (threat === 'medium') {
    if (useFives && fives.length > 0) return fives[0].tiles;
    if (triples.length > 0) return triples[0].tiles;
    if (pairs.length > 0) return pairs[0].tiles;
    if (singles.length > 0) return singles[singles.length - 1].tiles;
    return null;
  }

  // low — 페어·트리플 우선, 싱글은 중상위
  if (pairs.length > 0) return pairs[0].tiles;
  if (triples.length > 0) return triples[0].tiles;
  if (singles.length > 0) {
    const mid = singles[Math.floor(singles.length * 0.65)];
    return mid.tiles;
  }
  if (fives.length > 0 && useFives) return fives[0].tiles;
  return null;
}

function aiLeadMoveHardCounting(
  sorted: LexioTile[],
  remainingByNumber: Map<number, number>,
  threat: AiThreatInfo,
): LexioTile[] | null {
  const { singles, pairs, triples, fives } = gatherLeadCombos(sorted);
  const useFives = shouldSpendFiveCombo(
    sorted.length,
    threat.level,
    'hard',
  );

  if (threat.level !== 'none') {
    return aiLeadMoveThreatBlock(sorted, threat.level, 'hard');
  }

  const comboCandidates: LexioCombination[] = [];
  if (useFives && fives.length > 0) comboCandidates.push(fives[0]);
  if (pairs.length > 0) comboCandidates.push(pairs[0]);
  if (triples.length > 0 && sorted.length <= 7) comboCandidates.push(triples[0]);

  if (comboCandidates.length > 0) {
    return pickMostFlexibleLead(sorted, comboCandidates);
  }

  if (singles.length > 0) {
    const scored = [...singles].sort((a, b) => {
      const remA = remainingByNumber.get(a.tiles[0].number) ?? 4;
      const remB = remainingByNumber.get(b.tiles[0].number) ?? 4;
      if (remA !== remB) return remA - remB;
      return a.value - b.value;
    });
    return scored[0].tiles;
  }

  if (triples.length > 0) return triples[0].tiles;
  if (fives.length > 0) return fives[0].tiles;
  return null;
}

function aiLeadMove(
  sorted: LexioTile[],
  difficulty: LexioAIDifficulty,
  threat: AiThreatInfo,
  remainingByNumber: Map<number, number>,
): LexioTile[] | null {
  if (difficulty === 'hard') {
    return aiLeadMoveHardCounting(sorted, remainingByNumber, threat);
  }

  if (difficulty === 'medium') {
    if (threat.level !== 'none') {
      return aiLeadMoveThreatBlock(sorted, threat.level, 'medium');
    }
    if (sorted.length >= 8) {
      return aiLeadMoveEasyConserving(sorted);
    }
    return aiLeadMoveEasy(sorted);
  }

  return aiLeadMoveEasy(sorted);
}

function sortValidFollowMoves(
  valid: LexioCombination[],
  target: LexioCombination,
  preferStrong: boolean,
): LexioCombination[] {
  const size = target.tiles.length;
  return [...valid].sort((a, b) => {
    if (preferStrong && size === 1) return b.value - a.value;
    if (preferStrong) return b.value - a.value;
    return a.value - b.value;
  });
}

function shouldPassExpensiveWin(
  combo: LexioCombination,
  threat: AiThreatInfo,
  difficulty: LexioAIDifficulty,
  handLength: number,
): boolean {
  if (handLength <= combo.tiles.length) return false;
  if (threat.minOpponentCards <= 3) return false;
  if (!comboUsesPremiumTile(combo)) return false;
  if (difficulty === 'hard') return threat.minOpponentCards >= 4;
  if (difficulty === 'medium') return threat.minOpponentCards >= 5;
  return false;
}

function aiFollowMove(
  sorted: LexioTile[],
  target: LexioCombination,
  difficulty: LexioAIDifficulty,
  threat: AiThreatInfo,
): LexioTile[] | null {
  const size = target.tiles.length;
  const candidates = enumerateCombos(sorted, size);
  const valid = candidates.filter((c) => beats(c, target));
  if (valid.length === 0) return null;

  const winsGame = sorted.length === size;
  if (winsGame) return valid[0].tiles;

  const preferStrong =
    difficulty !== 'easy' &&
    (threat.level === 'high' ||
      threat.level === 'medium' ||
      (threat.level === 'low' && difficulty === 'hard'));

  const ranked = sortValidFollowMoves(valid, target, preferStrong);
  const pick = ranked[0];

  if (
    !preferStrong &&
    shouldPassExpensiveWin(pick, threat, difficulty, sorted.length)
  ) {
    return null;
  }

  if (
    preferStrong &&
    difficulty === 'hard' &&
    threat.level === 'none' &&
    shouldPassExpensiveWin(pick, threat, difficulty, sorted.length)
  ) {
    const cheaper = ranked.find(
      (c) => !shouldPassExpensiveWin(c, threat, difficulty, sorted.length),
    );
    if (cheaper) return cheaper.tiles;
    return null;
  }

  return pick.tiles;
}

/** 리드 fallback용 단일 타일 */
export function aiLeadFallbackTile(
  hand: LexioTile[],
  options?: AiFindMoveOptions,
): LexioTile {
  const sorted = sortHand(hand);
  const difficulty = options?.difficulty ?? 'easy';
  const threat = getAiThreatInfo(options?.players, options?.currentPlayerId);
  const preferHigh =
    difficulty !== 'easy' &&
    (threat.level === 'high' ||
      threat.level === 'medium' ||
      (threat.level === 'low' && difficulty === 'hard'));
  return preferHigh ? sorted[sorted.length - 1] : sorted[0];
}

// AI: 현재 트릭을 이길 수 있는 조합 반환, 없으면 null(패스)
export function aiFindMove(
  hand: LexioTile[],
  target: LexioCombination | null,
  options?: AiFindMoveOptions,
): LexioTile[] | null {
  if (hand.length === 0) return null;
  const sorted = sortHand(hand);
  const difficulty = options?.difficulty ?? 'easy';
  const threat = getAiThreatInfo(options?.players, options?.currentPlayerId);
  const playerCount = options?.playerCount ?? 5;
  const remainingByNumber = buildRemainingCountByNumber(
    hand,
    options?.discardedTiles ?? [],
    options?.tablePlay ?? target,
    playerCount,
  );

  if (!target) {
    return aiLeadMove(sorted, difficulty, threat, remainingByNumber);
  }

  return aiFollowMove(sorted, target, difficulty, threat);
}

// 첫 시작 플레이어 찾기 (가장 약한 타일을 가진 사람)
export function findStarterIndex(players: LexioPlayer[]): number {
  let bestIdx = 0;
  let bestStrength = Infinity;
  players.forEach((p, idx) => {
    for (const t of p.hand) {
      const s = tileStrength(t);
      if (s < bestStrength) {
        bestStrength = s;
        bestIdx = idx;
      }
    }
  });
  return bestIdx;
}

// 손에 가장 약한 타일이 있는지 확인
export function hasLowestTile(
  player: LexioPlayer,
  allPlayers: LexioPlayer[],
): boolean {
  let lowestStrength = Infinity;
  let lowestPlayerIdx = -1;
  allPlayers.forEach((p, idx) => {
    for (const t of p.hand) {
      const s = tileStrength(t);
      if (s < lowestStrength) {
        lowestStrength = s;
        lowestPlayerIdx = idx;
      }
    }
  });
  return allPlayers[lowestPlayerIdx]?.id === player.id;
}

/** 판 종료 시 손패 기준 코인: 남은 장수 × (숫자 2 보유 시 2배) */
export function roundCoinForHand(hand: LexioTile[]): {
  earned: number;
  doubled: boolean;
} {
  const remaining = hand.length;
  const hasTwo = hand.some((t) => t.number === 2);
  const doubled = hasTwo && remaining > 0;
  const earned = remaining * (hasTwo ? 2 : 1);
  return { earned, doubled };
}
