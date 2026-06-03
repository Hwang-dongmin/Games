import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Home,
  Copy,
  Check,
  Users,
  Wifi,
  WifiOff,
  Play,
  Loader2,
  Link2,
  Crown,
} from 'lucide-react';
import {
  LexioPlayCard,
  lexioColorToSuit,
} from '../components/lexio/LexioPlayCard';
import {
  beats,
  comboKorean,
  detectCombo,
} from '../utils/lexio';
import {
  applyPass,
  applyPlay,
  buildClientView,
  createEmptyGameState,
  MAX_ONLINE_PLAYERS,
  MAX_SESSION_ROUNDS,
  MIN_ONLINE_PLAYERS,
  startNewRound,
  type ClientGameView,
  type LexioGameState,
} from '../utils/lexioGameEngine';
import {
  buildInviteUrl,
  createHostRoom,
  displayRoomCode,
  generateRoomCode,
  joinGuestRoom,
  parseRoomCodeInput,
  invalidRoomCodeMessage,
  peerErrorMessage,
  type LexioGuestRoom,
  type LexioHostRoom,
  type LobbyPlayer,
  type LobbySettings,
  type WireMessage,
} from '../utils/lexioMultiplayer';

type Screen = 'entry' | 'lobby' | 'game';

const DEFAULT_NICK = () =>
  `플레이어${Math.floor(100 + Math.random() * 900)}`;

