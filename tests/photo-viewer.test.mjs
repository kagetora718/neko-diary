// 日記写真の全体表示ビューアの自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTOS, openCat, reset, startApp } from './helpers.mjs';

const PORT = 3121;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

// helpers の PHOTOS は 120x90（4:3）のPNG。正方形でないので比率の確認に使える。
const uri = (base64) => `data:image/png;base64,${base64}`;
const WIDE = uri(PHOTOS[0]);
const OTHER = uri(PHOTOS[1]);
const THIRD = uri(PHOTOS[2]);

const diary = (id, date, photos, text = '') => ({
  id,
  catId: 'cat-ravi',
  date,
  photos,
  text,
});

async function open(entries) {
  await reset(page, app.base, []);
  await page.evaluate(
    (payload) => window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload)),
    {
      cats: [{ id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' }],
      entries,
    },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCat(page);
  await page.waitForSelector('.entry');
}

const viewerCount = () => page.locator('.viewer').count();
const viewerSrc = () => page.locator('.viewer-photo').getAttribute('src');

const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

describe('写真の全体表示', () => {
  it('1. サムネイルが押せる要素になっている', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);

    const buttons = page.locator('.entry-photo');
    assert.equal(await buttons.count(), 1);
    assert.equal(await buttons.evaluate((n) => n.tagName), 'BUTTON');
    assert.equal(await buttons.getAttribute('aria-label'), '写真を大きく見る');
  });

  it('2. 押すとビューアが開き、同じ写真が表示される', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);
    assert.equal(await viewerCount(), 0, '最初から開いている');

    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    assert.equal(await viewerSrc(), WIDE, '押した写真と違う画像が出ている');
  });

  it('3. 切り取らずに全体が出る（contain・元の縦横比）', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    const fit = await page.locator('.viewer-photo').evaluate((n) => getComputedStyle(n).objectFit);
    assert.equal(fit, 'contain');

    const size = await page.locator('.viewer-photo').evaluate((n) => ({
      w: n.getBoundingClientRect().width,
      h: n.getBoundingClientRect().height,
      naturalW: n.naturalWidth,
      naturalH: n.naturalHeight,
    }));

    const shown = size.w / size.h;
    const original = size.naturalW / size.naturalH;
    assert.ok(
      Math.abs(shown - original) < 0.05,
      `縦横比が変わっている (表示 ${shown.toFixed(2)} / 元 ${original.toFixed(2)})`,
    );
  });

  it('4. 画面内に収まる', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    const fits = await page.locator('.viewer-photo').evaluate((n) => {
      const r = n.getBoundingClientRect();
      return r.width <= window.innerWidth && r.height <= window.innerHeight;
    });
    assert.equal(fits, true, '写真が画面からはみ出している');
  });

  it('5. 一覧のサムネイルは切り取り表示のまま', async () => {
    await open([diary('e1', '2026-08-01', [WIDE, OTHER])]);

    const thumb = await page.locator('.entry-photos img').first().evaluate((n) => ({
      fit: getComputedStyle(n).objectFit,
      height: Math.round(n.getBoundingClientRect().height),
    }));

    assert.equal(thumb.fit, 'cover', 'サムネイルの表示方法が変わっている');
    assert.equal(thumb.height, 220, 'サムネイルの高さが変わっている');
  });

  it('6. ×で閉じられ、一覧へ戻る', async () => {
    await open([diary('e1', '2026-08-01', [WIDE], '本文あり')]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    await page.getByRole('button', { name: '閉じる' }).click();
    assert.equal(await viewerCount(), 0, '閉じていない');

    // 一覧はそのまま
    assert.equal(await page.locator('.entry').count(), 1);
    assert.equal(await page.locator('.entry-text').innerText(), '本文あり');
  });

  it('7. 背景を押しても閉じるが、写真自体を押しても閉じない', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    await page.locator('.viewer-photo').click();
    assert.equal(await viewerCount(), 1, '写真を押しただけで閉じている');

    // 背景（左上のすみ）を押す
    await page.locator('.viewer').click({ position: { x: 5, y: 200 } });
    assert.equal(await viewerCount(), 0, '背景を押しても閉じない');
  });

  it('8. 複数写真では押した1枚だけが出る', async () => {
    await open([diary('e1', '2026-08-01', [WIDE, OTHER, THIRD])]);
    assert.equal(await page.locator('.entry-photo').count(), 3);

    await page.locator('.entry-photo').nth(1).click();
    await page.waitForSelector('.viewer');

    assert.equal(await page.locator('.viewer-photo').count(), 1, '複数枚出ている');
    const second = await page.locator('.entry-photos img').nth(1).getAttribute('src');
    assert.equal(await viewerSrc(), second);
  });

  it('9. 閉じてから別の写真を押すとその写真が出る', async () => {
    await open([diary('e1', '2026-08-01', [WIDE, OTHER])]);

    await page.locator('.entry-photo').first().click();
    await page.waitForSelector('.viewer');
    const first = await viewerSrc();
    await page.getByRole('button', { name: '閉じる' }).click();

    await page.locator('.entry-photo').nth(1).click();
    await page.waitForSelector('.viewer');
    const second = await viewerSrc();

    assert.notEqual(first, second, '別の写真を押しても同じ画像が出ている');
    assert.equal(second, await page.locator('.entry-photos img').nth(1).getAttribute('src'));
  });

  it('10. 写真のない日記では何も変わらない', async () => {
    await open([diary('e1', '2026-08-01', [], '文章だけ')]);

    assert.equal(await page.locator('.entry-photo').count(), 0);
    assert.equal(await page.locator('.entry-photos').count(), 0);
    assert.equal(await viewerCount(), 0);
    assert.equal(await page.locator('.entry-text').innerText(), '文章だけ');
  });

  it('11. 表示中は後ろの一覧がスクロールしない', async () => {
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    assert.equal(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      'hidden',
    );

    await page.getByRole('button', { name: '閉じる' }).click();
    assert.notEqual(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
      'hidden',
      '閉じたのにスクロールが止まったまま',
    );
  });

  it('12. 320px幅ではみ出さない', async () => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    assert.equal(await overflow(), 0, `横に ${await overflow()}px はみ出している`);
    const fits = await page.locator('.viewer-photo').evaluate((n) => {
      const r = n.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
    });
    assert.equal(fits, true);
  });

  it('13. 390px幅ではみ出さない', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    assert.equal(await overflow(), 0);

    // 閉じるボタンは押しやすい大きさ
    const close = await page.getByRole('button', { name: '閉じる' }).boundingBox();
    assert.ok(close.width >= 44 && close.height >= 44, '閉じるボタンが小さい');
  });

  it('14. iPad相当の幅でも巨大化せず全体が出る', async () => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await open([diary('e1', '2026-08-01', [WIDE])]);
    await page.locator('.entry-photo').click();
    await page.waitForSelector('.viewer');

    const size = await page.locator('.viewer-photo').evaluate((n) => {
      const r = n.getBoundingClientRect();
      return { w: r.width, h: r.height, naturalW: n.naturalWidth, naturalH: n.naturalHeight };
    });

    // 元より引き伸ばさず、画面にも収まっている
    assert.ok(size.w <= size.naturalW + 1, '元の写真より引き伸ばされている');
    assert.ok(size.w <= 1180 && size.h <= 820);
    assert.ok(
      Math.abs(size.w / size.h - size.naturalW / size.naturalH) < 0.05,
      '縦横比が変わっている',
    );

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('15. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
