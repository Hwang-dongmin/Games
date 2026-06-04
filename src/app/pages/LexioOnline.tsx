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
  Play,
  Loader2,
  Link2,
  Crown,
  BookOpen,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import LexioFirstPersonScene from './lexio/LexioFirstPersonScene';
import LexioOnlineWelcomeOverlay from './lexio/LexioOnlineWelcomeOverlay';
import LexioRulesModal from './lexio/LexioRulesModal';
import LexioSessionRankingPanel from './lexio/LexioSessionRankingPanel';
import { beats, comboKorean, detectCombo, aiFindMove, aiLeadFallbackTile } from '../utils/lexio';
import {
  buildOnlineFinishTableUi,
  clientViewToPlayers,
} from '../utils/lexioOnlineScene';
import {
  applyPass,
  applyPlay,
  buildClientView,
  createEmptyGameState,
  MAX_ONLINE_PLAYERS,
  MAX_SESSION_ROUNDS,
  MIN_ONLINE_PLAYERS,
  replacePlayerWithAI,
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
import { setLexioBgmMode, stopLexioBgm } from '../utils/lexioBgm';
import {
  playLexioSound,
  reactLexioGameViewSounds,
  unlockLexioAudio,
} from '../utils/lexioSounds';
import LexioSfxToggle from '../components/lexio/LexioSfxToggle';

type Screen = 'entry' | 'lobby' | 'game';

const LEXIO_NICKNAME_KEY = 'lexio-online-nickname';

const DEFAULT_NICK = () =>
  `플레이어${Math.floor(100 + Math.random() * 900)}`;

function loadStoredNickname(): string {
  try {
    const saved = window.localStorage.getItem(LEXIO_NICKNAME_KEY)?.trim();
    if (saved) return saved.slice(0, 16);
  } catch {
    /* ignore */
  }
  return DEFAULT_NICK();
}

function persistNickname(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    window.localStorage.setItem(LEXIO_NICKNAME_KEY, trimmed.slice(0, 16));
  } catch {
    /* ignore */
  }
}

function playerLeftMessage(nickname: string, replacedByAi: boolean): string {
  if (replacedByAi) {
    return `${nickname}님이 나갔습니다. 지금부터 AI가 플레이합니다.`;
  }
  return `${nickname}님이 나갔습니다.`;
}

