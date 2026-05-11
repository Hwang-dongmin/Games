import { useState, useEffect } from 'react';
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
} from '../utils/poker';

type GamePhase = 'betting' | 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'game-over' | 'setup';

const INITIAL_CHIPS = 1000;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

export default function TexasHoldem() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<Card[]>([]);
  const [communityCards, setCommunityCards] = useState<Card[]>([]);
  const [pot, setPot] = useState(0);
  const [currentBet, setCurrentBet] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [dealerIndex, setDealerIndex] = useState(0);
  const [message, setMessage] = useState('AI 플레이어 수를 선택하세요!');
  const [raiseAmount, setRaiseAmount] = useState(BIG_BLIND * 2);
  const [showCards, setShowCards] = useState(false);
  const [numAIPlayers, setNumAIPlayers] = useState(3);
  const [showRules, setShowRules] = useState(false);
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  // 게임 초기화
  const initGame = (aiCount: number = numAIPlayers) => {
    const newPlayers: Player[] = [
      { id: 0, name: '플레이어', chips: INITIAL_CHIPS, cards: [], currentBet: 0, folded: false, isAI: false },
    ];

    for (let i = 0; i < aiCount; i++) {
      newPlayers.push({
        id: i + 1,
        name: `AI ${i + 1}`,
        chips: INITIAL_CHIPS,
        cards: [],
        currentBet: 0,
        folded: false,
        isAI: true,
      });
    }

    setPlayers(newPlayers);
    setCommunityCards([]);
    setPot(0);
    setCurrentBet(0);
    setGamePhase('betting');
    setMessage('게임을 시작하세요!');
    setShowCards(false);
  };

  const startSetup = () => {
    setGamePhase('setup');
    setPlayers([]);
    setMessage('AI 플레이어 수를 선택하세요!');
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

      if (activeIdx === sbIndex) bet = Math.min(SMALL_BLIND, p.chips);
      if (activeIdx === bbIndex) bet = Math.min(BIG_BLIND, p.chips);

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
    setCurrentBet(BIG_BLIND);
    setGamePhase('pre-flop');
    setCurrentPlayerIndex((newDealerIndex + 3) % activePlayers.length);
    setDealerIndex(newDealerIndex);
    setMessage('프리플랍: 베팅을 시작하세요.');
    setRaiseAmount(BIG_BLIND * 2);
    setShowCards(false);
  };

  // 플레이어 액션
  const playerAction = (action: 'fold' | 'call' | 'raise', amount?: number) => {
    if (gamePhase === 'betting' || gamePhase === 'game-over') return;

    const player = players[currentPlayerIndex];
    if (!player || player.folded) return;

    const updatedPlayers = [...players];
    const currentPlayer = updatedPlayers[currentPlayerIndex];

    if (action === 'fold') {
      currentPlayer.folded = true;
      setMessage(`${currentPlayer.name}이(가) 폴드했습니다.`);
    } else if (action === 'call') {
      const callAmount = Math.min(currentBet - currentPlayer.currentBet, currentPlayer.chips);
      currentPlayer.chips -= callAmount;
      currentPlayer.currentBet += callAmount;
      setPot(prev => prev + callAmount);
      setMessage(`${currentPlayer.name}이(가) ${callAmount} 콜했습니다.`);
    } else if (action === 'raise' && amount) {
      const raiseTotal = Math.min(amount, currentPlayer.chips + currentPlayer.currentBet);
      const addAmount = raiseTotal - currentPlayer.currentBet;
      currentPlayer.chips -= addAmount;
      currentPlayer.currentBet = raiseTotal;
      setPot(prev => prev + addAmount);
      setCurrentBet(raiseTotal);
      setMessage(`${currentPlayer.name}이(가) ${raiseTotal}로 레이즈했습니다.`);
    }

    setPlayers(updatedPlayers);
    moveToNextPlayer();
  };

  // 다음 플레이어로 이동
  const moveToNextPlayer = () => {
    const activePlayers = players.filter(p => !p.folded && p.chips >= 0);
    if (activePlayers.length <= 1) {
      endRound();
      return;
    }

    let nextIndex = (currentPlayerIndex + 1) % players.length;
    while (players[nextIndex].folded || players[nextIndex].chips === 0) {
      nextIndex = (nextIndex + 1) % players.length;
    }

    // 베팅 라운드 종료 체크
    const allBetsEqual = activePlayers.every(p => p.currentBet === currentBet || p.chips === 0);
    if (allBetsEqual && nextIndex === dealerIndex) {
      moveToNextPhase();
      return;
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
    setCurrentPlayerIndex((dealerIndex + 1) % players.length);
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
        const amount = getAIRaiseAmount(currentPlayer, currentBet, BIG_BLIND);
        playerAction('raise', amount);
      } else {
        playerAction(decision);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentPlayerIndex, gamePhase]);

  useEffect(() => {
    // Start with setup phase
  }, []);

  const humanPlayer = players.find(p => !p.isAI);
  const isHumanTurn = players[currentPlayerIndex] && !players[currentPlayerIndex].isAI && !players[currentPlayerIndex].folded;
  const callAmount = humanPlayer ? currentBet - humanPlayer.currentBet : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 p-4">
      {/* New Game Confirmation Modal */}
      {showNewGameConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-green-800 rounded-2xl max-w-md w-full border-4 border-amber-600">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-yellow-400 mb-4 text-center">
                새 게임 시작
              </h2>
              <p className="text-white text-center mb-6">
                정말로 새 게임을 시작하시겠습니까?<br />
                현재 진행 중인 게임이 초기화됩니다.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowNewGameConfirm(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    setShowNewGameConfirm(false);
                    startSetup();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-green-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border-4 border-amber-600">
            <div className="sticky top-0 bg-green-800 border-b border-amber-600 p-6 flex items-center justify-between">
              <h2 className="text-3xl font-bold text-yellow-400 flex items-center gap-2">
                <BookOpen className="w-8 h-8" />
                텍사스 홀덤 게임 규칙
              </h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-white hover:text-yellow-400 transition-colors"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-white">
              {/* Game Overview */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">게임 개요</h3>
                <p className="text-green-100 leading-relaxed">
                  텍사스 홀덤은 세계에서 가장 인기 있는 포커 게임입니다. 각 플레이어는 2장의 개인 카드를 받고, 5장의 커뮤니티 카드와 조합하여 최고의 5장 카드 조합을 만들어 승부를 겨룹니다.
                </p>
              </section>

              {/* Game Flow */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">게임 진행</h3>
                <ol className="space-y-3 list-decimal list-inside text-green-100">
                  <li><strong className="text-white">블라인드:</strong> 스몰 블라인드(10칩)와 빅 블라인드(20칩) 강제 베팅</li>
                  <li><strong className="text-white">프리플랍:</strong> 각자 2장의 카드를 받고 첫 베팅 라운드</li>
                  <li><strong className="text-white">플랍:</strong> 3장의 커뮤니티 카드 공개 후 베팅</li>
                  <li><strong className="text-white">턴:</strong> 4번째 커뮤니티 카드 공개 후 베팅</li>
                  <li><strong className="text-white">리버:</strong> 5번째 커뮤니티 카드 공개 후 마지막 베팅</li>
                  <li><strong className="text-white">쇼다운:</strong> 남은 플레이어들이 카드를 공개하고 승자 결정</li>
                </ol>
              </section>

              {/* Actions */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">플레이어 액션</h3>
                <ul className="space-y-2 text-green-100">
                  <li><strong className="text-white">폴드:</strong> 카드를 버리고 라운드에서 나감</li>
                  <li><strong className="text-white">체크:</strong> 베팅 없이 다음 플레이어에게 턴 넘김 (베팅이 없을 때만 가능)</li>
                  <li><strong className="text-white">콜:</strong> 현재 베팅 금액만큼 따라감</li>
                  <li><strong className="text-white">레이즈:</strong> 현재 베팅보다 더 높은 금액으로 베팅</li>
                </ul>
              </section>

              {/* Hand Rankings */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">핸드 랭킹 (높은 순)</h3>
                <div className="space-y-4">
                  {/* Royal Flush */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">1. 로얄 플러시</strong>
                      <span className="text-green-200 text-sm">같은 무늬 A-K-Q-J-10</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♠', 'K♠', 'Q♠', 'J♠', '10♠'].map((card, i) => (
                        <div key={i} className="w-10 h-14 bg-white rounded text-black flex items-center justify-center text-xs font-bold shadow">
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Straight Flush */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">2. 스트레이트 플러시</strong>
                      <span className="text-green-200 text-sm">같은 무늬의 연속된 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['9♥', '8♥', '7♥', '6♥', '5♥'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Four of a Kind */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">3. 포카드</strong>
                      <span className="text-green-200 text-sm">같은 숫자 4장</span>
                    </div>
                    <div className="flex gap-1">
                      {['K♠', 'K♥', 'K♦', 'K♣', 'A♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Full House */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">4. 풀하우스</strong>
                      <span className="text-green-200 text-sm">트리플 + 원페어</span>
                    </div>
                    <div className="flex gap-1">
                      {['Q♠', 'Q♥', 'Q♦', '8♣', '8♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Flush */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">5. 플러시</strong>
                      <span className="text-green-200 text-sm">같은 무늬 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♦', 'J♦', '9♦', '6♦', '3♦'].map((card, i) => (
                        <div key={i} className="w-10 h-14 bg-white rounded text-red-600 flex items-center justify-center text-xs font-bold shadow">
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Straight */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">6. 스트레이트</strong>
                      <span className="text-green-200 text-sm">연속된 숫자 5장</span>
                    </div>
                    <div className="flex gap-1">
                      {['10♠', '9♥', '8♦', '7♣', '6♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Three of a Kind */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">7. 트리플</strong>
                      <span className="text-green-200 text-sm">같은 숫자 3장</span>
                    </div>
                    <div className="flex gap-1">
                      {['J♠', 'J♥', 'J♦', 'A♣', '9♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two Pair */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">8. 투페어</strong>
                      <span className="text-green-200 text-sm">같은 숫자 2장씩 2개</span>
                    </div>
                    <div className="flex gap-1">
                      {['10♠', '10♥', '7♦', '7♣', 'K♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* One Pair */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">9. 원페어</strong>
                      <span className="text-green-200 text-sm">같은 숫자 2장</span>
                    </div>
                    <div className="flex gap-1">
                      {['9♠', '9♥', 'A♦', 'J♣', '4♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* High Card */}
                  <div className="bg-green-900/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <strong className="text-white">10. 하이카드</strong>
                      <span className="text-green-200 text-sm">위의 조합이 없을 때 가장 높은 카드</span>
                    </div>
                    <div className="flex gap-1">
                      {['A♠', 'Q♥', '10♦', '7♣', '3♠'].map((card, i) => (
                        <div key={i} className={`w-10 h-14 bg-white rounded flex items-center justify-center text-xs font-bold shadow ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-black'}`}>
                          {card}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Tips */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">팁</h3>
                <ul className="space-y-2 text-green-100">
                  <li>• 좋은 핸드(높은 페어, 같은 무늬의 높은 카드)로 시작하세요</li>
                  <li>• 상대방의 베팅 패턴을 주의깊게 관찰하세요</li>
                  <li>• 약한 핸드로는 과도한 베팅을 피하세요</li>
                  <li>• 포지션이 중요합니다 - 늦게 행동할수록 유리합니다</li>
                  <li>• 블러핑도 전략이지만 신중하게 사용하세요</li>
                </ul>
              </section>

              {/* Starting Chips */}
              <section>
                <h3 className="text-2xl font-bold text-yellow-400 mb-3">게임 설정</h3>
                <ul className="space-y-2 text-green-100">
                  <li><strong className="text-white">시작 칩:</strong> 각 플레이어 1,000칩</li>
                  <li><strong className="text-white">스몰 블라인드:</strong> 10칩</li>
                  <li><strong className="text-white">빅 블라인드:</strong> 20칩</li>
                  <li><strong className="text-white">플레이어:</strong> 최대 10명 (플레이어 1명 + AI 최대 9명)</li>
                </ul>
              </section>
            </div>

            <div className="sticky bottom-0 bg-green-800 border-t border-amber-600 p-6">
              <button
                onClick={() => setShowRules(false)}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-4 rounded-lg font-bold text-xl transition-colors"
              >
                게임으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-4xl font-bold text-white">텍사스 홀덤</h1>
            <button
              onClick={() => setShowRules(true)}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <BookOpen className="w-5 h-5" />
              게임 규칙
            </button>
          </div>
          <p className="text-green-200">{message}</p>
        </div>

        {/* Game Table */}
        <div className="relative max-w-5xl mx-auto mb-6">
          {/* Oval Table */}
          <div className="relative" style={{ paddingBottom: '60%' }}>
            {/* Table Border (Rail) */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-full shadow-2xl">
              {/* Table Felt */}
              <div className="absolute inset-8 bg-gradient-to-br from-green-700 via-green-600 to-green-700 rounded-full border-4 border-amber-900/50">
                {/* Community Cards */}
                <div className="absolute top-[30%] left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 z-10">
                  {/* Pot Display */}
                  <div className="bg-yellow-500 text-black px-5 py-1.5 rounded-full font-bold text-base shadow-lg">
                    팟: {pot} 칩
                  </div>

                  {/* Cards */}
                  <div className="flex gap-2">
                    {communityCards.length > 0 ? (
                      communityCards.map((card, idx) => (
                        <div
                          key={idx}
                          className={`w-16 h-24 bg-white rounded-lg shadow-xl flex flex-col items-center justify-center text-2xl font-bold border-2 border-gray-300 ${
                            card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'
                          }`}
                        >
                          <div>{card.rank}</div>
                          <div>{card.suit}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-white text-sm opacity-50">커뮤니티 카드 대기 중...</div>
                    )}
                  </div>
                </div>

                {/* Players positioned around the table */}
                {players.map((player, idx) => {
                  // Calculate position around the oval
                  const totalPlayers = players.length;
                  const angle = (idx / totalPlayers) * Math.PI * 2 - Math.PI / 2;
                  const radiusX = 45; // horizontal radius percentage
                  const radiusY = 38; // vertical radius percentage
                  const x = 50 + radiusX * Math.cos(angle);
                  const y = 50 + radiusY * Math.sin(angle);

                  return (
                    <div
                      key={player.id}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                        idx === currentPlayerIndex && !player.folded
                          ? 'scale-105'
                          : ''
                      }`}
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                      }}
                    >
                      <div
                        className={`bg-gradient-to-br from-gray-900 to-gray-800 backdrop-blur-sm rounded-xl p-3 border-3 shadow-xl min-w-[140px] ${
                          idx === currentPlayerIndex && !player.folded
                            ? 'border-yellow-400 shadow-yellow-400/50 ring-2 ring-yellow-400'
                            : 'border-amber-900'
                        } ${player.folded ? 'opacity-60' : ''}`}
                      >
                        {/* Player Info */}
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-3 h-3 text-yellow-400" />
                          <span className="text-white font-bold text-sm">{player.name}</span>
                          {idx === dealerIndex && (
                            <span className="bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full font-bold">D</span>
                          )}
                        </div>

                        {/* Chips */}
                        <div className="text-green-300 text-xs mb-2">
                          💰 {player.chips}
                          {player.currentBet > 0 && (
                            <div className="text-yellow-300">베팅: {player.currentBet}</div>
                          )}
                        </div>

                        {/* Player Cards */}
                        <div className="flex gap-1 justify-center">
                          {player.cards.map((card, cardIdx) => (
                            <div
                              key={cardIdx}
                              className={`w-10 h-14 rounded text-xs ${
                                !player.isAI || showCards
                                  ? `bg-white ${card.suit === '♥' || card.suit === '♦' ? 'text-red-600' : 'text-black'} flex flex-col items-center justify-center font-bold shadow-lg`
                                  : 'bg-red-800 border-2 border-red-900 relative overflow-hidden'
                              }`}
                            >
                              {!player.isAI || showCards ? (
                                <>
                                  <div className="text-xs">{card.rank}</div>
                                  <div className="text-sm">{card.suit}</div>
                                </>
                              ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center">
                                  <div className="text-white text-2xl opacity-30">♠</div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Folded Status */}
                        {player.folded && (
                          <div className="text-red-400 text-xs mt-2 font-bold text-center opacity-100">
                            FOLD
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        {gamePhase === 'setup' ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col gap-4">
              <h3 className="text-white text-xl font-bold text-center">AI 플레이어 수 선택</h3>
              <p className="text-green-200 text-sm text-center">총 플레이어: {numAIPlayers + 1}명 (본인 포함)</p>
              <div className="grid grid-cols-5 gap-3 max-w-2xl mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    onClick={() => setNumAIPlayers(num)}
                    className={`w-16 h-16 rounded-lg font-bold text-xl transition-colors ${
                      numAIPlayers === num
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  initGame(numAIPlayers);
                }}
                className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-xl transition-colors"
              >
                게임 설정 완료
              </button>
            </div>
          </div>
        ) : gamePhase === 'betting' ? (
          <div className="flex gap-4 justify-center">
            <button
              onClick={startNewRound}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-xl transition-colors"
            >
              게임 시작
            </button>
          </div>
        ) : gamePhase === 'game-over' ? (
          <div className="flex gap-4 justify-center">
            <button
              onClick={startSetup}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-bold text-xl transition-colors"
            >
              새 게임
            </button>
          </div>
        ) : gamePhase !== 'showdown' && isHumanTurn && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => playerAction('fold')}
                  className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-lg font-bold transition-colors"
                >
                  폴드
                </button>
                <button
                  onClick={() => playerAction('call')}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-bold transition-colors"
                  disabled={humanPlayer && humanPlayer.chips < callAmount}
                >
                  {callAmount === 0 ? '체크' : `콜 (${callAmount})`}
                </button>
                <button
                  onClick={() => playerAction('raise', raiseAmount)}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-bold transition-colors"
                  disabled={humanPlayer && humanPlayer.chips < raiseAmount}
                >
                  레이즈 ({raiseAmount})
                </button>
              </div>

              <div className="flex items-center gap-4 justify-center flex-wrap">
                <label className="text-white">레이즈 금액:</label>
                <input
                  type="range"
                  min={currentBet + BIG_BLIND}
                  max={humanPlayer?.chips || 1000}
                  step={BIG_BLIND}
                  value={raiseAmount}
                  onChange={(e) => setRaiseAmount(Number(e.target.value))}
                  className="w-48"
                />
                <input
                  type="number"
                  min={currentBet + BIG_BLIND}
                  max={humanPlayer?.chips || 1000}
                  step={BIG_BLIND}
                  value={raiseAmount}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    const maxValue = humanPlayer?.chips || 1000;
                    const minValue = currentBet + BIG_BLIND;
                    if (value <= maxValue && value >= minValue) {
                      setRaiseAmount(value);
                    }
                  }}
                  className="w-24 bg-white/20 text-white px-3 py-2 rounded-lg border border-white/30 font-bold text-center"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex gap-4 justify-center mt-6">
          <Link
            to="/"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
          <button
            onClick={() => {
              if (gamePhase === 'setup' || gamePhase === 'betting') {
                startSetup();
              } else {
                setShowNewGameConfirm(true);
              }
            }}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            새 게임
          </button>
        </div>
      </div>
    </div>
  );
}
