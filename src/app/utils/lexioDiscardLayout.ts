import type { LexioTile } from './lexio';
import { LEXIO_CENTER_PLAY_TABLE_Z } from './lexioTableLayout';

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
const CENTER_PLAY_X = 0;
const CENTER_PLAY_Z = LEXIO_CENTER_PLAY_TABLE_Z;
const CENTER_PLAY_GAP = TILE_W * 1.1;
const MAX_CENTER_TILES = 5;
const TABLE_TOP_Y = 0.5;
const TABLE_SURFACE_EPS = 0.0015;

const DISCARD_TILE_W = TILE_W * 0.88;
const DISCARD_TILE_H = TILE_H * 0.88;
const DISCARD_XZ_REACH =
  Math.hypot(DISCARD_TILE_W / 2, DISCARD_TILE_H / 2) * 1.12;
const DISCARD_SPREAD_DIST = DISCARD_XZ_REACH * 1.55;
const DISCARD_LEAN_DIST = DISCARD_TILE_W * 0.5;
const KEEP_OUT_EXTRA = 0.1;
const STACK_STEP_Y = TILE_T * 0.72;

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

type DiscardPose = 'flat' | 'stand' | 'lean';

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

/** 제출 패 keep-out 바로 뒤까지 (중앙 Z가 커질수록 값이 커져 뒤쪽 버림 면적 확대) */
const ZONE_MAX_Z =
  CENTER_PLAY_KEEP_OUT.minZ - DISCARD_XZ_REACH - 0.006;

/** 중앙 제출 패 뒤·좌·우 — 이전 중앙(Z≈-0.2) 자리도 활용 */
const ZONE_CENTER_BACK_MAX_Z =
  CENTER_PLAY_KEEP_OUT.minZ - DISCARD_XZ_REACH - 0.04;

const DISCARD_ZONES: DiscardZone[] = [
  { minX: -1.16, maxX: -1.088, minZ: -1.1, maxZ: ZONE_MAX_Z },
  { minX: 1.088, maxX: 1.16, minZ: -1.1, maxZ: ZONE_MAX_Z },
  { minX: -0.76, maxX: 0.76, minZ: -1.1, maxZ: ZONE_MAX_Z },
  { minX: -0.58, maxX: 0.58, minZ: -1.1, maxZ: ZONE_CENTER_BACK_MAX_Z },
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

function xzReachForPose(rx: number): number {
  const t = Math.min(
    1,
    Math.abs(rx + Math.PI / 2) / (Math.PI / 2 - 0.12),
  );
  const standing = DISCARD_TILE_W * 0.52;
  return standing + (DISCARD_XZ_REACH - standing) * t;
}

function overlapsOtherDiscards(
  x: number,
  z: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'key'>>,
  minDist: number,
  exceptKey?: string,
): boolean {
  const d2 = minDist * minDist;
  for (const p of existing) {
    if (exceptKey && p.key === exceptKey) continue;
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < d2) return true;
  }
  return false;
}

function stackLayerAt(
  x: number,
  z: number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'y'>>,
): number {
  const r2 = (DISCARD_SPREAD_DIST * 0.65) ** 2;
  let layer = 0;
  for (const p of existing) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < r2) layer += 1;
  }
  return layer;
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
  const t = index * 2.399963 + rnd() * 0.4;
  const ring = Math.floor(index / 9);
  const x = Math.cos(t) * Math.min(0.62, 0.48 + ring * 0.035);
  const z = -0.92 - ring * 0.035 + Math.sin(t) * 0.12;
  return [x, z];
}

function pickDiscardXZ(
  rnd: () => number,
  existing: ReadonlyArray<Pick<DiscardPlacement, 'x' | 'z' | 'key'>>,
  globalIndex: number,
): [number, number] {
  for (let attempt = 0; attempt < 72; attempt++) {
    const zone = DISCARD_ZONES[Math.floor(rnd() * DISCARD_ZONES.length)];
    const [x, z] = sampleInZone(zone, rnd);
    if (
      !overlapsCenterPlay(x, z) &&
      !overlapsOtherDiscards(x, z, existing, DISCARD_SPREAD_DIST)
    ) {
      return [x, z];
    }
  }

  for (let attempt = 0; attempt < 36; attempt++) {
    const [x, z] = spiralFallback(globalIndex + attempt, rnd);
    if (
      !overlapsCenterPlay(x, z) &&
      !overlapsOtherDiscards(x, z, existing, DISCARD_SPREAD_DIST)
    ) {
      return [x, z];
    }
  }

  const zone = DISCARD_ZONES[globalIndex % DISCARD_ZONES.length];
  return sampleInZone(zone, rnd);
}

function pickPose(rnd: () => number, canLean: boolean): DiscardPose {
  const r = rnd();
  if (canLean && r < 0.36) return 'lean';
  if (r < 0.68) return 'flat';
  return 'stand';
}

function pickLeanAnchor(
  placed: DiscardPlacement[],
  rnd: () => number,
): DiscardPlacement | null {
  if (placed.length === 0) return null;
  const pool = placed.filter((p) => !overlapsCenterPlay(p.x, p.z));
  if (pool.length === 0) return placed[Math.floor(rnd() * placed.length)];
  return pool[Math.floor(rnd() * pool.length)];
}

