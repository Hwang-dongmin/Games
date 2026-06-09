import React, {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  layoutHandTiles3D,
  layoutOpponentHandSlots3D,
  layoutOpponentHandTiles3D,
  OPPONENT_MAX_CARDS_PER_ROW,
} from '../../utils/lexioHandLayout';
import {
  LEXIO_CENTER_PLAY_TABLE_Z,
  LEXIO_TABLE_PLAY_RADIUS,
} from '../../utils/lexioTableLayout';
import {
  discardTileContactGroupY,
  getRoundedTileGeometry,
} from '../../utils/lexioTileGeometry';
import { Billboard, ContactShadows, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import type {
  LexioTile,
  LexioPlayer,
  LexioCombination,
} from '../../utils/lexio';
import {
  comboPlaySignature,
} from '../../utils/lexio';
import {
  pickAiReactionSpeaker,
  passReactionClip,
  pickIdleReactionClip,
  pickSeatCharacterReaction,
  shouldAiTurnPoint,
  shouldReactToPass,
  shouldReactToSingle,
  stallReactionClip,
  tableReactionClipForCombo,
  type LexioOpponentReactionSignal,
} from '../../utils/lexioCharacterReactions';
import {
  canEmitEventReaction,
  canEmitIdleReaction,
  canEmitPassReaction,
  createReactionGateState,
  markEventReaction,
  markIdleReaction,
  markPassReaction,
  REACTION_COOLDOWN,
} from '../../utils/lexioReactionGate';
import { LexioOpponentCharacter3D } from '../../components/lexio/LexioOpponentCharacter3D';
import { lexioOpponentCharacterForPlayerId, LEXIO_OPPONENT_CHARACTERS } from '../../utils/lexioCharacterReactions';
import {
  LexioPlayCard,
  lexioColorToSuit,
} from '../../components/lexio/LexioPlayCard';
import { LexioPlayCardFace3D } from '../../components/lexio/LexioPlayCardFace3D';

export type LexioDiscardPlacement = {
  key: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

/** 판 종료 시 테이블 중앙 UI */
export type LexioPlayerFinishCoins = {
  playerId: number;
  name: string;
  roundEarned: number;
  sessionTotal: number;
  doubledThisRound: boolean;
};

export type LexioFinishTableUi = {
  playersCoins: LexioPlayerFinishCoins[];
  completedRounds: number;
  totalRounds: number;
  winnerName: string | null;
  hasNextHand: boolean;
  onNextHand: () => void;
  onBackToSetup: () => void;
};

/** 면 비율(앞면 UI): 브리지 카드 57×89mm 에 가깝게 */
const CARD_RATIO_H_W = 89 / 57;
/** 돌 패 — 폭·높이 2배 스케일, 두께는 카드가 아닌 두꺼운 돌 */
const TILE_W = 0.212;
const TILE_H = TILE_W * CARD_RATIO_H_W;
const TILE_T = 0.092;
const FACE_Z = TILE_T / 2 + 0.0015;
/** 캐릭터 제외 — 테이블·패·카메라 등 playfield 전체 Y 보정 */
const SCENE_PLAYFIELD_LIFT_Y = 0.3;
/** 초록·갈색 테이블 메시 (TableRoom) — TABLE_TOP_Y와 펠트 윗면 동기화 */
const TABLE_FELT_CENTER_Y = 0.56;
const TABLE_FELT_HEIGHT = 0.04;
const TABLE_BROWN_CENTER_Y = 0.53;
const TABLE_BROWN_HEIGHT = 0.08;
/** 펠트 윗면 Y — 패·손패 접촉 기준 */
const TABLE_TOP_Y =
  TABLE_FELT_CENTER_Y + TABLE_FELT_HEIGHT / 2 + SCENE_PLAYFIELD_LIFT_Y;
const TABLE_SURFACE_EPS = 0.0015;
const TILT_BACK = -0.18;
/** 플레이어 손패 — 테이블 가장자리(카메라 쪽) */
const HAND_TABLE_Z = 1.45;
/** 판 종료: 패 공개·카메라 탑다운 애니메이션 길이(초) */
const FINISH_REVEAL_SEC = 2;
/** 세션 최초 진입: 위에서 시계방향으로 내려오며 1인칭 시점(초) */
const START_INTRO_SEC = 4.2;
/** 시계방향 회전량(라디안): 기본 호 + 한 바퀴(2π) */
const START_INTRO_ROTATION = Math.PI * 0.72 + Math.PI * 2;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _qOut = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const HOVER_LIFT = 0.088;
const SELECT_LIFT = 0.168;

/** 손패·테이블 돌 — roughness 낮춰 매끈한 윗면 하이라이트 */
const TILE_STONE_MAT = {
  color: '#131118',
  metalness: 0.16,
  roughness: 0.5,
} as const;

/** 돌 패 모서리 — ExtrudeGeometry + 라운딩 실루엣 (lexioTileGeometry) */
const LEXIO_TILE_ROUNDED_GEOM = getRoundedTileGeometry(TILE_W, TILE_H, TILE_T);
const LEXIO_DISCARD_ROUNDED_GEOM = getRoundedTileGeometry(
  TILE_W * 0.88,
  TILE_H * 0.88,
  TILE_T,
);

const _tileBBoxCorner = new THREE.Vector3();
const _tileWorldMat = new THREE.Matrix4();
const _tileM1 = new THREE.Matrix4();
const _tileM2 = new THREE.Matrix4();

type TileOnTableOpts = {
  groupY: number;
  groupZ: number;
  cardYaw?: number;
  tiltX?: number;
  tileX?: number;
  tileY?: number;
  tileZ?: number;
};

/** R_y(cardYaw)·T(0,groupY,groupZ)·R_x(tilt)·T(tile) 적용 후 패 바닥 최저 월드 Y */
function tileBottomMinY(
  geom: THREE.BufferGeometry,
  opts: TileOnTableOpts,
): number {
  const {
    groupY,
    groupZ,
    cardYaw = 0,
    tiltX = TILT_BACK,
    tileX = 0,
    tileY = 0,
    tileZ = 0,
  } = opts;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox!;

  _tileM1.makeRotationY(cardYaw);
  _tileM2.makeTranslation(0, groupY, groupZ);
  _tileWorldMat.copy(_tileM1).multiply(_tileM2);
  _tileM1.makeRotationX(tiltX);
  _tileWorldMat.multiply(_tileM1);
  _tileM1.makeTranslation(tileX, tileY, tileZ);
  _tileWorldMat.multiply(_tileM1);

  let yMin = Infinity;
  for (const x of [bb.min.x, bb.max.x]) {
    for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) {
        _tileBBoxCorner.set(x, y, z).applyMatrix4(_tileWorldMat);
        if (_tileBBoxCorner.y < yMin) yMin = _tileBBoxCorner.y;
      }
    }
  }
  return yMin;
}

const TABLE_CONTACT_TARGET = TABLE_TOP_Y + TABLE_SURFACE_EPS;

