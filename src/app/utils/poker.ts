// 포커 카드 타입 정의
type Suit = '♠' | '♥' | '♦' | '♣';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

type AIPersonalityId =
  | 'tight-passive'
  | 'tight-aggressive'
  | 'loose-passive'
  | 'loose-aggressive'
  | 'maniac'
  | 'balanced';

export interface AIPersonality {
  id: AIPersonalityId;
  label: string;
  // 강도(0~1) 가공
  strengthMultiplier: number; // 자신감 보정
  // 액션 성향
  raiseStrong: number; // 강한 핸드에서 레이즈 확률
  raiseMid: number; // 중간 핸드에서 레이즈 확률
  raiseWeakBluff: number; // 약한 핸드 블러프 레이즈 확률
  callMid: number; // 중간 핸드 콜 확률
  callWeak: number; // 약한 핸드 콜 확률
  // 폴드 컷 (이 강도 미만이면 콜 비용 있을 때 폴드 경향 증가)
  foldThreshold: number;
}

const AI_PERSONALITIES: AIPersonality[] = [
  {
    id: 'tight-passive',
    label: '타이트 패시브',
    strengthMultiplier: 0.95,
    raiseStrong: 0.25,
    raiseMid: 0.05,
    raiseWeakBluff: 0.02,
    callMid: 0.6,
    callWeak: 0.2,
    foldThreshold: 0.4,
  },
  {
    id: 'tight-aggressive',
    label: '타이트 어그레시브',
    strengthMultiplier: 1.05,
    raiseStrong: 0.7,
    raiseMid: 0.25,
    raiseWeakBluff: 0.08,
    callMid: 0.55,
    callWeak: 0.25,
    foldThreshold: 0.38,
  },
  {
    id: 'loose-passive',
    label: '루즈 패시브',
    strengthMultiplier: 1.0,
    raiseStrong: 0.3,
    raiseMid: 0.08,
    raiseWeakBluff: 0.03,
    callMid: 0.85,
    callWeak: 0.6,
    foldThreshold: 0.18,
  },
  {
    id: 'loose-aggressive',
    label: '루즈 어그레시브',
    strengthMultiplier: 1.1,
    raiseStrong: 0.75,
    raiseMid: 0.45,
    raiseWeakBluff: 0.22,
    callMid: 0.7,
    callWeak: 0.5,
    foldThreshold: 0.22,
  },
  {
    id: 'maniac',
    label: '매니악',
    strengthMultiplier: 1.15,
    raiseStrong: 0.85,
    raiseMid: 0.6,
    raiseWeakBluff: 0.4,
    callMid: 0.6,
    callWeak: 0.55,
    foldThreshold: 0.12,
  },
  {
    id: 'balanced',
    label: '밸런스드',
    strengthMultiplier: 1.0,
    raiseStrong: 0.55,
    raiseMid: 0.2,
    raiseWeakBluff: 0.08,
    callMid: 0.7,
    callWeak: 0.4,
    foldThreshold: 0.3,
  },
];

export function getRandomPersonality(): AIPersonality {
  return AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)];
}

export interface Player {
  id: number;
  name: string;
  chips: number;
  cards: Card[];
  currentBet: number;
  folded: boolean;
  /** 칩을 모두 잃어 이번 매치에서 더 이상 핸드에 참가하지 않음 */
  eliminated?: boolean;
  isAI: boolean;
  personality?: AIPersonality;
}

type HandRank =
  | 'High Card'
  | 'One Pair'
  | 'Two Pair'
  | 'Three of a Kind'
  | 'Straight'
  | 'Flush'
  | 'Full House'
  | 'Four of a Kind'
  | 'Straight Flush'
  | 'Royal Flush';

export interface HandEvaluation {
  rank: HandRank;
  value: number;
  cards: Card[];
}

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

// 카드 덱 생성
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

// 덱 섞기 (Fisher-Yates 알고리즘)
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// 랭크를 숫자로 변환
function rankToValue(rank: Rank): number {
  const values: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };
  return values[rank];
}

