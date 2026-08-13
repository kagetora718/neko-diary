// テスト共通の下ごしらえ。
// 開発サーバーの起動、ブラウザ、テスト用画像の生成をまとめている。
//
// WebKit はこの環境で取得できないため Chromium で検証する。
// ブラウザ差の影響を受けにくいよう、DOM の change イベントを直接発火させて確認する。

import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

/* ---------- テスト用の小さなPNGを作る（画像ファイルを同梱しないため） ---------- */

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

// 単色PNGをbase64で返す。色を変えると縮小後のデータURIも変わるので、
// 「どの写真が残っているか」を src の差で判定できる。
function pngBase64([r, g, b], width = 120, height = 90) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const off = y * (1 + width * 3);
    for (let x = 0; x < width; x++) {
      raw[off + 1 + x * 3] = r;
      raw[off + 2 + x * 3] = g;
      raw[off + 3 + x * 3] = b;
    }
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
}

export const PHOTOS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
].map((color) => pngBase64(color));

/* ---------- 開発サーバーとブラウザ ---------- */

export async function startApp(port) {
  const base = `http://localhost:${port}`;

  const root = new URL('..', import.meta.url).pathname;

  // next を直接起動し、プロセスグループごと落とせるようにする。
  // ラッパー越しに起動すると停止時に next が生き残り、
  // 次のテストファイルが .next を掴めずサーバーを起動できなくなる。
  const server = spawn(`${root}/node_modules/.bin/next`, ['dev', '-p', String(port)], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });

  const deadline = Date.now() + 120000;
  for (;;) {
    try {
      const res = await fetch(base);
      if (res.ok) break;
    } catch {
      // まだ起動していない
    }
    if (Date.now() > deadline) throw new Error('開発サーバーが起動しませんでした');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 } });

  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') jsErrors.push(`console: ${m.text()}`);
  });

  return {
    page,
    jsErrors,
    base,
    async stop() {
      await browser.close();
      try {
        process.kill(-server.pid, 'SIGTERM');
      } catch {
        server.kill('SIGTERM');
      }
      // .next が解放されてから次のテストファイルが起動できるように少し待つ。
      await new Promise((resolve) => setTimeout(resolve, 1500));
    },
  };
}

/* ---------- 画面操作 ---------- */

// 保存データを消してホームから開き直す。
export async function reset(page, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export async function openCat(page) {
  await page.getByRole('button', { name: /ラヴィ/ }).click();
}

export async function openNewEntry(page, base) {
  await reset(page, base);
  await openCat(page);
  await page.getByRole('button', { name: '今日の思い出を残す' }).click();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
}

// 写真を1枚選ぶ（ファイル選択ダイアログの代わりに change を発火させる）。
// 実機の「写真を追加 → 1枚選ぶ」に相当する。
export async function selectPhoto(page, index) {
  await page.evaluate((data) => {
    const input = document.querySelector('input[type=file]');
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], `photo-${Date.now()}.png`, { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, PHOTOS[index]);
  await page.waitForTimeout(400);
}

export const previewCount = (page) => page.locator('.preview img').count();
export const previewSrcs = (page) => page.locator('.preview img').evaluateAll((n) => n.map((x) => x.src));