function solveGroupYOnTable(
  geom: THREE.BufferGeometry,
  groupZ: number,
  cardYaw = 0,
  tileX = 0,
  tileY = 0,
  tileZ = 0,
  tiltX = TILT_BACK,
  contactTarget = TABLE_CONTACT_TARGET,
): number {
  let lo = TABLE_TOP_Y - 0.5;
  let hi = TABLE_TOP_Y + 0.15;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (
      tileBottomMinY(geom, {
        groupY: mid,
        groupZ,
        cardYaw,
        tileX,
        tileY,
        tileZ,
        tiltX,
      }) > contactTarget
    ) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

const HAND_GROUP_Y = solveGroupYOnTable(
  LEXIO_TILE_ROUNDED_GEOM,
  HAND_TABLE_Z,
);
const CENTER_PLAY_GROUP_Y = solveGroupYOnTable(
  LEXIO_TILE_ROUNDED_GEOM,
  LEXIO_CENTER_PLAY_TABLE_Z,
);
/** 테이블에 완전히 눕힌 패(−90°) 그룹 Y */
const TILE_FLAT_Y =
  TABLE_TOP_Y -
  tileBottomMinY(LEXIO_TILE_ROUNDED_GEOM, {
    groupY: 0,
    groupZ: 0,
    tiltX: -Math.PI / 2,
  }) +
  TABLE_SURFACE_EPS;

/** 상대·AI 손패 — 기존(0.6) 대비 살짝 작게. 내 패(1.0)와 무관 */
const OPPONENT_TILE_SCALE = 0.53;
const OPPONENT_TILE_W = TILE_W * OPPONENT_TILE_SCALE;
const OPPONENT_TILE_H = TILE_H * OPPONENT_TILE_SCALE;
/** AI 패 두께 — 면적(0.52)보다 두께만 조금 덜 줄임 */
const OPPONENT_TILE_T = TILE_T * 0.58;
/** AI 손패 기울기 — 플레이어(TILT_BACK)보다 완만해 테이블에 자연스럽게 기대짐 */
const OPPONENT_TILT_BACK = -0.06;
/** 기존 상대 패 간격(TILE_W×0.78) 유지 — 카드만 줄이고 간격은 그대로 */
const OPPONENT_HAND_GAP = TILE_W * 0.78;
const OPPONENT_HAND_ROW_FRONT_Z = 0.16;
const OPPONENT_HAND_ROW_BACK_Z = -0.07;
const OPPONENT_TILE_GEOM = getRoundedTileGeometry(
  OPPONENT_TILE_W,
  OPPONENT_TILE_H,
  OPPONENT_TILE_T,
);
/** 좌석→테이블 안쪽 오프셋 (작을수록 플레이어 시점에 가깝게) */
const OPPONENT_HAND_Z = -1.0;
/** 판 종료 AI 패 공개 — 좌석→테이블 중심 거리 대비 안쪽 이동 (0=좌석, 1=중심) */
const OPPONENT_REVEAL_CENTER_FRAC = 0.54;
/** 캐릭터 발/베이스 높이 — 테이블·패는 그대로, 캐릭터만 위로 */
const CHARACTER_BASE_Y = 0;
/** 캐릭터 테이블 쪽 당김 — 좌석마다 테이블 반경 밖으로 clamp */
/** 좌석→테이블 안쪽 당김 — 작을수록 캐릭터가 테이블에서 멀어져 잘림 감소 */
const CHARACTER_TABLE_INSET_PREFERRED = 0.40;
const CHARACTER_SKIRT_CLEARANCE = 0.15;

function characterTableInset(seatPosition: [number, number, number]): number {
  const dist = Math.hypot(seatPosition[0], seatPosition[2]);
  const maxInset =
    dist - LEXIO_TABLE_PLAY_RADIUS - CHARACTER_SKIRT_CLEARANCE;
  return Math.max(
    0,
    Math.min(CHARACTER_TABLE_INSET_PREFERRED, maxInset),
  );
}

function opponentHandGroupY(
  cardYaw: number,
  handZ = OPPONENT_HAND_Z,
  referenceTileZ = 0,
): number {
  return solveGroupYOnTable(
    OPPONENT_TILE_GEOM,
    handZ,
    cardYaw,
    0,
    0,
    referenceTileZ,
    OPPONENT_TILT_BACK,
  );
}

/** 북서(3)·북동(4) — 대각 좌석은 앞줄(+Z)이 테이블 밖으로 나가기 쉬움 */
function opponentHandLayoutForSeat(playerId: number): {
  gap: number;
  frontRowZ: number;
  backRowZ: number;
  handZ: number;
} {
  if (playerId === 3 || playerId === 4) {
    return {
      gap: OPPONENT_HAND_GAP * 0.9,
      frontRowZ: 0.05,
      backRowZ: -0.19,
      handZ: -1.14,
    };
  }
  return {
    gap: OPPONENT_HAND_GAP,
    frontRowZ: OPPONENT_HAND_ROW_FRONT_Z,
    backRowZ: OPPONENT_HAND_ROW_BACK_Z,
    handZ: OPPONENT_HAND_Z,
  };
}

/** 세운 패 — 그룹 내 (x,y,z) 배치 후에도 바닥 높이 동일 */
function tileLocalWithTableContact(
  layoutX: number,
  layoutY: number,
  layoutZ: number,
  geom: THREE.BufferGeometry = LEXIO_TILE_ROUNDED_GEOM,
  tableOpts: TileOnTableOpts = {
    groupY: HAND_GROUP_Y,
    groupZ: HAND_TABLE_Z,
  },
): [number, number, number] {
  const ref = tileBottomMinY(geom, {
    ...tableOpts,
    tileX: 0,
    tileY: 0,
    tileZ: 0,
  });
  if (Math.abs(layoutY) < 0.0005 && Math.abs(layoutZ) < 0.0005) {
    return [layoutX, 0, 0];
  }
  let yLo = -0.4;
  let yHi = 0.4;
  for (let i = 0; i < 22; i++) {
    const mid = (yLo + yHi) / 2;
    const testY = layoutY + mid;
    if (
      tileBottomMinY(geom, {
        ...tableOpts,
        tileX: 0,
        tileY: testY,
        tileZ: layoutZ,
      }) > ref
    ) {
      yHi = mid;
    } else {
      yLo = mid;
    }
  }
  return [layoutX, layoutY + (yLo + yHi) / 2, layoutZ];
}

/** AI 손패 — 줄(Z)마다 기울기 보정해 테이블 접촉 높이 통일 */
function opponentTileLocalWithTableContact(
  layoutX: number,
  layoutY: number,
  layoutZ: number,
  opponentHandY: number,
  handZ: number,
  cardYaw: number,
): [number, number, number] {
  return tileLocalWithTableContact(
    layoutX,
    layoutY,
    layoutZ,
    OPPONENT_TILE_GEOM,
    {
      groupY: opponentHandY,
      groupZ: handZ,
      cardYaw,
      tiltX: OPPONENT_TILT_BACK,
    },
  );
}

const TILE_RENDER_ORDER: Record<'back' | 'single' | 'front', number> = {
  back: 0,
  single: 4,
  front: 8,
};

/** Html z-index [max, min] — drei가 거리로 보간. 줄별 범위가 겹치면 뒤줄이 앞줄을 덮을 수 있음 */
const TILE_HTML_Z_RANGE: Record<
  'back' | 'single' | 'front',
  [number, number]
> = {
  back: [180, 100],
  single: [320, 220],
  front: [320, 220],
};

const TILE_FACE_W = TILE_W * 0.92;
const TILE_FACE_H = TILE_H * 0.92;

function LexioTile3D({
  tile,
  position,
  rotation,
  selected,
  onClick,
  dimmed,
  facePointerHover = true,
  finishReveal = false,
  rowLayer = 'single',
  faceMode = 'mesh',
  liftAxis = 'y',
  tileScale = 1,
}: {
  tile: LexioTile;
  position: [number, number, number];
  rotation?: [number, number, number];
  selected?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  /** false면 앞면 호버 메시·2D 호버 강조 없음 (판 종료 후 상대 공개 패 등) */
  facePointerHover?: boolean;
  /** 판 종료 공개 패 — 숫자 2 후광을 더 밝게 */
  finishReveal?: boolean;
  /** 손패 2줄일 때 앞·뒤 가림 순서 */
  rowLayer?: 'back' | 'single' | 'front';
  /** mesh: WebGL plane 앞면(depth 정렬) / html: DOM Html 오버레이 */
  faceMode?: 'html' | 'mesh';
  /** 호버·선택 lift 축 (기본 Y) */
  liftAxis?: 'y' | 'z';
  /** 1=플레이어 손패, OPPONENT_TILE_SCALE=상대·AI(기존 0.6 대비) */
  tileScale?: number;
}) {
  const tileW = TILE_W * tileScale;
  const tileH = TILE_H * tileScale;
  const faceW = TILE_FACE_W * tileScale;
  const faceH = TILE_FACE_H * tileScale;
  const tileGeom = useMemo(
    () =>
      tileScale === 1
        ? LEXIO_TILE_ROUNDED_GEOM
        : getRoundedTileGeometry(tileW, tileH, TILE_T),
    [tileScale, tileW, tileH],
  );
  const groupRef = useRef<THREE.Group>(null);
  const liftSmoothed = useRef(0);
  const [hovered, setHovered] = useState(false);
  const interactive = !!onClick;
  const targetLift = selected
    ? SELECT_LIFT
    : hovered && interactive
      ? HOVER_LIFT
      : 0;

  useLayoutEffect(() => {
    liftSmoothed.current = 0;
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [tile.id, position[0], position[1], position[2]]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const t = 1 - Math.exp(-14 * delta);
    liftSmoothed.current += (targetLift - liftSmoothed.current) * t;
    const lift = liftSmoothed.current;
    if (liftAxis === 'z') {
      groupRef.current.position.set(
        position[0],
        position[1],
        position[2] + lift,
      );
    } else {
      groupRef.current.position.set(
        position[0],
        position[1] + lift,
        position[2],
      );
    }
  });

  const showFaceHover = facePointerHover;
  const cardHovered = showFaceHover && hovered;

  const meshOrder = TILE_RENDER_ORDER[rowLayer];
  const htmlZRange = TILE_HTML_Z_RANGE[rowLayer];
  const useMeshFace = faceMode === 'mesh';
  const suit = lexioColorToSuit(tile.color);

  const setHover = (next: boolean) => {
    setHovered(next);
    if (interactive) {
      document.body.style.cursor = next ? 'pointer' : 'default';
    }
  };

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      renderOrder={meshOrder}
    >
      <mesh
        castShadow
        receiveShadow
        geometry={tileGeom}
        renderOrder={meshOrder}
      >
        <meshStandardMaterial
          color={TILE_STONE_MAT.color}
          metalness={TILE_STONE_MAT.metalness}
          roughness={TILE_STONE_MAT.roughness}
          emissive="#000000"
          emissiveIntensity={0}
          opacity={dimmed ? 0.55 : 1}
          transparent={dimmed}
        />
      </mesh>
      {showFaceHover &&
        (useMeshFace
          ? interactive
          : !interactive) && (
        <mesh
          position={[0, 0, FACE_Z + 0.012]}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  onClick?.();
                }
              : undefined
          }
          onPointerOver={(e) => {
            e.stopPropagation();
            setHover(true);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHover(false);
          }}
        >
          <planeGeometry args={[tileW * 1.1, tileH * 1.55]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {useMeshFace ? (
        <group position={[0, 0, FACE_Z + 0.008]}>
          <LexioPlayCardFace3D
            number={tile.number}
            suit={suit}
            width={faceW}
            height={faceH}
            isHovered={cardHovered}
            renderOrder={meshOrder + 1}
          />
        </group>
      ) : (
      <Html
        transform
        center
        position={[0, 0, FACE_Z + 0.008]}
        /** 박스 폭(TILE_W=0.212)에 맞춰 앞면 DOM 스케일.
         *  DOM small 폭 49.6px ≈ 3D 박스 폭이 되도록 distanceFactor를 보정. */
        distanceFactor={1.55}
        zIndexRange={htmlZRange}
        renderOrder={meshOrder + 1}
        style={{ pointerEvents: 'none' }}
      >
        {interactive ? (
          /** 손패: DOM hit 영역(110%×155%) — Html·3D 투영 오차 없이 클릭·호버 */
          <div className="relative w-[3.1rem]">
            <LexioPlayCard
              number={tile.number}
              suit={suit}
              small
              embed3D
              isHovered={cardHovered}
            />
            <button
              type="button"
              aria-label={`패 ${tile.number} ${tile.color} 선택`}
              className="absolute cursor-pointer border-0 bg-transparent p-0"
              style={{
                pointerEvents: 'auto',
                left: '-5%',
                top: '-27.5%',
                width: '110%',
                height: '155%',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              onPointerEnter={() => setHover(true)}
              onPointerLeave={() => setHover(false)}
            />
          </div>
        ) : (
          <div className="pointer-events-none [&_*]:pointer-events-none">
            <LexioPlayCard
              number={tile.number}
              suit={suit}
              small
              embed3D
              isHovered={cardHovered}
            />
          </div>
        )}
      </Html>
      )}
    </group>
  );
}

function TileBack3D({
  position,
  rotation,
  tileScale = 0.85,
  tileT = TILE_T,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  tileScale?: number;
  tileT?: number;
}) {
  const w = TILE_W * tileScale;
  const h = TILE_H * tileScale;
  const backGeom = useMemo(
    () => getRoundedTileGeometry(w, h, tileT),
    [w, h, tileT],
  );
  return (
    <group position={position} rotation={rotation ?? [0, 0, 0]}>
      <mesh castShadow receiveShadow geometry={backGeom}>
        <meshStandardMaterial
          color="#3b2f6a"
          metalness={0.12}
          roughness={0.78}
        />
      </mesh>
    </group>
  );
}

/** 테이블 위 버림패: 뒷면은 검정, 레이캐스트 없음 */
function DiscardFaceDownTile({
  placement,
}: {
  placement: LexioDiscardPlacement;
}) {
  const isFlat = placement.rx < -1.4;
  const spin = isFlat
    ? Math.abs(placement.rz) > 0.001
      ? placement.rz
      : placement.ry
    : placement.ry;

  const groupY = discardTileContactGroupY(
    LEXIO_DISCARD_ROUNDED_GEOM,
    isFlat,
    spin,
    TABLE_TOP_Y,
    TABLE_SURFACE_EPS,
  );

  return (
    <group position={[placement.x, groupY, placement.z]}>
      {isFlat ? (
        <group rotation={[-Math.PI / 2, 0, spin]}>
          <DiscardFaceDownMesh />
        </group>
      ) : (
        <group rotation={[0, spin, 0]}>
          <DiscardFaceDownMesh />
        </group>
      )}
    </group>
  );
}

function DiscardFaceDownMesh() {
  return (
    <mesh
      castShadow
      receiveShadow
      raycast={() => null}
      geometry={LEXIO_DISCARD_ROUNDED_GEOM}
    >
      <meshStandardMaterial
        color="#030303"
        roughness={0.94}
        metalness={0.02}
      />
    </mesh>
  );
}

function DiscardPile3D({
  placements,
}: {
  placements: LexioDiscardPlacement[];
}) {
  if (placements.length === 0) return null;
  return (
    <group>
      {placements.map((p) => (
        <DiscardFaceDownTile key={p.key} placement={p} />
      ))}
    </group>
  );
}

/** 판 종료: 공개 패 옆 — 남은 장수 + 이번 획득 코인 (로컬 좌표, 공개 애니 그룹 자식) */
function FinishHandHudBillboard({
  handCount,
  roundEarned,
  position,
  anchorX = 'center',
}: {
  handCount: number;
  roundEarned: number;
  position: [number, number, number];
  anchorX?: 'left' | 'center' | 'right';
}) {
  /** anchorY=middle 기준 줄 중심 간격(글자 높이보다 충분히 크게) */
  const halfSpread = 0.052;
  const coinLabel =
    roundEarned > 0
      ? `+${roundEarned} 코인`
      : roundEarned < 0
        ? `${roundEarned} 코인`
        : `0 코인`;
  return (
    <Billboard position={position}>
      <Text
        position={[0, halfSpread, 0.004]}
        fontSize={0.088}
        color="#e9d5ff"
        anchorX={anchorX}
        anchorY="middle"
        depthOffset={5}
        renderOrder={900}
        outlineWidth={0.012}
        outlineColor="#0f0a1a"
      >
        {`남은 ${handCount}장`}
      </Text>
      <Text
        position={[0, -halfSpread, 0.004]}
        fontSize={0.098}
        color="#fcd34d"
        anchorX={anchorX}
        anchorY="middle"
        depthOffset={5}
        renderOrder={901}
        outlineWidth={0.018}
        outlineColor="#120b05"
      >
        {coinLabel}
      </Text>
    </Billboard>
  );
}

/** AI 손패: 세운 자세 → 테이블에 눕힘 (판 종료) */
function OpponentRevealAnimated({
  cardYaw,
  revealOffsetX,
  revealOffsetY,
  revealOffsetZ,
  tiles,
  finishHud,
  handLayout,
  opponentHandY,
}: {
  cardYaw: number;
  revealOffsetX: number;
  revealOffsetY: number;
  revealOffsetZ: number;
  tiles: LexioTile[];
  finishHud: { handCount: number; roundEarned: number };
  handLayout: ReturnType<typeof opponentHandLayoutForSeat>;
  opponentHandY: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t0Ref = useRef<number | null>(null);
  const tileIds = tiles.map((t) => t.id).join(',');

  const revealPlacements = useMemo(
    () =>
      layoutOpponentHandTiles3D(tiles, {
        gap: handLayout.gap,
        frontRowZ: handLayout.frontRowZ,
        backRowZ: handLayout.backRowZ,
      }).map((p) => ({
        ...p,
        position: opponentTileLocalWithTableContact(
          p.position[0],
          p.position[1],
          p.position[2],
          opponentHandY,
          handLayout.handZ,
          cardYaw,
        ),
      })),
    [
      tileIds,
      handLayout.gap,
      handLayout.frontRowZ,
      handLayout.backRowZ,
      handLayout.handZ,
      opponentHandY,
      cardYaw,
    ],
  );

  const pStart = useMemo(() => {
    const y = solveGroupYOnTable(
      OPPONENT_TILE_GEOM,
      handLayout.handZ,
      cardYaw,
      0,
      0,
      handLayout.frontRowZ,
      OPPONENT_TILT_BACK,
    );
    const p = new THREE.Vector3(0, y, handLayout.handZ);
    return p.applyAxisAngle(_axisY, cardYaw);
  }, [cardYaw, handLayout.handZ, handLayout.frontRowZ]);

  const pEnd = useMemo(
    () => new THREE.Vector3(revealOffsetX, revealOffsetY, revealOffsetZ),
    [revealOffsetX, revealOffsetY, revealOffsetZ],
  );

  const qStart = useMemo(() => {
    const qX = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      OPPONENT_TILT_BACK,
    );
    const qY = new THREE.Quaternion().setFromAxisAngle(_axisY, cardYaw);
    return qY.multiply(qX);
  }, [cardYaw]);

  const qEnd = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ'),
      ),
    [],
  );

  useLayoutEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(pStart);
      groupRef.current.quaternion.copy(qStart);
    }
    t0Ref.current = null;
  }, [cardYaw, revealOffsetX, revealOffsetY, revealOffsetZ, tileIds, pStart, qStart]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (t0Ref.current === null) t0Ref.current = state.clock.elapsedTime;
    const raw = Math.min(
      1,
      (state.clock.elapsedTime - t0Ref.current) / FINISH_REVEAL_SEC,
    );
    const t = easeInOutCubic(raw);
    _v3c.lerpVectors(pStart, pEnd, t);
    groupRef.current.position.copy(_v3c);
    _qOut.slerpQuaternions(qStart, qEnd, t);
    groupRef.current.quaternion.copy(_qOut);
  });

  return (
    <group ref={groupRef}>
      {revealPlacements.map(({ tile, position, rowLayer }) => (
        <LexioTile3D
          key={tile.id}
          tile={tile}
          position={position}
          rowLayer={rowLayer}
          tileScale={OPPONENT_TILE_SCALE}
          facePointerHover={false}
          faceMode="mesh"
          finishReveal
        />
      ))}
      <FinishHandHudBillboard
        handCount={finishHud.handCount}
        roundEarned={finishHud.roundEarned}
        position={[0, OPPONENT_TILE_H * 0.62 + 0.14, 0.06]}
      />
    </group>
  );
}

