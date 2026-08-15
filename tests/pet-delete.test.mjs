// ペットの削除の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, startApp } from './helpers.mjs';

const PORT = 3120;

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

const pet = (id, name) => ({ id, name, photo: PHOTO });
const diary = (id, catId, date, extra = {}) => ({
  id,
  catId,
  date,
  photos: [PHOTO],
  text: `${id}の記録`,
  ...extra,
});

// ラヴィ（記録2件・うち1件は大切な日）とアトム（記録1件）を用意する。
const CATS = [pet('cat-ravi', 'ラヴィ'), pet('cat-atom', 'アトム')];
const ENTRIES = [
  diary('e1', 'cat-ravi', '2026-08-01', { important: true }),
  diary('e2', 'cat-ravi', '2026-08-02'),
  diary('e3', 'cat-atom', '2026-08-01'),
];

async function open(cats = CATS, entries = ENTRIES) {
  await reset(page, app.base, []);
  await page.evaluate(
    (payload) => window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload)),
    { cats, entries },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cat-card');
}

const stored = () =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('neko-diary-v1') || '{}'));

// 以後の保存だけ失敗させる（読み込み後に呼ぶこと）。
const failSaves = () =>
  page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'neko-diary-v1') {
        throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
      }
      return original.call(this, key, value);
    };
  });

async function openConfirm(name = /ラヴィ/) {
  await openCat(page, name);
  await page.getByRole('button', { name: 'ペットを削除' }).click();
  await page.waitForSelector('.confirm');
}

describe('ペットの削除', () => {
  it('1. ペットの画面に「ペットを削除」がある', async () => {
    await open();
    await openCat(page);

    const button = page.getByRole('button', { name: 'ペットを削除' });
    assert.equal(await button.count(), 1);

    // 主ボタンと同じ見た目にしない
    const cls = await button.getAttribute('class');
    assert.doesNotMatch(cls, /btn-primary/);

    // 「今日の思い出を残す」より下にある
    const main = await page.getByRole('button', { name: '今日の思い出を残す' }).boundingBox();
    assert.ok((await button.boundingBox()).y > main.y, '通常操作より上にある');
  });

  it('2. 押すと確認が開き、日記も消えることが書かれている', async () => {
    await open();
    await openConfirm();

    assert.match(await page.locator('.confirm-text').innerText(), /ラヴィを削除しますか？/);
    assert.equal(
      await page.locator('.confirm-note').innerText(),
      'このペットの日記もすべて削除されます。',
    );
    assert.equal(await page.getByRole('button', { name: '削除する' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'キャンセル' }).count(), 1);
  });

  it('3. キャンセルすると何も削除されない', async () => {
    await open();
    const before = await stored();
    await openConfirm();

    await page.getByRole('button', { name: 'キャンセル' }).click();
    assert.equal(await page.locator('.confirm').count(), 0, '確認が閉じていない');

    // 画面もデータもそのまま
    assert.equal(await page.locator('.title').innerText(), 'ラヴィ');
    assert.deepEqual(await stored(), before);
  });

  it('4. 削除するとそのペットと日記だけが消え、他のペットは残る', async () => {
    await open();
    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.cat-card');

    const data = await stored();
    assert.deepEqual(
      data.cats.map((c) => c.id),
      ['cat-atom'],
      '対象のペットが消えていない、または他のペットまで消えている',
    );
    assert.deepEqual(
      data.entries.map((e) => e.id),
      ['e3'],
      '対象の日記が残っている、または他のペットの日記まで消えている',
    );

    // 残ったペットの日記はそのまま（写真・大切な日も含めて中身が変わらない）
    assert.deepEqual(data.entries[0], ENTRIES[2]);
  });

  it('5. 削除後はホームへ戻り、そのカードは出ない', async () => {
    await open();
    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();

    await page.waitForSelector('.cat-card');
    assert.equal(await page.locator('.title').innerText(), 'ペット日記', 'ホームへ戻っていない');

    const cards = await page.locator('.cat-card').allInnerTexts();
    assert.equal(cards.length, 1);
    assert.match(cards[0], /アトム/);
    assert.doesNotMatch(cards.join(), /ラヴィ/);
  });

  it('6. 残った他のペットの日記は開ける', async () => {
    await open();
    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.cat-card');

    await openCat(page, /アトム/);
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry').count(), 1);
    assert.equal(await page.locator('.entry-text').innerText(), 'e3の記録');
  });

  it('7. 2匹から1匹に減ると1匹用の大きなカードになる', async () => {
    await open();
    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.cat-card');

    const cls = await page.locator('.cat-grid').getAttribute('class');
    assert.match(cls, /is-single/, '1匹用のレイアウトになっていない');
  });

  it('8. 最後の1匹を削除すると空状態になる', async () => {
    await open([pet('cat-only', 'ひとりっ子')], [diary('e1', 'cat-only', '2026-08-01')]);
    await openConfirm(/ひとりっ子/);
    await page.getByRole('button', { name: '削除する' }).click();

    await page.waitForSelector('.empty');
    assert.equal(await page.locator('.cat-card').count(), 0);
    assert.match(await page.locator('.empty').innerText(), /まだ登録がありません/);

    const data = await stored();
    assert.deepEqual(data.cats, []);
    assert.deepEqual(data.entries, []);
  });

  it('9. 削除は再読み込みしても元に戻らない', async () => {
    await open();
    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.cat-card');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cat-card');

    assert.equal(await page.locator('.cat-card').count(), 1);
    assert.match(await page.locator('.cat-card').innerText(), /アトム/);
  });

  it('10. 保存できないときは削除を成功扱いにしない', async () => {
    await open();
    await page.waitForSelector('.cat-card');
    const before = await stored();
    await failSaves();

    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();

    // 画面だけ進めない
    assert.equal(await page.locator('.title').innerText(), 'ラヴィ', 'ホームへ戻ってしまっている');
    assert.equal(await page.locator('.confirm').count(), 1, '確認が閉じている');
    assert.equal(
      await page.locator('.confirm .notice').innerText(),
      '削除できませんでした。もう一度お試しください。',
    );

    // 保存内容も変わらない
    assert.deepEqual(await stored(), before, '保存できていないのにデータが変わっている');
  });

  it('11. 保存に失敗しても、戻れば元どおり使える', async () => {
    await open();
    await page.waitForSelector('.cat-card');
    await failSaves();

    await openConfirm();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.getByRole('button', { name: 'キャンセル' }).click();

    await page.getByRole('button', { name: '← ホーム' }).click();
    await page.waitForSelector('.cat-card');
    assert.equal(await page.locator('.cat-card').count(), 2, 'ペットが見えなくなっている');
  });

  it('12. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
