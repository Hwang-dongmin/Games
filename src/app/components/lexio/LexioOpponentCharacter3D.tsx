import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import {
  LEXIO_CHARACTER_GLB,
  LEXIO_OPPONENT_CHARACTERS,
  LEXIO_OPPONENT_GLB_PRELOAD_URLS,
  LEXIO_REACTION_CLIP_NAMES,
  type LexioOpponentCharacterId,
  REACTION_CLIP_START_SEC,
  reactionClipEndTrimSec,
  reactionClipPlayEndTime,
  reactionUsesStandingSeat,
  REACTION_CLIP_DEFAULT_END_TRIM_SEC,
  type LexioOpponentReactionClip,
  type LexioOpponentReactionSignal,
} from '../../utils/lexioCharacterReactions';
import { rebindMixamoMergedClips } from '../../utils/lexioCharacterAnimations';

export const LEXIO_SITTING_MODEL_URL = LEXIO_CHARACTER_GLB.sitting;
export const LEXIO_STANDING_CLAP_MODEL_URL = LEXIO_CHARACTER_GLB.standingClap;

const SITTING_POSE_CLIP = 'Sitting';

const MODEL_YAW = 0;
const STANDING_SEAT_BACK_Z = -0.55;
const SEAT_Z_LERP = 12;
/** Sitting 클립 bind/T-pose 구간 스킵 — idle·복귀 시작 시각(초) */
const SITTING_IDLE_START_SEC = 0.05;

export type { LexioOpponentReactionSignal };

function pushNamedClip(
  clips: THREE.AnimationClip[],
  anims: THREE.AnimationClip[],
  name: string,
) {
  const clip = rebindMixamoMergedClips(anims)[0];
  if (!clip) return;
  clip.name = name;
  clips.push(clip);
}

function buildOpponentAnimationClips(
  sittingAnims: THREE.AnimationClip[],
  standingClapAnims: THREE.AnimationClip[],
  sittingClapAnims: THREE.AnimationClip[],
  sittingPointingAnims: THREE.AnimationClip[],
  sittingYellAnims: THREE.AnimationClip[],
  sittingWeaponGrabAnims: THREE.AnimationClip[],
  shovedAnims: THREE.AnimationClip[],
  lookingAroundAnims: THREE.AnimationClip[],
  lookingAround2Anims: THREE.AnimationClip[],
  sittingDisbeliefAnims: THREE.AnimationClip[],
  sittingGunMotionAnims: THREE.AnimationClip[],
  sittingRubbingArmAnims: THREE.AnimationClip[],
  sittingHandsUpClapAnims: THREE.AnimationClip[],
  sittingHandsUpClapFastAnims: THREE.AnimationClip[],
): THREE.AnimationClip[] {
  const clips: THREE.AnimationClip[] = [];

  pushNamedClip(clips, sittingAnims, SITTING_POSE_CLIP);

  const standingBase = rebindMixamoMergedClips(standingClapAnims)[0];
  if (standingBase) {
    standingBase.name = LEXIO_REACTION_CLIP_NAMES['standing-clap'];
    clips.push(standingBase);
  }

  pushNamedClip(
    clips,
    sittingClapAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-clap'],
  );
  pushNamedClip(
    clips,
    sittingPointingAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-pointing'],
  );
  pushNamedClip(
    clips,
    sittingYellAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-yell'],
  );
  pushNamedClip(
    clips,
    sittingWeaponGrabAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-weapon-grab'],
  );
  pushNamedClip(clips, shovedAnims, LEXIO_REACTION_CLIP_NAMES.shoved);
  pushNamedClip(
    clips,
    lookingAroundAnims,
    LEXIO_REACTION_CLIP_NAMES['looking-around'],
  );
  pushNamedClip(
    clips,
    lookingAround2Anims,
    LEXIO_REACTION_CLIP_NAMES['looking-around2'],
  );
  pushNamedClip(
    clips,
    sittingDisbeliefAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-disbelief'],
  );
  pushNamedClip(
    clips,
    sittingGunMotionAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-gun-motion'],
  );
  pushNamedClip(
    clips,
    sittingRubbingArmAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-rubbing-arm'],
  );
  pushNamedClip(
    clips,
    sittingHandsUpClapAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-hands-up-clap'],
  );
  pushNamedClip(
    clips,
    sittingHandsUpClapFastAnims,
    LEXIO_REACTION_CLIP_NAMES['sitting-hands-up-clap-fast'],
  );

  return clips;
}

