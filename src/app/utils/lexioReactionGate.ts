/** AI 리액션 빈도 제어 — 이벤트·idle 간 최소 간격 */
export const REACTION_COOLDOWN = {
  /** 족보·턴·재촉 등 이벤트 리액션 최소 간격(초) */
  eventMinGapSec: 12,
  /** 패스 리액션 최소 간격(초) */
  passMinGapSec: 18,
  /** 무활동 idle 모션 주기(초) */
  idleIntervalSec: 35,
  /** 이벤트 리액션 직후 idle까지 대기(초) */
  idleAfterEventSec: 20,
} as const;

export const REACTION_CHANCE = {
  /** AI 새 트릭 선두 — 가리키기 */
  aiTurnPoint: 0.45,
  /** 패스 시 리액션 */
  onPass: 0.4,
  /** single 내기 — disbelief */
  onSingle: 0.35,
} as const;

export type LexioReactionGateState = {
  lastEventAt: number;
  lastIdleAt: number;
  lastPassAt: number;
};

export function createReactionGateState(): LexioReactionGateState {
  return { lastEventAt: 0, lastIdleAt: 0, lastPassAt: 0 };
}

function elapsedSec(sinceMs: number, now: number): number {
  return sinceMs <= 0 ? Infinity : (now - sinceMs) / 1000;
}

export function canEmitEventReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): boolean {
  return elapsedSec(gate.lastEventAt, now) >= REACTION_COOLDOWN.eventMinGapSec;
}

export function markEventReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): void {
  gate.lastEventAt = now;
  gate.lastIdleAt = now;
}

export function canEmitPassReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): boolean {
  if (elapsedSec(gate.lastPassAt, now) < REACTION_COOLDOWN.passMinGapSec) {
    return false;
  }
  return canEmitEventReaction(gate, now);
}

export function markPassReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): void {
  gate.lastPassAt = now;
  markEventReaction(gate, now);
}

export function canEmitIdleReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): boolean {
  if (elapsedSec(gate.lastIdleAt, now) < REACTION_COOLDOWN.idleIntervalSec) {
    return false;
  }
  if (elapsedSec(gate.lastEventAt, now) < REACTION_COOLDOWN.idleAfterEventSec) {
    return false;
  }
  return true;
}

export function markIdleReaction(
  gate: LexioReactionGateState,
  now = Date.now(),
): void {
  gate.lastIdleAt = now;
}
