import { Crown, Minus, Plus, UserPlus, Users } from 'lucide-react';
import { MAX_ONLINE_PLAYERS } from '../../utils/lexioGameEngine';
import type { LobbyPlayer } from '../../utils/lexioMultiplayer';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, rgba(168,85,247,0.55) 0%, rgba(91,33,182,0.75) 100%)',
  'linear-gradient(135deg, rgba(56,189,248,0.5) 0%, rgba(37,99,235,0.72) 100%)',
  'linear-gradient(135deg, rgba(52,211,153,0.45) 0%, rgba(5,150,105,0.68) 100%)',
  'linear-gradient(135deg, rgba(251,191,36,0.45) 0%, rgba(217,119,6,0.68) 100%)',
  'linear-gradient(135deg, rgba(244,114,182,0.45) 0%, rgba(190,24,93,0.68) 100%)',
] as const;

type LexioLobbyPlayerListProps = {
  players: LobbyPlayer[];
  maxPlayers: number;
  minPlayers: number;
  myPeerId: string;
  isHost?: boolean;
  onMaxPlayersChange?: (next: number) => void;
};

function playerInitial(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  return trimmed[0]!.toUpperCase();
}

function canRemoveToSeat(
  seat: number,
  playerCount: number,
  minPlayers: number,
  maxPlayers: number,
): boolean {
  return playerCount <= seat && seat >= minPlayers && seat < maxPlayers;
}

type SlotRowActionsProps = {
  seat: number;
  maxPlayers: number;
  playerCount: number;
  minPlayers: number;
  isHost: boolean;
  onMaxPlayersChange?: (next: number) => void;
};

function SlotRowActions({
  seat,
  maxPlayers,
  playerCount,
  minPlayers,
  isHost,
  onMaxPlayersChange,
}: SlotRowActionsProps) {
  const canRemove = canRemoveToSeat(seat, playerCount, minPlayers, maxPlayers);

  return (
    <div className="lexio-lobby-player-row-actions">
      <span className="lexio-lobby-player-seat">#{seat + 1}</span>
      {isHost && canRemove && (
        <button
          type="button"
          className="lexio-lobby-player-row-btn lexio-lobby-player-row-btn--remove"
          onClick={() => onMaxPlayersChange?.(seat)}
          aria-label={`${seat + 1}번 자리 제거`}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

type AddSlotRowProps = {
  seat: number;
  isHost: boolean;
  onMaxPlayersChange?: (next: number) => void;
};

function AddSlotRow({ seat, isHost, onMaxPlayersChange }: AddSlotRowProps) {
  return (
    <li
      key={`add-${seat}`}
      className="lexio-lobby-player-row lexio-lobby-player-row--empty lexio-lobby-player-row--add-slot"
    >
      {isHost ? (
        <button
          type="button"
          className="lexio-lobby-player-add-slot-btn"
          onClick={() => onMaxPlayersChange?.(seat + 1)}
          aria-label={`${seat + 1}번 자리 추가`}
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} />
        </button>
      ) : (
        <span
          className="lexio-lobby-player-add-slot-btn lexio-lobby-player-add-slot-btn--idle"
          aria-hidden
        >
          <Plus className="h-5 w-5" strokeWidth={2.25} />
        </span>
      )}
    </li>
  );
}

export default function LexioLobbyPlayerList({
  players,
  maxPlayers,
  minPlayers,
  myPeerId,
  isHost = false,
  onMaxPlayersChange,
}: LexioLobbyPlayerListProps) {
  const playersBySeat = new Map(players.map((p) => [p.seat, p]));
  const readyToStart = players.length >= minPlayers;
  const playersNeeded = Math.max(0, minPlayers - players.length);

  return (
    <section className="lexio-lobby-players" aria-label="대기 중인 플레이어">
      <div className="lexio-lobby-players-head">
        <div className="lexio-lobby-players-title-wrap">
          <h3 className="lexio-lobby-players-title">
            <Users className="lexio-lobby-players-title-icon" aria-hidden />
            대기 중인 플레이어
          </h3>
          <p className="lexio-lobby-players-sub">
            {isHost
              ? readyToStart
                ? '인원이 충족됐어요. 빈 자리에서 자리 수를 조절할 수 있어요.'
                : '빈 자리 카드에서 자리를 추가하거나 줄일 수 있어요.'
              : readyToStart
                ? '인원이 충족됐어요. 호스트가 시작할 수 있어요.'
                : `${playersNeeded}명 더 모이면 게임을 시작할 수 있어요.`}
          </p>
        </div>
        <span
          className={`lexio-lobby-players-count ${
            readyToStart ? 'lexio-lobby-players-count--ready' : ''
          }`}
        >
          {players.length}/{maxPlayers}
        </span>
      </div>

      <ul className="lexio-lobby-players-list">
        {Array.from({ length: MAX_ONLINE_PLAYERS }, (_, seat) => {
          if (seat >= maxPlayers) {
            return (
              <AddSlotRow
                key={`add-${seat}`}
                seat={seat}
                isHost={isHost}
                onMaxPlayersChange={onMaxPlayersChange}
              />
            );
          }

          const player = playersBySeat.get(seat) ?? null;

          if (!player) {
            return (
              <li
                key={`empty-${seat}`}
                className="lexio-lobby-player-row lexio-lobby-player-row--empty"
              >
                <span
                  className="lexio-lobby-player-avatar lexio-lobby-player-avatar--empty"
                  aria-hidden
                >
                  <UserPlus className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="lexio-lobby-player-meta">
                  <span className="lexio-lobby-player-name lexio-lobby-player-name--empty">
                    빈 자리
                  </span>
                  <span className="lexio-lobby-player-hint">참가 대기 중</span>
                </div>
                <SlotRowActions
                  seat={seat}
                  maxPlayers={maxPlayers}
                  playerCount={players.length}
                  minPlayers={minPlayers}
                  isHost={isHost}
                  onMaxPlayersChange={onMaxPlayersChange}
                />
              </li>
            );
          }

          const isMe = player.peerId === myPeerId;
          const isHostSeat = seat === 0;
          const rowClass = [
            'lexio-lobby-player-row',
            'lexio-lobby-player-row--occupied',
            isMe ? 'lexio-lobby-player-row--me' : '',
            isHostSeat ? 'lexio-lobby-player-row--host' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li key={player.peerId} className={rowClass}>
              <span
                className="lexio-lobby-player-avatar"
                style={{ background: AVATAR_GRADIENTS[seat % AVATAR_GRADIENTS.length] }}
                aria-hidden
              >
                {isHostSeat ? (
                  <Crown className="h-4 w-4 text-amber-100" strokeWidth={2.25} />
                ) : (
                  playerInitial(player.nickname)
                )}
              </span>
              <div className="lexio-lobby-player-meta">
                <div className="lexio-lobby-player-name-row">
                  <span className="lexio-lobby-player-name">{player.nickname}</span>
                  <div className="lexio-lobby-player-tags">
                    {isHostSeat && (
                      <span className="lexio-lobby-player-tag lexio-lobby-player-tag--host">
                        호스트
                      </span>
                    )}
                    {isMe && (
                      <span className="lexio-lobby-player-tag lexio-lobby-player-tag--me">
                        나
                      </span>
                    )}
                  </div>
                </div>
                <span className="lexio-lobby-player-hint lexio-lobby-player-hint--joined">
                  입장 완료
                </span>
              </div>
              <span className="lexio-lobby-player-seat">#{seat + 1}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
