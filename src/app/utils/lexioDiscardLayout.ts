import type { LexioTile } from './lexio';
import { LEXIO_CENTER_PLAY_TABLE_Z } from './lexioTableLayout';
import {
  discardTileContactGroupY,
  getRoundedTileGeometry,
} from './lexioTileGeometry';

export type DiscardPlacement = {
  key: string;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};

/** LexioFirstPersonScene TILE_* / TABLE_* 와 동일 */
const TILE_W = 0.212;
const TILE_H = TILE_W * (89 / 57);
const TILE_T = 0.092;
const TILT_BACK = -0.18;
const CENTER_PLAY_Z = LEXIO_CENTER_PLAY_TABLE_Z;
const CENTER_PLAY_GAP = TILE_W * 1.1;
const MAX_CENTER_TILES = 5;
const TABLE_TOP_Y = 0.5;
const TABLE_SURFACE_EPS = 0.0015;

const DISCARD_TILE_W = TILE_W * 0.88;
const DISCARD_TILE_H = TILE_H * 0.88;
const DISCARD_XZ_REACH =
  Math.hypot(DISCARD_TILE_W / 2, DISCARD_TILE_H / 2) * 1.12;
const DISCARD_SPREAD_DIST = DISCARD_XZ_REACH * 1.92;
const KEEP_OUT_EXTRA = 0.1;
const TABLE_X_LIMIT = 1.12;
const TABLE_Z_MIN = -1.05;

/** LexioFirstPersonScene OpponentSeat — 손패가 테이블 위에 놓이는 위치 */
const OPPONENT_HAND_Z = -0.92;
const OPPONENT_BACK_GAP = TILE_W * 0.78;
const OPPONENT_MAX_HAND = 14;
const OPPONENT_HAND_HALF_SPREAD =
  ((OPPONENT_MAX_HAND - 1) * OPPONENT_BACK_GAP) / 2;
const OPPONENT_SEATS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0, z: -2.55 },
  { x: -2.78, z: 0.44 },
  { x: 2.78, z: 0.44 },
  { x: -1.72, z: -2.52 },
  { x: 1.72, z: -2.52 },
];

type KeepOutRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type DiscardZone = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const DISCARD_GEOM = getRoundedTileGeometry(
  DISCARD_TILE_W,
  DISCARD_TILE_H,
  TILE_T,
);

type DiscardPose = 'flat' | 'stand';

/** CenterPlay3D 최대 5장 */
function computeCenterPlayKeepOut(): KeepOutRect {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const ht = TILE_T / 2;
  const sinT = Math.sin(TILT_BACK);
  const cosT = Math.cos(TILT_BACK);
  const total = (MAX_CENTER_TILES - 1) * CENTER_PLAY_GAP;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < MAX_CENTER_TILES; i++) {
    const tileX = -total / 2 + i * CENTER_PLAY_GAP;
    minX = Math.min(minX, tileX - hw);
    maxX = Math.max(maxX, tileX + hw);
    for (const ly of [-hh, hh]) {
      for (const lz of [-ht, ht]) {
        const wz = CENTER_PLAY_Z + sinT * ly + cosT * lz;
        minZ = Math.min(minZ, wz);
        maxZ = Math.max(maxZ, wz);
      }
    }
  }

  const margin = KEEP_OUT_EXTRA + DISCARD_XZ_REACH;
  return {
    minX: minX - margin,
    maxX: maxX + margin,
    minZ: minZ - margin,
    maxZ: maxZ + margin + 0.14,
  };
}

const CENTER_PLAY_KEEP_OUT = computeCenterPlayKeepOut();

function computeOpponentHandKeepOuts(): KeepOutRect[] {
  const tileReach = DISCARD_TILE_W * 0.55 + 0.14;
  const margin = OPPONENT_HAND_HALF_SPREAD + tileReach;

  return OPPONENT_SEATS.map(({ x: sx, z: sz }) => {
    const cardYaw = Math.atan2(sx, sz);
    const cx = sx - OPPONENT_HAND_Z * Math.sin(cardYaw);
    const cz = sz - OPPONENT_HAND_Z * Math.cos(cardYaw);
    return {
      minX: cx - margin,
      maxX: cx + margin,
      minZ: cz - margin,
      maxZ: cz + margin,
    };
  });
}