// 핸드 평가
export function evaluateHand(cards: Card[]): HandEvaluation {
  if (cards.length < 5) {
    return { rank: 'High Card', value: 0, cards: [] };
  }

  // 가능한 모든 5장 조합 생성
  const combinations = getCombinations(cards, 5);
  let bestHand: HandEvaluation = { rank: 'High Card', value: 0, cards: [] };

  for (const combo of combinations) {
    const evaluation = evaluateFiveCards(combo);
    if (evaluation.value > bestHand.value) {
      bestHand = evaluation;
    }
  }

  return bestHand;
}

// 5장 카드 평가
function evaluateFiveCards(cards: Card[]): HandEvaluation {
  const sortedCards = [...cards].sort((a, b) => rankToValue(b.rank) - rankToValue(a.rank));
  const ranks = sortedCards.map(c => c.rank);
  const suits = sortedCards.map(c => c.suit);

  // 각 랭크의 개수 세기
  const rankCounts: Record<string, number> = {};
  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = suits.every(suit => suit === suits[0]);
  const isStraight = checkStraight(ranks);

  // Royal Flush
  if (isFlush && isStraight && ranks[0] === 'A' && ranks[4] === '10') {
    return { rank: 'Royal Flush', value: 10000000, cards: sortedCards };
  }

  // Straight Flush
  if (isFlush && isStraight) {
    return { rank: 'Straight Flush', value: 9000000 + rankToValue(ranks[0]), cards: sortedCards };
  }

  // Four of a Kind
  if (counts[0] === 4) {
    const fourKind = Object.keys(rankCounts).find(r => rankCounts[r] === 4)!;
    return { rank: 'Four of a Kind', value: 8000000 + rankToValue(fourKind as Rank), cards: sortedCards };
  }

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    const threeKind = Object.keys(rankCounts).find(r => rankCounts[r] === 3)!;
    return { rank: 'Full House', value: 7000000 + rankToValue(threeKind as Rank), cards: sortedCards };
  }

  // Flush
  if (isFlush) {
    const value = 6000000 + sortedCards.reduce((sum, card, i) => sum + rankToValue(card.rank) * Math.pow(15, 4 - i), 0);
    return { rank: 'Flush', value, cards: sortedCards };
  }

  // Straight
  if (isStraight) {
    return { rank: 'Straight', value: 5000000 + rankToValue(ranks[0]), cards: sortedCards };
  }

  // Three of a Kind
  if (counts[0] === 3) {
    const threeKind = Object.keys(rankCounts).find(r => rankCounts[r] === 3)!;
    return { rank: 'Three of a Kind', value: 4000000 + rankToValue(threeKind as Rank), cards: sortedCards };
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = Object.keys(rankCounts)
      .filter(r => rankCounts[r] === 2)
      .map(r => rankToValue(r as Rank))
      .sort((a, b) => b - a);
    return { rank: 'Two Pair', value: 3000000 + pairs[0] * 15 + pairs[1], cards: sortedCards };
  }

  // One Pair
  if (counts[0] === 2) {
    const pair = Object.keys(rankCounts).find(r => rankCounts[r] === 2)!;
    return { rank: 'One Pair', value: 2000000 + rankToValue(pair as Rank), cards: sortedCards };
  }

  // High Card
  const value = 1000000 + sortedCards.reduce((sum, card, i) => sum + rankToValue(card.rank) * Math.pow(15, 4 - i), 0);
  return { rank: 'High Card', value, cards: sortedCards };
}

// 스트레이트 체크
function checkStraight(ranks: Rank[]): boolean {
  const values = ranks.map(rankToValue).sort((a, b) => b - a);

  // 일반 스트레이트
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      // A-2-3-4-5 스트레이트 체크
      if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        return true;
      }
      return false;
    }
  }
  return true;
}