/** 플레이어 손패: 앞 세움 → 테이블에 눕힘 */
function HumanRevealAnimated({
  tiles,
  finishHud,
  narrow,
}: {
  tiles: LexioTile[];
  finishHud: { handCount: number; roundEarned: number } | null;
  narrow: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t0Ref = useRef<number | null>(null);
  const tileIds = tiles.map((t) => t.id).join(',');
  const gap = TILE_W * 1.1;
  const hud = finishHud ?? { handCount: tiles.length, roundEarned: 0 };
  const placements = layoutHandTiles3D(tiles, {
    narrow,
    gap,
    tableTiltX: TILT_BACK,
  });
  const maxX = placements.reduce(
    (m, p) => Math.max(m, Math.abs(p.position[0])),
    0,
  );
  const total = maxX * 2 + TILE_W;

  const pStart = useMemo(
    () => new THREE.Vector3(0, HAND_GROUP_Y, HAND_TABLE_Z),
    [],
  );
  const pEnd = useMemo(
    () => new THREE.Vector3(0, TILE_FLAT_Y, 1.46),
    [],
  );
  const qStart = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(TILT_BACK, 0, 0, 'XYZ'),
      ),
    [],
  );
  const qEnd = useMemo(
    () =>
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ'),
      ),
    [],
  );

  useLayoutEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(pStart);
      groupRef.current.quaternion.copy(qStart);
    }
    t0Ref.current = null;
  }, [tileIds, pStart, qStart]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (t0Ref.current === null) t0Ref.current = state.clock.elapsedTime;
    const raw = Math.min(
      1,
      (state.clock.elapsedTime - t0Ref.current) / FINISH_REVEAL_SEC,
    );
    const t = easeInOutCubic(raw);
    _v3c.lerpVectors(pStart, pEnd, t);
    groupRef.current.position.copy(_v3c);
    _qOut.slerpQuaternions(qStart, qEnd, t);
    groupRef.current.quaternion.copy(_qOut);
  });

  return (
    <group ref={groupRef}>
      {placements.map(({ tile, position, rowLayer }) => (
        <LexioTile3D
          key={tile.id}
          tile={tile}
          position={position}
          rowLayer={rowLayer}
          facePointerHover={false}
          faceMode="mesh"
          finishReveal
        />
      ))}
      <FinishHandHudBillboard
        handCount={hud.handCount}
        roundEarned={hud.roundEarned}
        position={[total / 2 + TILE_W * 0.35, TILE_H * 0.32 + 0.12, 0.06]}
        anchorX="left"
      />
    </group>
  );
}

