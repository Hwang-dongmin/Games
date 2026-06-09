import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbDir = path.join(__dirname, '..', 'public', 'models', 'glb');

/**
 * 메시로 렌더링되는 GLB. 메시/스킨/애니는 유지하고 텍스처만 1024 WebP로 압축.
 * 그 외 파일은 애니메이션 전용으로 간주하여 메시/머티리얼/텍스처/스킨을 제거한다.
 */
const MESH_FILES = new Set(['Sitting.glb', 'Remy.glb', 'MaleSitting.glb']);

const MAX_TEXTURE_SIZE = 1024;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 애니메이션 트랙만 남기고 메시/머티리얼/텍스처/스킨을 제거한다. */
async function stripToAnimationOnly(document) {
  const root = document.getRoot();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const material of root.listMaterials()) material.dispose();
  for (const texture of root.listTextures()) texture.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  // 본 노드는 애니메이션 채널 타깃이라 keepLeaves로 보존, 고아 accessor만 정리
  await document.transform(prune({ keepLeaves: true, keepAttributes: false }));
}

/** 텍스처를 WebP로 변환하고 1024 이하로 리사이즈한다. */
async function compressTextures(document) {
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE],
      quality: 85,
    }),
  );
}

async function optimizeFile(fileName) {
  const filePath = path.join(glbDir, fileName);
  const before = (await stat(filePath)).size;

  const document = await io.read(filePath);
  if (MESH_FILES.has(fileName)) {
    await compressTextures(document);
  } else {
    await stripToAnimationOnly(document);
  }
  await io.write(filePath, document);

  const after = (await stat(filePath)).size;
  const mode = MESH_FILES.has(fileName) ? 'texture' : 'anim-only';
  const pct = (((before - after) / before) * 100).toFixed(1);
  console.log(
    `${fileName.padEnd(34)} [${mode.padEnd(9)}] ${mb(before).padStart(9)} -> ${mb(
      after,
    ).padStart(9)}  (-${pct}%)`,
  );
  return { before, after };
}

async function main() {
  const entries = await readdir(glbDir, { withFileTypes: true });
  const glbFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.glb'))
    .map((e) => e.name)
    .sort();

  if (glbFiles.length === 0) {
    throw new Error(`No GLB files found in ${glbDir}`);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  for (const fileName of glbFiles) {
    const { before, after } = await optimizeFile(fileName);
    totalBefore += before;
    totalAfter += after;
  }

  const pct = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
  console.log(
    `\nTotal: ${mb(totalBefore)} -> ${mb(totalAfter)}  (-${pct}%) across ${
      glbFiles.length
    } files`,
  );
}

await main();
