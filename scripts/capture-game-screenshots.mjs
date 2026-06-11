import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/images/games');
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:5173';

async function clearStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function capture(page, name) {
  const filePath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`Saved ${filePath}`);
}

/** 게임 보드가 뷰포트 상단 쪽에 오도록 스크롤해 헤더·점수 영역 노출을 줄인다 */
async function frameGameplay(page, boardSelector, topInset = 36) {
  await page.locator(boardSelector).first().evaluate((el, inset) => {
    const rect = el.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + rect.top - inset,
      left: 0,
      behavior: 'instant',
    });
  }, topInset);
  await page.waitForTimeout(250);
}

async function goto(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'load', timeout: 60000 });
}

async function capture2048(page) {
  await goto(page, '/2048');
  await clearStorage(page);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForSelector('#game-board', { timeout: 15000 });

  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }

  await page.waitForTimeout(400);
  await frameGameplay(page, '#game-board', 28);
  await capture(page, '2048');
}

async function captureHoldem(page) {
  await goto(page, '/holdem');
  await clearStorage(page);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: 'Deal Me In' }).click();
  await page.getByRole('button', { name: 'Start Round' }).click();
  await page.waitForSelector('text=프리플랍', { timeout: 15000 });
  await page.waitForTimeout(1000);
  await capture(page, 'holdem');
}

async function captureBlindOmok(page) {
  await goto(page, '/blind-omok');
  await clearStorage(page);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: '싱글' }).click();
  await page.waitForSelector('text=싱글 — AI와 대결', { timeout: 10000 });

  const centerCoords = ['H8', 'I8', 'H9', 'G8', 'H7', 'I9', 'G9'];
  for (const coord of centerCoords) {
    const cell = page.getByRole('button', { name: new RegExp(`좌표 ${coord}$`) });
    if (await cell.count()) {
      await cell.click({ force: true });
      await page.waitForTimeout(450);
    }
  }

  await page.waitForTimeout(500);
  await frameGameplay(page, 'div[style*="repeat(15"]', 32);
  await capture(page, 'blind-omok');
}

async function captureLexio(page) {
  await goto(page, '/lexio');
  await clearStorage(page);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.getByRole('button', { name: '게임 시작' }).click();

  await page.waitForFunction(
    () =>
      document.querySelector('canvas') !== null &&
      document.querySelector('.lexio-loading-overlay') === null,
    { timeout: 120000 },
  );

  await page.waitForTimeout(800);
  await capture(page, 'lexio');
}

const CAPTURES = {
  '2048': capture2048,
  holdem: captureHoldem,
  'blind-omok': captureBlindOmok,
  lexio: captureLexio,
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const only = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
  const targets = only?.length ? only : Object.keys(CAPTURES);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 560 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  try {
    for (const name of targets) {
      const fn = CAPTURES[name];
      if (!fn) {
        console.warn(`Unknown capture target: ${name}`);
        continue;
      }
      await fn(page);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