export default function LexioOnline() {
  const [searchParams] = useSearchParams();
  const roomFromUrl = searchParams.get('room')?.trim() ?? '';

  const [screen, setScreen] = useState<Screen>('entry');
  const [nickname, setNickname] = useState(DEFAULT_NICK);
  const [joinCode, setJoinCode] = useState(roomFromUrl);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [lobbySettings, setLobbySettings] = useState<LobbySettings>({
    totalRounds: 5,
    maxPlayers: 5,
  });
  const [gameView, setGameView] = useState<ClientGameView | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);

  const hostRef = useRef<LexioHostRoom | null>(null);
  const guestRef = useRef<LexioGuestRoom | null>(null);
  const gameStateRef = useRef<LexioGameState | null>(null);
  const myPeerIdRef = useRef('');
  const lobbySettingsRef = useRef(lobbySettings);
  lobbySettingsRef.current = lobbySettings;

  const inviteUrl = roomId ? buildInviteUrl(roomId) : '';

  const broadcastGame = useCallback((state: LexioGameState) => {
    const host = hostRef.current;
    if (!host) return;
    for (const p of state.players) {
      const view = buildClientView(state, p.peerId);
      if (view) host.sendTo(p.peerId, { type: 'game', view });
    }
  }, []);

  const handleHostMessage = useCallback(
    (msg: WireMessage, fromPeerId: string) => {
      if (msg.type === 'hello') {
        const gs = gameStateRef.current;
        if (gs && gs.phase !== 'lobby') {
          hostRef.current?.sendTo(fromPeerId, {
            type: 'error',
            message: '이미 게임이 시작되었습니다.',
          });
          return;
        }
        setLobbyPlayers((prev) => {
          if (prev.some((p) => p.peerId === fromPeerId)) return prev;
          const settings = lobbySettingsRef.current;
          if (prev.length >= settings.maxPlayers) {
            hostRef.current?.sendTo(fromPeerId, {
              type: 'error',
              message: '방이 가득 찼습니다.',
            });
            return prev;
          }
          const seat = prev.length;
          const next = [
            ...prev,
            { peerId: fromPeerId, nickname: msg.nickname, seat },
          ];
          hostRef.current?.broadcast({
            type: 'lobby_update',
            players: next,
            settings,
          });
          hostRef.current?.sendTo(fromPeerId, {
            type: 'lobby',
            roomCode: roomId,
            you: { peerId: fromPeerId, nickname: msg.nickname, seat },
            players: next,
            settings,
            isHost: false,
          });
          return next;
        });
        return;
      }

      if (msg.type === 'action') {
        const state = gameStateRef.current;
        const host = hostRef.current;
        if (!state || state.phase !== 'playing' || !host) return;

        const actor = state.players.find((p) => p.peerId === fromPeerId);
        if (!actor) return;

        let result;
        if (msg.action === 'pass') {
          result = applyPass(state, actor.seat);
        } else {
          const tiles = actor.hand.filter((t) =>
            (msg.tileIds ?? []).includes(t.id),
          );
          result = applyPlay(state, actor.seat, tiles);
        }

        if (!result.ok) {
          host.sendTo(fromPeerId, { type: 'error', message: result.error });
          return;
        }

        gameStateRef.current = result.state;
        broadcastGame(result.state);
      }
    },
    [broadcastGame, roomId],
  );

  const onGuestMessage = useCallback((msg: WireMessage) => {
    switch (msg.type) {
      case 'lobby':
        setRoomId(msg.roomCode);
        setIsHost(msg.isHost);
        setLobbyPlayers(msg.players);
        setLobbySettings(msg.settings);
        setScreen('lobby');
        setConnectionStatus('connected');
        break;
      case 'lobby_update':
        setLobbyPlayers(msg.players);
        setLobbySettings(msg.settings);
        break;
      case 'start':
        setScreen('game');
        break;
      case 'game':
        setGameView(msg.view);
        setSelectedIds([]);
        break;
      case 'error':
        setStatusMessage(msg.message);
        break;
      case 'host_left':
        setConnectionStatus('error');
        setStatusMessage('호스트가 방을 나갔습니다.');
        setScreen('entry');
        break;
      default:
        break;
    }
  }, []);

  const cleanup = useCallback(() => {
    hostRef.current?.destroy();
    guestRef.current?.destroy();
    hostRef.current = null;
    guestRef.current = null;
    gameStateRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const createRoom = async () => {
    cleanup();
    setConnectionStatus('connecting');
    setStatusMessage('');
    const id = generateRoomCode();
    try {
      const host = await createHostRoom(
        id,
        handleHostMessage,
        (peerId, conn) => {
          conn.on('open', () => {
            /* guest connected */
          });
        },
        (peerId) => {
          setLobbyPlayers((prev) => {
            const next = prev.filter((p) => p.peerId !== peerId);
            hostRef.current?.broadcast({
              type: 'lobby_update',
              players: next,
              settings: lobbySettings,
            });
            return next;
          });
        },
      );
      hostRef.current = host;
      myPeerIdRef.current = host.myPeerId;
      const hostPlayer: LobbyPlayer = {
        peerId: host.myPeerId,
        nickname: nickname.trim() || '호스트',
        seat: 0,
      };
      setRoomId(id);
      setIsHost(true);
      setLobbyPlayers([hostPlayer]);
      setScreen('lobby');
      setConnectionStatus('connected');
      gameStateRef.current = createEmptyGameState(lobbySettings.totalRounds);
    } catch (err) {
      setConnectionStatus('error');
      setStatusMessage(peerErrorMessage(err));
    }
  };

  const joinRoom = async (codeInput?: string) => {
    cleanup();
    setConnectionStatus('connecting');
    setStatusMessage('');
    const id = parseRoomCodeInput(codeInput ?? joinCode);
    if (!id) {
      setConnectionStatus('error');
      setStatusMessage(invalidRoomCodeMessage());
      return;
    }
    try {
      const guest = await joinGuestRoom(
        id,
        (msg) => onGuestMessage(msg),
        () => {
          setConnectionStatus('error');
          setStatusMessage('연결이 끊어졌습니다.');
        },
      );
      guestRef.current = guest;
      myPeerIdRef.current = guest.myPeerId;
      setRoomId(id);
      setIsHost(false);
      guest.send({
        type: 'hello',
        nickname: nickname.trim() || '게스트',
      });
      setScreen('lobby');
      setConnectionStatus('connected');
    } catch (err) {
      setConnectionStatus('error');
      setStatusMessage(peerErrorMessage(err));
    }
  };

  useEffect(() => {
    if (!roomFromUrl || screen !== 'entry' || connectionStatus !== 'idle') {
      return;
    }
    const parsed = parseRoomCodeInput(roomFromUrl);
    setJoinCode(parsed ? displayRoomCode(parsed) : roomFromUrl);
  }, [roomFromUrl, screen, connectionStatus]);

  const hostStartGame = () => {
    if (lobbyPlayers.length < MIN_ONLINE_PLAYERS) {
      setStatusMessage(`최소 ${MIN_ONLINE_PLAYERS}명이 필요합니다.`);
      return;
    }
    let state = createEmptyGameState(lobbySettings.totalRounds);
    state = {
      ...state,
      players: lobbyPlayers.map((lp) => ({
        seat: lp.seat,
        peerId: lp.peerId,
        name: lp.nickname,
        hand: [],
        passed: false,
      })),
    };
    state = startNewRound(state);
    gameStateRef.current = state;
    hostRef.current?.broadcast({ type: 'start' });
    broadcastGame(state);
    setScreen('game');
    const hostView = buildClientView(state, myPeerIdRef.current);
    if (hostView) setGameView(hostView);
  };

  const hostNextRound = () => {
    const state = gameStateRef.current;
    if (!state) return;
    if (state.sessionCompletedRounds >= state.sessionTotalRounds) return;
    const next = startNewRound(state);
    gameStateRef.current = next;
    broadcastGame(next);
    const hostView = buildClientView(next, myPeerIdRef.current);
    if (hostView) setGameView(hostView);
  };

  const sendAction = (action: 'play' | 'pass', tileIds?: number[]) => {
    guestRef.current?.send({ type: 'action', action, tileIds });
    if (isHost && hostRef.current) {
      handleHostMessage(
        { type: 'action', action, tileIds },
        myPeerIdRef.current,
      );
    }
  };

  const selectedTiles = useMemo(() => {
    if (!gameView) return [];
    return gameView.yourHand.filter((t) => selectedIds.includes(t.id));
  }, [gameView, selectedIds]);

  const selectedCombo = useMemo(
    () => detectCombo(selectedTiles),
    [selectedTiles],
  );

  const isMyTurn =
    gameView &&
    gameView.phase === 'playing' &&
    gameView.currentPlayerIdx === gameView.yourSeat;

  const canPlay =
    isMyTurn &&
    selectedCombo !== null &&
    (gameView?.currentPlay === null ||
      beats(selectedCombo, gameView.currentPlay));

  const handlePlay = () => {
    if (!canPlay) return;
    sendAction('play', selectedTiles.map((t) => t.id));
    setSelectedIds([]);
  };

  const handlePass = () => {
    if (!gameView?.currentPlay) {
      setStatusMessage('리드 차례에는 패스할 수 없습니다.');
      return;
    }
    sendAction('pass');
    setSelectedIds([]);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatusMessage('링크 복사에 실패했습니다.');
    }
  };

  const leaveRoom = () => {
    cleanup();
    setScreen('entry');
    setConnectionStatus('idle');
    setLobbyPlayers([]);
    setGameView(null);
    setRoomId('');
    setIsHost(false);
    setStatusMessage('');
  };

  const updateHostSettings = (patch: Partial<LobbySettings>) => {
    const next = { ...lobbySettings, ...patch };
    setLobbySettings(next);
    hostRef.current?.broadcast({
      type: 'lobby_update',
      players: lobbyPlayers,
      settings: next,
    });
  };

  const sessionHasNext =
    gameView &&
    gameView.phase === 'finished' &&
    gameView.sessionCompletedRounds < gameView.sessionTotalRounds;

  return (
    <div
      className="min-h-screen text-slate-100 p-4"
      style={{
        background:
          'radial-gradient(ellipse at top, #2e1065 0%, #1e1b4b 45%, #0a0a23 100%)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-purple-100 border border-purple-500/30 hover:bg-white/10"
          >
            <Home className="w-4 h-4" />
            홈
          </Link>
          <div className="text-center">
            <p className="text-[10px] tracking-[0.5em] text-purple-300/70 uppercase">
              Online
            </p>
            <h1 className="text-2xl font-serif tracking-wider text-purple-100">
              렉시오 온라인
            </h1>
          </div>
          <Link
            to="/lexio"
            className="text-xs text-purple-300/80 hover:text-purple-100"
          >
            AI 대전
          </Link>
        </header>

        {connectionStatus === 'connecting' && (
          <div className="flex items-center justify-center gap-2 py-8 text-purple-200">
            <Loader2 className="w-5 h-5 animate-spin" />
            연결 중…
          </div>
        )}

        {statusMessage && (
          <p className="mb-4 text-center text-sm text-rose-200/90 bg-rose-950/40 rounded-lg py-2 px-4 border border-rose-500/30">
            {statusMessage}
          </p>
        )}

        {screen === 'entry' && connectionStatus !== 'connecting' && (
          <div className="grid gap-6 md:grid-cols-2">
            <section
              className="rounded-2xl p-6 border border-purple-500/30"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.8) 0%, rgba(10,10,35,0.9) 100%)',
              }}
            >
              <h2 className="text-lg font-semibold text-purple-100 mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                방 만들기
              </h2>
              <label className="block text-xs text-purple-200/80 mb-1">
                닉네임
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={16}
                className="w-full mb-4 rounded-lg bg-black/30 border border-purple-500/40 px-3 py-2 text-sm"
                placeholder="닉네임"
              />
              <button
                type="button"
                onClick={createRoom}
                className="w-full rounded-full py-3 text-sm font-bold tracking-widest uppercase text-purple-100 bg-gradient-to-b from-purple-500/50 to-violet-800/60 border border-purple-400/50 hover:brightness-110"
              >
                새 방 만들기
              </button>
              <p className="mt-3 text-xs text-purple-300/60 leading-relaxed">
                로그인 없이 PeerJS(P2P)로 친구와 연결합니다. 호스트가 게임을
                진행합니다.
              </p>
            </section>

            <section
              className="rounded-2xl p-6 border border-purple-500/30"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.8) 0%, rgba(10,10,35,0.9) 100%)',
              }}
            >
              <h2 className="text-lg font-semibold text-purple-100 mb-4 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-sky-400" />
                방 참가
              </h2>
              <label className="block text-xs text-purple-200/80 mb-1">
                방 코드 (6자) — URL 붙여넣기 가능
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={200}
                className="w-full mb-2 rounded-lg bg-black/30 border border-purple-500/40 px-3 py-2 text-sm font-mono tracking-widest uppercase"
                placeholder="예: ABC234"
              />
              <p className="mb-4 text-[11px] leading-relaxed text-purple-300/60">
                초대 링크는 브라우저 주소창에 붙여넣어 열거나, 여기에는{' '}
                <strong className="text-purple-200/80">6자리 코드만</strong>{' '}
                입력하세요. http://localhost… 전체는 넣지 마세요.
              </p>
              <button
                type="button"
                onClick={() => joinRoom()}
                disabled={!parseRoomCodeInput(joinCode)}
                className="w-full rounded-full py-3 text-sm font-bold tracking-widest uppercase text-purple-100 bg-white/10 border border-white/20 hover:bg-white/15 disabled:opacity-40"
              >
                참가하기
              </button>
            </section>
          </div>
        )}

        {screen === 'lobby' && (
          <div
            className="rounded-2xl p-6 border border-purple-500/40"
            style={{
              background:
                'linear-gradient(180deg, rgba(30,27,75,0.85) 0%, rgba(10,10,35,0.95) 100%)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <p className="text-xs text-purple-300/70 uppercase tracking-widest">
                  방 코드
                </p>
                <p className="text-3xl font-mono font-bold text-purple-100 tracking-[0.35em]">
                  {displayRoomCode(roomId)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-sm text-purple-200/80">
                  {lobbyPlayers.length}/{lobbySettings.maxPlayers}명
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs bg-purple-500/25 border border-purple-400/40 hover:bg-purple-500/35"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                초대 링크 복사
              </button>
              <button
                type="button"
                onClick={leaveRoom}
                className="rounded-full px-4 py-2 text-xs text-rose-200 border border-rose-500/40 hover:bg-rose-950/40"
              >
                나가기
              </button>
            </div>

            <h3 className="text-sm font-semibold text-purple-200 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              대기 중인 플레이어
            </h3>
            <ul className="space-y-2 mb-6">
              {lobbyPlayers.map((p) => (
                <li
                  key={p.peerId}
                  className="flex items-center justify-between rounded-lg bg-black/25 px-4 py-2 text-sm"
                >
                  <span>
                    {p.nickname}
                    {p.seat === 0 && isHost && p.peerId === myPeerIdRef.current && (
                      <span className="ml-2 text-[10px] text-amber-300/90">
                        (나 · 호스트)
                      </span>
                    )}
                    {p.seat === 0 && !(p.peerId === myPeerIdRef.current) && (
                      <span className="ml-2 text-[10px] text-amber-300/90">
                        호스트
                      </span>
                    )}
                  </span>
                  <span className="text-purple-400/60 text-xs">
                    #{p.seat + 1}
                  </span>
                </li>
              ))}
            </ul>

            {isHost && (
              <div className="space-y-4 mb-6 border-t border-purple-500/20 pt-4">
                <div>
                  <label className="text-xs text-purple-200/80">
                    세션 총 판 수 (최대 {MAX_SESSION_ROUNDS})
                  </label>
                  <div className="flex items-center gap-4 mt-1">
                    <input
                      type="range"
                      min={1}
                      max={MAX_SESSION_ROUNDS}
                      value={lobbySettings.totalRounds}
                      onChange={(e) =>
                        updateHostSettings({
                          totalRounds: Number(e.target.value),
                        })
                      }
                      className="flex-1 accent-purple-400"
                    />
                    <span className="font-mono text-sm w-8 text-right">
                      {lobbySettings.totalRounds}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-purple-200/80">
                    최대 인원 ({MIN_ONLINE_PLAYERS}~{MAX_ONLINE_PLAYERS})
                  </label>
                  <select
                    value={lobbySettings.maxPlayers}
                    onChange={(e) =>
                      updateHostSettings({
                        maxPlayers: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg bg-black/30 border border-purple-500/40 px-3 py-2 text-sm"
                  >
                    {[3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}명
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isHost ? (
              <button
                type="button"
                onClick={hostStartGame}
                disabled={lobbyPlayers.length < MIN_ONLINE_PLAYERS}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3 text-sm font-bold tracking-widest uppercase text-purple-100 bg-gradient-to-b from-purple-500/50 to-violet-800/60 border border-purple-400/50 disabled:opacity-40"
              >
                <Play className="w-5 h-5" />
                게임 시작 ({MIN_ONLINE_PLAYERS}명 이상)
              </button>
            ) : (
              <p className="text-center text-sm text-purple-300/70 py-4">
                호스트가 게임을 시작할 때까지 기다려주세요…
              </p>
            )}
          </div>
        )}

        {screen === 'game' && gameView && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200/80">
              <span>
                {gameView.sessionCompletedRounds}/{gameView.sessionTotalRounds}
                판 · 내 코인{' '}
                {gameView.sessionCoinsBySeat[gameView.yourSeat] ?? 0}
              </span>
              <button
                type="button"
                onClick={leaveRoom}
                className="text-rose-300/90 hover:text-rose-200"
              >
                방 나가기
              </button>
            </div>

            {/* 다른 플레이어 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gameView.players
                .filter((p) => !p.isYou)
                .map((p) => (
                  <div
                    key={p.seat}
                    className={`rounded-xl px-3 py-2 border text-sm ${
                      gameView.currentPlayerIdx === p.seat &&
                      gameView.phase === 'playing'
                        ? 'border-purple-400/70 bg-purple-500/15'
                        : 'border-white/10 bg-black/25'
                    }`}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-purple-300/70">
                      {p.handCount}장
                      {p.passed && ' · 패스'}
                    </div>
                  </div>
                ))}
            </div>

            {/* 테이블 현재 패 */}
            <div
              className="rounded-2xl min-h-[120px] flex flex-col items-center justify-center p-4 border border-purple-500/30"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              {gameView.currentPlay ? (
                <>
                  <p className="text-xs text-purple-300/80 mb-2">
                    {comboKorean(gameView.currentPlay.type)} ·{' '}
                    {gameView.players[gameView.trickStarterIdx ?? 0]?.name}
                  </p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {gameView.currentPlay.tiles.map((t) => (
                      <LexioPlayCard
                        key={t.id}
                        number={t.number}
                        suit={lexioColorToSuit(t.color)}
                        small
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-purple-300/50">
                  {gameView.phase === 'playing'
                    ? '새 트릭 — 리드 대기'
                    : '—'}
                </p>
              )}
            </div>

            {/* 내 손패 */}
            <div>
              <p className="text-xs text-purple-300/80 mb-2">
                내 패 ({gameView.yourHand.length}장)
                {isMyTurn && (
                  <span className="ml-2 text-purple-200 font-semibold">
                    · 당신 차례
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-1 justify-center pb-2">
                {gameView.yourHand.map((t) => {
                  const sel = selectedIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) =>
                          prev.includes(t.id)
                            ? prev.filter((id) => id !== t.id)
                            : [...prev, t.id],
                        )
                      }
                      disabled={gameView.phase !== 'playing'}
                      className={`transition-transform ${sel ? '-translate-y-2 ring-2 ring-purple-400 rounded-lg' : ''}`}
                    >
                      <LexioPlayCard
                        number={t.number}
                        suit={lexioColorToSuit(t.color)}
                        small
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {gameView.phase === 'playing' && (
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={!isMyTurn || !gameView.currentPlay}
                  className="rounded-full px-6 py-2 text-xs font-semibold uppercase text-rose-100 bg-rose-950/50 border border-rose-500/40 disabled:opacity-40"
                >
                  패스
                </button>
                <button
                  type="button"
                  onClick={handlePlay}
                  disabled={!canPlay}
                  className="rounded-full px-8 py-2 text-xs font-bold uppercase text-purple-100 bg-gradient-to-b from-purple-500/50 to-violet-800/60 border border-purple-400/50 disabled:opacity-40"
                >
                  내기
                </button>
              </div>
            )}

            {gameView.phase === 'finished' && (
              <div
                className="rounded-2xl p-6 text-center border border-amber-500/30"
                style={{ background: 'rgba(0,0,0,0.4)' }}
              >
                <p className="text-lg font-serif text-amber-100 mb-2">
                  {gameView.players.find((p) => p.seat === gameView.winnerSeat)
                    ?.name ?? '—'}
                  님 승리!
                </p>
                <ul className="text-sm text-purple-200/80 space-y-1 mb-4">
                  {gameView.lastRoundCoinRows.map((r) => {
                    const pl = gameView.players.find(
                      (p) => p.seat === r.playerId,
                    );
                    return (
                      <li key={r.playerId}>
                        {pl?.name}: +{r.earned}
                        {r.doubled ? ' (×2)' : ''}
                      </li>
                    );
                  })}
                </ul>
                {isHost && sessionHasNext && (
                  <button
                    type="button"
                    onClick={hostNextRound}
                    className="rounded-full px-8 py-2 text-xs font-bold uppercase text-purple-100 bg-gradient-to-b from-purple-500/50 to-violet-800/60 border border-purple-400/50"
                  >
                    다음 판
                  </button>
                )}
                {!isHost && sessionHasNext && (
                  <p className="text-xs text-purple-300/60">
                    호스트가 다음 판을 시작합니다…
                  </p>
                )}
                {!sessionHasNext && (
                  <p className="text-xs text-purple-300/60">
                    세션 종료 — 방을 나가 새 게임을 시작하세요.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
