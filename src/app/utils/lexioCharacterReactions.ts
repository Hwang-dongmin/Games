import type { LexioCombination } from './lexio';

import { REACTION_CHANCE } from './lexioReactionGate';



/** Mixamo 클립 — public/models/glb/*.glb 파일명과 동일 */

export type LexioOpponentReactionClip =

  | 'sitting-clap'

  | 'standing-clap'

  | 'sitting-pointing'

  | 'sitting-yell'

  | 'sitting-weapon-grab'

  | 'shoved'

  | 'looking-around'

  | 'looking-around2'

  | 'sitting-disbelief'

  | 'sitting-gun-motion'

  | 'sitting-rubbing-arm'

  | 'sitting-hands-up-clap'

  | 'sitting-hands-up-clap-fast';



export type LexioOpponentReactionSignal = {

  id: number;

  clip: LexioOpponentReactionClip;

  /** 지정 시 해당 좌석 AI만 재생 */

  targetPlayerId?: number;

};



export const LEXIO_REACTION_CLIP_NAMES: Record<

  LexioOpponentReactionClip,

  string

> = {

  'sitting-clap': 'Sitting Clap',

  'standing-clap': 'Standing Clap',

  'sitting-pointing': 'Sitting And Pointing',

  'sitting-yell': 'Sitting Yell',

  'sitting-weapon-grab': 'Sitting Weapon Grab',

  shoved: 'Shoved',

  'looking-around': 'Looking Around',

  'looking-around2': 'Looking Around2',

  'sitting-disbelief': 'Sitting Disbelief',

  'sitting-gun-motion': 'Sitting Gun Motion',

  'sitting-rubbing-arm': 'Sitting Rubbing Arm',

  'sitting-hands-up-clap': 'Sitting hands up Clap',

  'sitting-hands-up-clap-fast': 'Sitting hands up Clap fast',

};



const GLB = '/models/glb';



/** 캐릭터·리액션 GLB — 병합 파일 없이 개별 로드 */

export const LEXIO_CHARACTER_GLB = {

  sitting: `${GLB}/Sitting.glb`,

  standingClap: `${GLB}/Standing Clap.glb`,

  sittingClap: `${GLB}/Sitting Clap.glb`,

  sittingPointing: `${GLB}/Sitting And Pointing.glb`,

  sittingYell: `${GLB}/Sitting Yell.glb`,

  sittingWeaponGrab: `${GLB}/Sitting Weapon Grab.glb`,

  shoved: `${GLB}/Shoved.glb`,

  lookingAround: `${GLB}/Looking Around.glb`,

  lookingAround2: `${GLB}/Looking Around2.glb`,

  sittingDisbelief: `${GLB}/Sitting Disbelief.glb`,

  sittingGunMotion: `${GLB}/Sitting Gun Motion.glb`,

  sittingRubbingArm: `${GLB}/Sitting Rubbing Arm.glb`,

  sittingHandsUpClap: `${GLB}/Sitting hands up Clap.glb`,

  sittingHandsUpClapFast: `${GLB}/Sitting hands up Clap fast.glb`,

} as const;



/** useGLTF.preload용 — URL 중복 제거 */

export const LEXIO_CHARACTER_GLB_PRELOAD_URLS = [

  ...new Set(Object.values(LEXIO_CHARACTER_GLB)),

] as string[];



/** Mixamo 메시 — Peasant glb/ 클립과 본 이름이 같으면 애니 재사용 가능 */

export type LexioOpponentCharacterId = 'peasant-girl' | 'remy' | 'josh';



export const LEXIO_OPPONENT_CHARACTERS: Record<

  LexioOpponentCharacterId,

  { mesh: string; scale: number; sittingAnim: string; displayName?: string }

> = {

  'peasant-girl': {

    mesh: LEXIO_CHARACTER_GLB.sitting,

    scale: 1,

    sittingAnim: LEXIO_CHARACTER_GLB.sitting,

  },

  remy: {

    mesh: `${GLB}/Remy.glb`,

    scale: 0.6,

    sittingAnim: LEXIO_CHARACTER_GLB.sitting,

  },

  josh: {

    mesh: `${GLB}/MaleSitting.glb`,

    scale: 1.25,

    sittingAnim: `${GLB}/MaleSitting.glb`,

    displayName: 'Josh',

  },

};



const OPPONENT_CHARACTER_ORDER: LexioOpponentCharacterId[] = [

  'peasant-girl',

  'remy',

  'josh',

];



/** AI 좌석별 캐릭터 (id 1→Peasant, 2→Remy, 3→Josh, … 순환) */

export function lexioOpponentCharacterForPlayerId(

  playerId: number,

): LexioOpponentCharacterId {

  const idx = Math.max(0, playerId - 1) % OPPONENT_CHARACTER_ORDER.length;

  return OPPONENT_CHARACTER_ORDER[idx];

}



/** useGLTF.preload — 공유 애니 + 캐릭터 메시 */

export const LEXIO_OPPONENT_GLB_PRELOAD_URLS = [

  ...new Set([

    ...LEXIO_CHARACTER_GLB_PRELOAD_URLS,

    ...Object.values(LEXIO_OPPONENT_CHARACTERS).map((c) => c.mesh),

  ]),

] as string[];



/** 일어서는 리액션 — 테이블에서 뒤로 */

export function reactionUsesStandingSeat(

  clip: LexioOpponentReactionClip,

): boolean {

  return clip === 'standing-clap';

}



/** 클립 앞 준비 구간 스킵 (초) */

export const REACTION_CLIP_START_SEC: Partial<

  Record<LexioOpponentReactionClip, number>

