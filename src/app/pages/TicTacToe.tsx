import { useState } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw } from 'lucide-react';

type Player = 'X' | 'O';
type Board = (Player | null)[];

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export default function TicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);

  const checkWinner = (board: Board): Player | 'Draw' | null => {
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every((cell) => cell !== null)) {
      return 'Draw';
    }
    return null;
  };

  const handleClick = (index: number) => {
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-cyan-900 to-blue-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">틱택토</h1>
          <p className="text-cyan-200">3개를 먼저 연결하세요!</p>
        </div>

        {/* Game Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          {winner ? (
            <div className="text-center">
              <p className="text-2xl font-bold text-white mb-2">
                {winner === 'Draw' ? '무승부!' : `${winner} 승리!`}
              </p>
              <button
                onClick={resetGame}
                className="flex items-center gap-2 mx-auto bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                다시 시작
              </button>
            </div>
          ) : (
            <p className="text-xl text-center text-white">
              현재 플레이어: <span className="font-bold text-cyan-300">{currentPlayer}</span>
            </p>
          )}
        </div>

        {/* Game Board */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
          <div className="grid grid-cols-3 gap-3">
            {board.map((cell, index) => (
              <button
                key={index}
                onClick={() => handleClick(index)}
                className="aspect-square bg-white/20 hover:bg-white/30 rounded-xl border-2 border-white/40 flex items-center justify-center text-5xl font-bold transition-all hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed"
                disabled={!!cell || !!winner}
              >
                {cell === 'X' && <span className="text-cyan-400">X</span>}
                {cell === 'O' && <span className="text-pink-400">O</span>}
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
            onClick={resetGame}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>
    </div>
  );
}
