import * as THREE from 'three';

const tileRoundedGeomCache = new Map<string, THREE.BufferGeometry>();

export function getRoundedTileGeometry(
  width: number,
  height: number,
  depth: number,
): THREE.BufferGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const cr = Math.min(
    Math.min(width, height) * 0.1,
    hw * 0.44,
    hh * 0.36,
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

  const bevelTh = Math.min(depth * 0.09, cr * 0.5);
  const bevelSz = Math.min(cr * 0.38, depth * 0.075);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelTh > 0.002,
    bevelThickness: bevelTh,
    bevelSize: bevelSz,
    bevelSegments: 4,
    steps: 1,
    curveSegments: 20,
  });
  geom.computeVertexNormals();
  geom.center();
  tileRoundedGeomCache.set(key, geom);
  return geom;
}

const _discardCorner = new THREE.Vector3();
const _discardRot = new THREE.Matrix4();
const _discardEuler = new THREE.Euler();

/** DiscardFaceDownTile 회전과 동일 — 로컬 bbox 최저 Y */
function discardTileBottomMinY(
  geom: THREE.BufferGeometry,
  isFlat: boolean,
  spin: number,
): number {
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox!;

  _discardEuler.set(
    isFlat ? -Math.PI / 2 : 0,
    isFlat ? 0 : spin,
    isFlat ? spin : 0,
    'XYZ',
  );
  _discardRot.makeRotationFromEuler(_discardEuler);

  let yMin = Infinity;
  for (const x of [bb.min.x, bb.max.x]) {
    for (const y of [bb.min.y, bb.max.y]) {
      for (const z of [bb.min.z, bb.max.z]) {
        _discardCorner.set(x, y, z).applyMatrix4(_discardRot);
        if (_discardCorner.y < yMin) yMin = _discardCorner.y;
      }
    }
  }
  return yMin;
}

export function discardTileContactGroupY(
  geom: THREE.BufferGeometry,
  isFlat: boolean,
  spin: number,
  tableTopY: number,
  surfaceEps: number,
): number {
  return tableTopY + surfaceEps - discardTileBottomMinY(geom, isFlat, spin);
}
