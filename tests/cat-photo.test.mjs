// 猫の代表写真の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHOTOS, openCat, reset, startApp } from './helpers.mjs';

const PORT = 3114;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

// 画面にひとつだけある file input へ写真を1枚渡す。
async function choosePhoto(index) {
  await page.evaluate((data) => {
    const input = document.querySelector('input[type=file]');
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bin], `cat-${Date.now()}.png`, { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, PHOTOS[index]);
  await page.waitForTimeout(400);
}

// ホームの猫カードの写真の src を名前で引く。
// localStorage は描画後に読み込まれるので、カードが出るまで待つ。
async function cardPhoto(name) {
  await page.waitForSelector('.cat-card');
  return page.evaluate((catName) => {
    const card = [...document.querySelectorAll('.cat-card')].find((c) =>
      c.innerText.includes(catName),
    );
    return card ? card.querySelector('img').src : null;
  }, name);
}

const storedCats = () =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('neko-diary-v1') || '{}').cats || []);

describe('猫の代表写真', () => {
  it('1. 名前だけで新しい猫を追加できる', async () => {
    await reset(page, app.base);
    await page.getByRole('button', { name: '＋ 猫を追加' }).click();
    await page.locator('.input').fill('みかん');
    await page.getByRole('button', { name: '追加する' }).click();

    assert.equal(await page.locator('.cat-card').count(), 4);
    assert.match(await cardPhoto('みかん'), /^data:image\/svg\+xml/, 'プレースホルダーでないこと');
  });

  it('2. 新しい猫に代表写真を設定でき、ホームカードに出る', async () => {
    await reset(page, app.base);
    await page.getByRole('button', { name: '＋ 猫を追加' }).click();
    await page.locator('.input').fill('そら');
    await choosePhoto(0);

    // 追加前にプレビューが出る
    assert.equal(await page.locator('.cat-photo-preview img').count(), 1);

    await page.getByRole('button', { name: '追加する' }).click();

    const src = await cardPhoto('そら');
    assert.match(src, /^data:image\/jpeg/, '選んだ写真がカードに出ていない');
  });

  it('3. 写真を選ばなかった猫はプレースホルダーのまま', async () => {
    await reset(page, app.base);
    await page.getByRole('button', { name: '＋ 猫を追加' }).click();
    await page.locator('.input').fill('しろ');
    await page.getByRole('button', { name: '追加する' }).click();

    assert.match(await cardPhoto('しろ'), /^data:image\/svg\+xml/);
  });

  it('4. 既存の猫の代表写真を後から変更できる', async () => {
    await reset(page, app.base);
    const before = await cardPhoto('ラヴィ');

    await openCat(page);
    await page.getByRole('button', { name: '写真を変更' }).click();
    await choosePhoto(1);

    // 猫の日記画面のヘッダーが差し替わる
    const header = await page.locator('.cat-header img').getAttribute('src');
    assert.match(header, /^data:image\/jpeg/);
    assert.notEqual(header, before);

    await page.getByRole('button', { name: '← ホーム' }).click();
    assert.equal(await cardPhoto('ラヴィ'), header, 'ホームカードに反映されていない');
  });

  it('5. 変更した写真は再読み込みしても残る', async () => {
    await reset(page, app.base);
    await openCat(page);
    await page.getByRole('button', { name: '写真を変更' }).click();
    await choosePhoto(2);
    const header = await page.locator('.cat-header img').getAttribute('src');

    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await cardPhoto('ラヴィ'), header);

    const cats = await storedCats();
    assert.equal(cats.length, 3, '猫の件数が変わっている');
    assert.match(cats.find((c) => c.name === 'ラヴィ').photo, /^data:image\/jpeg/);
  });

  it('6. 代表写真は縮小して保存される', async () => {
    await reset(page, app.base);
    await openCat(page);
    await page.getByRole('button', { name: '写真を変更' }).click();
    await choosePhoto(0);

    const size = await page.evaluate(() => {
      const cats = JSON.parse(window.localStorage.getItem('neko-diary-v1')).cats;
      return cats.find((c) => c.name === 'ラヴィ').photo.length;
    });
    assert.ok(size < 200000, `代表写真が縮小されていない (${size} bytes)`);
  });

  it('7. 写真のない既存データもそのまま表示できる', async () => {
    await reset(page, app.base);
    await page.evaluate(() => {
      window.localStorage.setItem(
        'neko-diary-v1',
        JSON.stringify({
          cats: [{ id: 'cat-old', name: 'むぎ', photo: 'data:image/svg+xml;utf8,<svg/>' }],
          entries: [],
        }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    assert.match(await cardPhoto('むぎ'), /^data:image\/svg\+xml/);
    assert.equal(await page.locator('.cat-card').count(), 1);
  });

  it('8. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
