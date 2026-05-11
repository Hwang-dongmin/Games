import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw, Users, BookOpen, X } from 'lucide-react';
import {
  Card,
  Player,
  createDeck,
  shuffleDeck,
  evaluateHand,
  getAIDecision,
  getAIRaiseAmount,
  getHandRankKorean,
  getRandomPersonality,
} from '../utils/poker';

type GamePhase = 'betting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'game-over' | 'setup';

const INITIAL_CHIPS = 1000;
const BASE_SMALL_BLIND = 10;
const BASE_BIG_BLIND = 20;
const BLIND_INCREASE_INTERVAL = 60; // seconds
const BLIND_INCREASE_SMALL = 10;
const BLIND_INCREASE_BIG = 20;

export default function TexasHoldem() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [bettingRoundStartIndex, setBettingRoundStartIndex] = useState(0);
  const [actedPlayerIds, setActedPlayerIds] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('AI 플레이어 수를 선택하세요!');
  const [raiseAmount, setRaiseAmount] = useState(BASE_BIG_BLIND * 2);
  const [showCards, setShowCards] = useState(false);
  const [numAIPlayers, setNumAIPlayers] = useState(3);
  const [showRules, setShowRules] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);
  const [blindLevel, setBlindLevel] = useState(0);
  const [blindTimeLeft, setBlindTimeLeft] = useState(BLIND_INCREASE_INTERVAL);

  // 게임 초기화
  const initGame = (aiCount: number = numAIPlayers) => {
    const newPlayers: Player[] = [
      { id: 0, name: '플레이어', chips: INITIAL_CHIPS, cards: [], currentBet: 0, folded: false, isAI: false },
    ];

    for (let i = 0; i < aiCount; i++) {
      const personality = getRandomPersonality();
      newPlayers.push({
        id: i + 1,
        name: `AI ${i + 1}`,
        chips: INITIAL_CHIPS,
        cards: [],
        currentBet: 0,
        folded: false,
        isAI: true,
        personality,
      });
    }

    setPlayers(newPlayers);
    setCommunityCards([]);
    setPot(0);
    setCurrentBet(0);
    setGamePhase('betting');
    setMessage('게임을 시작하세요!');
    setShowCards(false);
    setBlindLevel(0);
    setBlindTimeLeft(BLIND_INCREASE_INTERVAL);
  };

  const startSetup = () => {
    setGamePhase('setup');
    setPlayers([]);
    setMessage('AI 플레이어 수를 선택하세요!');
    setBlindLevel(0);
    setBlindTimeLeft(BLIND_INCREASE_INTERVAL);
  };

  // 새 라운드 시작
  const startNewRound = () => {
    if (players.filter(p => p.chips > 0).length < 2) {
      const humanPlayer = players.find(p => !p.isAI);
      if (humanPlayer && humanPlayer.chips > 0) {
        setMessage('축하합니다! 모든 상대를 이겼습니다!');
        setGamePhase('game-over');
      } else {
        setMessage('게임 오버! 칩을 모두 잃었습니다.');
        setGamePhase('game-over');
      }
      return;
    }

    const newDeck = shuffleDeck(createDeck());
    const activePlayers = players.filter(p => p.chips > 0);

    // 블라인드 설정
    const newDealerIndex = (dealerIndex + 1) % activePlayers.length;
    const sbIndex = (newDealerIndex + 1) % activePlayers.length;
    const bbIndex = (newDealerIndex + 2) % activePlayers.length;

    const updatedPlayers = players.map((p, idx) => {
      if (p.chips <= 0) return { ...p, folded: true, currentBet: 0, cards: [] };

      const activeIdx = activePlayers.findIndex(ap => ap.id === p.id);
      let bet = 0;

      if (activeIdx === sbIndex) bet = Math.min(currentSmallBlind, p.chips);
      if (activeIdx === bbIndex) bet = Math.min(currentBigBlind, p.chips);

      return {
        ...p,
        cards: [newDeck.pop()!, newDeck.pop()!],
        currentBet: bet,
        chips: p.chips - bet,
        folded: false,
      };
    });

    setDeck(newDeck);
    setPlayers(updatedPlayers);
    setCommunityCards([]);
    setPot(activePlayers[sbIndex].currentBet + activePlayers[bbIndex].currentBet);
    setCurrentBet(currentBigBlind);
    setGamePhase('pre-flop');
    const preflopStartIndex = (newDealerIndex + 3) % activePlayers.length;
    setCurrentPlayerIndex(preflopStartIndex);
    setBettingRoundStartIndex(preflopStartIndex);
    setActedPlayerIds(new Set());
    setDealerIndex(newDealerIndex);
    setMessage('프리플랍: 베팅을 시작하세요.');
    setRaiseAmount(currentBigBlind * 2);
    setShowCards(false);
  };

  // 플레이어 액션
  const playerAction = (action: 'fold' | 'call' | 'raise', amount?: number) => {
    if (gamePhase === 'betting' || gamePhase === 'game-over') return;

    const player = players[currentPlayerIndex];
    if (!player || player.folded) return;

    const updatedPlayers = [...players];
    const currentPlayer = updatedPlayers[currentPlayerIndex];
    let newCurrentBet = currentBet;
    let raisedThisAction = false;

    if (action === 'fold') {
      currentPlayer.folded = true;
      setMessage(`${currentPlayer.name}이(가) 폴드했습니다.`);
    } else if (action === 'call') {
      const callAmount = Math.min(currentBet - currentPlayer.currentBet, currentPlayer.chips);
      currentPlayer.chips -= callAmount;
      currentPlayer.currentBet += callAmount;
      setPot(prev => prev + callAmount);
      setMessage(
        callAmount === 0
          ? `${currentPlayer.name}이(가) 체크했습니다.`
          : `${currentPlayer.name}이(가) ${callAmount} 콜했습니다.`
      );
    } else if (action === 'raise' && amount) {
      const raiseTotal = Math.min(amount, currentPlayer.chips + currentPlayer.currentBet);
      const addAmount = raiseTotal - currentPlayer.currentBet;
      currentPlayer.chips -= addAmount;
      currentPlayer.currentBet = raiseTotal;
      setPot(prev => prev + addAmount);
      newCurrentBet = raiseTotal;
      setCurrentBet(raiseTotal);
      raisedThisAction = true;
      setMessage(`${currentPlayer.name}이(가) ${raiseTotal}로 레이즈했습니다.`);
    }

    // 이번 페이즈에서 액션한 플레이어 셋 갱신
    // 레이즈가 일어나면 다른 플레이어들의 '액션함' 상태를 리셋(다시 한 번 액션해야 함)
    let nextActed: Set<number>;
    if (raisedThisAction) {
      nextActed = new Set<number>([currentPlayer.id]);
    } else {
      nextActed = new Set(actedPlayerIds);
      nextActed.add(currentPlayer.id);
    }
    setActedPlayerIds(nextActed);

    setPlayers(updatedPlayers);
    moveToNextPlayer(updatedPlayers, newCurrentBet, nextActed);
  };

  // 다음 플레이어로 이동 — 최신 players/currentBet/acted 셋을 직접 받아서 판정
  const moveToNextPlayer = (
    latestPlayers: typeof players,
    latestBet: number,
    latestActed: Set<number>
  ) => {
    const activePlayers = latestPlayers.filter(p => !p.folded);
    if (activePlayers.length <= 1) {
      endRound();
      return;
    }

    // 베팅에 참여할 수 있는 플레이어(폴드/올인 제외)
    const playersStillToAct = activePlayers.filter(p => p.chips > 0);

    const allMatchedBet = activePlayers.every(
      p => p.currentBet === latestBet || p.chips === 0
    );
    const everyoneActed = playersStillToAct.every(p => latestActed.has(p.id));

    if (allMatchedBet && everyoneActed) {
      moveToNextPhase();
      return;
    }

    let nextIndex = (currentPlayerIndex + 1) % latestPlayers.length;
    let safety = 0;
    while (
      (latestPlayers[nextIndex].folded || latestPlayers[nextIndex].chips === 0) &&
      safety < latestPlayers.length
    ) {
      nextIndex = (nextIndex + 1) % latestPlayers.length;
      safety++;
    }

    setCurrentPlayerIndex(nextIndex);
  };

  // 다음 페이즈로 이동
  const moveToNextPhase = () => {
    const newDeck = [...deck];

    if (gamePhase === 'pre-flop') {
      // 플랍
      const flop = [newDeck.pop()!, newDeck.pop()!, newDeck.pop()!];
      setCommunityCards(flop);
      setGamePhase('flop');
      setMessage('플랍: 3장의 커뮤니티 카드가 공개되었습니다.');
    } else if (gamePhase === 'flop') {
      // 턴
      setCommunityCards(prev => [...prev, newDeck.pop()!]);
      setGamePhase('turn');
      setMessage('턴: 4번째 커뮤니티 카드가 공개되었습니다.');
    } else if (gamePhase === 'turn') {
      // 리버
      setCommunityCards(prev => [...prev, newDeck.pop()!]);
      setGamePhase('river');
      setMessage('리버: 마지막 커뮤니티 카드가 공개되었습니다.');
    } else if (gamePhase === 'river') {
      // 쇼다운
      endRound();
      return;
    }

    setDeck(newDeck);
    setCurrentBet(0);
    setPlayers(prev => prev.map(p => ({ ...p, currentBet: 0 })));
    // 폴드되지 않은 첫 플레이어부터 시작 (딜러 다음)
    let nextRoundStartIndex = (dealerIndex + 1) % players.length;
    let safety = 0;
    while (
      (players[nextRoundStartIndex].folded || players[nextRoundStartIndex].chips === 0) &&
      safety < players.length
    ) {
      nextRoundStartIndex = (nextRoundStartIndex + 1) % players.length;
      safety++;
    }
    setCurrentPlayerIndex(nextRoundStartIndex);
    setBettingRoundStartIndex(nextRoundStartIndex);
    setActedPlayerIds(new Set());
  };

  // 라운드 종료
  const endRound = () => {
    setGamePhase('showdown');
    setShowCards(true);

    const activePlayers = players.filter(p => !p.folded);

    if (activePlayers.length === 1) {
      // 한 명만 남음
      const winner = activePlayers[0];
      const updatedPlayers = players.map(p =>
        p.id === winner.id ? { ...p, chips: p.chips + pot } : p
      );
      setPlayers(updatedPlayers);
      setMessage(`${winner.name}이(가) 승리했습니다! ${pot} 칩 획득!`);
    } else {
      // 쇼다운
      const evaluations = activePlayers.map(p => ({
        player: p,
        hand: evaluateHand([...p.cards, ...communityCards]),
      }));

      evaluations.sort((a, b) => b.hand.value - a.hand.value);
      const winners = evaluations.filter(e => e.hand.value === evaluations[0].hand.value);
      const winAmount = Math.floor(pot / winners.length);

      const updatedPlayers = players.map(p => {
        const winner = winners.find(w => w.player.id === p.id);
        if (winner) {
          return { ...p, chips: p.chips + winAmount };
        }
        return p;
      });

      setPlayers(updatedPlayers);

      if (winners.length === 1) {
        const winnerHand = getHandRankKorean(winners[0].hand.rank);
        setMessage(`${winners[0].player.name}이(가) ${winnerHand}로 승리! ${winAmount} 칩 획득!`);
      } else {
        const winnerNames = winners.map(w => w.player.name).join(', ');
        setMessage(`무승부! ${winnerNames}가 ${winAmount}칩씩 나눠가집니다.`);
      }
    }

    setPot(0);
    setTimeout(() => {
      startNewRound();
    }, 5000);
  };

  // AI 턴 처리
  useEffect(() => {
    if (gamePhase === 'betting' || gamePhase === 'showdown' || gamePhase === 'game-over') return;

    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isAI || currentPlayer.folded) return;

    const timer = setTimeout(() => {
      const decision = getAIDecision(currentPlayer, communityCards, currentBet, pot);
      if (decision === 'raise') {
        const amount = getAIRaiseAmount(currentPlayer, currentBet, currentBigBlind);
        playerAction('raise', amount);
      } else {
        playerAction(decision);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [currentPlayerIndex, gamePhase]);

  useEffect(() => {
    // Start with setup phase
  }, []);

  useEffect(() => {
    if (gamePhase === 'setup' || gamePhase === 'game-over') return;

    const timer = setInterval(() => {
      setBlindTimeLeft(prev => {
        if (prev <= 1) {
          setBlindLevel(level => level + 1);
          return BLIND_INCREASE_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase]);

  const humanPlayer = players.find(p => !p.isAI);
  const isHumanTurn = players[currentPlayerIndex] && !players[currentPlayerIndex].isAI && !players[currentPlayerIndex].folded;
  const callAmount = humanPlayer ? currentBet - humanPlayer.currentBet : 0;
  const currentSmallBlind = BASE_SMALL_BLIND + blindLevel * BLIND_INCREASE_SMALL;
  const currentBigBlind = BASE_BIG_BLIND + blindLevel * BLIND_INCREASE_BIG;
  const nextSmallBlind = currentSmallBlind + BLIND_INCREASE_SMALL;
  const nextBigBlind = currentBigBlind + BLIND_INCREASE_BIG;
  const blindTimerLabel = `${String(Math.floor(blindTimeLeft / 60)).padStart(2, '0')}:${String(
    blindTimeLeft % 60
  ).padStart(2, '0')}`;
  const totalPlayers = players.length;
  const dealerSeatIndex = totalPlayers > 0 ? dealerIndex % totalPlayers : 0;
  const dealerAngle = totalPlayers > 0 ? (dealerSeatIndex / totalPlayers) * Math.PI * 2 + Math.PI / 2 : 0;
  const dealerButtonPosition = {
    left: `${50 + 43 * Math.cos(dealerAngle)}%`,
    top: `${50 + 37 * Math.sin(dealerAngle)}%`,
  };

  return (
    <div
      className="min-h-screen p-4 text-slate-100"
      style={{
        background:
          'radial-gradient(ellipse at top, #0f3a2e 0%, #0a1f1a 45%, #050b0a 100%)',
      }}
    >
      {/* New Game Confirmation Modal */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div
            className="rounded-2xl max-w-md w-full p-7"
            style={{
              background:
                'linear-gradient(180deg, #0f1e1a 0%, #07120f 100%)',
              boxShadow:
                '0 0 0 1px rgba(245,158,11,0.3), 0 30px 60px -20px rgba(0,0,0,0.8)',
            }}
          >
            <p className="text-[10px] tracking-[0.4em] text-amber-300/70 uppercase text-center mb-2">
              Confirm
            </p>
            <h2 className="text-2xl font-serif tracking-wide text-amber-100 mb-4 text-center">
              새 게임 시작
            </h2>
            <p className="text-emerald-100/80 text-center mb-7 text-sm leading-relaxed">
              정말로 새 게임을 시작하시겠습니까?
              <br />
              <span className="text-emerald-100/50">
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
                  startSetup();
                }}
                className="flex-1 rounded-full px-6 py-3 text-xs tracking-[0.3em] uppercase font-semibold text-rose-100 transition-all hover:-translate-y-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(159,18,57,0.35) 0%, rgba(76,5,25,0.5) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(244,63,94,0.55), 0 8px 20px -10px rgba(244,63,94,0.5)',
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
            className="rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            style={{
              background:
                'linear-gradient(180deg, #0f1e1a 0%, #07120f 100%)',
              boxShadow:
                '0 0 0 1px rgba(245,158,11,0.3), 0 30px 60px -20px rgba(0,0,0,0.8)',
            }}
          >
            <div
              className="sticky top-0 p-6 flex items-center justify-between backdrop-blur-md z-10"
              style={{
                background:
                  'linear-gradient(180deg, rgba(15,30,26,0.95) 0%, rgba(15,30,26,0.85) 100%)',
                borderBottom: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <div>
                <p className="text-[10px] tracking-[0.4em] text-amber-300/70 uppercase mb-1">
                  House Guide
                </p>
                <h2 className="text-2xl font-serif tracking-wide text-amber-100 flex items-center gap-2.5">
                  <BookOpen className="w-5 h-5 text-amber-300/80" />
                  텍사스 홀덤 게임 규칙
                </h2>
              </div>
              <button
                onClick={() => setShowRules(false)}
                className="text-slate-300/70 hover:text-amber-200 transition-colors rounded-full p-1.5 hover:bg-white/[0.05]"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-7 text-slate-100">
              {/* Game Overview */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">
                  게임 개요
                </h3>
                <p className="text-emerald-100/80 leading-relaxed text-sm">
                  텍사스 홀덤은 세계에서 가장 인기 있는 포커 게임입니다. 각 플레이어는 2장의 개인 카드를 받고, 5장의 커뮤니티 카드와 조합하여 최고의 5장 카드 조합을 만들어 승부를 겨룹니다.
                </p>
              </section>

              {/* Game Flow */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">
                  게임 진행
                </h3>
                <ol className="space-y-2.5 list-decimal list-inside text-emerald-100/80 text-sm marker:text-amber-300/60">
                  <li><strong className="text-amber-100/90 font-semibold">블라인드:</strong> 스몰 블라인드(10칩)와 빅 블라인드(20칩) 강제 베팅</li>
                  <li><strong className="text-amber-100/90 font-semibold">프리플랍:</strong> 각자 2장의 카드를 받고 첫 베팅 라운드</li>
                  <li><strong className="text-amber-100/90 font-semibold">플랍:</strong> 3장의 커뮤니티 카드 공개 후 베팅</li>
                  <li><strong className="text-amber-100/90 font-semibold">턴:</strong> 4번째 커뮤니티 카드 공개 후 베팅</li>
                  <li><strong className="text-amber-100/90 font-semibold">리버:</strong> 5번째 커뮤니티 카드 공개 후 마지막 베팅</li>
                  <li><strong className="text-amber-100/90 font-semibold">쇼다운:</strong> 남은 플레이어들이 카드를 공개하고 승자 결정</li>
                </ol>
              </section>

              {/* Actions */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">
                  플레이어 액션
                </h3>
                <ul className="space-y-2 text-emerald-100/80 text-sm">
                  <li><strong className="text-amber-100/90 font-semibold">폴드:</strong> 카드를 버리고 라운드에서 나감</li>
                  <li><strong className="text-amber-100/90 font-semibold">체크:</strong> 베팅 없이 다음 플레이어에게 턴 넘김 (베팅이 없을 때만 가능)</li>
                  <li><strong className="text-amber-100/90 font-semibold">콜:</strong> 현재 베팅 금액만큼 따라감</li>
                  <li><strong className="text-amber-100/90 font-semibold">레이즈:</strong> 현재 베팅보다 더 높은 금액으로 베팅</li>
                </ul>
              </section>

              {/* Hand Rankings */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">
                  핸드 랭킹 (높은 순)
                </h3>
                <div className="space-y-2.5">
                  {/* Royal Flush */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">1. 로얄 플러시</strong>
                      <span className="text-emerald-200/70 text-xs">같은 무늬 A-K-Q-J-10</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♠', 'K♠', 'Q♠', 'J♠', '10♠'].map((card, i) => (
                        <div key={i} className="w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md text-slate-900 flex items-center justify-center text-xs font-bold">
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Straight Flush */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">2. 스트레이트 플러시</strong>
                      <span className="text-emerald-200/70 text-xs">같은 무늬의 연속된 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['9♥', '8♥', '7♥', '6♥', '5♥'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Four of a Kind */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">3. 포카드</strong>
                      <span className="text-emerald-200/70 text-xs">같은 숫자 4장</span>
                    </div>
                    <div className="flex gap-1">
                      {['K♠', 'K♥', 'K♦', 'K♣', 'A♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full House */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">4. 풀하우스</strong>
                      <span className="text-emerald-200/70 text-xs">트리플 + 원페어</span>
                    </div>
                    <div className="flex gap-1">
                      {['Q♠', 'Q♥', 'Q♦', '8♣', '8♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flush */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">5. 플러시</strong>
                      <span className="text-emerald-200/70 text-xs">같은 무늬 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♦', 'J♦', '9♦', '6♦', '3♦'].map((card, i) => (
                        <div key={i} className="w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md text-rose-600 flex items-center justify-center text-xs font-bold">
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Straight */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">6. 스트레이트</strong>
                      <span className="text-emerald-200/70 text-xs">연속된 숫자 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['10♠', '9♥', '8♦', '7♣', '6♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Three of a Kind */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">7. 트리플</strong>
                      <span className="text-emerald-200/70 text-xs">같은 숫자 3장</span>
                    </div>
                    <div className="flex gap-1">
                      {['J♠', 'J♥', 'J♦', 'A♣', '9♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two Pair */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">8. 투페어</strong>
                      <span className="text-emerald-200/70 text-xs">같은 숫자 2장씩 2개</span>
                    </div>
                    <div className="flex gap-1">
                      {['10♠', '10♥', '7♦', '7♣', 'K♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* One Pair */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">9. 원페어</strong>
                      <span className="text-emerald-200/70 text-xs">같은 숫자 2장</span>
                    </div>
                    <div className="flex gap-1">
                      {['9♠', '9♥', 'A♦', 'J♣', '4♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* High Card */}
                  <div
                    className="rounded-xl p-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.025)',
                      boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.15)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-amber-100/95 font-semibold">10. 하이카드</strong>
                      <span className="text-emerald-200/70 text-xs">위의 조합이 없을 때 가장 높은 카드</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♠', 'Q♥', '10♦', '7♣', '3♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 rounded-md bg-gradient-to-b from-stone-50 to-stone-200 ring-1 ring-black/10 shadow-md flex items-center justify-center text-xs font-bold ${card.includes('♥') || card.includes('♦') ? 'text-rose-600' : 'text-slate-900'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">팁</h3>
                <ul className="space-y-1.5 text-emerald-100/80 text-sm">
                  <li>· 좋은 핸드(높은 페어, 같은 무늬의 높은 카드)로 시작하세요</li>
                  <li>· 상대방의 베팅 패턴을 주의깊게 관찰하세요</li>
                  <li>· 약한 핸드로는 과도한 베팅을 피하세요</li>
                  <li>· 포지션이 중요합니다 - 늦게 행동할수록 유리합니다</li>
                  <li>· 블러핑도 전략이지만 신중하게 사용하세요</li>
                </ul>
              </section>

              {/* Starting Chips */}
              <section>
                <h3 className="text-xs tracking-[0.3em] uppercase text-amber-300/80 mb-3">게임 설정</h3>
                <ul className="space-y-2 text-emerald-100/80 text-sm">
                  <li><strong className="text-amber-100/95 font-semibold">시작 칩:</strong> 각 플레이어 1,000칩</li>
                  <li><strong className="text-amber-100/95 font-semibold">스몰 블라인드:</strong> 10칩</li>
                  <li><strong className="text-amber-100/95 font-semibold">빅 블라인드:</strong> 20칩</li>
                  <li><strong className="text-amber-100/95 font-semibold">플레이어:</strong> 최대 10명 (플레이어 1명 + AI 최대 9명)</li>
                </ul>
              </section>
            </div>

            <div
              className="sticky bottom-0 p-5 backdrop-blur-md"
              style={{
                background:
                  'linear-gradient(0deg, rgba(15,30,26,0.95) 0%, rgba(15,30,26,0.7) 100%)',
                borderTop: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <button
                onClick={() => setShowRules(false)}
                className="holdem-shimmer w-full rounded-full px-6 py-3 text-xs tracking-[0.35em] uppercase font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                  color: '#1c1917',
                  boxShadow:
                    '0 10px 24px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.55)',
                }}
              >
                Back to Game
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative text-center mb-8 pt-2">
          <div className="absolute top-0 right-0 flex items-center gap-2">
            <button
              onClick={() => setShowRules(true)}
              className="group inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/[0.03] backdrop-blur-sm px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-amber-200/90 hover:text-amber-100 hover:border-amber-300/60 hover:bg-white/[0.06] transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Rules
            </button>
            <button
              onClick={() => {
                if (gamePhase === 'setup' || gamePhase === 'betting') {
                  startSetup();
                } else {
                  setShowNewGameConfirm(true);
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-white/[0.03] backdrop-blur-sm px-4 py-1.5 text-xs tracking-[0.2em] uppercase text-amber-200/90 hover:text-amber-100 hover:border-amber-300/60 hover:bg-white/[0.06] transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Game
            </button>
          </div>
          <div
            className="absolute top-11 right-0 rounded-xl px-3 py-2 text-left"
            style={{
              background: 'rgba(3, 7, 6, 0.55)',
              boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.25)',
            }}
          >
            <div className="text-[9px] tracking-[0.28em] uppercase text-amber-300/70">Blind Timer</div>
            <div className="text-xs text-amber-100 font-semibold mt-0.5">
              SB/BB: {currentSmallBlind}/{currentBigBlind}
            </div>
            <div className="text-[11px] text-emerald-100/90 mt-0.5">다음 인상: {blindTimerLabel}</div>
            <div className="text-[10px] text-emerald-100/70">
              다음 {nextSmallBlind}/{nextBigBlind}
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="hidden sm:block h-px w-16 bg-gradient-to-r from-transparent to-amber-500/60" />
            <h1
              className="text-5xl font-serif tracking-[0.18em] uppercase"
              style={{
                backgroundImage:
                  'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 1px 0 rgba(0,0,0,0.35)',
              }}
            >
              Texas Hold'em
            </h1>
            <div className="hidden sm:block h-px w-16 bg-gradient-to-l from-transparent to-amber-500/60" />
          </div>
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-[10px] tracking-[0.5em] text-amber-200/60 uppercase">
              Premium Poker Club
            </span>
          </div>
          <p className="text-emerald-100/80 text-sm tracking-wide">{message}</p>
        </div>

        {/* Game Table */}
        <div className="relative max-w-5xl mx-auto mb-8">
          {/* Oval Table */}
          <div className="relative" style={{ paddingBottom: '58%' }}>
            {/* Outer ambient glow */}
            <div
              className="absolute -inset-6 rounded-[999px] blur-2xl opacity-60 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 70%)',
              }}
            />

            {/* Table Border (Rail) - mahogany wood */}
            <div
              className="absolute inset-0 rounded-[999px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
              style={{
                background:
                  'radial-gradient(ellipse at center, #3a1a0c 0%, #2a1208 60%, #150804 100%)',
                boxShadow:
                  '0 30px 80px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(245,158,11,0.25), inset 0 -2px 8px rgba(0,0,0,0.6)',
              }}
            >
              {/* Gold inner ring on rail */}
              <div
                className="absolute inset-3 rounded-[999px] pointer-events-none"
                style={{
                  boxShadow:
                    'inset 0 0 0 1px rgba(245,158,11,0.35), inset 0 0 30px rgba(0,0,0,0.5)',
                }}
              />

              {/* Table Felt */}
              <div
                className="absolute inset-8 rounded-[999px]"
                style={{
                  background:
                    'radial-gradient(ellipse at center, #1a6b4d 0%, #115239 55%, #0a3a28 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(245,158,11,0.25), inset 0 0 80px rgba(0,0,0,0.55)',
                }}
              >
                {/* Subtle felt texture overlay */}
                <div
                  className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.4) 0px, transparent 1.5px), radial-gradient(circle at 75% 60%, rgba(0,0,0,0.4) 0px, transparent 1.5px)',
                    backgroundSize: '4px 4px, 4px 4px',
                  }}
                />

                {/* Center monogram */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span
                    className="font-serif text-[7rem] leading-none opacity-[0.06] select-none"
                    style={{ color: '#fde68a' }}
                  >
                    ♠
                  </span>
                </div>

                {/* Community Cards + Pot */}
                <div className="absolute top-[28%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-10">
                  {/* Pot Display */}
                  <div
                    className="relative px-5 py-1.5 rounded-full text-[11px] tracking-[0.3em] uppercase font-semibold"
                    style={{
                      background:
                        'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                      color: '#1c1917',
                      boxShadow:
                        '0 8px 20px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.25)',
                    }}
                  >
                    Pot · {pot.toLocaleString()}
                  </div>

                  {/* Cards */}
                  <div className="flex gap-2 min-h-[6rem] items-center">
                    {communityCards.length > 0 ? (
                      communityCards.map((card, idx) => {
                        const isRed = card.suit === '♥' || card.suit === '♦';
                        return (
                          <div
                            key={idx}
                            className="relative w-[4.25rem] h-[6rem] rounded-lg overflow-hidden"
                            style={{
                              background:
                                'linear-gradient(180deg, #fafaf9 0%, #e7e5e4 100%)',
                              boxShadow:
                                '0 10px 24px -8px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.08)',
                              animation: 'cardIn 280ms ease-out both',
                              animationDelay: `${idx * 60}ms`,
                            }}
                          >
                            <div
                              className={`absolute top-1 left-1.5 leading-none font-semibold ${
                                isRed ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              <div className="text-sm">{card.rank}</div>
                              <div className="text-[11px]">{card.suit}</div>
                            </div>
                            <div
                              className={`absolute inset-0 flex items-center justify-center text-3xl ${
                                isRed ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {card.suit}
                            </div>
                            <div
                              className={`absolute bottom-1 right-1.5 leading-none font-semibold rotate-180 ${
                                isRed ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              <div className="text-sm">{card.rank}</div>
                              <div className="text-[11px]">{card.suit}</div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-amber-100/40 text-[11px] tracking-[0.4em] uppercase">
                        Community
                      </div>
                    )}
                  </div>
                </div>

                {/* Players positioned around the table */}
                {players.map((player, idx) => {
                  const angle = (idx / totalPlayers) * Math.PI * 2 + Math.PI / 2;
                  const radiusX = 56;
                  const radiusY = 51;
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);
                  const isActive = idx === currentPlayerIndex && !player.folded;

                  return (
                    <div
                      key={player.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                      }}
                    >
                      <div
                        className={`relative px-1 py-1 transition-all duration-300 ${
                          isActive ? 'scale-[1.04]' : ''
                        } ${player.folded ? 'opacity-55 grayscale' : ''}`}
                      >
                        {/* Player Info */}
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Users className="w-3 h-3 text-amber-300/80 shrink-0" />
                            <span className="text-slate-100 text-sm font-semibold tracking-wide truncate">
                              {player.name}
                            </span>
                          </div>
                        </div>

                        {/* Chips */}
                        <div className="flex items-center justify-center mb-0.5 pl-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full"
                              style={{
                                background:
                                  'radial-gradient(circle at 30% 30%, #fde68a, #b45309 70%)',
                                boxShadow:
                                  'inset 0 0 0 1px rgba(0,0,0,0.4)',
                              }}
                            />
                            <span className="text-amber-100/90 text-sm font-mono tabular-nums">
                              {player.chips.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Folded Status */}
                        {player.folded && (
                          <div className="mt-0.5 flex items-center justify-center pointer-events-none">
                            <span className="text-[9px] tracking-[0.35em] text-rose-300/90 font-bold uppercase">
                              Fold
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Player hole cards: always inside table */}
                {players.map((player, idx) => {
                  const angle = (idx / totalPlayers) * Math.PI * 2 + Math.PI / 2;
                  const radiusX = 56;
                  const radiusY = 51;
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);
                  const cardOffset = 14;
                  const cardX = x - cardOffset * Math.cos(angle);
                  const cardY = y - cardOffset * Math.sin(angle);
                  const isRedCard = (suit: string) => suit === '♥' || suit === '♦';

                  return (
                    <div
                      key={`cards-${player.id}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                      style={{
                        left: `${cardX}%`,
                        top: `${cardY}%`,
                      }}
                    >
                      <div className="flex gap-1 justify-center">
                        {player.cards.map((card, cardIdx) => {
                          const showFace = !player.isAI || showCards;
                          return (
                            <div
                              key={cardIdx}
                              className="relative w-9 h-[3.25rem] rounded-md overflow-hidden"
                              style={
                                showFace
                                  ? {
                                      background:
                                        'linear-gradient(180deg, #fafaf9 0%, #e7e5e4 100%)',
                                      boxShadow:
                                        '0 4px 10px -2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.1)',
                                    }
                                  : {
                                      background:
                                        'linear-gradient(135deg, #1e3a8a 0%, #0c1e54 100%)',
                                      boxShadow:
                                        '0 4px 10px -2px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(245,158,11,0.4)',
                                    }
                              }
                            >
                              {showFace ? (
                                <>
                                  <div
                                    className={`absolute top-0.5 left-1 leading-none font-bold ${
                                      isRedCard(card.suit) ? 'text-rose-600' : 'text-slate-900'
                                    }`}
                                  >
                                    <div className="text-[10px]">{card.rank}</div>
                                    <div className="text-[9px]">{card.suit}</div>
                                  </div>
                                  <div
                                    className={`absolute inset-0 flex items-center justify-center text-base ${
                                      isRedCard(card.suit) ? 'text-rose-600' : 'text-slate-900'
                                    }`}
                                  >
                                    {card.suit}
                                  </div>
                                </>
                              ) : (
                                <div
                                  className="absolute inset-0.5 rounded-[3px]"
                                  style={{
                                    backgroundImage:
                                      'repeating-linear-gradient(45deg, rgba(245,158,11,0.18) 0px, rgba(245,158,11,0.18) 2px, transparent 2px, transparent 6px), repeating-linear-gradient(-45deg, rgba(245,158,11,0.18) 0px, rgba(245,158,11,0.18) 2px, transparent 2px, transparent 6px)',
                                  }}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-amber-200/70 text-xs font-serif">♠</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Dealer / Blind button on table */}
                {players.length > 0 && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-all duration-700 ease-in-out"
                    style={dealerButtonPosition}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wide"
                      style={{
                        background:
                          'radial-gradient(circle at 30% 30%, #fef3c7 0%, #f59e0b 55%, #b45309 100%)',
                        color: '#1c1917',
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.65), 0 6px 14px -4px rgba(0,0,0,0.6), 0 0 0 1px rgba(120,53,15,0.35)',
                      }}
                      title="Dealer / Blind Button"
                    >
                      D
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        {gamePhase === 'setup' ? (
          <div
            className="rounded-2xl p-7 backdrop-blur-md max-w-2xl mx-auto"
            style={{
              background:
                'linear-gradient(180deg, rgba(15,23,20,0.7) 0%, rgba(8,14,12,0.85) 100%)',
              boxShadow:
                '0 0 0 1px rgba(245,158,11,0.2), 0 20px 50px -20px rgba(0,0,0,0.7)',
            }}
          >
            <div className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-[10px] tracking-[0.4em] text-amber-300/70 uppercase mb-1">
                  Table Setup
                </p>
                <h3 className="text-2xl font-serif tracking-wide text-amber-100">
                  AI 플레이어 수 선택
                </h3>
                <p className="text-emerald-100/60 text-xs mt-1.5">
                  총 플레이어 · <span className="text-amber-200">{numAIPlayers + 1}</span> 명
                  <span className="opacity-60"> (본인 포함)</span>
                </p>
              </div>
              <div className="grid grid-cols-5 gap-2.5 max-w-xl mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  const selected = numAIPlayers === num;
                  return (
                    <button
                      key={num}
                      onClick={() => setNumAIPlayers(num)}
                      className="relative w-14 h-14 rounded-full font-serif text-lg transition-all duration-200 hover:-translate-y-0.5"
                      style={
                        selected
                          ? {
                              background:
                                'radial-gradient(circle at 30% 30%, #fde68a, #b45309 75%)',
                              color: '#1c1917',
                              boxShadow:
                                'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 18px -6px rgba(245,158,11,0.7), 0 0 0 1px rgba(245,158,11,0.6)',
                            }
                          : {
                              background:
                                'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                              color: '#e7e5e4',
                              boxShadow:
                                'inset 0 0 0 1px rgba(245,158,11,0.18)',
                            }
                      }
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => initGame(numAIPlayers)}
                className="holdem-shimmer mt-1 mx-auto block rounded-full px-10 py-3.5 text-xs tracking-[0.35em] uppercase font-semibold transition-transform hover:-translate-y-0.5"
                style={{
                  background:
                    'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                  color: '#1c1917',
                  boxShadow:
                    '0 10px 24px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.55)',
                }}
              >
                Deal Me In
              </button>
            </div>
          </div>
        ) : gamePhase === 'betting' ? (
          <div className="flex justify-center">
            <button
              onClick={startNewRound}
              className="holdem-shimmer rounded-full px-12 py-4 text-xs tracking-[0.35em] uppercase font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                color: '#1c1917',
                boxShadow:
                  '0 10px 24px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.55)',
              }}
            >
              Start Round
            </button>
          </div>
        ) : gamePhase === 'game-over' ? (
          <div className="flex justify-center">
            <button
              onClick={startSetup}
              className="holdem-shimmer rounded-full px-12 py-4 text-xs tracking-[0.35em] uppercase font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                background:
                  'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                color: '#1c1917',
                boxShadow:
                  '0 10px 24px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.55)',
              }}
            >
              New Match
            </button>
          </div>
        ) : (
          gamePhase !== 'showdown' &&
          isHumanTurn && (
            <div
              className="rounded-2xl p-6 backdrop-blur-md max-w-3xl mx-auto"
              style={{
                background:
                  'linear-gradient(180deg, rgba(15,23,20,0.7) 0%, rgba(8,14,12,0.85) 100%)',
                boxShadow:
                  '0 0 0 1px rgba(245,158,11,0.2), 0 20px 50px -20px rgba(0,0,0,0.7)',
              }}
            >
              <div className="flex flex-col gap-5">
                <div className="flex gap-3 justify-center flex-wrap">
                  <button
                    onClick={() => playerAction('fold')}
                    className="rounded-full px-7 py-3 text-xs tracking-[0.3em] uppercase font-semibold text-rose-100 transition-all hover:-translate-y-0.5"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(159,18,57,0.25) 0%, rgba(76,5,25,0.4) 100%)',
                      boxShadow:
                        'inset 0 0 0 1px rgba(244,63,94,0.45), 0 8px 20px -10px rgba(244,63,94,0.4)',
                    }}
                  >
                    Fold
                  </button>
                  <button
                    onClick={() => playerAction('call')}
                    disabled={!!humanPlayer && humanPlayer.chips < callAmount}
                    className="rounded-full px-7 py-3 text-xs tracking-[0.3em] uppercase font-semibold text-sky-100 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(14,116,144,0.25) 0%, rgba(8,47,73,0.4) 100%)',
                      boxShadow:
                        'inset 0 0 0 1px rgba(56,189,248,0.45), 0 8px 20px -10px rgba(56,189,248,0.4)',
                    }}
                  >
                    {callAmount === 0 ? 'Check' : `Call · ${callAmount}`}
                  </button>
                  <button
                    onClick={() => playerAction('raise', raiseAmount)}
                    disabled={!!humanPlayer && humanPlayer.chips < raiseAmount}
                    className="holdem-shimmer rounded-full px-8 py-3 text-xs tracking-[0.3em] uppercase font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{
                      background:
                        'linear-gradient(180deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
                      color: '#1c1917',
                      boxShadow:
                        '0 10px 24px -8px rgba(245,158,11,0.7), inset 0 1px 0 rgba(255,255,255,0.55)',
                    }}
                  >
                    Raise · {raiseAmount}
                  </button>
                </div>

                <div className="flex items-center gap-4 justify-center flex-wrap">
                  <label className="text-[10px] tracking-[0.35em] uppercase text-amber-200/70">
                    Raise
                  </label>
                  <input
                    type="range"
                    min={currentBet + currentBigBlind}
                    max={humanPlayer?.chips || 1000}
                    step={currentBigBlind}
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="holdem-range w-56"
                    style={
                      {
                        '--val': `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((raiseAmount - (currentBet + currentBigBlind)) /
                              Math.max(
                                1,
                                (humanPlayer?.chips || 1000) -
                                  (currentBet + currentBigBlind)
                              )) *
                              100
                          )
                        )}%`,
                      } as React.CSSProperties
                    }
                  />
                  <input
                    type="number"
                    min={currentBet + currentBigBlind}
                    max={humanPlayer?.chips || 1000}
                    step={currentBigBlind}
                    value={raiseAmount}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      const maxValue = humanPlayer?.chips || 1000;
                      const minValue = currentBet + currentBigBlind;
                      if (value <= maxValue && value >= minValue) {
                        setRaiseAmount(value);
                      }
                    }}
                    className="w-24 bg-white/[0.04] text-amber-100 px-3 py-1.5 rounded-md border border-amber-400/30 font-mono text-center text-sm focus:outline-none focus:border-amber-300/60 focus:bg-white/[0.06] transition-all"
                  />
                </div>
              </div>
            </div>
          )
        )}

        {/* Bottom Actions */}
        <div className="flex gap-3 justify-center mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] backdrop-blur-sm px-5 py-2 text-xs tracking-[0.25em] uppercase text-slate-200/80 hover:text-white hover:border-white/30 hover:bg-white/[0.06] transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