> = {

  'sitting-yell': 0.35,

};



export const REACTION_CLIP_DEFAULT_END_TRIM_SEC = 0.05;



export const REACTION_CLIP_END_TRIM_SEC: Partial<

  Record<LexioOpponentReactionClip, number>

> = {};



export function reactionClipEndTrimSec(

  clip: LexioOpponentReactionClip,

): number {

  return REACTION_CLIP_END_TRIM_SEC[clip] ?? REACTION_CLIP_DEFAULT_END_TRIM_SEC;

}



export function reactionClipPlayEndTime(

  duration: number,

  startSec: number,

  endTrimSec: number,

): number {

  return Math.max(startSec + 0.05, duration - endTrimSec);

}



/**

 * 테이블 족보 → AI 반응 (salt로 동일 족보도 가끔 변형)

 * - single → disbelief (확률은 씬 게이트에서)

 */

export function tableReactionClipForCombo(

  combo: LexioCombination,

  salt: number,

): LexioOpponentReactionClip | null {

  switch (combo.type) {

    case 'straightflush':

      return 'standing-clap';

    case 'flush':

      return salt % 3 === 0 ? 'sitting-hands-up-clap' : 'sitting-clap';

    case 'fullhouse':

      return salt % 2 === 0 ? 'sitting-hands-up-clap' : 'sitting-clap';

    case 'fourkind':

      return salt % 4 === 0 ? 'sitting-gun-motion' : 'sitting-weapon-grab';

    case 'straight':

      return 'sitting-pointing';

    case 'triple':

      return 'sitting-yell';

    case 'pair':

      return salt % 3 === 0 ? 'sitting-hands-up-clap-fast' : 'shoved';

    case 'single':

      return 'sitting-disbelief';

    default:

      return null;

  }

}



/** @deprecated tableReactionClipForCombo 사용 */

export function tableReactionForCombo(

  combo: LexioCombination | null,

): LexioOpponentReactionClip | null {

  if (!combo) return null;

  return tableReactionClipForCombo(combo, 0);

}



export function passReactionClip(salt: number): LexioOpponentReactionClip {

  const variants: LexioOpponentReactionClip[] = [

    'sitting-disbelief',

    'sitting-rubbing-arm',

    'sitting-yell',

  ];

  return variants[salt % variants.length]!;

}



export function stallReactionClip(salt: number): LexioOpponentReactionClip {

  return salt % 3 === 0 ? 'sitting-rubbing-arm' : 'sitting-yell';

}



/** 무활동 idle — 둘러보기·팔 비비기·가끔 disbelief */

export function pickIdleReactionClip(

  salt: number,

): LexioOpponentReactionClip {

  const pool: LexioOpponentReactionClip[] = [

    'looking-around',

    'looking-around2',

    'looking-around',

    'sitting-rubbing-arm',

    'sitting-rubbing-arm',

    'looking-around2',

    'sitting-disbelief',

  ];

  return pool[salt % pool.length]!;

}



export function shouldAiTurnPoint(salt: number): boolean {

  const x = Math.abs(Math.sin(salt * 9.17) * 43758.5453);

  return x - Math.floor(x) < REACTION_CHANCE.aiTurnPoint;

}



export function shouldReactToPass(salt: number): boolean {

  const x = Math.abs(Math.sin(salt * 7.31) * 43758.5453);

  return x - Math.floor(x) < REACTION_CHANCE.onPass;

}



export function shouldReactToSingle(salt: number): boolean {

  const x = Math.abs(Math.sin(salt * 5.43) * 43758.5453);

  return x - Math.floor(x) < REACTION_CHANCE.onSingle;

}



export function reactionAppliesToSeat(

  signal: LexioOpponentReactionSignal | null | undefined,

  playerId: number,

): boolean {

  if (!signal) return false;

  if (signal.targetPlayerId === undefined) return true;

  return signal.targetPlayerId === playerId;

}



export function pickAiReactionSpeaker(

  aiPlayers: ReadonlyArray<{ id: number }>,

  excludePlayerId?: number,

  salt = 0,

): number | undefined {

  if (aiPlayers.length === 0) return undefined;

  const responders =

    excludePlayerId !== undefined

      ? aiPlayers.filter((ai) => ai.id !== excludePlayerId)

      : [...aiPlayers];

  if (responders.length === 0) return aiPlayers[0]?.id;

  return responders[salt % responders.length]!.id;

}



/** @deprecated pickIdleReactionClip 사용 */

export function pickIdleLookAroundClip(

  salt: number,

): 'looking-around' | 'looking-around2' {

  const clip = pickIdleReactionClip(salt);

  if (clip === 'looking-around' || clip === 'looking-around2') return clip;

  return salt % 2 === 0 ? 'looking-around' : 'looking-around2';

}



/** 좌석별 우선순위: 테이블 > 턴 > 패스 > 재촉 > idle */

export function pickSeatCharacterReaction(

  playerId: number,

  reactions: {

    table: LexioOpponentReactionSignal | null;

    turn: LexioOpponentReactionSignal | null;

    pass: LexioOpponentReactionSignal | null;

    stall?: LexioOpponentReactionSignal | null;

    idleLook?: LexioOpponentReactionSignal | null;

  },

): LexioOpponentReactionSignal | null {

  const ordered = [

    reactions.table,

    reactions.turn,

    reactions.pass,

    reactions.stall ?? null,

    reactions.idleLook ?? null,

  ];

  for (const signal of ordered) {

    if (reactionAppliesToSeat(signal, playerId)) return signal;

  }

  return null;

}


