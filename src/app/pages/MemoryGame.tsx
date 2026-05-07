import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw, Trophy } from 'lucide-react';

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const emojis = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎺', '🎸'];

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [isWon, setIsWon] = useState(false);

  useEffect(() => {
    initializeGame();
  }, []);

  const initializeGame = () => {
    const shuffledCards = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffledCards);
    setFlippedCards([]);
    setMoves(0);
    setIsWon(false);
  };

  const handleCardClick = (id: number) => {
    if (
      flippedCards.length === 2 ||
      flippedCards.includes(id) ||
      cards[id].isMatched
    ) {
      return;
    }

    const newFlippedCards = [...flippedCards, id];
    setFlippedCards(newFlippedCards);

    const newCards = [...cards];
    newCards[id].isFlipped = true;
    setCards(newCards);

    if (newFlippedCards.length === 2) {
      setMoves(moves + 1);
      const [firstId, secondId] = newFlippedCards;

      if (newCards[firstId].emoji === newCards[secondId].emoji) {
        newCards[firstId].isMatched = true;
        newCards[secondId].isMatched = true;
        setCards(newCards);
        setFlippedCards([]);

        if (newCards.every((card) => card.isMatched)) {
          setIsWon(true);
        }
      } else {
        setTimeout(() => {
          newCards[firstId].isFlipped = false;
          newCards[secondId].isFlipped = false;
          setCards([...newCards]);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">메모리 게임</h1>
          <p className="text-pink-200">같은 카드를 찾아보세요!</p>
        </div>

        {/* Game Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <p className="text-lg">이동 횟수</p>
              <p className="text-3xl font-bold text-pink-300">{moves}</p>
            </div>
            {isWon && (
              <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-400">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div className="text-white">
                  <p className="font-bold">승리!</p>
                  <p className="text-sm">{moves} 이동</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-4 gap-3">
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card.id)}
                className={`aspect-square rounded-xl text-5xl flex items-center justify-center transition-all transform ${
                  card.isFlipped || card.isMatched
                    ? 'bg-white/90 scale-105'
                    : 'bg-white/20 hover:bg-white/30 hover:scale-105'
                } ${card.isMatched ? 'opacity-70' : ''}`}
                disabled={card.isFlipped || card.isMatched}
              >
                {card.isFlipped || card.isMatched ? card.emoji : '❓'}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
          <button
            onClick={initializeGame}
            className="flex items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <RotateCcw className="w-4 h-4" />
            새 게임
          </button>
        </div>
      </div>
    </div>
  );
}