function overlayActionForReaction(
  clip: LexioOpponentReactionClip,
  actions: Record<string, THREE.AnimationAction | undefined | null>,
): THREE.AnimationAction | null {
  return actions[LEXIO_REACTION_CLIP_NAMES[clip]] ?? null;
}

/** SkeletonUtils.clone은 mesh material을 공유하므로 턴 하이라이트가 전 좌석에 동시 적용된다 */
function cloneMeshMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
}

function sittingIdleStartTime(action: THREE.AnimationAction): number {
  const duration = action.getClip().duration;
  if (duration <= 0) return 0;
  return Math.min(SITTING_IDLE_START_SEC, Math.max(0, duration - 0.05));
}

function snapSittingToIdleStart(action: THREE.AnimationAction): void {
  action.time = sittingIdleStartTime(action);
}

function applySittingIdle(
  action: THREE.AnimationAction,
  mixer: THREE.AnimationMixer,
  allActions: Record<string, THREE.AnimationAction | undefined | null>,
) {
  for (const other of Object.values(allActions)) {
    if (other && other !== action) {
      other.stop();
      other.setEffectiveWeight(0);
    }
  }

  const startTime = sittingIdleStartTime(action);

  action.enabled = true;
  if (!action.isRunning()) {
    action.reset();
    action.time = startTime;
    action.play();
  } else if (action.time < SITTING_IDLE_START_SEC) {
    action.time = startTime;
  }
  action.setEffectiveWeight(1);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.timeScale = 1;
  action.paused = false;
  mixer.update(0);
}

/** sitting은 항상 weight 1 — overlay만 fade (crossFade 시 bind/T-pose) */
function ensureSittingBaseLayer(
  sitting: THREE.AnimationAction,
  mixer: THREE.AnimationMixer,
) {
  snapSittingToIdleStart(sitting);
  sitting.enabled = true;
  sitting.setLoop(THREE.LoopRepeat, Infinity);
  sitting.clampWhenFinished = false;
  sitting.timeScale = 1;
  sitting.paused = false;
  sitting.setEffectiveWeight(1);
  if (!sitting.isRunning()) {
    sitting.reset();
    sitting.time = sittingIdleStartTime(sitting);
    sitting.play();
  }
  mixer.update(0);
}

const OVERLAY_FADE_IN_SEC = 0.15;
const OVERLAY_FADE_OUT_SEC = 0.35;

function fadeActionWeight(
  action: THREE.AnimationAction,
  from: number,
  to: number,
  durationSec: number,
  mixer: THREE.AnimationMixer,
  onDone?: () => void,
): () => void {
  if (durationSec <= 0) {
    action.setEffectiveWeight(to);
    mixer.update(0);
    onDone?.();
    return () => {};
  }

  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    const raw = Math.min(1, (performance.now() - t0) / (durationSec * 1000));
    const eased = raw * raw * (3 - 2 * raw);
    action.setEffectiveWeight(THREE.MathUtils.lerp(from, to, eased));
    mixer.update(0);
    if (raw < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      onDone?.();
    }
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (raf) cancelAnimationFrame(raf);
  };
}

function overlayPlayEndTime(
  action: THREE.AnimationAction,
  startSec: number,
  endTrimSec: number,
): number {
  return reactionClipPlayEndTime(action.getClip().duration, startSec, endTrimSec);
}

function clampOverlayAtEnd(
  overlay: THREE.AnimationAction,
  endTime: number,
) {
  overlay.time = Math.min(Math.max(overlay.time, 0), endTime);
  overlay.clampWhenFinished = true;
  if (!overlay.isRunning()) overlay.play();
}

function returnOverlayToSitting(
  overlay: THREE.AnimationAction,
  sitting: THREE.AnimationAction,
  mixer: THREE.AnimationMixer,
  allActions: Record<string, THREE.AnimationAction | undefined | null>,
  overlayEndTime: number,
  onSeatOffset?: (back: boolean) => void,
): () => void {
  for (const other of Object.values(allActions)) {
    if (other && other !== sitting && other !== overlay) {
      other.stop();
      other.setEffectiveWeight(0);
    }
  }

  onSeatOffset?.(false);
  clampOverlayAtEnd(overlay, overlayEndTime);
  ensureSittingBaseLayer(sitting, mixer);

  const overlayWeight = overlay.getEffectiveWeight();
  let cancelFade: (() => void) | null = null;

  cancelFade = fadeActionWeight(
    overlay,
    overlayWeight,
    0,
    OVERLAY_FADE_OUT_SEC,
    mixer,
    () => {
      overlay.stop();
      overlay.setEffectiveWeight(0);
      ensureSittingBaseLayer(sitting, mixer);
    },
  );

  return () => {
    cancelFade?.();
    overlay.stop();
    overlay.setEffectiveWeight(0);
    onSeatOffset?.(false);
    applySittingIdle(sitting, mixer, allActions);
  };
}