// 조합 생성
function getCombinations(arr: Card[], k: number): Card[][] {
  if (k === 1) return arr.map(item => [item]);
  if (k === arr.length) return [arr];

  const result: Card[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombs = getCombinations(arr.slice(i + 1), k - 1);
    tailCombs.forEach(tailComb => {
      result.push([head, ...tailComb]);
    });
  }
  return result;
}

// 프리플랍 홀카드 강도 (0~1)
function getPreflopStrength(cards: Card[]): number {
  if (cards.length < 2) return 0;
  const [a, b] = cards;
  const va = rankToValue(a.rank);
  const vb = rankToValue(b.rank);
  const high = Math.max(va, vb);
  const low = Math.min(va, vb);
  const pair = va === vb;
  const suited = a.suit === b.suit;
  const gap = high - low;
  const connector = gap <= 1;
  const oneGap = gap === 2;

  if (pair) {
    if (high >= 13) return 0.98; // KK, AA
    if (high >= 10) return 0.9;  // TT-QQ
    if (high >= 7) return 0.72;  // 77-99
    return 0.58;                 // 22-66
  }

  if (high === 14) {
    if (low >= 10) return suited ? 0.86 : 0.74; // AT-AK
    if (low >= 7) return suited ? 0.55 : 0.4;
    return suited ? 0.4 : 0.25;
  }
  if (high === 13) {
    if (low >= 10) return suited ? 0.74 : 0.6;
    if (low >= 8) return suited ? 0.5 : 0.36;
    return suited ? 0.32 : 0.2;
  }
  if (high === 12) {
    if (low >= 10) return suited ? 0.62 : 0.48;
    return suited ? 0.36 : 0.24;
  }
  if (high === 11) {
    if (low >= 9) return suited ? 0.5 : 0.36;
  }

  if (suited && connector) return 0.5;
  if (connector) return 0.36;
  if (suited && oneGap) return 0.36;
  if (suited) return 0.28;
  return 0.18;
}

const DEFAULT_PERSONALITY: AIPersonality = AI_PERSONALITIES.find(p => p.id === 'balanced')!;

// AI 결정 로직 (성향 반영)
export function getAIDecision(
  player: Player,
  communityCards: Card[],
  currentBet: number,
  pot: number
): 'fold' | 'call' | 'raise' {
  if (player.folded || player.eliminated || player.chips <= 0) return 'fold';

  const persona = player.personality ?? DEFAULT_PERSONALITY;
  const callAmount = Math.max(0, currentBet - player.currentBet);

  const baseStrength =
    communityCards.length === 0
      ? getPreflopStrength(player.cards)
      : getHandStrength(evaluateHand([...player.cards, ...communityCards]).rank);
  const strength = Math.min(1, baseStrength * persona.strengthMultiplier);

  // 베팅이 없을 땐 체크 또는 가치 베팅(레이즈)
  if (callAmount === 0) {
    if (strength >= 0.7 && Math.random() < persona.raiseStrong) return 'raise';
    if (strength >= 0.45 && Math.random() < persona.raiseMid) return 'raise';
    if (Math.random() < persona.raiseWeakBluff) return 'raise';
    return 'call';
  }

  // 콜도 못하는 비용이면 폴드
  if (callAmount > player.chips) {
    return 'fold';
  }

  const potOdds = pot > 0 ? callAmount / (pot + callAmount) : 0;
  const callRatio = callAmount / Math.max(1, player.chips + player.currentBet);
  const cheapCall = callRatio < 0.04 || potOdds < 0.22;

  // 매우 강한 핸드
  if (strength >= 0.82) {
    return Math.random() < persona.raiseStrong ? 'raise' : 'call';
  }
  // 강한 핸드
  if (strength >= 0.62) {
    return Math.random() < persona.raiseStrong * 0.7 ? 'raise' : 'call';
  }
  // 중간 핸드
  if (strength >= 0.42) {
    if (Math.random() < persona.raiseMid) return 'raise';
    if (cheapCall) return 'call';
    return Math.random() < persona.callMid ? 'call' : 'fold';
  }
  // 약한 핸드
  if (strength >= persona.foldThreshold) {
    if (Math.random() < persona.raiseWeakBluff * 0.6) return 'raise';
    if (cheapCall) return 'call';
    return Math.random() < persona.callWeak ? 'call' : 'fold';
  }
  // 매우 약한 핸드 — 블러프/싼 콜만 가끔
  if (Math.random() < persona.raiseWeakBluff * 0.4) return 'raise';
  if (cheapCall && Math.random() < persona.callWeak * 0.5) return 'call';
  return 'fold';
}

