import type { ClientGameView } from './lexioGameEngine';
import type { LexioCombination } from './lexio';

export type LexioSoundId =
  | 'tileSelect'
  | 'tileDeselect'
  | 'play'
  | 'pass'
  | 'invalid'
  | 'trickClear'
  | 'turnStart'
  | 'victory'
  | 'deal'
  | 'fireworkLaunch'
  | 'fireworkExplosion';

const MUTE_KEY = 'lexio-sfx-muted';
const VOLUME_KEY = 'lexio-sfx-volume';
const DEFAULT_VOLUME = 0.8;

let audioCtx: AudioContext | null = null;
let masterBus: GainNode | null = null;

export function isLexioSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(MUTE_KEY) === '1';
}

export function setLexioSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  applyLexioSfxSettings();
  import('./lexioBgm').then((m) => {
    if (muted) m.stopLexioBgm();
    else m.applyLexioBgmGain();
  });
  import('./homeBgm').then((m) => {
    if (muted) m.stopHomeBgm();
    else m.applyHomeBgmGain();
  });
}

export function getLexioSfxVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(VOLUME_KEY);
  if (raw == null) return DEFAULT_VOLUME;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, n));
}

export function setLexioSfxVolume(volume: number): void {
  if (typeof window === 'undefined') return;
  const v = Math.min(1, Math.max(0, volume));
  window.localStorage.setItem(VOLUME_KEY, String(v));
  applyLexioSfxSettings();
  import('./lexioBgm').then((m) => m.applyLexioBgmGain());
  import('./homeBgm').then((m) => m.applyHomeBgmGain());
}

function syncMasterGain(ctx: AudioContext): void {
  if (!masterBus) return;
  const gain = isLexioSfxMuted() ? 0 : getLexioSfxVolume();
  masterBus.gain.setValueAtTime(gain, ctx.currentTime);
}

function sfxOut(ctx: AudioContext): AudioNode {
  if (!masterBus) {
    masterBus = ctx.createGain();
    masterBus.connect(ctx.destination);
  }
  syncMasterGain(ctx);
  return masterBus;
}

export function applyLexioSfxSettings(): void {
  if (audioCtx && audioCtx.state !== 'closed') {
    syncMasterGain(audioCtx);
  }
}

/** 배경음·공유 AudioContext용 (음소거 여부와 무관하게 컨텍스트만 준비) */
export function getLexioAudioContext(): AudioContext | null {
  unlockLexioAudio();
  return audioCtx;
}

export function getLexioAudioOutput(ctx: AudioContext): GainNode {
  if (!masterBus) {
    masterBus = ctx.createGain();
    masterBus.connect(ctx.destination);
  }
  syncMasterGain(ctx);
  return masterBus;
}

export function unlockLexioAudio(): void {
  if (typeof window === 'undefined') return;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
}

function getCtx(): AudioContext | null {
  if (isLexioSfxMuted()) return null;
  unlockLexioAudio();
  return audioCtx;
}

/** 찰진 어택 + 빠른 감쇠 */
function snapEnvelope(
  g: GainNode,
  start: number,
  peak: number,
  duration: number,
  attack = 0.002,
): void {
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
}

/** 짧은 톤 (완만한 스윕, 기본 사인) */
function blip(
  ctx: AudioContext,
  start: number,
  freqFrom: number,
  freqTo: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  const t1 = start + duration * 0.55;
  const f0 = Math.max(40, freqFrom);
  const f1 = Math.max(40, freqTo);
  osc.frequency.setValueAtTime(f0, start);
  osc.frequency.exponentialRampToValueAtTime(f1, t1);
  osc.frequency.setValueAtTime(f1, t1);
  snapEnvelope(g, start, gain, duration, 0.004);
  osc.connect(g);
  g.connect(sfxOut(ctx));
  osc.start(start);
  osc.stop(start + duration + 0.015);
}

/** 짧은 클릭 노이즈 — 돌 패 ‘탁’ */
function popClick(
  ctx: AudioContext,
  start: number,
  gain: number,
  centerHz = 1280,
): void {
  const len = Math.max(1, Math.floor(ctx.sampleRate * 0.018));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = 1 - i / len;
    data[i] = (Math.random() * 2 - 1) * env * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(centerHz, start);
  bp.Q.setValueAtTime(1.8, start);
  const g = ctx.createGain();
  snapEnvelope(g, start, gain, 0.022, 0.001);
  src.connect(bp);
  bp.connect(g);
  g.connect(sfxOut(ctx));
  src.start(start);
  src.stop(start + 0.03);
}

