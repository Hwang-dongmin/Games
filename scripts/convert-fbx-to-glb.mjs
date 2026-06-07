import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import convert from 'fbx2gltf';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const modelsDir = path.join(root, 'public', 'models');
const outDir = path.join(modelsDir, 'glb');

function clipNameFromFile(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

/** T-pose / 중복 Mixamo export — 게임 GLB에서 제외 */
function shouldSkipFbx(fileName) {
  const base = clipNameFromFile(fileName);
  if (/^t[\s-]?pose$/i.test(base)) return true;
  if (/^sitting\s*\(\s*1\s*\)$/i.test(base)) return true;
  return false;
}

async function convertAllFbx() {
  const entries = await readdir(modelsDir, { withFileTypes: true });
  const fbxFiles = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.fbx'))
    .filter((e) => !shouldSkipFbx(e.name))
    .map((e) => e.name)
    .sort();

  if (fbxFiles.length === 0) {
    throw new Error(`No FBX files found in ${modelsDir}`);
  }

  await mkdir(outDir, { recursive: true });

  const converted = [];
  for (const fbx of fbxFiles) {
    const src = path.join(modelsDir, fbx);
    const dest = path.join(outDir, `${clipNameFromFile(fbx)}.glb`);
    console.log(`Converting ${fbx} -> glb/${path.basename(dest)}`);
    await convert(src, dest, ['--binary']);
    converted.push({ fbx, glb: dest, clipName: clipNameFromFile(fbx) });
  }

  return converted;
}

const converted = await convertAllFbx();
console.log(
  `\nConverted ${converted.length} GLB(s) to glb/:`,
  converted.map((c) => c.clipName).join(', '),
);
