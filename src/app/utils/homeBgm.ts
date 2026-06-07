import {
  getLexioAudioContext,
  getLexioAudioOutput,
  getLexioSfxVolume,
  isLexioSfxMuted,
} from './lexioSounds';

const FADE_IN_SEC = 3.2;
const FADE_OUT_SEC = 1.6;
const LOOKAHEAD_SEC = 0.14;
const SCHEDULER_MS = 30;

const PRESET = {
  level: 0.082,
  noteSec: 0.78,
  padLevel: 0.028,
  progression: [
    [220, 261.63, 329.63, 392],
    [174.61, 220, 261.63, 329.63],
    [261.63, 329.63, 392, 493.88],
    [196, 246.94, 293.66, 329.63],
  ],
  pattern: [0, 2, 1, 3, 2, 1, 0, 2, 1, 3, 2, 0],
  stepsPerChord: 12,
  arpLevel: 0.034,
  filterHz: 1050,
};

type BgmEngine = {
  master: GainNode;
  filter: BiquadFilterNode;
  nextNoteTime: number;
  step: number;
  chordIndex: number;
  schedulerId: ReturnType<typeof setInterval>;
};

let engine: BgmEngine | null = null;
let starting = false;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

function peakGain(): number {
  if (isLexioSfxMuted()) return 0;
  return getLexioSfxVolume() * PRESET.level;
}

export function applyHomeBgmGain(): void {
  const ctx = getLexioAudioContext();
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  engine.master.gain.cancelScheduledValues(t);
  engine.master.gain.setValueAtTime(engine.master.gain.value, t);
  engine.master.gain.linearRampToValueAtTime(peakGain(), t + 0.35);
}

function scheduleArpNote(
  ctx: AudioContext,
  time: number,
  freq: number,
  dest: AudioNode,
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(PRESET.arpLevel, time + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, time + PRESET.noteSec);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + PRESET.noteSec + 0.08);
}

function schedulePadNote(
  ctx: AudioContext,
  time: number,
  freq: number,
  dest: AudioNode,
): void {
  const duration = PRESET.noteSec * PRESET.stepsPerChord;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(PRESET.padLevel, time + 0.45);
  g.gain.setValueAtTime(PRESET.padLevel * 0.85, time + duration - 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + duration + 0.1);
}

function stopEngine(target: BgmEngine | null): void {
  if (!target) return;
  clearInterval(target.schedulerId);
  try {
    target.filter.disconnect();
    target.master.disconnect();
  } catch {
    /* noop */
  }
}

function teardownAll(): void {
  stopEngine(engine);
  engine = null;
  starting = false;
}

function tickEngine(ctx: AudioContext, eng: BgmEngine): void {
  const horizon = ctx.currentTime + LOOKAHEAD_SEC;

  while (eng.nextNoteTime < horizon) {
    const chord = PRESET.progression[eng.chordIndex];
    const degree = PRESET.pattern[eng.step % PRESET.pattern.length];
    const freq = chord[degree % chord.length];

    scheduleArpNote(ctx, eng.nextNoteTime, freq, eng.filter);

    if (eng.step % PRESET.stepsPerChord === 0) {
      schedulePadNote(ctx, eng.nextNoteTime, chord[0], eng.filter);
    }

    eng.step += 1;
    if (eng.step % PRESET.stepsPerChord === 0) {
      eng.chordIndex = (eng.chordIndex + 1) % PRESET.progression.length;
    }

    eng.nextNoteTime += PRESET.noteSec;
  }
}

function beginEngine(fadeIn = true): void {
  if (isLexioSfxMuted()) return;
  const ctx = getLexioAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(PRESET.filterHz, t);
  filter.Q.setValueAtTime(0.5, t);

  const master = ctx.createGain();
  master.gain.setValueAtTime(fadeIn ? 0.0001 : peakGain(), t);
  filter.connect(master);
  master.connect(getLexioAudioOutput(ctx));

  const eng: BgmEngine = {
    master,
    filter,
    nextNoteTime: t + 0.2,
    step: 0,
    chordIndex: 0,
    schedulerId: setInterval(() => {
      if (engine === eng) tickEngine(ctx, eng);
    }, SCHEDULER_MS),
  };

  engine = eng;
  starting = false;

  if (fadeIn) {
    master.gain.linearRampToValueAtTime(peakGain(), t + FADE_IN_SEC);
  }
}

export function stopHomeBgm(): void {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }

  const ctx = getLexioAudioContext();
  if (!ctx || !engine) {
    teardownAll();
    return;
  }

  const snapshot = engine;
  engine = null;

  const t = ctx.currentTime;
  snapshot.master.gain.cancelScheduledValues(t);
  snapshot.master.gain.setValueAtTime(snapshot.master.gain.value, t);
  snapshot.master.gain.linearRampToValueAtTime(0.0001, t + FADE_OUT_SEC);

  stopTimer = setTimeout(() => {
    stopTimer = null;
    stopEngine(snapshot);
    starting = false;
  }, FADE_OUT_SEC * 1000 + 80);
}

export function startHomeBgm(): void {
  if (isLexioSfxMuted()) return;
  if (engine) return;
  if (starting) return;

  starting = true;
  beginEngine();
}

export function isHomeBgmActive(): boolean {
  return engine !== null;
}
