import type { LexioCombination } from './lexio';
import {
  getLexioSfxVolume,
  isLexioSfxMuted,
  unlockLexioAudio,
} from './lexioSounds';

export type LexioVoiceLineId =
  | 'stallNag'
  | 'reactFlush'
  | 'reactFullHouse'
  | 'reactStraightFlush';

/** TTS 멘트 — public/audio/lexio/voice/*.mp3 가 있으면 파일 우선 */
export const LEXIO_VOICE_LINES: Record<LexioVoiceLineId, string[]> = {
  stallNag: [
    '아, 언제까지 기다려야 되는 거야?',
    '에이, 빨리 좀 내. 다들 지치잖아.',
    '뭐야, 패 고르다 잠든 거야?',
    '하… 아직도야? 언제 내.',
    '언제까지 끌 거야, 빨리 좀 내줘.',
    '기다리다 목 빠지겠어, 빨리.',
  ],
  reactFlush: [
    '와… 플러시네요.',
    '플러시예요, 정말 멋져요.',
    '오… 예쁜 플러시예요.',
  ],
  reactFullHouse: [
    '풀하우스라니, 대단해요.',
    '와… 풀하우스네요.',
    '풀하우스예요, 정말 멋지네요.',
  ],
  reactStraightFlush: [
    '어머… 스트레이트 플러시예요.',
    '스트레이트 플러시라니, 믿기지가 않아요.',
    '와… 스트레이트 플러시예요.',
  ],
};

/** mp3 추가 시 같은 id 파일명 사용 (예: stall-nag.mp3) */
const LEXIO_VOICE_FILES: Partial<Record<LexioVoiceLineId, string>> = {
  stallNag: '/audio/lexio/voice/stall-nag.mp3',
  reactFlush: '/audio/lexio/voice/react-flush.mp3',
  reactFullHouse: '/audio/lexio/voice/react-fullhouse.mp3',
  reactStraightFlush: '/audio/lexio/voice/react-straightflush.mp3',
};

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesReady = false;
let currentAudio: HTMLAudioElement | null = null;

function initVoiceList(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  cachedVoices = window.speechSynthesis.getVoices();
  voicesReady = cachedVoices.length > 0;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  initVoiceList();
  window.speechSynthesis.addEventListener('voiceschanged', initVoiceList);
}

/** 부드러운 여성 TTS — 속도·피치는 speakText에서 적용 */
const TTS_SOFT_RATE = 0.93;
const TTS_SOFT_PITCH = 1.06;

function scoreKoreanFemaleVoice(v: SpeechSynthesisVoice): number {
  const label = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;

  if (/female|woman|heami|sun-hi|yuna|girl|여성|여/i.test(label)) score += 12;
  if (/heami|sun-hi|yuna|google 한국의|microsoft.*ko/i.test(label)) score += 6;
  if (/male|man|inho|jinho|남성|남/i.test(label)) score -= 20;

  return score;
}

function pickKoreanFemaleVoice(): SpeechSynthesisVoice | null {
  if (!cachedVoices.length) initVoiceList();
  const ko = cachedVoices.filter(
    (v) => v.lang === 'ko-KR' || v.lang.startsWith('ko'),
  );
  if (ko.length === 0) return null;

  return [...ko].sort(
    (a, b) => scoreKoreanFemaleVoice(b) - scoreKoreanFemaleVoice(a),
  )[0] ?? null;
}

export function voiceLineForCombo(
  combo: LexioCombination | null,
): LexioVoiceLineId | null {
  if (!combo) return null;
  if (combo.type === 'straightflush') return 'reactStraightFlush';
  if (combo.type === 'fullhouse') return 'reactFullHouse';
  if (combo.type === 'flush') return 'reactFlush';
  return null;
}

export function stopLexioVoice(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function speakText(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.volume = getLexioSfxVolume() * 0.92;
  utterance.rate = TTS_SOFT_RATE;
  utterance.pitch = TTS_SOFT_PITCH;

  const voice = pickKoreanFemaleVoice();
  if (voice) utterance.voice = voice;

  window.speechSynthesis.speak(utterance);
}

async function tryPlayVoiceFile(url: string, fallbackText: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const audio = new Audio(url);
    audio.volume = getLexioSfxVolume() * 0.92;
    currentAudio = audio;

    const played = await new Promise<boolean>((resolve) => {
      const cleanup = () => {
        audio.removeEventListener('canplaythrough', onReady);
        audio.removeEventListener('error', onError);
      };
      const onReady = () => {
        cleanup();
        void audio.play().then(() => resolve(true)).catch(() => resolve(false));
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      audio.addEventListener('canplaythrough', onReady, { once: true });
      audio.addEventListener('error', onError, { once: true });
      audio.load();
      window.setTimeout(() => {
        cleanup();
        resolve(false);
      }, 400);
    });

    if (!played) {
      currentAudio = null;
      return false;
    }

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
    };
    return true;
  } catch {
    currentAudio = null;
    speakText(fallbackText);
    return true;
  }
}

/** AI 멘트 재생 — SFX 음소거·볼륨 설정 따름 */
export function playLexioVoice(lineId: LexioVoiceLineId): void {
  if (typeof window === 'undefined') return;
  if (isLexioSfxMuted()) return;

  unlockLexioAudio();

  const pool = LEXIO_VOICE_LINES[lineId];
  const text = pool[Math.floor(Math.random() * pool.length)] ?? '';
  if (!text) return;

  stopLexioVoice();

  const file = LEXIO_VOICE_FILES[lineId];
  if (file) {
    void tryPlayVoiceFile(file, text).then((ok) => {
      if (!ok) speakText(text);
    });
    return;
  }

  speakText(text);
}

export function isLexioVoiceReady(): boolean {
  return voicesReady || cachedVoices.length > 0;
}
