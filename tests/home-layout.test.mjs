// ホーム画面の見た目（ペット数ごとのレイアウト）の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reset, startApp } from './helpers.mjs';

const PORT = 3119;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PLACEHOLDER = 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E';

// ペットと記録を置いてからホームを開く。
async function home(cats, entries = []) {
  await reset(page, app.base, []);
  await page.evaluate(
    (payload) => window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload)),
    { cats, entries },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.title');
}

const pet = (id, name, photo = PLACEHOLDER) => ({ id, name, photo });
const diary = (id, catId, date) => ({ id, catId, date, photos: [], text: '' });

const columns = () =>
  page.evaluate(
    () => getComputedStyle(document.querySelector('.cat-grid')).gridTemplateColumns.split(' ').length,
  );

const overflow = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );

describe('ホーム画面のレイアウト', () => {
  it('1. 0匹のときは案内と追加ボタンだけが出る', async () => {
    await home([]);

    assert.equal(await page.locator('.cat-card').count(), 0);
    assert.match(await page.locator('.empty').innerText(), /まだ登録がありません/);
    assert.equal(await page.getByRole('button', { name: '＋ ペットを追加' }).count(), 1);

    // 見出しは維持する
    assert.equal(await page.locator('.title').innerText(), 'ペット日記');
    assert.match(await page.locator('.lead').innerText(), /ペットとの大切な日常/);
  });

  it('2. 1匹のときは1列の大きなカードになる', async () => {
    await home([pet('cat-a', 'もも', PHOTO)]);

    assert.equal(await page.locator('.cat-card').count(), 1);
    assert.equal(await columns(), 1, '1匹なのに2列のままになっている');

    const grid = await page.locator('.cat-grid').getAttribute('class');
    assert.match(grid, /is-single/);
  });

  it('3. 1匹カードの写真がコンテンツ幅いっぱいで大きい', async () => {
    await home([pet('cat-a', 'もも', PHOTO)]);

    const screen = await page.locator('.screen').boundingBox();
    const image = await page.locator('.cat-card img').boundingBox();

    // 左右の余白ぶんを除いてほぼ全幅を使っている
    assert.ok(image.width > screen.width - 60, `写真が小さい (${image.width}px)`);
    assert.ok(image.height > 200, `写真の高さが足りない (${image.height}px)`);

    // 縦に伸びすぎていない（写真らしい比率）
    const ratio = image.width / image.height;
    assert.ok(ratio > 1.1 && ratio < 1.6, `比率が不自然 (${ratio.toFixed(2)})`);
  });

  it('4. 2匹以上のときは2列グリッドになる', async () => {
    await home([pet('cat-a', 'もも'), pet('cat-b', 'そら')]);

    assert.equal(await page.locator('.cat-card').count(), 2);
    assert.equal(await columns(), 2);
    assert.doesNotMatch(await page.locator('.cat-grid').getAttribute('class'), /is-single/);
  });

  it('5. 3匹・5匹でも2列で自然に並ぶ', async () => {
    for (const n of [3, 5]) {
      const cats = Array.from({ length: n }, (_, i) => pet(`cat-${i}`, `ペット${i}`));
      await home(cats);

      assert.equal(await page.locator('.cat-card').count(), n);
      assert.equal(await columns(), 2, `${n}匹で2列になっていない`);

      // 同じ行のカードは同じ大きさ
      const boxes = await page.locator('.cat-card').evaluateAll((cards) =>
        cards.map((c) => Math.round(c.getBoundingClientRect().width)),
      );
      assert.equal(new Set(boxes).size, 1, `${n}匹でカード幅がそろっていない`);
    }
  });

  it('6. 代表写真が表示され、未設定なら🐾のプレースホルダーになる', async () => {
    await home([pet('cat-a', 'もも', PHOTO), pet('cat-b', 'そら')]);

    const srcs = await page.locator('.cat-card img').evaluateAll((n) => n.map((x) => x.src));
    assert.match(srcs[0], /^data:image\/png/, '設定した写真が出ていない');
    assert.match(srcs[1], /^data:image\/svg\+xml/);
  });

  it('7. 記録件数が正しく表示される', async () => {
    await home(
      [pet('cat-a', 'もも'), pet('cat-b', 'そら')],
      [
        diary('e1', 'cat-a', '2026-08-01'),
        diary('e2', 'cat-a', '2026-08-02'),
        diary('e3', 'cat-b', '2026-08-01'),
      ],
    );

    const counts = await page.locator('.cat-card-count').allInnerTexts();
    assert.deepEqual(counts, ['2件の記録', '1件の記録']);
  });

  it('8. 記録がないペットはその旨が出る', async () => {
    await home([pet('cat-a', 'もも')]);
    assert.equal(await page.locator('.cat-card-count').innerText(), 'まだ記録がありません');
  });

  it('9. 1匹カードを押すとそのペットの画面へ入れる', async () => {
    await home([pet('cat-a', 'もも', PHOTO)]);
    await page.locator('.cat-card').click();

    await page.waitForSelector('.cat-header');
    assert.equal(await page.locator('.title').innerText(), 'もも');
    assert.equal(await page.getByRole('button', { name: '今日の思い出を残す' }).count(), 1);
  });

  it('10. 2匹以上でも、押したペットの画面へ入れる', async () => {
    await home([pet('cat-a', 'もも'), pet('cat-b', 'そら')]);
    await page.locator('.cat-card').nth(1).click();

    await page.waitForSelector('.cat-header');
    assert.equal(await page.locator('.title').innerText(), 'そら');
  });

  it('11. 「＋ ペットを追加」は従来どおり動き、目立ちすぎない', async () => {
    await home([pet('cat-a', 'もも', PHOTO)]);

    // 登録済みカードより小さいこと
    const card = await page.locator('.cat-card').boundingBox();
    const add = await page.getByRole('button', { name: '＋ ペットを追加' }).boundingBox();
    assert.ok(add.height < card.height / 2, '追加ボタンが目立ちすぎている');

    // 一覧より下にある
    assert.ok(add.y > card.y, '追加ボタンが一覧より上にある');

    // 追加できる
    await page.getByRole('button', { name: '＋ ペットを追加' }).click();
    await page.locator('.input').fill('こむぎ');
    await page.getByRole('button', { name: '追加する' }).click();

    await page.waitForSelector('.cat-card:nth-child(2)');
    assert.equal(await page.locator('.cat-card').count(), 2);
    assert.equal(await columns(), 2, '2匹になったのに1匹用のままになっている');
  });

  it('12. 320px幅で横にはみ出さない（0匹・1匹・2匹）', async () => {
    await page.setViewportSize({ width: 320, height: 800 });

    await home([]);
    assert.equal(await overflow(), 0, '0匹ではみ出している');

    await home([pet('cat-a', 'もも', PHOTO)]);
    assert.equal(await overflow(), 0, '1匹ではみ出している');

    await home([pet('cat-a', 'もも'), pet('cat-b', 'そら')]);
    assert.equal(await overflow(), 0, '2匹ではみ出している');

    // 2列でもカードが潰れすぎない
    const card = await page.locator('.cat-card').first().boundingBox();
    assert.ok(card.width > 130, `カードが窮屈 (${card.width}px)`);
  });

  it('13. 390px幅で横にはみ出さない', async () => {
    await page.setViewportSize({ width: 390, height: 844 });

    await home([pet('cat-a', 'もも', PHOTO)]);
    assert.equal(await overflow(), 0);

    await home([pet('cat-a', 'もも'), pet('cat-b', 'そら'), pet('cat-c', 'ゆき')]);
    assert.equal(await overflow(), 0);
  });

  it('14. iPad横幅でも1匹カードが巨大にならない', async () => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await home([pet('cat-a', 'もも', PHOTO)]);

    assert.equal(await overflow(), 0);

    const image = await page.locator('.cat-card img').boundingBox();
    assert.ok(image.width <= 560, `カードが広がりすぎ (${image.width}px)`);

    // 中央にまとまっていること
    const screen = await page.locator('.screen').boundingBox();
    const left = screen.x;
    const right = 1180 - (screen.x + screen.width);
    assert.ok(Math.abs(left - right) < 2, '中央に寄っていない');

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('15. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
