// 포커 카드 타입 정의
export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface Player {
  id: number;
  name: string;
  chips: number;
  cards: Card[];
  currentBet: number;
  folded: boolean;
  isAI: boolean;
}

export type HandRank =
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

// AI 결정 로직
export function getAIDecision(
  player: Player,
  communityCards: Card[],
  currentBet: number,
  pot: number
): 'fold' | 'call' | 'raise' {
  const hand = evaluateHand([...player.cards, ...communityCards]);
  const callAmount = currentBet - player.currentBet;

  // 칩이 부족하면 폴드
  if (callAmount > player.chips) {
    return 'fold';
  }

  // 핸드 강도에 따른 결정
  const handStrength = getHandStrength(hand.rank);
  const potOdds = pot > 0 ? callAmount / (pot + callAmount) : 0;

  // 매우 강한 핸드
  if (handStrength >= 0.8) {
    return Math.random() > 0.3 ? 'raise' : 'call';
  }

  // 강한 핸드
  if (handStrength >= 0.6) {
    return Math.random() > 0.5 ? 'raise' : 'call';
  }

  // 중간 핸드
  if (handStrength >= 0.4) {
    if (potOdds < 0.3) {
      return 'call';
    }
    return Math.random() > 0.7 ? 'call' : 'fold';
  }

  // 약한 핸드
  if (handStrength >= 0.2) {
    if (callAmount === 0) return 'call'; // 체크
    return potOdds < 0.2 && Math.random() > 0.8 ? 'call' : 'fold';
  }

  // 매우 약한 핸드
  if (callAmount === 0) {
    return 'call'; // 체크
  }
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

// AI 레이즈 금액 결정
export function getAIRaiseAmount(player: Player, currentBet: number, bigBlind: number): number {
  const minRaise = currentBet * 2;
  const maxRaise = Math.min(player.chips, currentBet * 4);

  // 랜덤하게 결정하되, 일반적인 레이즈 패턴 사용
  const raiseOptions = [
    minRaise,
    currentBet + bigBlind * 2,
    currentBet + bigBlind * 3,
    maxRaise
  ];

  const validOptions = raiseOptions.filter(amount => amount <= player.chips);
  return validOptions[Math.floor(Math.random() * validOptions.length)] || minRaise;
}

// 한국어 핸드 랭크 이름
export function getHandRankKorean(rank: HandRank): string {
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