function OpponentSeat({
  player,
  seatPosition,
  cardYaw,
  isActive,
  showPass,
  reveal,
  peerCoins,
  sessionCoins,
  characterReaction,
}: {
  player: LexioPlayer;
  seatPosition: [number, number, number];
  cardYaw: number;
  isActive: boolean;
  showPass: boolean;
  reveal: boolean;
  peerCoins: LexioPlayerFinishCoins | null;
  /** 세션 누적 코인 (진행 중 이름 아래) */
  sessionCoins: number;
  characterReaction: LexioOpponentReactionSignal | null;
}) {
  const handLayout = useMemo(
    () => opponentHandLayoutForSeat(player.id),
    [player.id],
  );
  const handCount = player.hand.length;
  const backSlots = useMemo(
    () =>
      layoutOpponentHandSlots3D(handCount, {
        gap: handLayout.gap,
        frontRowZ: handLayout.frontRowZ,
        backRowZ: handLayout.backRowZ,
      }),
    [handCount, handLayout.gap, handLayout.frontRowZ, handLayout.backRowZ],
  );
  const opponentHandY = useMemo(
    () =>
      opponentHandGroupY(
        cardYaw,
        handLayout.handZ,
        handCount <= OPPONENT_MAX_CARDS_PER_ROW ? 0 : handLayout.frontRowZ,
      ),
    [cardYaw, handLayout.handZ, handLayout.frontRowZ, handCount],
  );

  // 좌석 그룹은 회전 없이 seatPosition에 놓여 있으므로,
  // 공개된 카드의 로컬 오프셋이 곧 (월드 위치 - seatPosition)이 된다.
  // cardYaw는 -Z 로컬 방향을 테이블 중앙으로 향하게 하는 회전각이다.
  const distToCenter = Math.hypot(seatPosition[0], seatPosition[2]);
  const layoutDistance = distToCenter * OPPONENT_REVEAL_CENTER_FRAC;
  const revealOffset: [number, number, number] = [
    -layoutDistance * Math.sin(cardYaw),
    TILE_FLAT_Y - seatPosition[1] - SCENE_PLAYFIELD_LIFT_Y,
    -layoutDistance * Math.cos(cardYaw),
  ];
  const opponentHandLocalY = opponentHandY - SCENE_PLAYFIELD_LIFT_Y;

  const opponentSlotPosition = useMemo(
    () => (slot: { position: [number, number, number] }) =>
      opponentTileLocalWithTableContact(
        slot.position[0],
        slot.position[1],
        slot.position[2],
        opponentHandY,
        handLayout.handZ,
        cardYaw,
      ),
    [opponentHandY, handLayout.handZ, cardYaw],
  );

  const lookAtTableYaw = Math.atan2(-seatPosition[0], -seatPosition[2]);
  const characterInset = useMemo(
    () => characterTableInset(seatPosition),
    [seatPosition[0], seatPosition[2]],
  );
  const characterId = lexioOpponentCharacterForPlayerId(player.id);
  const characterDisplayName =
    LEXIO_OPPONENT_CHARACTERS[characterId].displayName ?? player.name;

  return (
    <group position={seatPosition}>
      <group rotation={[0, lookAtTableYaw, 0]}>
        <group position={[0, CHARACTER_BASE_Y, characterInset]}>
          <LexioOpponentCharacter3D
            seatPosition={seatPosition}
            characterId={characterId}
            isActive={isActive}
            reaction={characterReaction}
          />
        </group>
      </group>

      <group position={[0, SCENE_PLAYFIELD_LIFT_Y, 0]}>
      {!reveal && (
        <>
          {/* 이름표는 항상 카메라(플레이어)를 향함 */}
          <Billboard position={[0, 1.5, 0]}>
            <Text
              fontSize={0.16}
              color="#f5f3ff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.016}
              outlineColor="#1e1b4b"
            >
              {characterDisplayName}
            </Text>
          </Billboard>
          <Billboard position={[0, 1.28, 0]}>
            <Text
              fontSize={0.092}
              color="#fcd34d"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="#120b05"
            >
              {`🪙 ${sessionCoins}`}
            </Text>
          </Billboard>
        </>
      )}
      {showPass && !reveal && (
        <Billboard position={[0, 1.08, 0]}>
          <Text
            fontSize={0.11}
            color="#fda4af"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#1f1233"
          >
            PASS
          </Text>
        </Billboard>
      )}

      {reveal ? (
        handCount > 0 && (
          <OpponentRevealAnimated
            cardYaw={cardYaw}
            revealOffsetX={revealOffset[0]}
            revealOffsetY={revealOffset[1]}
            revealOffsetZ={revealOffset[2]}
            tiles={player.hand}
            handLayout={handLayout}
            opponentHandY={opponentHandY}
            finishHud={{
              handCount: player.hand.length,
              roundEarned: peerCoins?.roundEarned ?? 0,
            }}
          />
        )
      ) : (
        // 진행 중: 좌석에서 테이블 안쪽으로 옮긴 위치(플레이어에 더 가깝게), 테이블 위에 일렬로 세움
        <group rotation={[0, cardYaw, 0]}>
          <group
            position={[0, opponentHandLocalY, handLayout.handZ]}
            rotation={[OPPONENT_TILT_BACK, 0, 0]}
          >
            {backSlots
              .filter((s) => s.rowLayer === 'back')
              .map((slot, i) => (
                <TileBack3D
                  key={`back-${i}`}
                  position={opponentSlotPosition(slot)}
                  tileScale={OPPONENT_TILE_SCALE}
                  tileT={OPPONENT_TILE_T}
                />
              ))}
            {backSlots
              .filter(
                (s) => s.rowLayer === 'front' || s.rowLayer === 'single',
              )
              .map((slot, i) => (
                <TileBack3D
                  key={`front-${i}`}
                  position={opponentSlotPosition(slot)}
                  tileScale={OPPONENT_TILE_SCALE}
                  tileT={OPPONENT_TILE_T}
                />
              ))}
          </group>
        </group>
      )}
      </group>
    </group>
  );
}

