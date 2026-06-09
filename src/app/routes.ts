import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Game2048 from "./pages/Game2048";
import TexasHoldem from "./pages/TexasHoldem";
import Lexio from "./pages/lexio/Lexio";
import LexioOnline from "./pages/lexio/LexioOnline";
import BlindOmok from "./pages/BlindOmok";

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
    path: "/holdem",
    Component: TexasHoldem,
  },
  {
    path: "/lexio",
    Component: Lexio,
  },
  {
    path: "/lexio/online",
    Component: LexioOnline,
  },
  {
    path: "/blind-omok",
    Component: BlindOmok,
  },
]);
