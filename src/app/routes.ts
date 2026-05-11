import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Game2048 from "./pages/Game2048";
import SnakeGame from "./pages/SnakeGame";
import TexasHoldem from "./pages/TexasHoldem";
import Lexio from "./pages/Lexio";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
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
  {
    path: "/lexio",
    Component: Lexio,
  },
]);