// 핸드 강도 계산 (0-1 사이 값)
function getHandStrength(rank: HandRank): number {
  const strength: Record<HandRank, number> = {
    'Royal Flush': 1.0,
    'Straight Flush': 0.95,
    'Four of a Kind': 0.9,
    'Full House': 0.85,
    'Flush': 0.75,
    'Straight': 0.65,
    'Three of a Kind': 0.55,
    'Two Pair': 0.45,
    'One Pair': 0.3,
    'High Card': 0.1
  };
  return strength[rank];
}

// AI 레이즈 금액 결정 (성향 반영)
export function getAIRaiseAmount(player: Player, currentBet: number, bigBlind: number): number {
  const persona = player.personality ?? DEFAULT_PERSONALITY;
  const minRaise = Math.max(currentBet * 2, currentBet + bigBlind);
  const stack = player.chips + player.currentBet;

  // 성향별 레이즈 사이즈 분포
  let multipliers: number[];
  switch (persona.id) {
    case 'tight-passive':
      multipliers = [2, 2.2, 2.5];
      break;
    case 'tight-aggressive':
      multipliers = [2.5, 3, 3.5];
      break;
    case 'loose-passive':
      multipliers = [2, 2.2];
      break;
    case 'loose-aggressive':
      multipliers = [2.5, 3, 4];
      break;
    case 'maniac':
      multipliers = [3, 4, 5, 6];
      break;
    case 'balanced':
    default:
      multipliers = [2, 2.5, 3, 3.5];
      break;
  }

  const candidates = multipliers
    .map(m => Math.floor(currentBet * m))
    .map(amount => Math.max(amount, minRaise))
    .filter(amount => amount <= stack);

  if (candidates.length === 0) {
    return Math.min(minRaise, stack);
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// 한국어 핸드 랭크 이름
function getHandRankKorean(rank: HandRank): string {
  const korean: Record<HandRank, string> = {
    'Royal Flush': '로얄 플러시',
    'Straight Flush': '스트레이트 플러시',
    'Four of a Kind': '포카드',
    'Full House': '풀하우스',
    'Flush': '플러시',
    'Straight': '스트레이트',
    'Three of a Kind': '트리플',
    'Two Pair': '투페어',
    'One Pair': '원페어',
    'High Card': '하이카드'
  };
  return korean[rank];
}

// 핸드 상세 설명 (예: A 원페어)
export function getHandDescriptionKorean(evaluation: HandEvaluation): string {
  const base = getHandRankKorean(evaluation.rank);
  if (evaluation.rank === 'Straight' || evaluation.rank === 'Straight Flush') {
    const values = evaluation.cards.map(card => rankToValue(card.rank)).sort((a, b) => b - a);
    const isWheelStraight =
      values.length === 5 &&
      values[0] === 14 &&
      values[1] === 5 &&
      values[2] === 4 &&
      values[3] === 3 &&
      values[4] === 2;
    const highRank = isWheelStraight ? '5' : evaluation.cards[0]?.rank;
    if (!highRank) return base;
    return `${highRank} 하이 ${base}`;
  }

  if (evaluation.rank !== 'One Pair') return base;

  const rankCounts: Record<Rank, number> = {
    '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0,
    '10': 0, J: 0, Q: 0, K: 0, A: 0,
  };
  evaluation.cards.forEach(card => {
    rankCounts[card.rank] += 1;
  });
  const pairRank = (Object.keys(rankCounts) as Rank[]).find(rank => rankCounts[rank] === 2);
  if (!pairRank) return base;
  return `${pairRank} 원페어`;
}
