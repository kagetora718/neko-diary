// 保存済み日記の編集・削除の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  openCat,
  openNewEntry,
  previewCount,
  previewSrcs,
  reset,
  selectPhoto,
  startApp,
} from './helpers.mjs';

const PORT = 3112;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

const pick = (i) => selectPhoto(page, i);

// 写真 photoCount 枚と本文を持つ記録を1件保存し、日記一覧に戻る。
async function saveEntry({ photoCount = 2, text = 'はじめの本文' } = {}) {
  await openNewEntry(page, app.base);
  for (let i = 0; i < photoCount; i++) await pick(i);
  if (text) await page.locator('.textarea').fill(text);
  await page.getByRole('button', { name: '保存する' }).click();
  await page.waitForSelector('.entry');
}

async function openEditor() {
  await page.locator('.entry-edit').first().click();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
}

describe('保存済み日記：編集と削除', () => {
  it('1. 保存済み日記から編集画面を開ける', async () => {
    await saveEntry();
    await openEditor();

    assert.equal(await page.locator('.title').innerText(), '記録を編集');
    assert.equal(await previewCount(page), 2, '保存済みの写真が引き継がれていない');
    assert.equal(await page.locator('.textarea').inputValue(), 'はじめの本文');
  });

  it('2. 日記本文を修正できる', async () => {
    await saveEntry();
    await openEditor();

    await page.locator('.textarea').fill('あとから直した本文');
    await page.getByRole('button', { name: '保存する' }).click();

    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-text').innerText(), 'あとから直した本文');
    assert.equal(await page.locator('.entry').count(), 1, '記録が増えている（新規扱いになっている）');
  });

  it('3. 日付を変更できる', async () => {
    await saveEntry();
    await openEditor();

    await page.locator('input[type=date]').fill('2024-03-09');
    await page.getByRole('button', { name: '保存する' }).click();

    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-date').innerText(), '2024年3月9日');
  });

  it('4. 保存済みの写真を1枚削除できる', async () => {
    await saveEntry({ photoCount: 3 });
    await openEditor();

    const before = await previewSrcs(page);
    await page.locator('.preview button').first().click();
    assert.equal(await previewCount(page), 2);

    await page.getByRole('button', { name: '保存する' }).click();
    await page.waitForSelector('.entry');

    const after = await page.locator('.entry-photos img').evaluateAll((n) => n.map((x) => x.src));
    assert.equal(after.length, 2);
    assert.equal(after.includes(before[0]), false, '削除した写真が残っている');
  });

  it('5. 編集画面で新しい写真を追加できる', async () => {
    await saveEntry({ photoCount: 2 });
    await openEditor();

    await pick(3);
    assert.equal(await previewCount(page), 3);

    await page.getByRole('button', { name: '保存する' }).click();
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-photos img').count(), 3);
  });

  it('6. 編集画面でも合計5枚を超えない', async () => {
    await saveEntry({ photoCount: 3 });
    await openEditor();

    await pick(3);
    await pick(4);
    assert.equal(await previewCount(page), 5);

    const disabled = await page.getByRole('button', { name: '写真を追加' }).isDisabled();
    assert.equal(disabled, true, '5枚に達したら「写真を追加」は押せないこと');

    await pick(5);
    assert.equal(await previewCount(page), 5, '上限を超えて追加されている');
  });

  it('7. 削除は確認してから実行される（キャンセルすると消えない）', async () => {
    await saveEntry();
    await openEditor();

    await page.getByRole('button', { name: 'この記録を削除' }).click();
    assert.equal(await page.locator('.confirm-text').innerText(), 'この記録を削除しますか？');

    await page.getByRole('button', { name: 'キャンセル' }).click();
    assert.equal(await page.locator('.confirm').count(), 0, '確認が閉じていない');

    await page.getByRole('button', { name: '保存する' }).click();
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry').count(), 1, 'キャンセルしたのに削除されている');
  });

  it('8. 確認したうえで記録全体を削除できる', async () => {
    await saveEntry();
    await openEditor();

    await page.getByRole('button', { name: 'この記録を削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();

    // その猫の日記一覧に戻り、記録が消えている
    await page.waitForSelector('.empty');
    assert.equal(await page.locator('.entry').count(), 0);
    assert.match(await page.locator('.empty').innerText(), /まだ記録がありません/);
  });

  it('9. 削除した記録は再読み込み後も戻らない', async () => {
    await saveEntry();
    await openEditor();
    await page.getByRole('button', { name: 'この記録を削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.empty');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCat(page);
    assert.equal(await page.locator('.entry').count(), 0);
  });

  it('10. 以前の形式で保存された既存データを読み込める', async () => {
    // 旧データを直接書き込んで、移行処理なしで開けることを確認する。
    await reset(page, app.base);
    await page.evaluate(() => {
      window.localStorage.setItem(
        'neko-diary-v1',
        JSON.stringify({
          cats: [{ id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' }],
          entries: [
            { id: 'entry-old', catId: 'cat-ravi', date: '2023-05-04', photos: [], text: '昔の記録' },
          ],
        }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCat(page);

    assert.equal(await page.locator('.entry').count(), 1);
    assert.equal(await page.locator('.entry-date').innerText(), '2023年5月4日');
    assert.equal(await page.locator('.entry-text').innerText(), '昔の記録');

    // 既存データもそのまま編集できる
    await openEditor();
    assert.equal(await page.locator('.textarea').inputValue(), '昔の記録');
    await pick(0);
    await page.getByRole('button', { name: '保存する' }).click();
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-photos img').count(), 1);
  });

  it('11. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
