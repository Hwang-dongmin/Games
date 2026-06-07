import {
  getLexioAudioContext,
  getLexioAudioOutput,
  getLexioSfxVolume,
  isLexioSfxMuted,
} from './lexioSounds';

export type LexioBgmMode = 'playing' | 'finished';

const FADE_IN_SEC = 2.8;
const FADE_OUT_SEC = 1.4;
const CROSSFADE_SEC = 1.8;
const LOOKAHEAD_SEC = 0.12;
const SCHEDULER_MS = 30;

type BgmMusicPreset = {
  level: number;
  noteSec: number;
  progression: number[][];
  pattern: number[];
  stepsPerChord: number;
  arpLevel: number;
  filterHz: number;
};

const PRESETS: Record<LexioBgmMode, BgmMusicPreset> = {
  playing: {
    level: 0.095,
    noteSec: 0.54,
    progression: [
      [110, 130.81, 164.81, 196],
      [87.31, 110, 130.81, 164.81],
      [98, 123.47, 146.83, 196],
      [130.81, 164.81, 196, 246.94],
    ],
    pattern: [0, 2, 1, 3, 2, 1, 0, 1, 2, 3, 1, 2],
    stepsPerChord: 12,
    arpLevel: 0.038,
    filterHz: 1280,
  },
  finished: {
    level: 0.1,
    noteSec: 0.66,
    progression: [
      [130.81, 164.81, 196, 261.63],
      [110, 130.81, 164.81, 196],
      [87.31, 110, 130.81, 164.81],
      [98, 123.47, 146.83, 196],
    ],
    pattern: [0, 2, 1, 3, 2, 0, 1, 2],
    stepsPerChord: 8,
    arpLevel: 0.04,
    filterHz: 1480,
  },
};

type BgmEngine = {
  mode: LexioBgmMode;
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
let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;

function peakGain(mode: LexioBgmMode): number {
  if (isLexioSfxMuted()) return 0;
  return getLexioSfxVolume() * PRESETS[mode].level;
}

export function applyLexioBgmGain(): void {
  const ctx = getLexioAudioContext();
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  engine.master.gain.cancelScheduledValues(t);
  engine.master.gain.setValueAtTime(engine.master.gain.value, t);
  engine.master.gain.linearRampToValueAtTime(
    peakGain(engine.mode),
    t + 0.35,
  );
}

function scheduleArpNote(
  ctx: AudioContext,
  time: number,
  freq: number,
  preset: BgmMusicPreset,
  dest: AudioNode,
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, time);
  const g = ctx.createGain();
  const peak = preset.arpLevel;
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(peak, time + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, time + preset.noteSec);
  osc.connect(g);
  g.connect(dest);
  osc.start(time);
  osc.stop(time + preset.noteSec + 0.08);
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
  if (crossfadeTimer) {
    clearTimeout(crossfadeTimer);
    crossfadeTimer = null;
  }
  stopEngine(engine);
  engine = null;
  starting = false;
}

function tickEngine(ctx: AudioContext, eng: BgmEngine): void {
  const preset = PRESETS[eng.mode];
  const horizon = ctx.currentTime + LOOKAHEAD_SEC;

  while (eng.nextNoteTime < horizon) {
    const chord = preset.progression[eng.chordIndex];
    const degree = preset.pattern[eng.step % preset.pattern.length];
    const freq = chord[degree % chord.length];

    scheduleArpNote(ctx, eng.nextNoteTime, freq, preset, eng.filter);

    eng.step += 1;
    if (eng.step % preset.stepsPerChord === 0) {
      eng.chordIndex = (eng.chordIndex + 1) % preset.progression.length;
    }

    eng.nextNoteTime += preset.noteSec;
  }
}

function beginEngine(mode: LexioBgmMode, fadeIn = true): void {
  if (isLexioSfxMuted()) return;
  const ctx = getLexioAudioContext();
  if (!ctx) return;

  const preset = PRESETS[mode];
  const t = ctx.currentTime;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(preset.filterHz, t);
  filter.Q.setValueAtTime(0.55, t);

  const master = ctx.createGain();
  master.gain.setValueAtTime(fadeIn ? 0.0001 : peakGain(mode), t);
  filter.connect(master);
  master.connect(getLexioAudioOutput(ctx));

  const eng: BgmEngine = {
    mode,
    master,
    filter,
    nextNoteTime: t + 0.15,
    step: 0,
    chordIndex: 0,
    schedulerId: setInterval(() => {
      if (engine === eng) tickEngine(ctx, eng);
    }, SCHEDULER_MS),
  };

  engine = eng;
  starting = false;

  if (fadeIn) {
    master.gain.linearRampToValueAtTime(peakGain(mode), t + FADE_IN_SEC);
  }
}

export function stopLexioBgm(): void {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (crossfadeTimer) {
    clearTimeout(crossfadeTimer);
    crossfadeTimer = null;
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

export function setLexioBgmMode(mode: LexioBgmMode): void {
  if (isLexioSfxMuted()) return;
  if (engine?.mode === mode) return;

  const ctx = getLexioAudioContext();
  if (!ctx) return;

  if (!engine) {
    if (starting) return;
    starting = true;
    beginEngine(mode);
    return;
  }

  if (crossfadeTimer) {
    clearTimeout(crossfadeTimer);
    crossfadeTimer = null;
  }

  const outgoing = engine;
  engine = null;

  const t = ctx.currentTime;
  outgoing.master.gain.cancelScheduledValues(t);
  outgoing.master.gain.setValueAtTime(outgoing.master.gain.value, t);
  outgoing.master.gain.linearRampToValueAtTime(0.0001, t + CROSSFADE_SEC);

  crossfadeTimer = setTimeout(() => {
    crossfadeTimer = null;
    stopEngine(outgoing);
    beginEngine(mode);
  }, CROSSFADE_SEC * 1000 + 40);
}

export function startLexioBgm(mode: LexioBgmMode = 'playing'): void {
  setLexioBgmMode(mode);
}
