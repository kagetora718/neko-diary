// 「大切な日」チェックの自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, startApp } from './helpers.mjs';

const PORT = 3116;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const dateString = (d) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(d)}`;

const TINY_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 記録を localStorage に直接置いてから開く。
async function seed(entries) {
  await reset(page, app.base);
  await page.evaluate((payload) => {
    window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload));
  }, {
    cats: [
      { id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' },
      { id: 'cat-atom', name: 'アトム', photo: 'data:image/svg+xml;utf8,<svg/>' },
    ],
    entries,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openCat(page);
  await page.waitForSelector('.entry');
}

const stars = () => page.locator('.entry-star').allInnerTexts();
const storedEntries = () =>
  page.evaluate(
    () => JSON.parse(window.localStorage.getItem('neko-diary-v1') || '{}').entries || [],
  );

async function openCalendar() {
  await page.getByRole('button', { name: 'カレンダー' }).click();
  await page.waitForSelector('.calendar-grid');
}

describe('大切な日', () => {
  it('1. 既定では未チェック（☆）で表示される', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(3), photos: [], text: 'ふつうの日' }]);
    assert.deepEqual(await stars(), ['☆']);
  });

  it('2. important を持たない既存データも☆として扱う', async () => {
    // important フィールドがない古い形式
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(4), photos: [], text: '昔の記録' }]);

    const [entry] = await storedEntries();
    assert.equal('important' in entry, false, '前提：保存データに important がないこと');
    assert.deepEqual(await stars(), ['☆']);
  });

  it('3. タップすると★になる', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(5), photos: [], text: '大切な日' }]);
    await page.locator('.entry-star').click();

    assert.deepEqual(await stars(), ['★']);
  });

  it('4. もう一度タップすると☆に戻る', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(6), photos: [], text: '' }]);
    await page.locator('.entry-star').click();
    assert.deepEqual(await stars(), ['★']);

    await page.locator('.entry-star').click();
    assert.deepEqual(await stars(), ['☆']);
  });

  it('5. 切り替えると localStorage にも保存される', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(7), photos: [], text: '' }]);
    await page.locator('.entry-star').click();

    let [entry] = await storedEntries();
    assert.equal(entry.important, true, '★にしたのに保存されていない');

    await page.locator('.entry-star').click();
    [entry] = await storedEntries();
    assert.equal(entry.important, false, '☆に戻したのに保存されていない');
  });

  it('6. 再読み込みしても★のまま残る', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(8), photos: [], text: '' }]);
    await page.locator('.entry-star').click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCat(page);
    await page.waitForSelector('.entry');
    assert.deepEqual(await stars(), ['★']);
  });

  it('7. 押した記録だけが★になる', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(9), photos: [], text: '一件目' },
      { id: 'e2', catId: 'cat-ravi', date: dateString(10), photos: [], text: '二件目' },
    ]);
    await page.locator('.entry-star').nth(1).click();

    assert.deepEqual(await stars(), ['☆', '★']);

    const saved = await storedEntries();
    assert.equal(saved.find((e) => e.id === 'e1').important, undefined);
    assert.equal(saved.find((e) => e.id === 'e2').important, true);
  });

  it('8. 「編集」ボタンと干渉しない（★を押しても編集画面へ行かない）', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(11), photos: [], text: '' }]);
    await page.locator('.entry-star').click();

    assert.equal(await page.locator('.entry').count(), 1, '編集画面へ遷移している');
    assert.equal(await page.locator('.textarea').count(), 0);

    // 「編集」はこれまでどおり編集画面を開く
    await page.locator('.entry-edit').click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });
    assert.equal(await page.locator('.title').innerText(), '記録を編集');
  });

  it('9. ★の押せる範囲が44px以上ある', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(12), photos: [], text: '' }]);
    const box = await page.locator('.entry-star').boundingBox();

    assert.ok(box.width >= 44, `幅が足りない (${box.width}px)`);
    assert.ok(box.height >= 44, `高さが足りない (${box.height}px)`);
  });

  it('10. カレンダーでも大切な日に★が出る（写真あり）', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(13), photos: [TINY_PHOTO], text: '' },
    ]);
    await page.locator('.entry-star').click();
    await openCalendar();

    assert.equal(await page.locator('.calendar-star').count(), 1);
    assert.equal(await page.locator('.calendar-thumb').count(), 1, 'サムネイルが消えている');
  });

  it('11. 写真なしの大切な日は★と点の両方が出る', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(14), photos: [], text: '' }]);
    await page.locator('.entry-star').click();
    await openCalendar();

    assert.equal(await page.locator('.calendar-star').count(), 1);
    assert.equal(await page.locator('.calendar-dot').count(), 1, '記録ありの点が消えている');
  });

  it('12. 大切な日でなければカレンダーに★は出ない', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(15), photos: [TINY_PHOTO], text: '' },
    ]);
    await openCalendar();

    assert.equal(await page.locator('.calendar-star').count(), 0);
    assert.equal(await page.locator('.calendar-thumb').count(), 1);
  });

  it('13. カレンダーの★は表示だけで、押すと従来どおり編集画面が開く', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(16), photos: [], text: 'この日' }]);
    await page.locator('.entry-star').click();
    await openCalendar();

    await page.locator('.calendar-cell.has-entry').click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });
    assert.equal(await page.locator('.title').innerText(), '記録を編集');

    // 編集画面には大切な日のUIを足していない
    assert.equal(await page.locator('.entry-star').count(), 0);
  });

  it('14. 別の猫の大切な日はこちらのカレンダーに出ない', async () => {
    await seed([
      { id: 'e1', catId: 'cat-atom', date: dateString(17), photos: [], text: 'アトム', important: true },
      { id: 'e2', catId: 'cat-ravi', date: dateString(18), photos: [], text: 'ラヴィ' },
    ]);
    await openCalendar();

    assert.equal(await page.locator('.calendar-star').count(), 0, '他の猫の★が出ている');
    assert.equal(await page.locator('.calendar-cell.has-entry').count(), 1);
  });

  it('15. ★をつけてもカレンダーの7列が崩れない（320px幅）', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(19), photos: [TINY_PHOTO], text: '' },
    ]);
    await page.locator('.entry-star').click();
    await page.setViewportSize({ width: 320, height: 800 });
    await openCalendar();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, `横に ${overflow}px はみ出している`);

    const columns = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.calendar-grid')).gridTemplateColumns.split(' ')
          .length,
    );
    assert.equal(columns, 7);

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('16. 保存できないときは★を切り替えたことにしない', async () => {
    await seed([{ id: 'e1', catId: 'cat-ravi', date: dateString(20), photos: [], text: '' }]);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'neko-diary-v1') {
          throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
        }
        return original.call(this, key, value);
      };
    });

    const before = await storedEntries();
    await page.locator('.entry-star').click();

    assert.deepEqual(await stars(), ['☆'], '保存できていないのに★になっている');
    assert.deepEqual(await storedEntries(), before, '保存内容が変わっている');
  });

  it('17. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