/** 부드러운 핑크 노이즈 느낌 */
function makeSoftNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < len; i++) {
    smooth = smooth * 0.965 + (Math.random() * 2 - 1) * 0.14;
    const t = i / len;
    data[i] = smooth * (1 - t) * (1 - t);
  }
  return buffer;
}

function connectSwell(
  ctx: AudioContext,
  source: AudioNode,
  start: number,
  peak: number,
  attack: number,
  release: number,
): void {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + release);
  source.connect(g);
  g.connect(sfxOut(ctx));
}

const SPRINKLE_SCALE = [261.63, 329.63, 392, 493.88, 587.33];

function pickSprinkleTone(): number {
  return SPRINKLE_SCALE[Math.floor(Math.random() * SPRINKLE_SCALE.length)];
}

/** 손뼉 치듯 가볍게 위로 — 뿌리기 직전 스윗 */
function victorySprinkleUp(
  ctx: AudioContext,
  start: number,
  gain: number,
): void {
  const dur = 0.2 + Math.random() * 0.06;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f0 = 280 + Math.random() * 40;
  const f1 = 520 + Math.random() * 80;
  osc.frequency.setValueAtTime(f0, start);
  osc.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.85);
  connectSwell(ctx, osc, start, gain * 0.38, dur * 0.3, dur);

  const buf = makeSoftNoiseBuffer(ctx, dur);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(0.5, start);
  bp.frequency.setValueAtTime(680, start);
  bp.frequency.exponentialRampToValueAtTime(1200, start + dur * 0.9);
  src.connect(bp);
  connectSwell(ctx, bp, start, gain * 0.2, dur * 0.25, dur);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  src.start(start);
  src.stop(start + dur + 0.02);
}

/** 퍼지는 순간 — 반짝 차임 + 부드러운 샤워 */
function victorySprinkleBurst(ctx: AudioContext, start: number, gain: number): void {
  const g = gain * (0.85 + Math.random() * 0.1);
  const grains = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < grains; i++) {
    const s = start + i * (0.032 + Math.random() * 0.022);
    const freq = pickSprinkleTone();
    blip(
      ctx,
      s,
      freq * 1.02,
      freq * 0.96,
      0.05 + Math.random() * 0.03,
      g * (0.045 + Math.random() * 0.03),
      'sine',
    );
  }

  const showerDur = 0.42 + Math.random() * 0.1;
  const buf = makeSoftNoiseBuffer(ctx, showerDur);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.setValueAtTime(0.45, start);
  bp.frequency.setValueAtTime(1600, start);
  bp.frequency.exponentialRampToValueAtTime(520, start + showerDur * 0.92);
  src.connect(bp);
  connectSwell(ctx, bp, start, g * 0.24, 0.03, showerDur);
  src.start(start);
  src.stop(start + showerDur + 0.03);
}

/** 차분한 2~3음 짧은 멜로디 */
function toneChime(
  ctx: AudioContext,
  start: number,
  freqs: number[],
  spacing: number,
  noteLen: number,
  gain: number,
): void {
  freqs.forEach((freq, i) => {
    blip(ctx, start + i * spacing, freq * 1.02, freq * 0.98, noteLen, gain, 'sine');
  });
}

function playTileSelect(ctx: AudioContext, deselect: boolean): void {
  const t = ctx.currentTime;
  if (deselect) {
    blip(ctx, t, 440, 330, 0.055, 0.07);
  } else {
    blip(ctx, t, 360, 440, 0.05, 0.075);
    popClick(ctx, t, 0.025, 1100);
  }
}

function playTilePlay(ctx: AudioContext, tileCount: number): void {
  const t = ctx.currentTime;
  const n = Math.max(1, Math.min(5, tileCount));
  popClick(ctx, t, 0.08 + n * 0.012, 900 + n * 60);
  blip(ctx, t, 280 + n * 22, 392 + n * 28, 0.065, 0.09);
  if (n >= 3) {
    blip(ctx, t + 0.04, 330 + n * 12, 440, 0.05, 0.05);
  }
}

function playPass(ctx: AudioContext): void {
  const t = ctx.currentTime;
  toneChime(ctx, t, [392, 330], 0.07, 0.06, 0.065);
}

function playInvalid(ctx: AudioContext): void {
  const t = ctx.currentTime;
  blip(ctx, t, 220, 185, 0.08, 0.075);
  blip(ctx, t + 0.09, 196, 165, 0.09, 0.065);
}