function playOneShotOverlay(
  overlay: THREE.AnimationAction,
  sitting: THREE.AnimationAction,
  mixer: THREE.AnimationMixer,
  allActions: Record<string, THREE.AnimationAction | undefined | null>,
  onComplete: (ctx: {
    overlay: THREE.AnimationAction;
    finish: () => void;
  }) => void,
  options?: { standingSeatOffset?: boolean; onSeatOffset?: (back: boolean) => void },
  startTime = 0,
  endTrimSec = REACTION_CLIP_DEFAULT_END_TRIM_SEC,
): () => void {
  const { standingSeatOffset = false, onSeatOffset } = options ?? {};
  const overlayEndTime = overlayPlayEndTime(overlay, startTime, endTrimSec);
  if (standingSeatOffset) onSeatOffset?.(true);

  for (const other of Object.values(allActions)) {
    if (other && other !== sitting && other !== overlay) {
      other.stop();
      other.setEffectiveWeight(0);
    }
  }

  ensureSittingBaseLayer(sitting, mixer);

  overlay.reset();
  overlay.setLoop(THREE.LoopOnce, 1);
  overlay.clampWhenFinished = true;
  overlay.timeScale = 1;
  overlay.paused = false;
  overlay.time = Math.min(Math.max(0, startTime), overlayEndTime);
  overlay.setEffectiveWeight(0);
  overlay.play();
  mixer.update(0);

  let cancelFadeIn: (() => void) | null = fadeActionWeight(
    overlay,
    0,
    1,
    OVERLAY_FADE_IN_SEC,
    mixer,
  );

  let finished = false;
  let finishReturn: (() => void) | null = null;

  const finish = () => {
    if (finished) return;
    finished = true;
    mixer.removeEventListener('finished', onFinished);
    finishReturn?.();
    finishReturn = returnOverlayToSitting(
      overlay,
      sitting,
      mixer,
      allActions,
      overlayEndTime,
      onSeatOffset,
    );
  };

  const onFinished = (event: THREE.Event & { action: THREE.AnimationAction }) => {
    if (event.action !== overlay) return;
    finish();
  };
  mixer.addEventListener('finished', onFinished);
  onComplete({ overlay, finish });

  return () => {
    mixer.removeEventListener('finished', onFinished);
    cancelFadeIn?.();
    finishReturn?.();
    overlay.stop();
    onSeatOffset?.(false);
    applySittingIdle(sitting, mixer, allActions);
  };
}

type LexioOpponentCharacter3DProps = {
  seatPosition: [number, number, number];
  characterId?: LexioOpponentCharacterId;
  isActive?: boolean;
  reaction?: LexioOpponentReactionSignal | null;
};

