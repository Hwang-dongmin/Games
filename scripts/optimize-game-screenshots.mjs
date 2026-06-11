import sharp from 'sharp';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_DIR = path.join(__dirname, '../public/images/games');

async function optimizeFile(fileName) {
  const input = path.join(IN_DIR, fileName);
  const webpPath = path.join(IN_DIR, fileName.replace(/\.png$/i, '.webp'));

  await sharp(input)
    .resize(1080, null, { withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(webpPath);

  await unlink(input);
  console.log(`Optimized ${webpPath}`);
}

async function main() {
  const files = await readdir(IN_DIR);
  const pngs = files.filter((f) => f.endsWith('.png'));
  await Promise.all(pngs.map(optimizeFile));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
