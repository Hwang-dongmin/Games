import type { LexioTile } from './lexio';

/** 같은 숫자 타일끼리 한 그룹 (손패 정렬 순서 유지) */
export function groupTilesByNumber(tiles: LexioTile[]): LexioTile[][] {
  if (tiles.length === 0) return [];
  const groups: LexioTile[][] = [[tiles[0]]];
  for (let i = 1; i < tiles.length; i++) {
    const t = tiles[i];
    const last = groups[groups.length - 1]!;
    if (t.number === last[0]!.number) last.push(t);
    else groups.push([t]);
  }
  return groups;
}

/** 숫자 그룹 단위로 두 줄에 나눔 — 같은 숫자는 항상 같은 줄 */
export function splitHandIntoTwoRows(tiles: LexioTile[]): [LexioTile[], LexioTile[]] {
  const groups = groupTilesByNumber(tiles);
  const row0: LexioTile[] = [];
  const row1: LexioTile[] = [];
  let count0 = 0;
  let count1 = 0;

  for (const group of groups) {
    if (count0 <= count1) {
      row0.push(...group);
      count0 += group.length;
    } else {
      row1.push(...group);
      count1 += group.length;
    }
  }

  return [row0, row1];
}

export type HandRowLayer = 'front' | 'back' | 'single';

export type HandTilePlacement = {
  tile: LexioTile;
  position: [number, number, number];
  rowLayer: HandRowLayer;
};

/**
 * 손패 3D 배치 — 좁은 화면이면 2줄(숫자 그룹 단위), 아니면 1줄.
 */
export function layoutHandTiles3D(
  tiles: LexioTile[],
  options: {
    narrow: boolean;
    gap: number;
    /** 플레이어 쪽 줄 Z (+ = 카메라/테이블 바깥) */
    frontRowZ?: number;
    /** 테이블 쪽 줄 Z (− = 테이블 중앙 방향) */
    backRowZ?: number;
    /** 두 줄일 때 뒤줄 Y lift */
    backRowY?: number;
  },
): HandTilePlacement[] {
  const {
    narrow,
    gap,
    frontRowZ = 0.34,
    backRowZ = -0.1,
    backRowY = 0,
  } = options;
  const n = tiles.length;

  if (n === 0) return [];

  const useTwoRows = narrow && n > 4;

  if (!useTwoRows) {
    const total = (n - 1) * gap;
    return tiles.map((tile, i) => ({
      tile,
      position: [-total / 2 + i * gap, 0, 0],
      rowLayer: 'single' as const,
    }));
  }

  const [backRow, frontRow] = splitHandIntoTwoRows(tiles);
  const placements: HandTilePlacement[] = [];

  const placeRow = (
    rowTiles: LexioTile[],
    z: number,
    y: number,
    rowLayer: HandRowLayer,
  ) => {
    if (rowTiles.length === 0) return;
    const total = (rowTiles.length - 1) * gap;
    rowTiles.forEach((tile, i) => {
      placements.push({
        tile,
        position: [-total / 2 + i * gap, y, z],
        rowLayer,
      });
    });
  };

  if (frontRow.length === 0) {
    placeRow(backRow, 0, 0, 'single');
  } else if (backRow.length === 0) {
    placeRow(frontRow, 0, 0, 'single');
  } else {
    placeRow(backRow, backRowZ, backRowY, 'back');
    placeRow(frontRow, frontRowZ, 0, 'front');
  }

  return placements;
}
