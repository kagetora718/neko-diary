// ホーム画面の背景の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, startApp } from './helpers.mjs';

const PORT = 3122;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

const pet = (id, name) => ({ id, name, photo: 'data:image/svg+xml;utf8,<svg/>' });

async function home(cats) {
  await reset(page, app.base, []);
  await page.evaluate(
    (payload) => window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload)),
    { cats, entries: [] },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.title');
}

const backgroundImage = () =>
  page.locator('.home-bg').evaluate((n) => getComputedStyle(n).backgroundImage);

const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

describe('ホーム画面の背景', () => {
  it('1. 背景が敷かれ、画像が読み込める', async () => {
    await home([]);

    assert.equal(await page.locator('.home-bg').count(), 1);

    const image = await backgroundImage();
    assert.match(image, /pet-background/, '背景画像が指定されていない');

    // 実際に読み込めること（パスが壊れていないこと）
    const url = image.match(/url\("([^"]*pet-background[^"]*)"\)/)[1];
    const ok = await page.evaluate(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img.naturalWidth > 0);
          img.onerror = () => resolve(false);
          img.src = src;
        }),
      url,
    );
    assert.equal(ok, true, `背景画像を読み込めない (${url})`);
  });

  it('2. 画面いっぱいに敷かれ、内容より後ろにある', async () => {
    await home([]);

    const box = await page.locator('.home-bg').evaluate((n) => {
      const r = n.getBoundingClientRect();
      const s = getComputedStyle(n);
      return {
        w: r.width,
        h: r.height,
        position: s.position,
        zIndex: s.zIndex,
        pointerEvents: s.pointerEvents,
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });

    assert.equal(box.position, 'fixed');
    assert.equal(box.w, box.vw, '横幅が画面いっぱいでない');
    assert.equal(box.h, box.vh, '高さが画面いっぱいでない');
    assert.ok(Number(box.zIndex) < 0, '内容より前に出ている');
    assert.equal(box.pointerEvents, 'none', '操作を邪魔する');
  });

  it('3. 薄い膜を重ねて読みやすくしている', async () => {
    await home([]);

    // 画像の手前に同系色のグラデーションを重ねている
    assert.match(await backgroundImage(), /linear-gradient/, '膜が重なっていない');

    // 見出しと案内が読める状態で表示されている
    assert.equal(await page.locator('.title').innerText(), 'ペット日記');
    assert.match(await page.locator('.empty').innerText(), /まだ登録がありません/);
  });

  it('4. 0匹・1匹・2匹以上のどれでも背景が出て、横スクロールしない', async () => {
    for (const cats of [[], [pet('a', 'もも')], [pet('a', 'もも'), pet('b', 'そら')]]) {
      await home(cats);

      assert.equal(await page.locator('.home-bg').count(), 1, `${cats.length}匹で背景がない`);
      assert.equal(await overflow(), 0, `${cats.length}匹で横にはみ出している`);
      assert.equal(await page.locator('.cat-card').count(), cats.length);
    }
  });

  it('5. 追加ボタンとカードは背景の上で押せる', async () => {
    await home([pet('a', 'もも')]);

    // カードを押してペット画面へ入れる
    await page.locator('.cat-card').click();
    await page.waitForSelector('.cat-header');
    assert.equal(await page.locator('.title').innerText(), 'もも');

    await page.getByRole('button', { name: '← ホーム' }).click();
    await page.waitForSelector('.cat-card');

    // 追加フォームも開ける
    await page.getByRole('button', { name: '＋ ペットを追加' }).click();
    assert.equal(await page.locator('.input').count(), 1);
  });

  it('6. ホーム以外の画面には背景を出さない', async () => {
    await home([pet('a', 'もも')]);
    assert.equal(await page.locator('.home-bg').count(), 1);

    await openCat(page, /もも/);
    await page.waitForSelector('.cat-header');
    assert.equal(await page.locator('.home-bg').count(), 0, 'ペット画面にも背景が出ている');

    await page.getByRole('button', { name: '今日の思い出を残す' }).click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });
    assert.equal(await page.locator('.home-bg').count(), 0, '記録画面にも背景が出ている');
  });

  it('7. 320px / 1180px でも画面いっぱいのまま', async () => {
    for (const size of [
      { width: 320, height: 800 },
      { width: 1180, height: 820 },
    ]) {
      await page.setViewportSize(size);
      await home([pet('a', 'もも')]);

      const fits = await page.locator('.home-bg').evaluate((n) => {
        const r = n.getBoundingClientRect();
        return r.width === window.innerWidth && r.height === window.innerHeight;
      });
      assert.equal(fits, true, `${size.width}px で画面を覆えていない`);
      assert.equal(await overflow(), 0, `${size.width}px で横にはみ出している`);
    }

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('8. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