export function LexioOpponentCharacter3D({
  seatPosition,
  characterId = 'peasant-girl',
  isActive = false,
  reaction = null,
}: LexioOpponentCharacter3DProps) {
  const { mesh: meshUrl, scale: modelScale, sittingAnim: sittingAnimUrl } =
    LEXIO_OPPONENT_CHARACTERS[characterId];
  const { scene: meshScene } = useGLTF(meshUrl);
  const { animations: sittingAnims } = useGLTF(sittingAnimUrl);
  const { animations: standingClapAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.standingClap,
  );
  const { animations: sittingClapAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingClap,
  );
  const { animations: sittingPointingAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingPointing,
  );
  const { animations: sittingYellAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingYell,
  );
  const { animations: sittingWeaponGrabAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingWeaponGrab,
  );
  const { animations: shovedAnims } = useGLTF(LEXIO_CHARACTER_GLB.shoved);
  const { animations: lookingAroundAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.lookingAround,
  );
  const { animations: lookingAround2Anims } = useGLTF(
    LEXIO_CHARACTER_GLB.lookingAround2,
  );
  const { animations: sittingDisbeliefAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingDisbelief,
  );
  const { animations: sittingGunMotionAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingGunMotion,
  );
  const { animations: sittingRubbingArmAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingRubbingArm,
  );
  const { animations: sittingHandsUpClapAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingHandsUpClap,
  );
  const { animations: sittingHandsUpClapFastAnims } = useGLTF(
    LEXIO_CHARACTER_GLB.sittingHandsUpClapFast,
  );

  const model = useMemo(() => {
    const cloned = SkeletonUtils.clone(meshScene);
    cloneMeshMaterials(cloned);
    return cloned;
  }, [meshScene]);
  const animationClips = useMemo(
    () =>
      buildOpponentAnimationClips(
        sittingAnims,
        standingClapAnims,
        sittingClapAnims,
        sittingPointingAnims,
        sittingYellAnims,
        sittingWeaponGrabAnims,
        shovedAnims,
        lookingAroundAnims,
        lookingAround2Anims,
        sittingDisbeliefAnims,
        sittingGunMotionAnims,
        sittingRubbingArmAnims,
        sittingHandsUpClapAnims,
        sittingHandsUpClapFastAnims,
      ),
    [
      sittingAnims,
      standingClapAnims,
      sittingClapAnims,
      sittingPointingAnims,
      sittingYellAnims,
      sittingWeaponGrabAnims,
      shovedAnims,
      lookingAroundAnims,
      lookingAround2Anims,
      sittingDisbeliefAnims,
      sittingGunMotionAnims,
      sittingRubbingArmAnims,
      sittingHandsUpClapAnims,
      sittingHandsUpClapFastAnims,
    ],
  );
  const { actions, mixer } = useAnimations(animationClips, model);
  const didInitSittingPose = useRef(false);
  const rootGroupRef = useRef<THREE.Group>(null);
  const seatOffsetZRef = useRef(0);
  const seatOffsetTargetRef = useRef(0);
  const overlayPlaybackRef = useRef<{
    overlay: THREE.AnimationAction;
    endTime: number;
    finish: () => void;
  } | null>(null);

  const setStandingSeatOffset = (back: boolean) => {
    seatOffsetTargetRef.current = back ? STANDING_SEAT_BACK_Z : 0;
  };

  useFrame((_, delta) => {
    const target = seatOffsetTargetRef.current;
    const current = seatOffsetZRef.current;
    if (Math.abs(target - current) > 0.0005) {
      seatOffsetZRef.current = THREE.MathUtils.lerp(
        current,
        target,
        1 - Math.exp(-SEAT_Z_LERP * delta),
      );
    } else {
      seatOffsetZRef.current = target;
    }
    if (rootGroupRef.current) {
      rootGroupRef.current.position.z = seatOffsetZRef.current;
    }

    const state = overlayPlaybackRef.current;
    if (!state) return;

    const { overlay, endTime, finish } = state;
    if (!overlay.isRunning()) return;

    if (overlay.time >= endTime) {
      overlay.time = endTime;
      finish();
    }
  });

  useLayoutEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [model]);

  useLayoutEffect(() => {
    const sitting = actions[SITTING_POSE_CLIP];
    if (!sitting || didInitSittingPose.current) return;
    didInitSittingPose.current = true;
    applySittingIdle(sitting, mixer, actions);
  }, [actions, mixer]);

  useEffect(() => {
    if (!reaction) return;
    const overlay = overlayActionForReaction(reaction.clip, actions);
    const sitting = actions[SITTING_POSE_CLIP];
    if (!overlay || !sitting) return;

    const standingSeatOffset = reactionUsesStandingSeat(reaction.clip);
    const startTime = REACTION_CLIP_START_SEC[reaction.clip] ?? 0;
    const endTrimSec = reactionClipEndTrimSec(reaction.clip);

    overlayPlaybackRef.current = null;
    return playOneShotOverlay(
      overlay,
      sitting,
      mixer,
      actions,
      (ctx) => {
        const endTime = overlayPlayEndTime(ctx.overlay, startTime, endTrimSec);
        overlayPlaybackRef.current = {
          overlay: ctx.overlay,
          endTime,
          finish: () => {
            overlayPlaybackRef.current = null;
            ctx.finish();
          },
        };
      },
      {
        standingSeatOffset,
        onSeatOffset: setStandingSeatOffset,
      },
      startTime,
      endTrimSec,
    );
  }, [reaction?.id, reaction?.clip, actions, mixer]);

  useEffect(() => {
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        if (!('emissive' in material)) continue;
        const std = material as THREE.MeshStandardMaterial;
        std.emissive.set(isActive ? '#5b21b6' : '#000000');
        std.emissiveIntensity = isActive ? 0.22 : 0;
      }
    });
  }, [isActive, model]);

  return (
    <group ref={rootGroupRef} scale={modelScale}>
      <primitive object={model} rotation={[0, MODEL_YAW, 0]} />
    </group>
  );
}

for (const url of LEXIO_OPPONENT_GLB_PRELOAD_URLS) {
  useGLTF.preload(url);
}