function TableRoom() {
  const lift = SCENE_PLAYFIELD_LIFT_Y;
  return (
    <>
      {/** 그림자·캐릭터 기준 바닥 — playfield lift와 분리 (y=0) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0} />
      </mesh>
      <mesh
        position={[0, TABLE_BROWN_CENTER_Y + lift, 0]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[2.18, 2.2, TABLE_BROWN_HEIGHT, 48]} />
        <meshStandardMaterial color="#3f2e1a" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, TABLE_FELT_CENTER_Y + lift, 0]} receiveShadow>
        <cylinderGeometry args={[2.15, 2.15, TABLE_FELT_HEIGHT, 48]} />
        <meshStandardMaterial color="#14532d" roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 2.8 + lift, -3.6]} rotation={[0.15, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>
    </>
  );
}

function CenterPlay3D({
  combo,
  flatOnTable = false,
}: {
  combo: LexioCombination | null;
  /** true면 테이블에 눕힘 — 판 종료 탑다운에서 잘 보이게 */
  flatOnTable?: boolean;
}) {
  if (!combo) return null;
  const n = combo.tiles.length;
  const gap = TILE_W * 1.1;
  const total = (n - 1) * gap;

  if (flatOnTable) {
    return (
      <group
        position={[0, TILE_FLAT_Y, LEXIO_CENTER_PLAY_TABLE_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {combo.tiles.map((t, i) => (
          <LexioTile3D
            key={t.id}
            tile={t}
            position={[-total / 2 + i * gap, 0, 0]}
            rotation={[0, 0, 0]}
            dimmed={false}
            facePointerHover={false}
            faceMode="mesh"
            finishReveal
          />
        ))}
      </group>
    );
  }

  return (
    <group
      position={[0, CENTER_PLAY_GROUP_Y, LEXIO_CENTER_PLAY_TABLE_Z]}
      rotation={[TILT_BACK, 0, 0]}
    >
      {combo.tiles.map((t, i) => (
        <LexioTile3D
          key={t.id}
          tile={t}
          position={[-total / 2 + i * gap, 0, 0]}
          rotation={[0, 0, 0]}
          dimmed={false}
          faceMode="mesh"
        />
      ))}
    </group>
  );
}

const HAND_NARROW_BREAKPOINT_PX = 768;

function HandRow3D({
  tiles,
  selectedIds,
  onToggle,
  enabled,
  reveal,
  finishHud,
}: {
  tiles: LexioTile[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  enabled: boolean;
  reveal: boolean;
  finishHud?: { handCount: number; roundEarned: number } | null;
}) {
  const { size } = useThree();
  const narrow = size.width < HAND_NARROW_BREAKPOINT_PX;
  const n = tiles.length;

  if (reveal) {
    if (n === 0) return null;
    return (
      <HumanRevealAnimated
        tiles={tiles}
        finishHud={finishHud ?? null}
        narrow={narrow}
      />
    );
  }

  const gap = TILE_W * 1.1;
  const placements = layoutHandTiles3D(tiles, { narrow, gap });
  const backPlacements = placements.filter((p) => p.rowLayer === 'back');
  const frontPlacements = placements.filter(
    (p) => p.rowLayer === 'front' || p.rowLayer === 'single',
  );

  const renderPlacement = (p: (typeof placements)[number]) => {
    const selected = selectedIds.includes(p.tile.id);
    const localPos = tileLocalWithTableContact(
      p.position[0],
      p.position[1],
      p.position[2],
    );
    return (
      <LexioTile3D
        key={p.tile.id}
        tile={p.tile}
        position={localPos}
        rotation={[0, 0, 0]}
        selected={selected}
        rowLayer={p.rowLayer}
        faceMode="mesh"
        onClick={enabled ? () => onToggle(p.tile.id) : undefined}
      />
    );
  };

  return (
    <group position={[0, HAND_GROUP_Y, HAND_TABLE_Z]} rotation={[TILT_BACK, 0, 0]}>
      {backPlacements.length > 0 && (
        <group renderOrder={0}>
          {backPlacements.map((p) => renderPlacement(p))}
        </group>
      )}
      <group renderOrder={10}>
        {frontPlacements.map((p) => renderPlacement(p))}
      </group>
    </group>
  );
}

/** 좌석 번호별 테이블 위치 (0=북, 1=서, 2=동, 3=북서, 4=북동) */
const TABLE_SEAT_BY_ID: Record<number, { pos: [number, number, number] }> = {
  0: { pos: [0, 0, -2.55] },
  1: { pos: [-2.78, 0, 0.44] },
  2: { pos: [2.78, 0, 0.44] },
  3: { pos: [-1.72, 0, -2.52] },
  4: { pos: [1.72, 0, -2.52] },
};

/** 내 턴에서 이 시간 동안 내지/패스하지 않으면 재촉 */
const TURN_STALL_NAG_SEC = 30;

function SceneContent({
  players,
  currentPlayerIdx,
  humanPlayer,
  currentPlay,
  selectedIds,
  onToggleTile,
  phase,
  discardPlacements,
  finishTableUi,
  sessionCoinsByPlayerId,
  handInteractionEnabled = true,
}: {
  players: LexioPlayer[];
  currentPlayerIdx: number;
  humanPlayer: LexioPlayer | undefined;
  currentPlay: LexioCombination | null;
  selectedIds: number[];
  onToggleTile: (id: number) => void;
  phase: 'setup' | 'playing' | 'finished';
  discardPlacements: LexioDiscardPlacement[];
  finishTableUi: LexioFinishTableUi | null;
  sessionCoinsByPlayerId: Record<number, number>;
  handInteractionEnabled?: boolean;
}) {
  const aiPlayers = useMemo(() => players.filter((p) => p.isAI), [players]);

  const seats = useMemo(() => {
    const make = (player: LexioPlayer, pos: [number, number, number]) => ({
      player,
      pos,
      cardYaw: Math.atan2(pos[0], pos[2]),
    });
    return aiPlayers.map((p) => {
      const cfg = TABLE_SEAT_BY_ID[p.id] ?? TABLE_SEAT_BY_ID[1];
      return make(p, cfg.pos);
    });
  }, [aiPlayers]);

  const reveal = phase === 'finished';

  const prevPlaySigRef = useRef<string | null>(null);
  const reactionSeqRef = useRef(0);
  const turnEpochRef = useRef(0);
  const prevPassSigRef = useRef('');
  const prevTurnIdxRef = useRef(currentPlayerIdx);
  const reactionGateRef = useRef(createReactionGateState());
  const [tableReaction, setTableReaction] =
    useState<LexioOpponentReactionSignal | null>(null);
  const [passReaction, setPassReaction] =
    useState<LexioOpponentReactionSignal | null>(null);
  const [turnReaction, setTurnReaction] =
    useState<LexioOpponentReactionSignal | null>(null);
  const [stallReaction, setStallReaction] =
    useState<LexioOpponentReactionSignal | null>(null);
  const [idleLookReaction, setIdleLookReaction] =
    useState<LexioOpponentReactionSignal | null>(null);

  const turnActivityKey = useMemo(() => {
    const passFlags = players.map((p) => (p.passed ? '1' : '0')).join('');
    return `${currentPlayerIdx}|${comboPlaySignature(currentPlay) ?? '-'}|${passFlags}`;
  }, [currentPlayerIdx, currentPlay, players]);

  useEffect(() => {
    const sig = comboPlaySignature(currentPlay);
    if (
      prevPlaySigRef.current !== null &&
      sig &&
      sig !== prevPlaySigRef.current &&
      (phase === 'playing' || phase === 'finished')
    ) {
      if (!currentPlay) return;
      reactionSeqRef.current += 1;
      const seq = reactionSeqRef.current;
      const gate = reactionGateRef.current;
      if (!canEmitEventReaction(gate)) return;

      const clip = tableReactionClipForCombo(currentPlay, seq);
      if (!clip) return;
      if (currentPlay.type === 'single' && !shouldReactToSingle(seq)) return;

      markEventReaction(gate);
      const lastPlayerIdx =
        (currentPlayerIdx - 1 + players.length) % players.length;
      const lastPlayer = players[lastPlayerIdx];
      const speakerId = pickAiReactionSpeaker(
        aiPlayers,
        lastPlayer?.id,
        seq,
      );
      setTableReaction({
        id: seq,
        clip,
        targetPlayerId: speakerId,
      });
    }
    prevPlaySigRef.current = sig;
  }, [currentPlay, phase, players, currentPlayerIdx, aiPlayers]);

  useEffect(() => {
    if (phase !== 'playing') {
      setPassReaction(null);
      prevPassSigRef.current = '';
      return;
    }

    const sig = players.map((p) => `${p.id}:${p.passed ? 1 : 0}`).join('|');
    if (prevPassSigRef.current && sig !== prevPassSigRef.current) {
      for (const p of players) {
        const prev = prevPassSigRef.current
          .split('|')
          .find((entry) => entry.startsWith(`${p.id}:`));
        const wasPassed = prev?.endsWith(':1');
        if (p.passed && !wasPassed) {
          reactionSeqRef.current += 1;
          const seq = reactionSeqRef.current;
          const gate = reactionGateRef.current;
          if (
            !shouldReactToPass(seq) ||
            !canEmitPassReaction(gate)
          ) {
            break;
          }
          const responders = aiPlayers.filter((ai) => ai.id !== p.id);
          if (responders.length > 0) {
            const speaker =
              responders[(p.id + currentPlayerIdx) % responders.length]!;
            markPassReaction(gate);
            setPassReaction({
              id: seq,
              clip: passReactionClip(seq),
              targetPlayerId: speaker.id,
            });
          }
          break;
        }
      }
    }
    prevPassSigRef.current = sig;
  }, [players, phase, aiPlayers, currentPlayerIdx]);

  useEffect(() => {
    if (phase !== 'playing') {
      setTurnReaction(null);
      prevTurnIdxRef.current = currentPlayerIdx;
      return;
    }

    if (prevTurnIdxRef.current !== currentPlayerIdx) {
      const current = players[currentPlayerIdx];
      if (current?.isAI && !currentPlay && !current.passed) {
        reactionSeqRef.current += 1;
        const seq = reactionSeqRef.current;
        const gate = reactionGateRef.current;
        if (shouldAiTurnPoint(seq) && canEmitEventReaction(gate)) {
          markEventReaction(gate);
          setTurnReaction({
            id: seq,
            clip: 'sitting-pointing',
            targetPlayerId: current.id,
          });
        } else {
          setTurnReaction(null);
        }
      } else {
        setTurnReaction(null);
      }
    }
    prevTurnIdxRef.current = currentPlayerIdx;
  }, [currentPlayerIdx, currentPlay, phase, players]);

  useEffect(() => {
    if (phase !== 'playing') {
      setStallReaction(null);
      return;
    }

    const current = players[currentPlayerIdx];
    const isHumanTurn =
      !!humanPlayer && !!current && !current.isAI && current.id === humanPlayer.id;
    if (!isHumanTurn) {
      setStallReaction(null);
      return;
    }

    turnEpochRef.current += 1;
    const epoch = turnEpochRef.current;

    const timer = window.setTimeout(() => {
      if (epoch !== turnEpochRef.current) return;

      const stillCurrent = players[currentPlayerIdx];
      if (
        !humanPlayer ||
        !stillCurrent ||
        stillCurrent.isAI ||
        stillCurrent.id !== humanPlayer.id
      ) {
        return;
      }

      reactionSeqRef.current += 1;
      const seq = reactionSeqRef.current;
      const gate = reactionGateRef.current;
      if (!canEmitEventReaction(gate)) return;

      markEventReaction(gate);
      const speakerId = pickAiReactionSpeaker(
        aiPlayers,
        humanPlayer.id,
        seq,
      );
      setStallReaction({
        id: seq,
        clip: stallReactionClip(seq),
        targetPlayerId: speakerId,
      });
    }, TURN_STALL_NAG_SEC * 1000);

    return () => {
      window.clearTimeout(timer);
      setStallReaction(null);
    };
  }, [turnActivityKey, phase, players, currentPlayerIdx, humanPlayer, aiPlayers]);

  useEffect(() => {
    if (phase !== 'playing') {
      setIdleLookReaction(null);
      return;
    }

    let cancelled = false;
    let timer = 0;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;

        const now = Date.now();
        const gate = reactionGateRef.current;
        if (canEmitIdleReaction(gate, now)) {
          reactionSeqRef.current += 1;
          const seq = reactionSeqRef.current;
          markIdleReaction(gate, now);
          setIdleLookReaction({
            id: seq,
            clip: pickIdleReactionClip(seq),
            targetPlayerId: pickAiReactionSpeaker(aiPlayers, undefined, seq),
          });
        }

        schedule();
      }, REACTION_COOLDOWN.idleIntervalSec * 1000);
    };

    schedule();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setIdleLookReaction(null);
    };
  }, [turnActivityKey, phase, aiPlayers]);

  const humanFinishCoins = useMemo(() => {
    if (!finishTableUi || !humanPlayer) return null;
    return (
      finishTableUi.playersCoins.find((c) => c.playerId === humanPlayer.id) ??
      null
    );
  }, [finishTableUi, humanPlayer]);

  return (
    <>
      <color attach="background" args={['#0a0a23']} />
      <fog attach="fog" args={['#0a0a23', 12, 28]} />

      <ambientLight intensity={0.2} />
      <hemisphereLight args={['#a89fd4', '#0c0a18', 0.22]} />
      {/** 키 라이트 — 테이블·손패 돌 윗면 하이라이트 */}
      <directionalLight
        castShadow
        position={[0.6, 16, 3.2]}
        intensity={1.65}
        color="#fff6eb"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.00012}
      >
        <object3D attach="target" position={[0, TABLE_TOP_Y, 0.8]} />
      </directionalLight>
      {/** 손패 쪽 보조 — 위에서 부드럽게 채움 */}
      <directionalLight
        position={[0, 12, 1.8]}
        intensity={0.42}
        color="#ede9fe"
      >
        <object3D attach="target" position={[0, HAND_GROUP_Y, HAND_TABLE_Z]} />
      </directionalLight>
      <pointLight position={[0, 5.5 + SCENE_PLAYFIELD_LIFT_Y, 3.2]} intensity={0.14} color="#c4b5fd" />

      <TableRoom />
      <DiscardPile3D placements={discardPlacements} />
      {/** 진행 중·종료 후: 테이블 중앙 마지막 조합(승리 직전 내기) 유지 */}
      <CenterPlay3D combo={currentPlay} flatOnTable={phase === 'finished'} />

      {seats.map(({ player, pos, cardYaw }) => {
        const idx = players.findIndex((p) => p.id === player.id);
        return (
          <OpponentSeat
            key={player.id}
            player={player}
            seatPosition={pos}
            cardYaw={cardYaw}
            isActive={idx === currentPlayerIdx && phase === 'playing'}
            showPass={player.passed}
            reveal={reveal}
            peerCoins={
              finishTableUi?.playersCoins.find((c) => c.playerId === player.id) ??
              null
            }
            sessionCoins={sessionCoinsByPlayerId[player.id] ?? 0}
            characterReaction={pickSeatCharacterReaction(player.id, {
              table: tableReaction,
              turn: turnReaction,
              pass: passReaction,
              stall: stallReaction,
              idleLook: idleLookReaction,
            })}
          />
        );
      })}

      {humanPlayer && (phase === 'playing' || phase === 'finished') && (
        <HandRow3D
          tiles={humanPlayer.hand}
          selectedIds={selectedIds}
          onToggle={onToggleTile}
          enabled={phase === 'playing' && handInteractionEnabled}
          reveal={reveal}
          finishHud={
            reveal && humanPlayer
              ? {
                  handCount: humanPlayer.hand.length,
                  roundEarned: humanFinishCoins?.roundEarned ?? 0,
                }
              : null
          }
        />
      )}

      <ContactShadows
        position={[0, TABLE_TOP_Y + 0.001, 0]}
        opacity={0.5}
        scale={6}
        blur={2.5}
        far={2}
      />
    </>
  );
}

