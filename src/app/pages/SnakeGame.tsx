import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Position {
  x: number;
  y: number;
}

const GRID_SIZE = 20;
const INITIAL_SNAKE: Position[] = [
  { x: 10, y: 10 },
  { x: 10, y: 11 },
  { x: 10, y: 12 },
];

export default function SnakeGame() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Position>({ x: 5, y: 5 });
  const [direction, setDirection] = useState<Direction>('UP');
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const generateFood = useCallback((snakeBody: Position[]) => {
    let newFood: Position;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (snakeBody.some((segment) => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setFood({ x: 5, y: 5 });
    setDirection('UP');
    setIsGameOver(false);
    setScore(0);
    setIsPlaying(true);
  };

  const moveSnake = useCallback(() => {
    if (isGameOver || !isPlaying) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      let newHead: Position;

      switch (direction) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (
        newHead.x < 0 ||
        newHead.x >= GRID_SIZE ||
        newHead.y < 0 ||
        newHead.y >= GRID_SIZE
      ) {
        setIsGameOver(true);
        setIsPlaying(false);
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setIsGameOver(true);
        setIsPlaying(false);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((prev) => prev + 10);
        setFood(generateFood(newSnake));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, isGameOver, isPlaying, generateFood]);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(moveSnake, 150);
    return () => clearInterval(interval);
  }, [moveSnake, isPlaying]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying) return;

      switch (e.key) {
        case 'ArrowUp':
          if (direction !== 'DOWN') setDirection('UP');
          break;
        case 'ArrowDown':
          if (direction !== 'UP') setDirection('DOWN');
          break;
        case 'ArrowLeft':
          if (direction !== 'RIGHT') setDirection('LEFT');
          break;
        case 'ArrowRight':
          if (direction !== 'LEFT') setDirection('RIGHT');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [direction, isPlaying]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-green-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">스네이크 게임</h1>
          <p className="text-emerald-200">화살표 키로 뱀을 조종하세요!</p>
        </div>

        {/* Game Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center">
            <div className="text-white">
              <p className="text-lg">점수</p>
              <p className="text-3xl font-bold text-emerald-300">{score}</p>
            </div>
            {isGameOver && (
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg border border-red-400">
                <Trophy className="w-6 h-6 text-red-400" />
                <div className="text-white">
                  <p className="font-bold">게임 오버!</p>
                  <p className="text-sm">최종 점수: {score}</p>
                </div>
              </div>
            )}
            {!isPlaying && !isGameOver && (
              <button
                onClick={resetGame}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                시작하기
              </button>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div
            className="bg-black/40 rounded-lg grid gap-0"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
              aspectRatio: '1',
            }}
          >
            {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, index) => {
              const x = index % GRID_SIZE;
              const y = Math.floor(index / GRID_SIZE);
              const isSnake = snake.some((segment) => segment.x === x && segment.y === y);
              const isHead = snake[0].x === x && snake[0].y === y;
              const isFood = food.x === x && food.y === y;

              return (
                <div
                  key={index}
                  className={`border border-white/5 ${
                    isHead
                      ? 'bg-emerald-400'
                      : isSnake
                      ? 'bg-emerald-500'
                      : isFood
                      ? 'bg-red-500 rounded-full'
                      : ''
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20 md:hidden">
          <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
            <div></div>
            <button
              onClick={() => direction !== 'DOWN' && setDirection('UP')}
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg flex items-center justify-center"
              disabled={!isPlaying}
            >
              <ArrowUp className="w-6 h-6 text-white" />
            </button>
            <div></div>
            <button
              onClick={() => direction !== 'RIGHT' && setDirection('LEFT')}
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg flex items-center justify-center"
              disabled={!isPlaying}
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={() => direction !== 'UP' && setDirection('DOWN')}
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg flex items-center justify-center"
              disabled={!isPlaying}
            >
              <ArrowDown className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={() => direction !== 'LEFT' && setDirection('RIGHT')}
              className="bg-white/20 hover:bg-white/30 p-4 rounded-lg flex items-center justify-center"
              disabled={!isPlaying}
            >
              <ArrowRight className="w-6 h-6 text-white" />
            </button>
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
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
          >
            <RotateCcw className="w-4 h-4" />
            새 게임
          </button>
        </div>
      </div>
    </div>
  );
}