const OPPONENT_HAND_KEEP_OUTS = computeOpponentHandKeepOuts();

/** 제출 패 keep-out 바로 뒤까지 (중앙 Z가 커질수록 값이 커져 뒤쪽 버림 면적 확대) */
const ZONE_MAX_Z =
  CENTER_PLAY_KEEP_OUT.minZ - DISCARD_XZ_REACH - 0.006;

/** 중앙 제출 패 뒤·좌·우 — 이전 중앙(Z≈-0.2) 자리도 활용 */
const ZONE_CENTER_BACK_MAX_Z =
  CENTER_PLAY_KEEP_OUT.minZ - DISCARD_XZ_REACH - 0.04;

const DISCARD_ZONES: DiscardZone[] = [
  { minX: -0.58, maxX: 0.58, minZ: -1.05, maxZ: ZONE_CENTER_BACK_MAX_Z },
  { minX: -1.1, maxX: -0.62, minZ: -1.05, maxZ: -0.42 },
  { minX: 0.62, maxX: 1.1, minZ: -1.05, maxZ: -0.42 },
  { minX: -1.1, maxX: -0.72, minZ: -1.05, maxZ: ZONE_MAX_Z },
  { minX: 0.72, maxX: 1.1, minZ: -1.05, maxZ: ZONE_MAX_Z },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlapsRect(
  x: number,
  z: number,
  reach: number,
  rect: KeepOutRect,
): boolean {
  return (
    x + reach > rect.minX &&
    x - reach < rect.maxX &&
    z + reach > rect.minZ &&
    z - reach < rect.maxZ
  );
}

function overlapsCenterPlay(x: number, z: number): boolean {
  return overlapsRect(x, z, DISCARD_XZ_REACH, CENTER_PLAY_KEEP_OUT);
}

function overlapsOpponentHands(x: number, z: number): boolean {
  for (const rect of OPPONENT_HAND_KEEP_OUTS) {
    if (overlapsRect(x, z, DISCARD_XZ_REACH, rect)) return true;
  }
  return false;
}

function overlapsBlockedAreas(x: number, z: number): boolean {
  return overlapsCenterPlay(x, z) || overlapsOpponentHands(x, z);
}

function overlapsOtherDiscards(
  x: number,
  z: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'key'>>,
  minDist: number,
): boolean {
  const d2 = minDist * minDist;
  for (const p of existing) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < d2) return true;
  }
  return false;
}

function pickRandomZone(rnd: () => number): DiscardZone {
  return DISCARD_ZONES[Math.floor(rnd() * DISCARD_ZONES.length)];
}

function sampleSpreadXZ(rnd: () => number): [number, number] {
  if (rnd() < 0.55) {
    const zone = pickRandomZone(rnd);
    return sampleInZone(zone, rnd);
  }
  const x = (rnd() * 2 - 1) * TABLE_X_LIMIT;
  const z = TABLE_Z_MIN + rnd() * (ZONE_MAX_Z - TABLE_Z_MIN);
  return [x, z];
}

function minDistToDiscardsSq(
  x: number,
  z: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z'>>,
): number {
  if (existing.length === 0) return Infinity;
  let best = Infinity;
  for (const p of existing) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return best;
}

function sampleInZone(zone: DiscardZone, rnd: () => number): [number, number] {
  const x = zone.minX + rnd() * (zone.maxX - zone.minX);
  const z = zone.minZ + rnd() * (zone.maxZ - zone.minZ);
  return [x, z];
}

function spiralFallback(
  index: number,
  rnd: () => number,
): [number, number] {
  const t = index * 2.399963 + rnd() * 0.55;
  const ring = Math.floor(index / 7);
  const radius = Math.min(1.05, 0.38 + ring * 0.09);
  const x = Math.cos(t) * radius;
  const z = TABLE_Z_MIN + 0.18 + ring * 0.07 + (Math.sin(t) + 1) * 0.22;
  return [x, Math.min(ZONE_MAX_Z, z)];
}

