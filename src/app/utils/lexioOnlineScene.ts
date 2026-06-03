import type { LexioPlayer, LexioTile } from './lexio';
import type { ClientGameView } from './lexioGameEngine';
import type { LexioFinishTableUi } from '../pages/lexio/LexioFirstPersonScene';

function hiddenHand(count: number, seat: number): LexioTile[] {
  return Array.from({ length: count }, (_, i) => ({
    id: -(seat * 1000 + i + 1),
    number: 3,
    color: 'blue' as const,
  }));
}

export function clientViewToPlayers(view: ClientGameView): {
  players: LexioPlayer[];
  humanPlayer: LexioPlayer | undefined;
} {
  const players: LexioPlayer[] = [...view.players]
    .sort((a, b) => a.seat - b.seat)
    .map((p) => {
      let hand: LexioTile[];
      if (p.isYou) {
        hand = view.yourHand;
      } else if (view.phase === 'finished' && view.handsBySeat?.[p.seat]) {
        hand = view.handsBySeat[p.seat];
      } else {
        hand = hiddenHand(p.handCount, p.seat);
      }
      return {
        id: p.seat,
        name: p.name,
        isAI: !p.isYou,
        hand,
        passed: p.passed,
      };
    });

  return {
    players,
    humanPlayer: players.find((p) => !p.isAI),
  };
}

export function buildOnlineFinishTableUi(
  view: ClientGameView,
  isHost: boolean,
  onNextHand: () => void,
  onBackToSetup: () => void,
): LexioFinishTableUi | null {
  if (view.phase !== 'finished') return null;
  const winner = view.players.find((p) => p.seat === view.winnerSeat);
  const hasNextHand =
    view.sessionCompletedRounds < view.sessionTotalRounds;

  return {
    playersCoins: view.players.map((p) => {
      const row = view.lastRoundCoinRows.find((r) => r.playerId === p.seat);
      return {
        playerId: p.seat,
        name: p.name,
        roundEarned: row?.earned ?? 0,
        sessionTotal: view.sessionCoinsBySeat[p.seat] ?? 0,
        doubledThisRound: row?.doubled ?? false,
      };
    }),
    completedRounds: view.sessionCompletedRounds,
    totalRounds: view.sessionTotalRounds,
    winnerName: winner?.name ?? null,
    hasNextHand,
    onNextHand: isHost ? onNextHand : () => {},
    onBackToSetup,
  };
}
