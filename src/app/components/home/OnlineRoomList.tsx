import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Globe,
  Lock,
  RefreshCw,
  Users,
  Gamepad2,
  X,
} from 'lucide-react';
import { getGameById, getOnlineJoinPath } from '../../data/games';
import {
  grantRoomAccess,
  listRooms,
  ROOM_PASSWORD_MAX,
  verifyRoomPassword,
  type LobbyRoom,
  type ListRoomsResult,
} from '../../utils/lobbyApi';

const POLL_MS = 8_000;

type OnlineRoomListProps = {
  joinError?: string;
  onJoinErrorDismiss?: () => void;
};

function phaseLabel(phase: LobbyRoom['phase']): string {
  return phase === 'lobby' ? '대기 중' : '게임 중';
}

function phaseClass(phase: LobbyRoom['phase']): string {
  return phase === 'lobby'
    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/35'
    : 'bg-amber-500/15 text-amber-200 border-amber-500/30';
}

export default function OnlineRoomList({
  joinError = '',
  onJoinErrorDismiss,
}: OnlineRoomListProps) {
  const navigate = useNavigate();
  const [result, setResult] = useState<ListRoomsResult>({ status: 'ok', rooms: [] });
  const [loading, setLoading] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<LobbyRoom | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [joinErrorMessage, setJoinErrorMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await listRooms();
    setResult(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!joinError) return;
    setJoinErrorMessage(joinError);
    void refresh();
  }, [joinError, refresh]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await listRooms();
      if (!cancelled) setResult(next);
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const dismissJoinError = () => {
    setJoinErrorMessage('');
    onJoinErrorDismiss?.();
  };

  const joinRoom = (room: LobbyRoom) => {
    if (room.phase !== 'lobby') return;
    if (room.playerCount >= room.maxPlayers) return;

    if (room.visibility === 'private') {
      setPasswordTarget(room);
      setPasswordInput('');
      setPasswordError('');
      return;
    }

    const path = getOnlineJoinPath(room.gameId, room.code);
    if (path) navigate(path);
  };

  const submitPassword = async () => {
    if (!passwordTarget) return;
    if (passwordInput.trim().length < 1) {
      setPasswordError('비밀번호를 입력하세요');
      return;
    }
    setVerifying(true);
    setPasswordError('');
    const ok = await verifyRoomPassword(passwordTarget.code, passwordInput);
    setVerifying(false);
    if (!ok) {
      setPasswordError('비밀번호가 틀렸습니다.');
      return;
    }
    grantRoomAccess(passwordTarget.code);
    const path = getOnlineJoinPath(passwordTarget.gameId, passwordTarget.code);
    setPasswordTarget(null);
    if (path) navigate(path);
  };

  const rooms = result.status === 'ok' ? result.rooms : [];

  return (
    <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100 sm:text-xl">
          <Gamepad2 className="h-5 w-5 text-violet-300" />
          온라인 방
          {result.status === 'ok' && (
            <span className="text-sm font-normal text-zinc-500">{rooms.length}</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="새로고침"
          className="inline-flex items-center justify-center rounded-full border border-white/10 p-2 text-zinc-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {result.status === 'disabled' && (
        <p className="py-8 text-center text-sm text-zinc-500">
          방 목록 서버가 연결되지 않았습니다. (Upstash Redis 설정 확인)
        </p>
      )}

      {result.status === 'error' && (
        <p className="py-8 text-center text-sm text-zinc-500">
          방 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      {result.status === 'ok' && rooms.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-500">
          열린 방이 없습니다. 위 게임을 선택해 방을 만들어 보세요.
        </p>
      )}

      {result.status === 'ok' && rooms.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => {
            const game = getGameById(room.gameId);
            const full = room.playerCount >= room.maxPlayers;
            const inGame = room.phase === 'playing';
            const canJoin = !full && !inGame;

            return (
              <li key={room.code}>
                <button
                  type="button"
                  onClick={() => joinRoom(room)}
                  disabled={!canJoin}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/25 px-4 py-3 text-left transition hover:border-violet-500/30 hover:bg-violet-500/5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-white/[0.07] disabled:hover:bg-black/25"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-medium text-zinc-100">
                        {game?.title ?? room.gameId}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${phaseClass(room.phase)}`}
                      >
                        {phaseLabel(room.phase)}
                      </span>
                      {room.visibility === 'private' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                          <Lock className="h-3 w-3" />
                          비공개
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                          <Globe className="h-3 w-3" />
                          공개
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {room.hostNickname}님 · {room.totalRounds}판
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-sm text-zinc-400">
                      <Users className="h-4 w-4" />
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                    <span className="min-w-[3.5rem] text-center text-sm font-semibold text-violet-200">
                      {inGame ? '게임 중' : full ? '가득 참' : '입장'}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {passwordTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="room-password-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12101c] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <h3 id="room-password-title" className="text-lg font-semibold text-zinc-100">
                  비공개 방
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  {getGameById(passwordTarget.gameId)?.title} ·{' '}
                  {passwordTarget.hostNickname}님
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordTarget(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/5"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              maxLength={ROOM_PASSWORD_MAX}
              placeholder="최대 4자"
              className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-zinc-100"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitPassword();
              }}
            />
            {passwordError && (
              <p className="mb-3 text-sm text-rose-300">{passwordError}</p>
            )}
            <button
              type="button"
              onClick={() => void submitPassword()}
              disabled={verifying}
              className="w-full rounded-full bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              {verifying ? '확인 중…' : '입장'}
            </button>
          </div>
        </div>
      )}

      {joinErrorMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="join-error-title"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12101c] p-5 shadow-xl">
            <h3 id="join-error-title" className="mb-4 text-lg font-semibold text-zinc-100">
              입장 실패
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-zinc-300">
              {joinErrorMessage}
            </p>
            <button
              type="button"
              onClick={dismissJoinError}
              className="w-full rounded-full bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
