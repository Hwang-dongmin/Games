import type { LexioCombination } from './lexio';

export type LexioVoiceLineId =
  | 'stallNag'
  | 'reactFlush'
  | 'reactFullHouse'
  | 'reactStraightFlush';

/** AI 대사 풀 — 화면 표시용 (음성 재생 없음) */
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

export function pickLexioVoiceLine(lineId: LexioVoiceLineId): string {
  const pool = LEXIO_VOICE_LINES[lineId];
  return pool[Math.floor(Math.random() * pool.length)] ?? '';
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