function positionLeanAgainst(
  anchor: DiscardPlacement,
  rnd: () => number,
): { x: number; z: number; ry: number } {
  const awayX = anchor.x - CENTER_PLAY_X;
  const awayZ = anchor.z - CENTER_PLAY_Z;
  const base = Math.atan2(awayZ, awayX);
  const angle = base + (rnd() - 0.5) * 1.15;
  const dist = DISCARD_LEAN_DIST + rnd() * 0.07;
  return {
    x: anchor.x + Math.cos(angle) * dist,
    z: anchor.z + Math.sin(angle) * dist,
    ry: angle + Math.PI / 2 + (rnd() - 0.5) * 0.4,
  };
}

/** Three.js Euler 'XYZ' */
function rotateCornerXYZ(
  lx: number,
  ly: number,
  lz: number,
  rx: number,
  ry: number,
  rz: number,
): [number, number, number] {
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const y1 = ly * cx + lz * sx;
  const z1 = -ly * sx + lz * cx;
  const x1 = lx;

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x2 = x1 * cy + z1 * sy;
  const y2 = y1;
  const z2 = -x1 * sy + z1 * cy;

  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const x3 = x2 * cz - y2 * sz;
  const y3 = x2 * sz + y2 * cz;
  return [x3, y3, z2];
}

function discardYExtents(
  rx: number,
  ry: number,
  rz: number,
): { min: number; max: number } {
  const hw = DISCARD_TILE_W / 2;
  const hh = DISCARD_TILE_H / 2;
  const ht = TILE_T / 2;
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const lx of [-hw, hw]) {
    for (const ly of [-hh, hh]) {
      for (const lz of [-ht, ht]) {
        const [, y3] = rotateCornerXYZ(lx, ly, lz, rx, ry, rz);
        ymin = Math.min(ymin, y3);
        ymax = Math.max(ymax, y3);
      }
    }
  }
  return { min: ymin, max: ymax };
}

function sampleRotationForPose(
  pose: DiscardPose,
  rnd: () => number,
  leanRy?: number,
): { rx: number; ry: number; rz: number } {
  switch (pose) {
    case 'flat':
      return {
        rx: -1.18 - rnd() * rnd() * 0.34,
        ry: rnd() * Math.PI * 2,
        rz: (rnd() - 0.5) * 0.4,
      };
    case 'stand':
      return {
        rx: TILT_BACK - 0.06 - rnd() * 0.14,
        ry: rnd() * Math.PI * 2,
        rz: (rnd() - 0.5) * 0.2,
      };
    case 'lean':
      return {
        rx: -0.38 - rnd() * 0.52,
        ry: leanRy ?? rnd() * Math.PI * 2,
        rz: (rnd() - 0.5) * 0.34,
      };
  }
}

function computeDiscardY(
  rx: number,
  ry: number,
  rz: number,
  layer: number,
  rnd: () => number,
  anchor?: DiscardPlacement,
): number {
  const ext = discardYExtents(rx, ry, rz);
  if (anchor) {
    const aExt = discardYExtents(anchor.rx, anchor.ry, anchor.rz);
    const gap = 0.003 + rnd() * 0.008;
    return anchor.y + aExt.max - ext.min + gap;
  }
  const lift = -ext.min;
  return (
    TABLE_TOP_Y +
    TABLE_SURFACE_EPS +
    lift +
    layer * STACK_STEP_Y +
    rnd() * 0.003
  );
}

function tryLeanPlacement(
  anchor: DiscardPlacement,
  rnd: () => number,
  existing: DiscardPlacement[],
): {
  x: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
} | null {
  for (let attempt = 0; attempt < 28; attempt++) {
    const { x, z, ry } = positionLeanAgainst(anchor, rnd);
    const reach = xzReachForPose(-0.55);
    if (
      overlapsRect(x, z, reach, CENTER_PLAY_KEEP_OUT) ||
      overlapsOtherDiscards(x, z, existing, DISCARD_LEAN_DIST * 0.85, anchor.key)
    ) {
      continue;
    }
    const rot = sampleRotationForPose('lean', rnd, ry);
    if (overlapsRect(x, z, xzReachForPose(rot.rx), CENTER_PLAY_KEEP_OUT)) {
      continue;
    }
    return { x, z, ...rot };
  }
  return null;
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
    const canLean = placed.length > 0;
    let pose = pickPose(rnd, canLean);
    let anchor: DiscardPlacement | undefined;
    let x = 0;
    let z = 0;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    if (pose === 'lean') {
      const leanAnchor = pickLeanAnchor(placed, rnd);
      if (leanAnchor) {
        const lean = tryLeanPlacement(leanAnchor, rnd, placed);
        if (lean) {
          anchor = leanAnchor;
          ({ x, z, rx, ry, rz } = lean);
        } else {
          pose = rnd() < 0.55 ? 'flat' : 'stand';
        }
      } else {
        pose = rnd() < 0.55 ? 'flat' : 'stand';
      }
    }

    if (!anchor) {
      [x, z] = pickDiscardXZ(rnd, placed, globalIndex);
      ({ rx, ry, rz } = sampleRotationForPose(pose, rnd));
    }

    const layer = anchor ? 0 : stackLayerAt(x, z, placed);
    const y = computeDiscardY(rx, ry, rz, layer, rnd, anchor);

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