function isValidDiscardXZ(
  x: number,
  z: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'key'>>,
  minDist: number,
): boolean {
  if (Math.abs(x) > TABLE_X_LIMIT || z < TABLE_Z_MIN || z > ZONE_MAX_Z) {
    return false;
  }
  return (
    !overlapsBlockedAreas(x, z) &&
    !overlapsOtherDiscards(x, z, existing, minDist)
  );
}

function pickDiscardXZ(
  rnd: () => number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'key'>>,
  globalIndex: number,
): [number, number] {
  let best: [number, number] | null = null;
  let bestScore = -1;

  for (let attempt = 0; attempt < 96; attempt++) {
    const [x, z] = sampleSpreadXZ(rnd);
    if (!isValidDiscardXZ(x, z, existing, DISCARD_SPREAD_DIST)) continue;
    const score = minDistToDiscardsSq(x, z, existing);
    if (score > bestScore) {
      bestScore = score;
      best = [x, z];
    }
  }
  if (best) return best;

  for (let attempt = 0; attempt < 48; attempt++) {
    const [x, z] = spiralFallback(globalIndex + attempt, rnd);
    if (!isValidDiscardXZ(x, z, existing, DISCARD_SPREAD_DIST * 0.82)) continue;
    const score = minDistToDiscardsSq(x, z, existing);
    if (score > bestScore) {
      bestScore = score;
      best = [x, z];
    }
  }
  if (best) return best;

  for (let attempt = 0; attempt < 32; attempt++) {
    const [x, z] = sampleSpreadXZ(rnd);
    if (isValidDiscardXZ(x, z, existing, DISCARD_SPREAD_DIST * 0.68)) {
      return [x, z];
    }
  }

  const zone = DISCARD_ZONES[globalIndex % DISCARD_ZONES.length];
  return sampleInZone(zone, rnd);
}

function pickPose(rnd: () => number): DiscardPose {
  return rnd() < 0.84 ? 'flat' : 'stand';
}

function sampleRotationForPose(
  pose: DiscardPose,
  rnd: () => number,
): { rx: number; ry: number; rz: number } {
  const spin = rnd() * Math.PI * 2;
  if (pose === 'flat') {
    // ry 대신 rz — XYZ 오일러에서 rx=-π/2 일 때 ry는 기울어짐(gimbal lock)
    return { rx: -Math.PI / 2, ry: 0, rz: spin };
  }
  return { rx: 0, ry: spin, rz: 0 };
}

function computeDiscardY(
  pose: DiscardPose,
  spin: number,
  rnd: () => number,
): number {
  return (
    discardTileContactGroupY(
      DISCARD_GEOM,
      pose === 'flat',
      spin,
      TABLE_TOP_Y,
      TABLE_SURFACE_EPS,
    ) +
    rnd() * 0.002
  );
}

export function buildDiscardPlacements(
  tiles: LexioTile[],
  seq: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'y' | 'rx' | 'ry' | 'rz' | 'key'>>,
): DiscardPlacement[] {
  const rnd = mulberry32(seq * 2654435761 + existing.length);
  const additions: DiscardPlacement[] = [];
  const placed: DiscardPlacement[] = [...existing];

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const globalIndex = placed.length;
    const pose = pickPose(rnd);
    const [x, z] = pickDiscardXZ(rnd, placed, globalIndex);
    const { rx, ry, rz } = sampleRotationForPose(pose, rnd);
    const spin = pose === 'flat' ? rz : ry;
    const y = computeDiscardY(pose, spin, rnd);

    const placement: DiscardPlacement = {
      key: `discard-${t.id}-s${seq}-i${i}`,
      x,
      y,
      z,
      rx,
      ry,
      rz,
    };
    additions.push(placement);
    placed.push(placement);
  }

  return additions;
}