/** Suspense 경계 안에서만 마운트 → 모든 GLB(에셋) 로드가 끝났음을 알린다 */
function SceneReadySignal({ onReady }: { onReady?: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    onReadyRef.current?.();
  }, []);
  return null;
}

function setIntroStartPose(
  camera: THREE.Camera,
  angle: number,
  radius: number,
  height: number,
  lookAt: THREE.Vector3,
) {
  camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
  camera.lookAt(lookAt);
  camera.updateProjectionMatrix();
}

/** 1인칭 · 세션 최초 진입 인트로 · 판 종료 탑다운 */
function FirstPersonCameraRig({
  phase,
  playStartIntro = false,
  onStartIntroComplete,
}: {
  phase: 'setup' | 'playing' | 'finished';
  playStartIntro?: boolean;
  onStartIntroComplete?: () => void;
}) {
  const camera = useThree((s) => s.camera);
  const finishStartRef = useRef<number | null>(null);
  const introStartRef = useRef<number | null>(null);
  const introDoneRef = useRef(!playStartIntro);
  const introCompleteSentRef = useRef(false);
  const onIntroCompleteRef = useRef(onStartIntroComplete);
  onIntroCompleteRef.current = onStartIntroComplete;

  const camPos0 = useMemo(
    () => new THREE.Vector3(0, 3.24 + SCENE_PLAYFIELD_LIFT_Y, 4.55),
    [],
  );
  const camEndRadius = useMemo(
    () => Math.hypot(camPos0.x, camPos0.z),
    [camPos0],
  );
  const camEndAngle = useMemo(
    () => Math.atan2(camPos0.x, camPos0.z),
    [camPos0],
  );
  /** 판 종료 시 탑다운 카메라 위치(lerp 끝점) */
  const camPos1 = useMemo(
    () => new THREE.Vector3(0, 5.38 + SCENE_PLAYFIELD_LIFT_Y, 0.24),
    [],
  );
  const look0 = useMemo(
    () => new THREE.Vector3(0, 0.52 + SCENE_PLAYFIELD_LIFT_Y, -0.12),
    [],
  );
  const look1 = useMemo(
    () => new THREE.Vector3(0, TABLE_TOP_Y + 0.02, 0),
    [],
  );
  const introLookStart = useMemo(
    () => new THREE.Vector3(0, TABLE_TOP_Y + 0.02, 0),
    [],
  );
  /** 위에서 내려오며 시계방향(−Y 각)으로 1인칭 각도까지 회전 */
  const introStartAngle = useMemo(
    () => camEndAngle + START_INTRO_ROTATION,
    [camEndAngle],
  );
  const introStartHeight = 7.85 + SCENE_PLAYFIELD_LIFT_Y;
  const introStartRadius = 0.35;

  useEffect(() => {
    if (playStartIntro) {
      introDoneRef.current = false;
      introStartRef.current = null;
      introCompleteSentRef.current = false;
    } else {
      introDoneRef.current = true;
    }
  }, [playStartIntro]);

  useLayoutEffect(() => {
    if (phase === 'finished') return;
    if (playStartIntro && !introDoneRef.current) {
      finishStartRef.current = null;
      setIntroStartPose(
        camera,
        introStartAngle,
        introStartRadius,
        introStartHeight,
        introLookStart,
      );
      return;
    }
    finishStartRef.current = null;
    camera.position.copy(camPos0);
    camera.lookAt(look0);
    camera.updateProjectionMatrix();
  }, [
    phase,
    camera,
    camPos0,
    look0,
    playStartIntro,
    introStartAngle,
    introLookStart,
  ]);

  useFrame((state) => {
    if (
      playStartIntro &&
      !introDoneRef.current &&
      phase === 'playing'
    ) {
      if (introStartRef.current === null) {
        introStartRef.current = state.clock.elapsedTime;
      }
      const raw = Math.min(
        1,
        (state.clock.elapsedTime - introStartRef.current) / START_INTRO_SEC,
      );
      const t = easeInOutCubic(raw);
      const angle = introStartAngle + (camEndAngle - introStartAngle) * t;
      const radius = THREE.MathUtils.lerp(introStartRadius, camEndRadius, t);
      const height = THREE.MathUtils.lerp(introStartHeight, camPos0.y, t);
      setIntroStartPose(camera, angle, radius, height, introLookStart);
      _v3b.lerpVectors(introLookStart, look0, t);
      camera.lookAt(_v3b);
      camera.updateProjectionMatrix();
      if (raw >= 1) {
        introDoneRef.current = true;
        camera.position.copy(camPos0);
        camera.lookAt(look0);
        camera.updateProjectionMatrix();
        if (!introCompleteSentRef.current) {
          introCompleteSentRef.current = true;
          onIntroCompleteRef.current?.();
        }
      }
      return;
    }

    if (phase !== 'finished') return;
    if (finishStartRef.current === null) {
      finishStartRef.current = state.clock.elapsedTime;
    }
    const raw = Math.min(
      1,
      (state.clock.elapsedTime - finishStartRef.current) / FINISH_REVEAL_SEC,
    );
    const t = easeInOutCubic(raw);
    _v3a.lerpVectors(camPos0, camPos1, t);
    _v3b.lerpVectors(look0, look1, t);
    camera.position.copy(_v3a);
    camera.lookAt(_v3b);
    camera.updateProjectionMatrix();
  });

  return null;
}

