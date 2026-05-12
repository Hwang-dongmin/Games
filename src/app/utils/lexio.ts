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
  const deck: LexioTile[] = [];
  let id = 0;
  for (const color of COLORS) {
    for (let n = 1; n <= 15; n++) {
      deck.push({ id: id++, number: n, color });
    }
  }
  return deck;
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

// AI: 현재 트릭을 이길 수 있는 가장 약한 조합 반환, 없으면 null
// target === null 이면 리드:
//   큰 조합(페어/트리플/5장 풀하우스·플러시 등)을 적극적으로 활용하도록 확률 가중을 둠.
export function aiFindMove(
  hand: LexioTile[],
  target: LexioCombination | null,
): LexioTile[] | null {
  if (hand.length === 0) return null;
  const sorted = sortHand(hand);

  if (!target) {
    const singles = enumerateCombos(sorted, 1).sort((a, b) => a.value - b.value);
    const pairs = enumerateCombos(sorted, 2).sort((a, b) => a.value - b.value);
    const triples = enumerateCombos(sorted, 3).sort((a, b) => a.value - b.value);
    const fives = enumerateCombos(sorted, 5).sort((a, b) => a.value - b.value);

    // 큰 조합부터 확률 기반으로 우선 사용.
    //  - 5장(풀하우스/플러시/스트레이트 등) ≈ 35%
    //  - 트리플 ≈ 55%
    //  - 페어 ≈ 65%
    //  - 그 외(=단일) fallback
    if (fives.length > 0 && Math.random() < 0.35) {
      return fives[0].tiles;
    }
    if (triples.length > 0 && Math.random() < 0.55) {
      return triples[0].tiles;
    }
    if (pairs.length > 0 && Math.random() < 0.65) {
      return pairs[0].tiles;
    }

    // fallback: 가장 약한 단일 → 없으면 더 큰 조합 순서로
    if (singles.length > 0) return singles[0].tiles;
    if (pairs.length > 0) return pairs[0].tiles;
    if (triples.length > 0) return triples[0].tiles;
    if (fives.length > 0) return fives[0].tiles;
    return null;
  }

  const size = target.tiles.length;
  const candidates = enumerateCombos(sorted, size);
  const valid = candidates.filter((c) => beats(c, target));

  if (valid.length === 0) return null;
  valid.sort((a, b) => a.value - b.value);
  return valid[0].tiles;
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