export default function LexioOnline() {
  const [searchParams] = useSearchParams();
  const roomFromUrl = searchParams.get('room')?.trim() ?? '';

  const [screen, setScreen] = useState<Screen>('entry');
  const [nickname, setNickname] = useState(loadStoredNickname);

  useEffect(() => {
    persistNickname(nickname);
  }, [nickname]);
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
  const [gameIntroDone, setGameIntroDone] = useState(false);
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const hostRef = useRef<LexioHostRoom | null>(null);
  const guestRef = useRef<LexioGuestRoom | null>(null);
  const gameStateRef = useRef<LexioGameState | null>(null);
  const myPeerIdRef = useRef('');
  const lobbySettingsRef = useRef(lobbySettings);
  lobbySettingsRef.current = lobbySettings;
  const lobbyPlayersRef = useRef(lobbyPlayers);
  lobbyPlayersRef.current = lobbyPlayers;
  const statusClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevGameViewRef = useRef<ClientGameView | null>(null);
  const pendingLocalActionRef = useRef<'play' | 'pass' | null>(null);

  const showTransientStatus = useCallback((message: string) => {
    if (statusClearTimerRef.current) {
      clearTimeout(statusClearTimerRef.current);
    }
    setStatusMessage(message);
    statusClearTimerRef.current = setTimeout(() => {
      setStatusMessage((current) => (current === message ? '' : current));
      statusClearTimerRef.current = null;
    }, 5000);
  }, []);

  const inviteUrl = roomId ? buildInviteUrl(roomId) : '';

  const broadcastGame = useCallback((state: LexioGameState) => {
    const host = hostRef.current;
    if (!host) return;
    for (const p of state.players) {
      if (p.isAI) continue;
      const view = buildClientView(state, p.peerId);
      if (view) host.sendTo(p.peerId, { type: 'game', view });
    }
    // 호스트는 P2P 연결 맵에 없어 sendTo로 자신에게 전달되지 않음 → 로컬 state 동기화
    const hostView = buildClientView(state, myPeerIdRef.current);
    if (hostView) setGameView(hostView);
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
        playLexioSound('invalid');
        break;
      case 'host_left':
        setConnectionStatus('error');
        setStatusMessage('호스트가 방을 나갔습니다.');
        setScreen('entry');
        break;
      case 'player_left':
        showTransientStatus(
          playerLeftMessage(msg.nickname, msg.replacedByAi ?? false),
        );
        break;
      default:
        break;
    }
  }, [showTransientStatus]);

  const handleGuestDisconnected = useCallback(
    (peerId: string) => {
      const leaving = lobbyPlayersRef.current.find((p) => p.peerId === peerId);
      const nextLobby = lobbyPlayersRef.current.filter(
        (p) => p.peerId !== peerId,
      );
      const gs = gameStateRef.current;
      const replacedByAi = Boolean(
        leaving && gs && gs.phase === 'playing' && gs.players.some(
          (p) => p.peerId === peerId,
        ),
      );

      if (leaving) {
        showTransientStatus(
          playerLeftMessage(leaving.nickname, replacedByAi),
        );
        hostRef.current?.broadcast({
          type: 'player_left',
          nickname: leaving.nickname,
          replacedByAi,
        });
      }

      if (replacedByAi && gs) {
        const replaced = replacePlayerWithAI(gs, peerId);
        if (replaced) {
          gameStateRef.current = replaced.state;
          broadcastGame(replaced.state);
        }
      }

      hostRef.current?.broadcast({
        type: 'lobby_update',
        players: nextLobby,
        settings: lobbySettingsRef.current,
      });
      setLobbyPlayers(nextLobby);
    },
    [broadcastGame, showTransientStatus],
  );

  const cleanup = useCallback(() => {
    hostRef.current?.destroy();
    guestRef.current?.destroy();
    hostRef.current = null;
    guestRef.current = null;
    gameStateRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (statusClearTimerRef.current) {
        clearTimeout(statusClearTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => () => cleanup(), [cleanup]);

  // 호스트: AI 좌석 자동 진행
  useEffect(() => {
    if (!isHost || screen !== 'game' || !gameView || gameView.phase !== 'playing') {
      return;
    }

    const current = gameView.players[gameView.currentPlayerIdx];
    if (!current?.isAI) return;

    const timer = setTimeout(() => {
      const gs = gameStateRef.current;
      if (!gs || gs.phase !== 'playing') return;
      const cur = gs.players[gs.currentPlayerIdx];
      if (!cur?.isAI) return;

      const move = aiFindMove(cur.hand, gs.currentPlay, {
        difficulty: 'medium',
        currentPlayerId: cur.seat,
        players: gs.players.map((p) => ({
          id: p.seat,
          handCount: p.hand.length,
        })),
        discardedTiles: gs.discardedTiles,
        tablePlay: gs.currentPlay,
        playerCount: gs.players.length,
      });
      let result;
      if (move === null) {
        if (gs.currentPlay) {
          result = applyPass(gs, cur.seat);
        } else if (cur.hand.length > 0) {
          result = applyPlay(gs, cur.seat, [
            aiLeadFallbackTile(cur.hand, {
              difficulty: 'medium',
              currentPlayerId: cur.seat,
              players: gs.players.map((p) => ({
                id: p.seat,
                handCount: p.hand.length,
              })),
              discardedTiles: gs.discardedTiles,
              tablePlay: gs.currentPlay,
              playerCount: gs.players.length,
            }),
          ]);
        } else {
          return;
        }
      } else {
        result = applyPlay(gs, cur.seat, move);
      }

      if (result.ok) {
        gameStateRef.current = result.state;
        broadcastGame(result.state);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isHost, screen, gameView, broadcastGame]);

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
        handleGuestDisconnected,
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
    try {
      state = startNewRound(state);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : '패 분배에 실패했습니다.',
      );
      return;
    }
    gameStateRef.current = state;
    hostRef.current?.broadcast({ type: 'start' });
    broadcastGame(state);
    setScreen('game');
    setStatusMessage('');
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
    pendingLocalActionRef.current = 'play';
    playLexioSound('play', { tileCount: selectedTiles.length });
    sendAction('play', selectedTiles.map((t) => t.id));
    setSelectedIds([]);
  };

  const handlePass = () => {
    if (!gameView?.currentPlay) {
      setStatusMessage('리드 차례에는 패스할 수 없습니다.');
      playLexioSound('invalid');
      return;
    }
    pendingLocalActionRef.current = 'pass';
    playLexioSound('pass');
    sendAction('pass');
    setSelectedIds([]);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setStatusMessage('링크 복사에 실패했습니다.');
    }
  };

  const copyRoomCode = async () => {
    const code = displayRoomCode(roomId);
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setStatusMessage('방 코드 복사에 실패했습니다.');
    }
  };

  const leaveRoom = () => {
    cleanup();
    setScreen('entry');
    setConnectionStatus('idle');
    setLobbyPlayers([]);
    setGameView(null);
    setGameIntroDone(false);
    setWelcomeLeaving(false);
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

  const isTableView = screen === 'game';
  const gameReady = gameIntroDone;

  const sceneBundle = useMemo(() => {
    if (!gameView) return null;
    const { players, humanPlayer } = clientViewToPlayers(gameView);
    return {
      players,
      humanPlayer,
      finishTableUi: buildOnlineFinishTableUi(
        gameView,
        isHost,
        hostNextRound,
        leaveRoom,
      ),
      sessionCoinsByPlayerId: gameView.sessionCoinsBySeat,
    };
  }, [gameView, isHost, hostNextRound, leaveRoom]);

  useEffect(() => {
    if (!isTableView || !gameView || gameView.phase !== 'finished') return;
    if (!isHost || !sessionHasNext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        hostNextRound();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTableView, gameView, isHost, sessionHasNext, hostNextRound]);

  const showWelcomeOverlay =
    gameView?.phase === 'playing' && (!gameReady || welcomeLeaving);

  const rulesPlayerCount = useMemo(() => {
    if (screen === 'game' && gameView) return gameView.players.length;
    if (screen === 'lobby' && lobbyPlayers.length >= MIN_ONLINE_PLAYERS) {
      return lobbyPlayers.length;
    }
    if (screen === 'lobby') return lobbySettings.maxPlayers;
    return undefined;
  }, [screen, gameView, lobbyPlayers.length, lobbySettings.maxPlayers]);

  useEffect(() => {
    if (!gameIntroDone) return;
    setWelcomeLeaving(true);
    const timer = setTimeout(() => setWelcomeLeaving(false), 650);
    return () => clearTimeout(timer);
  }, [gameIntroDone]);

  const toggleSelect = (tileId: number) => {
    if (!gameReady) return;
    setSelectedIds((prev) => {
      const deselecting = prev.includes(tileId);
      playLexioSound(deselecting ? 'tileDeselect' : 'tileSelect');
      return deselecting
        ? prev.filter((id) => id !== tileId)
        : [...prev, tileId];
    });
  };

  useEffect(() => {
    const onPointerDown = () => {
      unlockLexioAudio();
      const inFinishedRound =
        screen === 'game' && gameView?.phase === 'finished';
      setLexioBgmMode(inFinishedRound ? 'finished' : 'playing');
    };
    window.addEventListener('pointerdown', onPointerDown, { once: true });
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [screen, gameView?.phase]);

  useEffect(() => {
    const mode =
      screen === 'game' && gameView?.phase === 'finished'
        ? 'finished'
        : 'playing';
    setLexioBgmMode(mode);
    return () => stopLexioBgm();
  }, [screen, gameView?.phase]);

  useEffect(() => {
    if (!gameView) {
      prevGameViewRef.current = null;
      return;
    }
    reactLexioGameViewSounds(prevGameViewRef.current, gameView, {
      skipPlay: pendingLocalActionRef.current === 'play',
      skipPass: pendingLocalActionRef.current === 'pass',
    });
    pendingLocalActionRef.current = null;
    prevGameViewRef.current = gameView;
  }, [gameView]);

  return (
    <div
      className={`min-h-screen text-slate-100 ${isTableView ? 'p-0' : 'p-5 sm:p-6'}`}
      style={
        isTableView
          ? { background: '#0a0a23' }
          : {
              background:
                'radial-gradient(ellipse at top, #2e1065 0%, #1e1b4b 45%, #0a0a23 100%)',
            }
      }
    >
      <div className={isTableView ? '' : 'max-w-4xl mx-auto'}>
        <header
          className={`flex items-center justify-between ${
            isTableView
              ? 'fixed top-0 left-0 right-0 z-20 px-4 py-3 bg-gradient-to-b from-[#0a0a23]/95 to-transparent pointer-events-auto'
              : 'mb-6'
          }`}
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2.5 text-sm font-semibold uppercase tracking-widest text-purple-100 border border-purple-500/30 hover:bg-white/10"
          >
            <Home className="w-4 h-4" />
            홈
          </Link>
          <div className="text-center">
            <p
              className={`uppercase text-purple-300/70 ${
                isTableView
                  ? 'text-sm tracking-[0.4em]'
                  : 'text-base tracking-[0.45em] sm:text-lg'
              }`}
            >
              렉시오 온라인
            </p>
            <h1
              className={`font-serif tracking-wider text-purple-100 ${
                isTableView ? 'text-3xl' : 'text-4xl sm:text-5xl'
              }`}
            >
              Lexio Online
            </h1>
            {isTableView && gameView && (
              <p className="mt-1 text-sm tracking-wide text-purple-200/80">
                {displayRoomCode(roomId)} · 코인{' '}
                {gameView.sessionCoinsBySeat[gameView.yourSeat] ?? 0} ·{' '}
                {gameView.sessionCompletedRounds}/{gameView.sessionTotalRounds}
                판
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/5 px-3 py-2.5 text-sm font-semibold uppercase tracking-widest text-purple-100 border border-purple-500/30 hover:bg-white/10 sm:px-4"
            aria-label="게임 규칙 보기"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">게임 규칙</span>
          </button>
        </header>

        <LexioRulesModal
          open={showRules}
          onClose={() => setShowRules(false)}
          mode="online"
          playerCount={rulesPlayerCount}
          maxSessionRounds={MAX_SESSION_ROUNDS}
        />

        {connectionStatus === 'connecting' && (
          <div className="flex items-center justify-center gap-2 py-8 text-base text-purple-200">
            <Loader2 className="w-6 h-6 animate-spin" />
            연결 중…
          </div>
        )}

        {statusMessage && !isTableView && (
          <p className="mb-4 text-center text-base text-rose-200/90 bg-rose-950/40 rounded-lg py-2.5 px-4 border border-rose-500/30">
            {statusMessage}
          </p>
        )}

        {screen === 'entry' && connectionStatus !== 'connecting' && (
          <>
          <div className="grid gap-6 md:grid-cols-2">
            <section
              className="rounded-2xl p-6 border border-purple-500/30"
              style={{
                background:
                  'linear-gradient(180deg, rgba(30,27,75,0.8) 0%, rgba(10,10,35,0.9) 100%)',
              }}
            >
              <h2 className="text-xl font-semibold text-purple-100 mb-4 flex items-center gap-2">
                <Crown className="w-6 h-6 text-amber-400" />
                방 만들기
              </h2>
              <label className="block text-sm text-purple-200/80 mb-1">
                닉네임
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={16}
                className="w-full mb-4 rounded-lg bg-black/30 border border-purple-500/40 px-3 py-2.5 text-base"
                placeholder="닉네임"
              />
              <button
                type="button"
                onClick={createRoom}
                className="group relative w-full overflow-hidden rounded-full py-3.5 text-base font-bold tracking-[0.22em] uppercase text-purple-50 transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(192,132,252,0.55) 0%, rgba(126,34,206,0.72) 45%, rgba(76,29,149,0.9) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(216,180,254,0.65), 0 12px 32px -10px rgba(168,85,247,0.5)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background:
                      'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.2) 0%, transparent 70%)',
                  }}
                />
                <span className="relative z-10 inline-flex w-full items-center justify-center gap-2.5">
                  <Crown className="h-5 w-5 shrink-0 text-amber-200/95" />
                  새 방 만들기
                </span>
              </button>
              <p className="mt-3 text-sm text-purple-300/60 leading-relaxed">
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
              <h2 className="text-xl font-semibold text-purple-100 mb-4 flex items-center gap-2">
                <Link2 className="w-6 h-6 text-sky-400" />
                방 참가
              </h2>
              <label className="block text-sm text-purple-200/80 mb-1">
                방 코드 (6자) — URL 붙여넣기 가능
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                maxLength={200}
                className="w-full mb-2 rounded-lg bg-black/30 border border-purple-500/40 px-3 py-2.5 text-base font-mono tracking-widest uppercase"
                placeholder="예: ABC234"
              />
              <p className="mb-4 text-sm leading-relaxed text-purple-300/60">
                초대 링크는 브라우저 주소창에 붙여넣어 열거나, 여기에는{' '}
                <strong className="text-purple-200/80">6자리 코드만</strong>{' '}
                입력하세요. http://localhost… 전체는 넣지 마세요.
              </p>
              <button
                type="button"
                onClick={() => joinRoom()}
                disabled={!parseRoomCodeInput(joinCode)}
                className="group relative w-full overflow-hidden rounded-full py-3.5 text-base font-bold tracking-[0.22em] uppercase text-slate-50 transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:brightness-100"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(125,211,252,0.55) 0%, rgba(37,99,235,0.72) 42%, rgba(67,56,202,0.88) 100%)',
                  boxShadow:
                    'inset 0 0 0 1px rgba(186,230,253,0.65), 0 12px 32px -10px rgba(56,189,248,0.5)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-disabled:opacity-0"
                  style={{
                    background:
                      'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 70%)',
                  }}
                />
                <span className="relative z-10 inline-flex w-full items-center justify-center gap-2.5">
                  <Users className="h-5 w-5 shrink-0 opacity-95" />
                  참가하기
                </span>
              </button>
            </section>
          </div>
          <div className="mx-auto mt-4 max-w-lg px-1">
            <LexioSfxToggle className="col-span-1" />
          </div>
          </>
        )}

        {screen === 'lobby' && (
          <div
            className="rounded-2xl p-6 border border-purple-500/40"
            style={{
              background:
                'linear-gradient(180deg, rgba(30,27,75,0.85) 0%, rgba(10,10,35,0.95) 100%)',
            }}
          >
            {roomId && (
              <div className="mb-6">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm uppercase tracking-widest text-purple-300/70">
                    방 코드
                  </p>
                  <div className="flex items-center gap-2">
                    <Users
                      className={`w-5 h-5 ${
                        connectionStatus === 'connected'
                          ? 'text-purple-300'
                          : 'text-rose-400/90'
                      }`}
                    />
                    <span className="text-base text-purple-200/80">
                      {lobbyPlayers.length}/{lobbySettings.maxPlayers}명
                    </span>
                  </div>
                </div>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-purple-500/40 bg-black/30">
                  <p className="min-w-0 flex-1 px-3 py-3 font-mono text-3xl font-bold tracking-[0.35em] text-purple-100 select-all sm:text-4xl">
                    {displayRoomCode(roomId)}
                  </p>
                  <button
                    type="button"
                    onClick={copyRoomCode}
                    aria-label="방 코드 복사"
                    className="group/copy-code flex shrink-0 items-center justify-center self-center px-3 text-purple-200"
                  >
                    {copiedCode ? (
                      <Check className="h-5 w-5 text-emerald-400 transition-opacity group-hover/copy-code:opacity-70" />
                    ) : (
                      <Copy className="h-5 w-5 transition-opacity group-hover/copy-code:opacity-60" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {inviteUrl && (
              <div className="mb-6">
                <p className="mb-2 text-sm uppercase tracking-widest text-purple-300/70">
                  초대 링크
                </p>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-purple-500/40 bg-black/30">
                  <p className="min-w-0 flex-1 break-all px-3 py-3 font-mono text-sm leading-relaxed text-purple-100/90 select-all">
                    {inviteUrl}
                  </p>
                  <button
                    type="button"
                    onClick={copyInvite}
                    aria-label="링크 복사"
                    className="group/copy flex shrink-0 items-center justify-center px-3 text-purple-200"
                  >
                    {copiedInvite ? (
                      <Check className="h-5 w-5 text-emerald-400 transition-opacity group-hover/copy:opacity-70" />
                    ) : (
                      <Copy className="h-5 w-5 transition-opacity group-hover/copy:opacity-60" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <h3 className="text-base font-semibold text-purple-200 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              대기 중인 플레이어
            </h3>
            <ul className="space-y-2 mb-6">
              {lobbyPlayers.map((p) => (
                <li
                  key={p.peerId}
                  className="flex items-center justify-between rounded-lg bg-black/25 px-4 py-2.5 text-base"
                >
                  <span>
                    {p.nickname}
                    {p.seat === 0 && isHost && p.peerId === myPeerIdRef.current && (
                      <span className="ml-2 text-sm text-amber-300/90">
                        (나 · 호스트)
                      </span>
                    )}
                    {p.seat === 0 && !(p.peerId === myPeerIdRef.current) && (
                      <span className="ml-2 text-sm text-amber-300/90">
                        호스트
                      </span>
                    )}
                  </span>
                  <span className="text-purple-400/60 text-sm">
                    #{p.seat + 1}
                  </span>
                </li>
              ))}
            </ul>

            {isHost && (
              <div className="space-y-4 mb-6 border-t border-purple-500/20 pt-4">
                <div>
                  <label className="text-sm text-purple-200/80">
                    총 라운드 수 (최대 {MAX_SESSION_ROUNDS})
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
                    <span className="font-mono text-base w-10 text-right">
                      {lobbySettings.totalRounds}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-purple-200/80">
                    최대 인원 ({MIN_ONLINE_PLAYERS}~{MAX_ONLINE_PLAYERS})
                  </label>
                  <Select
                    value={String(lobbySettings.maxPlayers)}
                    onValueChange={(value) =>
                      updateHostSettings({ maxPlayers: Number(value) })
                    }
                  >
                    <SelectTrigger className="mt-1 h-auto w-full rounded-lg border-purple-500/40 bg-black/30 py-2.5 text-base text-purple-100 shadow-none focus-visible:border-purple-400/70 focus-visible:ring-2 focus-visible:ring-purple-500/30 dark:border-purple-500/40 dark:bg-black/30 dark:hover:bg-black/40 [&_svg]:text-purple-300/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      className="border-purple-500/40 bg-[#1e1b4b] text-purple-100 shadow-xl shadow-black/50"
                    >
                      {[3, 4, 5].map((n) => (
                        <SelectItem
                          key={n}
                          value={String(n)}
                          className="cursor-pointer text-base text-purple-100 focus:bg-purple-500/30 focus:text-purple-50 data-[highlighted]:bg-purple-500/30 data-[highlighted]:text-purple-50"
                        >
                          {n}명
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {isHost ? (
              <button
                type="button"
                onClick={hostStartGame}
                disabled={lobbyPlayers.length < MIN_ONLINE_PLAYERS}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-base font-bold tracking-widest uppercase text-purple-100 bg-gradient-to-b from-purple-500/50 to-violet-800/60 border border-purple-400/50 disabled:opacity-40"
              >
                <Play className="w-6 h-6" />
                게임 시작 ({MIN_ONLINE_PLAYERS}명 이상)
              </button>
            ) : (
              <p className="text-center text-base text-purple-300/70 py-4">
                호스트가 게임을 시작할 때까지 기다려주세요…
              </p>
            )}
          </div>
        )}

        {screen === 'game' && gameView && sceneBundle && (
          <div className="relative h-[100dvh] w-full overflow-hidden">
            <div className="absolute inset-0 z-0">
              <LexioFirstPersonScene
                players={sceneBundle.players}
                currentPlayerIdx={gameView.currentPlayerIdx}
                humanPlayer={sceneBundle.humanPlayer}
                currentPlay={gameView.currentPlay}
                selectedIds={selectedIds}
                onToggleTile={toggleSelect}
                phase={gameView.phase}
                discardPlacements={gameView.discardPlacements ?? []}
                finishTableUi={sceneBundle.finishTableUi}
                sessionCoinsByPlayerId={sceneBundle.sessionCoinsByPlayerId}
                playStartIntro={!gameIntroDone}
                onStartIntroComplete={() => setGameIntroDone(true)}
                interactionEnabled={gameReady}
              />
            </div>

            {showWelcomeOverlay && (
              <LexioOnlineWelcomeOverlay leaving={welcomeLeaving} />
            )}

            {gameView.phase === 'finished' &&
              !sessionHasNext &&
              sceneBundle.finishTableUi && (
                <LexioSessionRankingPanel
                  playersCoins={sceneBundle.finishTableUi.playersCoins}
                  humanPlayerId={sceneBundle.humanPlayer?.id}
                />
              )}

            {statusMessage && (
              <div className="pointer-events-none absolute left-0 right-0 top-20 z-10 flex justify-center px-4">
                <p
                  className="pointer-events-none max-w-xl rounded-full px-5 py-2.5 text-center text-sm tracking-wider text-purple-100 shadow-lg sm:text-base"
                  style={{
                    background: 'rgba(10,10,35,0.72)',
                    boxShadow:
                      'inset 0 0 0 1px rgba(168,85,247,0.35), 0 8px 32px rgba(0,0,0,0.45)',
                  }}
                >
                  {statusMessage}
                </p>
              </div>
            )}

            {sceneBundle.humanPlayer && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-[#0a0a23]/95 via-[#0a0a23]/55 to-transparent px-4 pb-6 pt-16">
                <div className="pointer-events-none mx-auto flex max-w-2xl flex-col items-center gap-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-purple-200/90 sm:text-base">
                      <Users className="h-4 w-4 text-purple-300" />
                      <span className="font-semibold">
                        {sceneBundle.humanPlayer.name}
                      </span>
                      <span className="text-purple-300/75">
                        ({sceneBundle.humanPlayer.hand.length}장)
                      </span>
                      {isMyTurn && gameView.phase === 'playing' && gameReady && (
                        <span
                          className="ml-1 rounded-full px-2.5 py-0.5 text-xs tracking-[0.25em] uppercase sm:text-sm"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(168,85,247,0.8)',
                          }}
                        >
                          당신 차례
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium tabular-nums text-amber-200/90 sm:text-base">
                      🪙{' '}
                      {gameView.sessionCoinsBySeat[gameView.yourSeat] ?? 0}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {gameView.phase === 'playing' &&
                      selectedTiles.length > 0 &&
                      selectedCombo && (
                        <span className="rounded-full bg-purple-500/20 px-3 py-1.5 text-sm text-purple-100">
                          선택: {comboKorean(selectedCombo.type)} (
                          {selectedTiles.length}장)
                        </span>
                      )}
                    {gameView.phase === 'playing' &&
                      selectedTiles.length > 0 &&
                      !selectedCombo && (
                        <span className="rounded-full bg-rose-500/20 px-3 py-1.5 text-sm text-rose-200">
                          유효하지 않은 조합
                        </span>
                      )}
                  </div>

                  {gameView.phase === 'finished' ? (
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
                      {isHost && sessionHasNext ? (
                        <button
                          type="button"
                          onClick={hostNextRound}
                          className="rounded-full px-10 py-3 text-sm font-bold tracking-[0.25em] text-purple-100 transition-all hover:-translate-y-0.5 sm:text-base"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                            boxShadow:
                              'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 24px -8px rgba(168,85,247,0.55)',
                          }}
                        >
                          다음 판
                          <span className="ml-2.5 font-mono text-xs font-semibold tracking-normal text-purple-200/90">
                            Enter
                          </span>
                        </button>
                      ) : !sessionHasNext ? (
                        <button
                          type="button"
                          onClick={leaveRoom}
                          className="rounded-full px-10 py-3 text-sm font-bold tracking-[0.25em] text-slate-100 transition-all hover:-translate-y-0.5 sm:text-base"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
                          }}
                        >
                          방 나가기
                        </button>
                      ) : (
                        <p className="text-sm text-purple-300/70 sm:text-base">
                          호스트가 다음 판을 시작합니다…
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
                      {isMyTurn && gameView.phase === 'playing' && gameReady && (
                        <>
                          <button
                            type="button"
                            onClick={handlePass}
                            disabled={!gameView.currentPlay}
                            className="rounded-full px-7 py-2.5 text-sm tracking-[0.3em] font-semibold uppercase text-rose-100 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(159,18,57,0.4) 0%, rgba(76,5,25,0.55) 100%)',
                              boxShadow:
                                'inset 0 0 0 1px rgba(244,63,94,0.55), 0 8px 20px -10px rgba(244,63,94,0.4)',
                            }}
                          >
                            패스
                          </button>
                          <button
                            type="button"
                            onClick={handlePlay}
                            disabled={!canPlay}
                            className="rounded-full px-9 py-2.5 text-sm tracking-[0.3em] font-bold uppercase text-purple-100 transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(91,33,182,0.6) 100%)',
                              boxShadow:
                                'inset 0 0 0 1px rgba(168,85,247,0.8), 0 10px 24px -8px rgba(168,85,247,0.55)',
                            }}
                          >
                            내기
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
