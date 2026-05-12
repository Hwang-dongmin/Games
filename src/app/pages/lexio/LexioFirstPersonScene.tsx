import React, {
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, ContactShadows, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import type {
  LexioTile,
  LexioPlayer,
  LexioCombination,
} from '../../utils/lexio';
import {
  LexioPlayCard,
  lexioColorToSuit,
} from '../../components/lexio/LexioPlayCard';

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
const TABLE_TOP_Y = 0.5;
const TILE_CENTER_Y = TABLE_TOP_Y + TILE_H / 2;
const TILT_BACK = -0.18;
/** 판 종료: 패 공개·카메라 탑다운 애니메이션 길이(초) */
const FINISH_REVEAL_SEC = 2;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const _v3a = new THREE.Vector3();
const _v3b = new THREE.Vector3();
const _v3c = new THREE.Vector3();
const _qA = new THREE.Quaternion();
const _qB = new THREE.Quaternion();
const _qOut = new THREE.Quaternion();
const _axisY = new THREE.Vector3(0, 1, 0);
const HOVER_LIFT = 0.088;
const SELECT_LIFT = 0.168;

/** 돌 패 모서리 — ExtrudeGeometry + 라운딩 실루엣 */
const tileRoundedGeomCache = new Map<string, THREE.BufferGeometry>();

function getRoundedTileGeometry(
  width: number,
  height: number,
  depth: number,
): THREE.BufferGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const cr = Math.min(
    Math.min(width, height) * 0.068,
    hw * 0.42,
    hh * 0.42,
  );
  const key = `${width.toFixed(6)}_${height.toFixed(6)}_${depth.toFixed(6)}_${cr.toFixed(6)}`;
  const cached = tileRoundedGeomCache.get(key);
  if (cached) return cached;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + cr, -hh);
  shape.lineTo(hw - cr, -hh);
  shape.absarc(hw - cr, -hh + cr, cr, -Math.PI / 2, 0, false);
  shape.lineTo(hw, hh - cr);
  shape.absarc(hw - cr, hh - cr, cr, 0, Math.PI / 2, false);
  shape.lineTo(-hw + cr, hh);
  shape.absarc(-hw + cr, hh - cr, cr, Math.PI / 2, Math.PI, false);
  shape.lineTo(-hw, -hh + cr);
  shape.absarc(-hw + cr, -hh + cr, cr, Math.PI, Math.PI * 1.5, false);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 14,
  });
  geom.computeVertexNormals();
  geom.center();
  tileRoundedGeomCache.set(key, geom);
  return geom;
}

const LEXIO_TILE_ROUNDED_GEOM = getRoundedTileGeometry(TILE_W, TILE_H, TILE_T);
const LEXIO_DISCARD_ROUNDED_GEOM = getRoundedTileGeometry(
  TILE_W * 0.88,
  TILE_H * 0.88,
  TILE_T,
);