export default function LexioFirstPersonScene({
  players,
  currentPlayerIdx,
  humanPlayer,
  currentPlay,
  selectedIds,
  onToggleTile,
  phase,
  discardPlacements = [],
  finishTableUi = null,
  sessionCoinsByPlayerId = {},
  playStartIntro = false,
  onStartIntroComplete,
  onSceneReady,
  interactionEnabled = true,
}: {
  players: LexioPlayer[];
  currentPlayerIdx: number;
  humanPlayer: LexioPlayer | undefined;
  currentPlay: LexioCombination | null;
  selectedIds: number[];
  onToggleTile: (id: number) => void;
  phase: 'setup' | 'playing' | 'finished';
  discardPlacements?: LexioDiscardPlacement[];
  finishTableUi?: LexioFinishTableUi | null;
  sessionCoinsByPlayerId?: Record<number, number>;
  playStartIntro?: boolean;
  onStartIntroComplete?: () => void;
  /** 씬 에셋(GLB) 로드가 모두 끝나 테이블이 그려질 준비가 됐을 때 */
  onSceneReady?: () => void;
  interactionEnabled?: boolean;
}) {
  return (
    <Canvas
      shadows
      camera={{ fov: 54, near: 0.08, far: 80, position: [0, 3.24 + SCENE_PLAYFIELD_LIFT_Y, 4.55] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, localClippingEnabled: true }}
      className="h-full w-full touch-none"
    >
      <FirstPersonCameraRig
        phase={phase}
        playStartIntro={playStartIntro}
        onStartIntroComplete={onStartIntroComplete}
      />
      <Suspense fallback={null}>
        <SceneReadySignal onReady={onSceneReady} />
        <SceneContent
          players={players}
          currentPlayerIdx={currentPlayerIdx}
          humanPlayer={humanPlayer}
          currentPlay={currentPlay}
          selectedIds={selectedIds}
          onToggleTile={onToggleTile}
          phase={phase}
          discardPlacements={discardPlacements}
          finishTableUi={finishTableUi}
          sessionCoinsByPlayerId={sessionCoinsByPlayerId}
          handInteractionEnabled={interactionEnabled}
        />
      </Suspense>
    </Canvas>
  );
}