function playTrickClear(ctx: AudioContext): void {
  const t = ctx.currentTime;
  popClick(ctx, t, 0.04, 980);
  toneChime(ctx, t + 0.03, [440, 523, 659], 0.065, 0.06, 0.07);
}

function playTurnStart(ctx: AudioContext): void {
  const t = ctx.currentTime;
  toneChime(ctx, t, [440, 523, 659], 0.075, 0.07, 0.075);
  popClick(ctx, t + 0.14, 0.03, 1200);
}

function playVictory(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const notes = [392, 494, 587, 659, 784];
  notes.forEach((freq, i) => {
    blip(ctx, t + i * 0.08, freq * 0.98, freq, 0.14, 0.07);
  });
}

function playFireworkLaunch(ctx: AudioContext): void {
  const t = ctx.currentTime;
  victorySprinkleUp(ctx, t, 0.024 + Math.random() * 0.008);
}

function playFireworkExplosion(ctx: AudioContext): void {
  const t = ctx.currentTime;
  victorySprinkleBurst(ctx, t, 0.08 + Math.random() * 0.025);
}

function playDeal(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const pops = [330, 370, 415, 440];
  pops.forEach((freq, i) => {
    const s = t + i * 0.034;
    popClick(ctx, s, 0.04, 820 + i * 50);
    blip(ctx, s, freq * 0.98, freq, 0.04, 0.055);
  });
}

export function playLexioSound(
  id: LexioSoundId,
  options?: { tileCount?: number },
): void {
  const ctx = getCtx();
  if (!ctx) return;

  switch (id) {
    case 'tileSelect':
      playTileSelect(ctx, false);
      break;
    case 'tileDeselect':
      playTileSelect(ctx, true);
      break;
    case 'play':
      playTilePlay(ctx, options?.tileCount ?? 1);
      break;
    case 'pass':
      playPass(ctx);
      break;
    case 'invalid':
      playInvalid(ctx);
      break;
    case 'trickClear':
      playTrickClear(ctx);
      break;
    case 'turnStart':
      playTurnStart(ctx);
      break;
    case 'victory':
      playVictory(ctx);
      break;
    case 'deal':
      playDeal(ctx);
      break;
    case 'fireworkLaunch':
      playFireworkLaunch(ctx);
      break;
    case 'fireworkExplosion':
      playFireworkExplosion(ctx);
      break;
    default:
      break;
  }
}

export function playLexioFireworkLaunch(): void {
  unlockLexioAudio();
  playLexioSound('fireworkLaunch');
}

export function playLexioFireworkExplosion(): void {
  unlockLexioAudio();
  playLexioSound('fireworkExplosion');
}

function comboSignature(combo: LexioCombination | null): string | null {
  if (!combo) return null;
  return `${combo.type}:${combo.tiles.map((t) => t.id).join(',')}`;
}

/** 온라인 gameView 갱신 시 원격·공통 이벤트 효과음 */
export function reactLexioGameViewSounds(
  prev: ClientGameView | null,
  next: ClientGameView,
  options?: { skipPlay?: boolean; skipPass?: boolean },
): void {
  if (!prev) {
    if (next.phase === 'playing') playLexioSound('deal');
    return;
  }

  if (next.phase === 'playing' && prev.phase === 'finished') {
    playLexioSound('deal');
  }

  if (next.phase === 'finished' && prev.phase !== 'finished') {
    playLexioSound('victory');
    return;
  }

  if (
    next.phase === 'playing' &&
    prev.currentPlay !== null &&
    next.currentPlay === null
  ) {
    playLexioSound('trickClear');
  }

  const prevSig = comboSignature(prev.currentPlay);
  const nextSig = comboSignature(next.currentPlay);
  if (
    next.phase === 'playing' &&
    nextSig &&
    nextSig !== prevSig &&
    !options?.skipPlay
  ) {
    playLexioSound('play', {
      tileCount: next.currentPlay?.tiles.length ?? 1,
    });
  }

  if (
    next.phase === 'playing' &&
    next.currentPlayerIdx === next.yourSeat &&
    prev.currentPlayerIdx !== next.yourSeat
  ) {
    playLexioSound('turnStart');
  }

  if (options?.skipPass) return;

  const playUnchanged =
    comboSignature(prev.currentPlay) === comboSignature(next.currentPlay);
  if (!playUnchanged || next.phase !== 'playing') return;

  for (const p of next.players) {
    const old = prev.players.find((x) => x.seat === p.seat);
    if (old && !old.passed && p.passed) {
      playLexioSound('pass');
      break;
    }
  }
}
