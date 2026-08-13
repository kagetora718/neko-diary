// 新規記録画面の「写真を追加」の自動テスト。
// iPad Safari で2枚目以降を追加できなかった不具合の回帰テストを含む。
//
// 実行: npm test
// WebKit はこの環境で取得できないため Chromium で検証する。
// ブラウザ差の影響を受けにくいよう、DOM の change イベントを直接発火させて確認する。

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const PORT = 3111;
const BASE = `http://localhost:${PORT}`;

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
// 「1枚目が2枚目に置き換わっていないか」を src の差で判定できる。
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

const PHOTOS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
].map((color) => pngBase64(color));

/* ---------- 起動と共通操作 ---------- */

let server;
let browser;
let page;
let jsErrors = [];

async function waitForServer(timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      // まだ起動していない
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('開発サーバーが起動しませんでした');
}

// 新規記録画面を開き直して、毎回まっさらな状態にする。
async function openNewEntry() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /ラヴィ/ }).click();
  await page.getByRole('button', { name: '今日の思い出を残す' }).click();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
}

// 写真を1枚選ぶ（ファイル選択ダイアログの代わりに change を発火させる）。
// 実機の「写真を追加 → 1枚選ぶ」に相当する。
async function selectPhoto(index) {
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

const previewCount = () => page.locator('.preview img').count();
const previewSrcs = () => page.locator('.preview img').evaluateAll((n) => n.map((x) => x.src));

before(async () => {
  server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'development' },
  });
  await waitForServer();

  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 820, height: 1180 } });
  page.on('pageerror', (e) => jsErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') jsErrors.push(`console: ${m.text()}`);
  });
});

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

/* ---------- テスト本体 ---------- */

describe('新規記録：写真の追加', () => {
  it('1. 写真を1枚追加できる', async () => {
    await openNewEntry();
    await selectPhoto(0);
    assert.equal(await previewCount(), 1);
  });

  it('2. 1枚追加した後、もう1枚追加できる', async () => {
    await openNewEntry();
    await selectPhoto(0);
    assert.equal(await previewCount(), 1, '1枚目が追加されていない');
    await selectPhoto(1);
    assert.equal(await previewCount(), 2, '2枚目を追加できていない');
  });

  it('3. 追加済みの写真を保持したまま次の写真が追加される', async () => {
    await openNewEntry();
    await selectPhoto(0);
    const [first] = await previewSrcs();
    await selectPhoto(1);

    const srcs = await previewSrcs();
    assert.equal(srcs.length, 2);
    assert.equal(srcs[0], first, '1枚目が2枚目に置き換わっている');
    assert.notEqual(srcs[0], srcs[1], '2枚が同じ画像になっている');
  });

  it('4. 1枚ずつ繰り返して最大5枚まで追加できる', async () => {
    await openNewEntry();
    for (let i = 0; i < 5; i++) await selectPhoto(i);

    assert.equal(await previewCount(), 5);
    assert.equal(new Set(await previewSrcs()).size, 5, '5枚がすべて異なる画像であること');
  });

  it('5. 6枚目は追加されない', async () => {
    await openNewEntry();
    for (let i = 0; i < 5; i++) await selectPhoto(i);
    await selectPhoto(5);

    assert.equal(await previewCount(), 5, '上限を超えて追加されている');
    const disabled = await page.getByRole('button', { name: '写真を追加' }).isDisabled();
    assert.equal(disabled, true, '5枚に達したら「写真を追加」は押せないこと');
  });

  it('6. 追加済みの写真を個別に削除できる', async () => {
    await openNewEntry();
    await selectPhoto(0);
    await selectPhoto(1);
    const [, second] = await previewSrcs();

    await page.locator('.preview button').first().click();
    const srcs = await previewSrcs();
    assert.equal(srcs.length, 1);
    assert.equal(srcs[0], second, '削除対象でない写真が消えている');
  });

  it('7. 削除した後、また追加できる', async () => {
    await openNewEntry();
    for (let i = 0; i < 5; i++) await selectPhoto(i);
    await page.locator('.preview button').first().click();
    assert.equal(await previewCount(), 4);

    await selectPhoto(5);
    assert.equal(await previewCount(), 5, '削除後に追加できていない');
  });

  it('8. 保存すると最大5枚が日記一覧に表示される', async () => {
    await openNewEntry();
    for (let i = 0; i < 5; i++) await selectPhoto(i);
    await page.getByRole('button', { name: '保存する' }).click();

    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-photos img').count(), 5);
  });

  it('9. change の直後に input.value が同期的に空になる（iPad Safari 回帰防止）', async () => {
    await openNewEntry();

    // 縮小の完了を待たず、ハンドラの同期部分が終わった直後の値を見る。
    // ここが空でないと、iPad Safari は次の選択で change を発火しない。
    const value = await page.evaluate((data) => {
      const input = document.querySelector('input[type=file]');
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], 'a.png', { type: 'image/png' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return input.value;
    }, PHOTOS[0]);

    assert.equal(value, '', 'await の後ではなく同期的にリセットされていること');
  });

  it('10. 縮小の完了前に次の写真を選んでも写真が失われない', async () => {
    await openNewEntry();

    // 1枚目の縮小完了を待たずに2枚目・3枚目を選ぶ（iPadでの実操作に相当）。
    await page.evaluate((list) => {
      const input = document.querySelector('input[type=file]');
      list.forEach((data, i) => {
        const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bin], `p${i}.png`, { type: 'image/png' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }, PHOTOS.slice(0, 3));

    await page.waitForTimeout(1200);
    assert.equal(await previewCount(), 3, '重なった選択で写真が失われている');
  });

  it('11. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(jsErrors, []);
  });
});