function LexioTile3D({
  tile,
  position,
  rotation,
  selected,
  onClick,
  dimmed,
  facePointerHover = true,
  finishReveal = false,
}: {
  tile: LexioTile;
  position: [number, number, number];
  rotation?: [number, number, number];
  selected?: boolean;
  onClick?: () => void;
  dimmed?: boolean;
  /** false면 앞면 호버 메시·2D 호버 강조 없음 (판 종료 후 상대 공개 패 등) */
  facePointerHover?: boolean;
  /** 판 종료 테이블 공개: 숫자 2 패 후광 */
  finishReveal?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const interactive = !!onClick;
  const lift = selected
    ? SELECT_LIFT
    : hovered && interactive
      ? HOVER_LIFT
      : 0;

  const showFaceHover = facePointerHover;
  const cardHovered = showFaceHover && hovered;
  const numberTwoHalo = finishReveal && tile.number === 2;

  return (
    <group
      position={[position[0], position[1] + lift, position[2]]}
      rotation={rotation ?? [0, 0, 0]}
    >
      {numberTwoHalo && (
        <mesh
          position={[0, 0, -0.008]}
          renderOrder={-1}
          scale={[1.14, 1.14, 1.18]}
          geometry={LEXIO_TILE_ROUNDED_GEOM}
        >
          <meshBasicMaterial
            color="#fcd34d"
            transparent
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh castShadow receiveShadow geometry={LEXIO_TILE_ROUNDED_GEOM}>
        <meshStandardMaterial
          color="#16151a"
          metalness={0.04}
          roughness={0.9}
          emissive="#000000"
          emissiveIntensity={0}
          opacity={dimmed ? 0.55 : 1}
          transparent={dimmed}
        />
      </mesh>
      {showFaceHover && (
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
            setHovered(true);
            if (interactive) document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            if (interactive) document.body.style.cursor = 'default';
          }}
        >
          {/** 카드 면 + 여유로 hit-area 확장. 가로는 인접 카드 gap=TILE_W*1.1을 꽉 채우고,
           *   세로는 카드 위/아래로 넉넉히 확보해 가장자리 클릭도 잡히게 함. */}
          <planeGeometry args={[TILE_W * 1.1, TILE_H * 1.55]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <Html
        transform
        center
        position={[0, 0, FACE_Z + 0.008]}
        /** 박스 폭(TILE_W=0.212)에 맞춰 앞면 DOM 스케일.
         *  DOM small 폭 49.6px ≈ 3D 박스 폭이 되도록 distanceFactor를 보정. */
        distanceFactor={1.55}
        occlude={false}
        zIndexRange={[16777271, 0]}
        style={{ pointerEvents: 'none' }}
      >
        {/** 클릭 가능한 손패(interactive)면 DOM 자체도 pointer 이벤트를 받아
         *   카드 위 어디서든 선택/해제가 동작한다. 그 외 카드(공개/AI/중앙)는
         *   기존처럼 모든 descendant에 pointer-events:none을 강제해 mesh로 통과시킨다. */}
        {interactive ? (
          <div
            className="cursor-pointer"
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            onPointerEnter={() => {
              setHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerLeave={() => {
              setHovered(false);
              document.body.style.cursor = 'default';
            }}
          >
            <LexioPlayCard
              number={tile.number}
              suit={lexioColorToSuit(tile.color)}
              small
              isHovered={cardHovered}
              numberTwoHalo={numberTwoHalo}
            />
          </div>
        ) : (
          <div className="pointer-events-none [&_*]:pointer-events-none">
            <LexioPlayCard
              number={tile.number}
              suit={lexioColorToSuit(tile.color)}
              small
              isHovered={cardHovered}
              numberTwoHalo={numberTwoHalo}
            />
          </div>
        )}
      </Html>
    </group>
  );
}

function TileBack3D({
  position,
  rotation,
  small,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  small?: boolean;
}) {
  const w = small ? TILE_W * 0.6 : TILE_W * 0.85;
  const h = small ? TILE_H * 0.6 : TILE_H * 0.85;
  const backGeom = useMemo(
    () => getRoundedTileGeometry(w, h, TILE_T),
    [w, h],
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
  return (
    <group
      position={[placement.x, placement.y, placement.z]}
      rotation={[placement.rx, placement.ry, placement.rz]}
    >
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
    </group>
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
}: {
  cardYaw: number;
  revealOffsetX: number;
  revealOffsetY: number;
  revealOffsetZ: number;
  tiles: LexioTile[];
  finishHud: { handCount: number; roundEarned: number };
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t0Ref = useRef<number | null>(null);
  const tileIds = tiles.map((t) => t.id).join(',');

  const revealGap = TILE_W * 1;
  const revealTotal = Math.max(0, (tiles.length - 1) * revealGap);

  const pStart = useMemo(() => {
    const p = new THREE.Vector3(0, TILE_CENTER_Y, -1.45);
    return p.applyAxisAngle(_axisY, cardYaw);
  }, [cardYaw]);

  const pEnd = useMemo(
    () => new THREE.Vector3(revealOffsetX, revealOffsetY, revealOffsetZ),
    [revealOffsetX, revealOffsetY, revealOffsetZ],
  );

  const qStart = useMemo(() => {
    const qX = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      TILT_BACK,
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
      {tiles.map((tile, i) => (
        <LexioTile3D
          key={tile.id}
          tile={tile}
          position={[-revealTotal / 2 + i * revealGap, 0, 0]}
          facePointerHover={false}
          finishReveal
        />
      ))}
      <FinishHandHudBillboard
        handCount={finishHud.handCount}
        roundEarned={finishHud.roundEarned}
        position={[0, TILE_H * 0.62 + 0.14, 0.06]}
      />
    </group>
  );
}

/** 플레이어 손패: 앞 세움 → 테이블에 눕힘 */
function HumanRevealAnimated({
  tiles,
  finishHud,
}: {
  tiles: LexioTile[];
  finishHud: { handCount: number; roundEarned: number } | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t0Ref = useRef<number | null>(null);
  const tileIds = tiles.map((t) => t.id).join(',');
  const gap = TILE_W * 1.1;
  const hud = finishHud ?? { handCount: tiles.length, roundEarned: 0 };
  const n = tiles.length;
  const total = Math.max(0, (n - 1) * gap);

  const pStart = useMemo(
    () => new THREE.Vector3(0, TILE_CENTER_Y, 1.42),
    [],
  );
  const pEnd = useMemo(
    () => new THREE.Vector3(0, TABLE_TOP_Y + TILE_T / 2 + 0.0015, 1.46),
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
      {tiles.map((tile, i) => (
        <LexioTile3D
          key={tile.id}
          tile={tile}
          position={[-total / 2 + i * gap, 0, 0]}
          facePointerHover={false}
          finishReveal
        />
      ))}
      <FinishHandHudBillboard
        handCount={hud.handCount}
        roundEarned={hud.roundEarned}
        position={[total / 2 + TILE_W * 1.25, TILE_H * 0.32 + 0.12, 0.06]}
        anchorX="left"
      />
    </group>
  );
}

function OpponentSeat({
  player,
  seatPosition,
  faceYaw,
  cardYaw,
  isActive,
  showPass,
  reveal,
  peerCoins,
}: {
  player: LexioPlayer;
  seatPosition: [number, number, number];
  faceYaw: number;
  cardYaw: number;
  isActive: boolean;
  showPass: boolean;
  reveal: boolean;
  peerCoins: LexioPlayerFinishCoins | null;
}) {
  const handCount = player.hand.length;
  const backCount = Math.min(handCount, 14);
  const backGap = TILE_W * 0.78;
  const backTotal = (backCount - 1) * backGap;

  // 좌석 그룹은 회전 없이 seatPosition에 놓여 있으므로,
  // 공개된 카드의 로컬 오프셋이 곧 (월드 위치 - seatPosition)이 된다.
  // cardYaw는 -Z 로컬 방향을 테이블 중앙으로 향하게 하는 회전각이다.
  const layoutDistance = 1.15;
  const revealOffset: [number, number, number] = [
    -layoutDistance * Math.sin(cardYaw),
    TABLE_TOP_Y + TILE_T / 2 + 0.0015 - seatPosition[1],
    -layoutDistance * Math.cos(cardYaw),
  ];

  return (
    <group position={seatPosition}>
      {!reveal && (
        <>
          {/* 캐릭터 (테이블 바깥) */}
          <group rotation={[0, faceYaw, 0]}>
            <mesh castShadow position={[0, 0.55, 0]}>
              <capsuleGeometry args={[0.22, 0.65, 6, 12]} />
              <meshStandardMaterial
                color={isActive ? '#a78bfa' : '#57534e'}
                metalness={0.2}
                roughness={0.5}
                emissive={isActive ? '#5b21b6' : '#000000'}
                emissiveIntensity={isActive ? 0.35 : 0}
              />
            </mesh>
          </group>

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
              {player.name}
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
            position={[0, TILE_CENTER_Y, -1.45]}
            rotation={[TILT_BACK, 0, 0]}
          >
            {Array.from({ length: backCount }).map((_, i) => (
              <TileBack3D
                key={i}
                position={[-backTotal / 2 + i * backGap, 0, 0]}
                small
              />
            ))}
          </group>
        </group>
      )}
    </group>
  );
}

function TableRoom() {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0f172a" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.35, 2.45, 0.08, 48]} />
        <meshStandardMaterial color="#3f2e1a" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.48, 0]} receiveShadow>
        <cylinderGeometry args={[2.15, 2.15, 0.04, 48]} />
        <meshStandardMaterial color="#14532d" roughness={0.85} metalness={0} />
      </mesh>
      <mesh position={[0, 2.8, -3.6]} rotation={[0.15, 0, 0]} receiveShadow>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>
    </>
  );
}

function CenterPlay3D({ combo }: { combo: LexioCombination | null }) {
  if (!combo) return null;
  const n = combo.tiles.length;
  const gap = TILE_W * 1.1;
  const total = (n - 1) * gap;
  return (
    <group position={[0, TILE_CENTER_Y, -0.2]} rotation={[TILT_BACK, 0, 0]}>
      {combo.tiles.map((t, i) => (
        <LexioTile3D
          key={t.id}
          tile={t}
          position={[-total / 2 + i * gap, 0, 0]}
          rotation={[0, 0, 0]}
          dimmed={false}
        />
      ))}
    </group>
  );
}

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
  const n = tiles.length;

  if (reveal) {
    if (n === 0) return null;
    return (
      <HumanRevealAnimated tiles={tiles} finishHud={finishHud ?? null} />
    );
  }

  const gap = TILE_W * 1.1;
  const total = (n - 1) * gap;

  return (
    <group position={[0, TILE_CENTER_Y, 1.5]} rotation={[TILT_BACK, 0, 0]}>
      {tiles.map((tile, i) => {
        const x = -total / 2 + i * gap;
        const selected = selectedIds.includes(tile.id);
        return (
          <LexioTile3D
            key={tile.id}
            tile={tile}
            position={[x, 0, 0]}
            rotation={[0, 0, 0]}
            selected={selected}
            onClick={enabled ? () => onToggle(tile.id) : undefined}
          />
        );
      })}
    </group>
  );
}

/** 플레이어 id(1~4 AI)별 좌석 — 반시계 차례 남→서→북서→북동→동 과 맞춤 */
const AI_SEAT_BY_ID: Record<
  number,
  { pos: [number, number, number]; yaw: number }
> = {
  1: { pos: [-2.78, 0, 0.44], yaw: -0.5 },
  2: { pos: [2.78, 0, 0.44], yaw: 0.5 },
  3: { pos: [-1.72, 0, -2.52], yaw: -1.0 },
  4: { pos: [1.72, 0, -2.52], yaw: 1.0 },
};

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
}) {
  const aiPlayers = useMemo(() => players.filter((p) => p.isAI), [players]);

  const seats = useMemo(() => {
    const make = (
      player: LexioPlayer,
      pos: [number, number, number],
      yaw: number,
    ) => ({
      player,
      pos,
      yaw,
      cardYaw: Math.atan2(pos[0], pos[2]),
    });
    if (aiPlayers.length !== 4) {
      return aiPlayers.map((p, i) =>
        make(p, [(-1.5 + i) * 0.82, 0, -2.55], 0),
      );
    }
    return aiPlayers.map((p) => {
      const cfg = AI_SEAT_BY_ID[p.id];
      if (cfg) return make(p, cfg.pos, cfg.yaw);
      return make(p, [0, 0, -2.55], 0);
    });
  }, [aiPlayers]);

  const reveal = phase === 'finished';

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

      <ambientLight intensity={0.4} />
      <directionalLight
        castShadow
        position={[4, 10, 6]}
        intensity={1.1}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <pointLight position={[0, 3.2, 1.5]} intensity={0.5} color="#e9d5ff" />

      <TableRoom />
      <DiscardPile3D placements={discardPlacements} />
      {/** 진행 중·종료 후: 테이블 중앙 마지막 조합(승리 직전 내기) 유지 */}
      <CenterPlay3D combo={currentPlay} />

      {seats.map(({ player, pos, yaw, cardYaw }) => {
        const idx = players.findIndex((p) => p.id === player.id);
        return (
          <OpponentSeat
            key={player.id}
            player={player}
            seatPosition={pos}
            faceYaw={yaw}
            cardYaw={cardYaw}
            isActive={idx === currentPlayerIdx && phase === 'playing'}
            showPass={player.passed}
            reveal={reveal}
            peerCoins={
              finishTableUi?.playersCoins.find((c) => c.playerId === player.id) ??
              null
            }
          />
        );
      })}

      {humanPlayer && (phase === 'playing' || phase === 'finished') && (
        <HandRow3D
          tiles={humanPlayer.hand}
          selectedIds={selectedIds}
          onToggle={onToggleTile}
          enabled={phase === 'playing'}
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

      <hemisphereLight args={['#312e81', '#0f172a', 0.4]} />
    </>
  );
}

/** 1인칭 → 판 종료 시 테이블 거의 수직 내려다보기(2초) */
function FirstPersonCameraRig({
  phase,
}: {
  phase: 'setup' | 'playing' | 'finished';
}) {
  const camera = useThree((s) => s.camera);
  const finishStartRef = useRef<number | null>(null);

  const camPos0 = useMemo(() => new THREE.Vector3(0, 3.45, 4.55), []);
  /** 판 종료 시 탑다운 카메라 위치(lerp 끝점) */
  const camPos1 = useMemo(() => new THREE.Vector3(0, 5.38, 0.24), []);
  const look0 = useMemo(() => new THREE.Vector3(0, 0.52, -0.12), []);
  const look1 = useMemo(
    () => new THREE.Vector3(0, TABLE_TOP_Y + 0.02, 0),
    [],
  );

  useLayoutEffect(() => {
    if (phase !== 'finished') {
      finishStartRef.current = null;
      camera.position.copy(camPos0);
      camera.lookAt(look0);
      camera.updateProjectionMatrix();
    }
  }, [phase, camera, camPos0, look0]);

  useFrame((state) => {
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
}) {
  return (
    <Canvas
      shadows
      camera={{ fov: 54, near: 0.08, far: 80, position: [0, 3.45, 4.55] }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      className="h-full w-full touch-none"
    >
      <FirstPersonCameraRig phase={phase} />
      <Suspense fallback={null}>
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
        />
      </Suspense>
    </Canvas>
  );
}
