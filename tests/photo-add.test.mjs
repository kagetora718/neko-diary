// 新規記録画面の「写真を追加」の自動テスト。
// iPad Safari で2枚目以降を追加できなかった不具合の回帰テストを含む。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHOTOS,
  openNewEntry,
  previewCount,
  previewSrcs,
  selectPhoto,
  startApp,
} from './helpers.mjs';

const PORT = 3111;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

const open = () => openNewEntry(page, app.base);
const pick = (i) => selectPhoto(page, i);

describe('新規記録：写真の追加', () => {
  it('1. 写真を1枚追加できる', async () => {
    await open();
    await pick(0);
    assert.equal(await previewCount(page), 1);
  });

  it('2. 1枚追加した後、もう1枚追加できる', async () => {
    await open();
    await pick(0);
    assert.equal(await previewCount(page), 1, '1枚目が追加されていない');
    await pick(1);
    assert.equal(await previewCount(page), 2, '2枚目を追加できていない');
  });

  it('3. 追加済みの写真を保持したまま次の写真が追加される', async () => {
    await open();
    await pick(0);
    const [first] = await previewSrcs(page);
    await pick(1);

    const srcs = await previewSrcs(page);
    assert.equal(srcs.length, 2);
    assert.equal(srcs[0], first, '1枚目が2枚目に置き換わっている');
    assert.notEqual(srcs[0], srcs[1], '2枚が同じ画像になっている');
  });

  it('4. 1枚ずつ繰り返して最大5枚まで追加できる', async () => {
    await open();
    for (let i = 0; i < 5; i++) await pick(i);

    assert.equal(await previewCount(page), 5);
    assert.equal(new Set(await previewSrcs(page)).size, 5, '5枚がすべて異なる画像であること');
  });

  it('5. 6枚目は追加されない', async () => {
    await open();
    for (let i = 0; i < 5; i++) await pick(i);
    await pick(5);

    assert.equal(await previewCount(page), 5, '上限を超えて追加されている');
    const disabled = await page.getByRole('button', { name: '写真を追加' }).isDisabled();
    assert.equal(disabled, true, '5枚に達したら「写真を追加」は押せないこと');
  });

  it('6. 追加済みの写真を個別に削除できる', async () => {
    await open();
    await pick(0);
    await pick(1);
    const [, second] = await previewSrcs(page);

    await page.locator('.preview button').first().click();
    const srcs = await previewSrcs(page);
    assert.equal(srcs.length, 1);
    assert.equal(srcs[0], second, '削除対象でない写真が消えている');
  });

  it('7. 削除した後、また追加できる', async () => {
    await open();
    for (let i = 0; i < 5; i++) await pick(i);
    await page.locator('.preview button').first().click();
    assert.equal(await previewCount(page), 4);

    await pick(5);
    assert.equal(await previewCount(page), 5, '削除後に追加できていない');
  });

  it('8. 保存すると最大5枚が日記一覧に表示される', async () => {
    await open();
    for (let i = 0; i < 5; i++) await pick(i);
    await page.getByRole('button', { name: '保存する' }).click();

    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-photos img').count(), 5);
  });

  it('9. change の直後に input.value が同期的に空になる（iPad Safari 回帰防止）', async () => {
    await open();

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
    await open();

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
    assert.equal(await previewCount(page), 3, '重なった選択で写真が失われている');
  });

  it('11. 写真欄に「最大5枚」と現在の枚数が表示される', async () => {
    await open();

    const label = await page.locator('.field-label', { hasText: '写真' }).innerText();
    assert.match(label, /最大5枚/, '「最大5枚」が見出しに書かれていること');

    // 端末によって挙動が違うので、追加のしかたは断定しない
    assert.doesNotMatch(label, /1枚ずつ/);

    const hint = () => page.locator('.hint', { hasText: '/5枚' }).innerText();
    assert.match(await hint(), /0\/5枚/);
    assert.doesNotMatch(await hint(), /1枚ずつ/);

    await pick(0);
    assert.match(await hint(), /1\/5枚/);
  });

  it('12. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
