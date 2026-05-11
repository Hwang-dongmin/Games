import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import TicTacToe from "./pages/TicTacToe";
import MemoryGame from "./pages/MemoryGame";
import Game2048 from "./pages/Game2048";
import SnakeGame from "./pages/SnakeGame";
import TexasHoldem from "./pages/TexasHoldem";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/tic-tac-toe",
    Component: TicTacToe,
  },
  {
    path: "/memory-game",
    Component: MemoryGame,
  },
  {
    path: "/2048",
    Component: Game2048,
  },
  {
    path: "/snake",
    Component: SnakeGame,
  },
  {
    path: "/holdem",
    Component: TexasHoldem,
  },
]);
