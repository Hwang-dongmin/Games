import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Home, RotateCcw, Trophy, Undo, FolderOpen } from 'lucide-react';

type Grid = number[][];

const GRID_SIZE = 4;

const TILE_COLORS: { [key: number]: string } = {
  2: 'bg-yellow-200 text-gray-800',
  4: 'bg-yellow-300 text-gray-800',
  8: 'bg-orange-400 text-white',
  16: 'bg-orange-500 text-white',
  32: 'bg-orange-600 text-white',
  64: 'bg-red-500 text-white',
  128: 'bg-red-600 text-white',
  256: 'bg-red-700 text-white',
  512: 'bg-yellow-500 text-white',
  1024: 'bg-yellow-600 text-white',
  2048: 'bg-yellow-700 text-white',
};

export default function Game2048() {
  const [grid, setGrid] = useState<Grid>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [history, setHistory] = useState<{ grid: Grid; score: number }[]>([]);
  const [hasPreviousGame, setHasPreviousGame] = useState(false);
  const [hasBestGame, setHasBestGame] = useState(false);
  const [showEnding, setShowEnding] = useState(false);
  const [highestTile, setHighestTile] = useState(0);

  useEffect(() => {
    // Load best score from localStorage
    const savedBestScore = localStorage.getItem('2048-best-score');
    if (savedBestScore) {
      setBestScore(parseInt(savedBestScore, 10));
    }

    // Check if there's a previous game saved
    const previousGame = localStorage.getItem('2048-previous-game-state');
    setHasPreviousGame(!!previousGame);

    // Check if there's a best game saved
    const bestGame = localStorage.getItem('2048-best-game-state');
    setHasBestGame(!!bestGame);

    // Load saved game state from localStorage
    const savedGameState = localStorage.getItem('2048-game-state');
    if (savedGameState) {
      try {
        const gameState = JSON.parse(savedGameState);
        setGrid(gameState.grid);
        setScore(gameState.score);
        setGameOver(gameState.gameOver || false);
        setWon(gameState.won || false);
        setHistory(gameState.history || []);
      } catch (e) {
        // If parsing fails, start a new game
        initializeGame();
      }
    } else {
      initializeGame();
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameOver) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          move('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          move('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          move('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          move('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [grid, gameOver]);

  // Touch event handling for mobile
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (gameOver) return;

      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    };

    const handleSwipe = () => {
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const minSwipeDistance = 30;

      // Determine if swipe is more horizontal or vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (Math.abs(deltaX) > minSwipeDistance) {
          if (deltaX > 0) {
            move('right');
          } else {
            move('left');
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > minSwipeDistance) {
          if (deltaY > 0) {
            move('down');
          } else {
            move('up');
          }
        }
      }
    };

    const gameBoard = document.getElementById('game-board');
    if (gameBoard) {
      gameBoard.addEventListener('touchstart', handleTouchStart);
      gameBoard.addEventListener('touchend', handleTouchEnd);

      return () => {
        gameBoard.removeEventListener('touchstart', handleTouchStart);
        gameBoard.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [grid, gameOver]);

  // Save game state whenever it changes
  useEffect(() => {
    if (grid.length > 0) {
      try {
        const gameState = {
          grid,
          score,
          gameOver,
          won,
          history,
        };
        localStorage.setItem('2048-game-state', JSON.stringify(gameState));
      } catch (e) {
        // If localStorage is full, clear old data and try again
        console.warn('localStorage is full, clearing old game data');
        try {
          localStorage.removeItem('2048-previous-game-state');
          const gameState = {
            grid,
            score,
            gameOver,
            won,
            history: history.slice(-10), // Keep only last 10 moves if storage is full
          };
          localStorage.setItem('2048-game-state', JSON.stringify(gameState));
        } catch (e2) {
          console.error('Failed to save game state:', e2);
        }
      }
    }
  }, [grid, score, gameOver, won, history]);

  const initializeGame = () => {
    // Save current game as previous game before starting new one
    if (grid.length > 0) {
      const currentGameState = {
        grid,
        score,
        gameOver,
        won,
        history,
      };
      localStorage.setItem('2048-previous-game-state', JSON.stringify(currentGameState));
      setHasPreviousGame(true);
    }

    const newGrid = Array(GRID_SIZE)
      .fill(null)
      .map(() => Array(GRID_SIZE).fill(0));
    addNewTile(newGrid);
    addNewTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setHistory([]);
    setShowEnding(false);
    setHighestTile(0);
  };

  const loadPreviousGame = () => {
    const previousGameState = localStorage.getItem('2048-previous-game-state');
    if (previousGameState) {
      try {
        const gameState = JSON.parse(previousGameState);
        setGrid(gameState.grid);
        setScore(gameState.score);
        setGameOver(gameState.gameOver || false);
        setWon(gameState.won || false);
        setHistory(gameState.history || []);
      } catch (e) {
        console.error('Failed to load previous game:', e);
      }
    }
  };

  const loadBestGame = () => {
    const bestGameState = localStorage.getItem('2048-best-game-state');
    if (bestGameState) {
      try {
        const gameState = JSON.parse(bestGameState);
        setGrid(gameState.grid);
        setScore(gameState.score);
        setGameOver(gameState.gameOver || false);
        setWon(gameState.won || false);
        setHistory(gameState.history || []);
      } catch (e) {
        console.error('Failed to load best game:', e);
      }
    }
  };

  const createTestBestGame = () => {
    // Create a game board matching the screenshot
    const testGrid: Grid = [
      [4, 2, 4, 2],
      [0, 64, 2, 8],
      [32, 64, 64, 128],
      [131072, 32768, 4096, 512]
    ];
    
    // Score from the screenshot
    const testScore = 2576400;
    const testBestScore = 2577004;
    
    const testGameState = {
      grid: testGrid,
      score: testScore,
      gameOver: false,
      won: true,
      history: [],
    };
    
    // Save as best game
    localStorage.setItem('2048-best-game-state', JSON.stringify(testGameState));
    localStorage.setItem('2048-best-score', testBestScore.toString());
    
    // Load the game
    setGrid(testGrid);
    setScore(testScore);
    setBestScore(testBestScore);
    setGameOver(false);
    setWon(true);
    setHistory([]);
    setHasBestGame(true);
  };

  const createTestPerfectGame = () => {
    // Create the theoretical perfect game board
    const testGrid: Grid = [
      [131072, 65536, 32768, 16384],
      [8192, 4096, 2048, 1024],
      [512, 256, 128, 64],
      [32, 16, 8, 4]
    ];
    
    // Theoretical maximum score
    const testScore = 3932156;
    
    const testGameState = {
      grid: testGrid,
      score: testScore,
      gameOver: true,
      won: true,
      history: [],
    };
    
    // Save as best game
    localStorage.setItem('2048-best-game-state', JSON.stringify(testGameState));
    localStorage.setItem('2048-best-score', testScore.toString());
    
    // Load the game and show ending
    setGrid(testGrid);
    setScore(testScore);
    setBestScore(testScore);
    setGameOver(true);
    setWon(true);
    setHistory([]);
    setHasBestGame(true);
    setHighestTile(131072);
    
    // Show ending after a short delay
    setTimeout(() => {
      setShowEnding(true);
    }, 500);
  };

  const addNewTile = (grid: Grid) => {
    const emptyTiles: [number, number][] = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (grid[i][j] === 0) {
          emptyTiles.push([i, j]);
        }
      }
    }

    if (emptyTiles.length > 0) {
      const [row, col] = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
      grid[row][col] = Math.random() < 0.9 ? 2 : 4;
    }
  };

  const move = (direction: 'up' | 'down' | 'left' | 'right') => {
    let newGrid = grid.map((row) => [...row]);
    let moved = false;
    let scoreIncrease = 0;

    const moveAndMerge = (line: number[]): [number[], number] => {
      let newLine = line.filter((val) => val !== 0);
      let points = 0;

      for (let i = 0; i < newLine.length - 1; i++) {
        if (newLine[i] === newLine[i + 1]) {
          newLine[i] *= 2;
          points += newLine[i];
          if (newLine[i] === 2048) {
            setWon(true);
          }
          newLine.splice(i + 1, 1);
        }
      }

      while (newLine.length < GRID_SIZE) {
        newLine.push(0);
      }

      return [newLine, points];
    };

    if (direction === 'left' || direction === 'right') {
      for (let i = 0; i < GRID_SIZE; i++) {
        let line = newGrid[i];
        if (direction === 'right') {
          line = line.reverse();
        }

        const [newLine, points] = moveAndMerge(line);
        scoreIncrease += points;

        if (direction === 'right') {
          newLine.reverse();
        }

        if (JSON.stringify(newGrid[i]) !== JSON.stringify(newLine)) {
          moved = true;
        }
        newGrid[i] = newLine;
      }
    } else {
      for (let j = 0; j < GRID_SIZE; j++) {
        let line = newGrid.map((row) => row[j]);
        if (direction === 'down') {
          line = line.reverse();
        }

        const [newLine, points] = moveAndMerge(line);
        scoreIncrease += points;

        if (direction === 'down') {
          newLine.reverse();
        }

        const oldLine = newGrid.map((row) => row[j]);
        if (JSON.stringify(oldLine) !== JSON.stringify(newLine)) {
          moved = true;
        }

        for (let i = 0; i < GRID_SIZE; i++) {
          newGrid[i][j] = newLine[i];
        }
      }
    }

    if (moved) {
      // Save current state to history before making the move (limit to last 100 moves)
      const newHistory = [...history, { grid: grid.map(row => [...row]), score }];
      const limitedHistory = newHistory.slice(-100); // Keep only last 100 moves
      setHistory(limitedHistory);
      
      addNewTile(newGrid);
      const newScore = score + scoreIncrease;
      setGrid(newGrid);
      setScore(newScore);

      // Check for highest tile
      const maxTile = Math.max(...newGrid.flat());
      setHighestTile(maxTile);

      // Update best score if current score exceeds it
      if (newScore > bestScore) {
        setBestScore(newScore);
        try {
          localStorage.setItem('2048-best-score', newScore.toString());
          
          // Save the game state when achieving best score (with limited history)
          const bestGameState = {
            grid: newGrid.map(row => [...row]),
            score: newScore,
            gameOver: false,
            won,
            history: limitedHistory,
          };
          localStorage.setItem('2048-best-game-state', JSON.stringify(bestGameState));
          setHasBestGame(true);
        } catch (e) {
          console.error('Failed to save to localStorage:', e);
        }
      }

      // Check if game is over
      if (isGameOver(newGrid)) {
        setGameOver(true);
        
        // Show ending only if theoretical maximum score is achieved
        // Theoretical max is around 3,932,156 points
        // This requires perfect play with tiles: 131072, 65536, 32768, 16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4
        if (maxTile >= 131072 && newScore >= 3932156) {
          setTimeout(() => {
            setShowEnding(true);
          }, 500);
        }
      }
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    
    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    
    setGrid(previousState.grid.map(row => [...row]));
    setScore(previousState.score);
    setHistory(newHistory);
    setGameOver(false);
  };

  const isGameOver = (grid: Grid): boolean => {
    // Check for empty cells
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (grid[i][j] === 0) return false;
      }
    }

    // Check for possible merges
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        const current = grid[i][j];
        if (
          (i < GRID_SIZE - 1 && grid[i + 1][j] === current) ||
          (j < GRID_SIZE - 1 && grid[i][j + 1] === current)
        ) {
          return false;
        }
      }
    }

    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-900 via-red-900 to-orange-900 flex items-center justify-center p-4">
      {/* Ending Screen Overlay */}
      {showEnding && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in"
          style={{
            animation: 'fadeIn 1s ease-in-out'
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { 
                opacity: 0;
                transform: translateY(30px);
              }
              to { 
                opacity: 1;
                transform: translateY(0);
              }
            }
            @keyframes glow {
              0%, 100% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3); }
              50% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 215, 0, 0.5); }
            }
          `}</style>
          <div className="max-w-2xl w-full px-6 text-center">
            {/* Stars decoration */}
            <div className="mb-8 flex justify-center gap-4">
              {[...Array(5)].map((_, i) => (
                <Trophy 
                  key={i}
                  className="w-8 h-8 text-yellow-400"
                  style={{
                    animation: `slideUp ${0.5 + i * 0.1}s ease-out`,
                    opacity: 0,
                    animationFillMode: 'forwards',
                    animationDelay: `${i * 0.1}s`
                  }}
                />
              ))}
            </div>

            {/* Main title */}
            <h1 
              className="text-6xl md:text-7xl font-bold text-yellow-400 mb-6"
              style={{
                animation: 'slideUp 0.8s ease-out, glow 2s ease-in-out infinite',
                animationDelay: '0.5s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              완벽한 승리
            </h1>

            {/* Subtitle */}
            <p 
              className="text-2xl md:text-3xl text-white mb-4"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '0.8s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              131,072 타일 달성
            </p>

            <p 
              className="text-lg md:text-xl text-orange-200 mb-8"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '1s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              이론상 가능한 최고의 순간
            </p>

            {/* Divider */}
            <div 
              className="h-px bg-gradient-to-r from-transparent via-yellow-400 to-transparent mb-8"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '1.2s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            />

            {/* Stats */}
            <div 
              className="grid grid-cols-2 gap-6 mb-8"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '1.4s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-yellow-400/30">
                <p className="text-yellow-300 text-sm mb-2">최종 점수</p>
                <p className="text-4xl font-bold text-white">{score.toLocaleString()}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-yellow-400/30">
                <p className="text-yellow-300 text-sm mb-2">최고 타일</p>
                <p className="text-4xl font-bold text-white">{highestTile.toLocaleString()}</p>
              </div>
            </div>

            {/* Poetic message */}
            <div 
              className="mb-8 space-y-3"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '1.6s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              <p className="text-white/90 text-lg leading-relaxed">
                작은 숫자 2에서 시작해
              </p>
              <p className="text-white/90 text-lg leading-relaxed">
                끝없이 합쳐지고, 쌓아올려
              </p>
              <p className="text-white/90 text-lg leading-relaxed">
                마침내 도달한 이 순간
              </p>
              <p className="text-yellow-300 text-xl font-bold leading-relaxed mt-4">
                당신은 불가능을 가능으로 만들었습니다
              </p>
            </div>

            {/* Buttons */}
            <div 
              className="flex gap-4 justify-center"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '1.8s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              <button
                onClick={() => setShowEnding(false)}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 rounded-lg transition-colors font-bold"
              >
                게임으로 돌아가기
              </button>
              <Link
                to="/"
                className="bg-white/20 hover:bg-white/30 text-white px-8 py-4 rounded-lg transition-colors font-bold flex items-center gap-2"
              >
                <Home className="w-5 h-5" />
                홈으로
              </Link>
            </div>

            {/* Final message */}
            <p 
              className="text-white/60 text-sm mt-8 italic"
              style={{
                animation: 'slideUp 0.8s ease-out',
                animationDelay: '2s',
                opacity: 0,
                animationFillMode: 'forwards'
              }}
            >
              "모든 위대한 성취는 처음에는 불가능해 보인다"
            </p>
          </div>
        </div>
      )}

      <div className="max-w-xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2">2048</h1>
          <p className="text-orange-200">타일을 합쳐 2048을 만드세요!</p>
        </div>

        {/* Game Info */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div className="flex justify-between items-center">
            <div className="flex gap-6">
              <div className="text-white">
                <p className="text-lg">점수</p>
                <p className="text-3xl font-bold text-orange-300">{score}</p>
              </div>
              <div className="text-white">
                <p className="text-lg">최고 기록</p>
                <p className="text-3xl font-bold text-yellow-300">{bestScore}</p>
              </div>
            </div>
            {won && !gameOver && (
              <div className="flex items-center gap-2 bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-400">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <div className="text-white">
                  <p className="font-bold">승리!</p>
                  <p className="text-sm">2048 달성!</p>
                </div>
              </div>
            )}
            {gameOver && (
              <div className="flex items-center gap-2 bg-red-500/20 px-4 py-2 rounded-lg border border-red-400">
                <Trophy className="w-6 h-6 text-red-400" />
                <div className="text-white">
                  <p className="font-bold">게임 오버!</p>
                  <p className="text-sm">점수: {score}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <div className="bg-orange-800/40 rounded-xl p-3 grid grid-cols-4 gap-3" id="game-board">
            {grid.map((row, i) =>
              row.map((cell, j) => (
                <div
                  key={`${i}-${j}`}
                  className={`aspect-square rounded-lg flex items-center justify-center text-2xl font-bold transition-all ${
                    cell === 0
                      ? 'bg-white/10'
                      : `${TILE_COLORS[cell] || 'bg-purple-500 text-white'} shadow-lg`
                  }`}
                >
                  {cell !== 0 && cell}
                </div>
              ))
            )}
          </div>
          {gameOver && (
            <div className="mt-4 text-center">
              <button
                onClick={initializeGame}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg transition-colors font-bold flex items-center gap-2 mx-auto"
              >
                <RotateCcw className="w-5 h-5" />
                다시 시작하기
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/20">
          <p className="text-white text-center text-sm">
            키보드 화살표 키 또는 스와이프로 타일을 이동하세요
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Link
              to="/"
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg transition-colors justify-center"
              style={{ flex: '0 0 140px' }}
            >
              <Home className="w-4 h-4" />
              홈으로
            </Link>
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-500"
            >
              <Undo className="w-4 h-4" />
              되돌리기
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={initializeGame}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center"
            >
              <RotateCcw className="w-4 h-4" />
              새 게임
            </button>
            <button
              onClick={loadPreviousGame}
              disabled={!hasPreviousGame}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500"
            >
              <FolderOpen className="w-4 h-4" />
              이전 게임
            </button>
          </div>
          <button
            onClick={loadBestGame}
            disabled={!hasBestGame}
            className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-3 rounded-lg transition-colors justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-yellow-500"
          >
            <Trophy className="w-4 h-4" />
            최고 기록 게임 불러오기
          </button>
          <button
            onClick={createTestBestGame}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors justify-center text-sm"
          >
            <Trophy className="w-4 h-4" />
            테스트용 최고 기록 생성 (2576400점)
          </button>
          <button
            onClick={createTestPerfectGame}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg transition-colors justify-center text-sm"
          >
            <Trophy className="w-4 h-4" />
            테스트용 완벽한 게임 생성 (3932156점)
          </button>
        </div>
      </div>
    </div>
  );
}