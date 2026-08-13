// 「1匹の猫につき1日1件」の自動テスト。
// catId + date が一意であること、重複が作られないことを確認する。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, selectPhoto, startApp } from './helpers.mjs';

const PORT = 3113;
const OTHER_DAY = '2024-01-01';

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

/* ---------- 共通操作 ---------- */

// ラヴィの日記一覧を開く。
async function openDiary(name) {
  await reset(page, app.base);
  await openCat(page, name);
}

// 「今日の思い出を残す」を押して、開いた画面の種類を返す。
async function pressRecord() {
  await page.getByRole('button', { name: '今日の思い出を残す' }).click();
  await page.waitForSelector('input[type=file]', { state: 'attached' });
  return page.locator('.title').innerText();
}

async function fillAndSave({ date, text } = {}) {
  if (date) await page.locator('input[type=date]').fill(date);
  if (text) await page.locator('.textarea').fill(text);
  await page.getByRole('button', { name: '保存する' }).click();
}

const entryCount = () => page.locator('.entry').count();
const entryDates = () => page.locator('.entry-date').evaluateAll((n) => n.map((x) => x.innerText));
const notice = () => page.locator('.notice').innerText();

// localStorage に入っている記録をそのまま読む。
const storedEntries = () =>
  page.evaluate(() => JSON.parse(window.localStorage.getItem('neko-diary-v1') || '{}').entries || []);

describe('1匹1日1日記', () => {
  it('1. 今日の日記がなければ新規作成画面が開く', async () => {
    await openDiary();
    assert.equal(await pressRecord(), '今日の思い出');
  });

  it('2. 今日の日記を保存できる', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ text: '今日の記録' });

    await page.waitForSelector('.entry');
    assert.equal(await entryCount(), 1);
  });

  it('3. 同じ猫でもう一度押すと、新規ではなく既存日記の編集画面が開く', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ text: '今日の記録' });
    await page.waitForSelector('.entry');

    assert.equal(await pressRecord(), '記録を編集', '新規作成画面が開いている');
    assert.equal(await page.locator('.textarea').inputValue(), '今日の記録');
  });

  it('4. 開き直して再保存しても記録は増えない', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ text: '一度目' });
    await page.waitForSelector('.entry');

    await pressRecord();
    await fillAndSave({ text: '二度目' });
    await page.waitForSelector('.entry');

    assert.equal(await entryCount(), 1, '同じ日の記録が増えている');
    assert.equal(await page.locator('.entry-text').innerText(), '二度目');
    assert.equal((await storedEntries()).length, 1);
  });

  it('5. 別の日付なら新しい日記を作れる', async () => {
    await openDiary();

    // 今日の記録がない状態で日付を変えて保存する
    await pressRecord();
    await fillAndSave({ date: OTHER_DAY, text: '昔の記録' });
    await page.waitForSelector('.entry');

    // 今日の記録はまだないので、新規作成画面が開く
    assert.equal(await pressRecord(), '今日の思い出');
    await fillAndSave({ text: '今日の記録' });
    await page.waitForSelector('.entry');

    assert.equal(await entryCount(), 2);
    assert.equal(new Set(await entryDates()).size, 2, '同じ日付のカードが並んでいる');
  });

  it('6. 別の猫なら同じ日付の日記を作れる', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ text: 'ラヴィの今日' });
    await page.waitForSelector('.entry');

    await page.getByRole('button', { name: '← ホーム' }).click();
    await openCat(page, /アトム/);
    assert.equal(await pressRecord(), '今日の思い出', '別の猫なのに編集画面が開いている');

    await fillAndSave({ text: 'アトムの今日' });
    await page.waitForSelector('.entry');

    assert.equal(await entryCount(), 1, 'アトムの一覧に他の猫の記録が出ている');
    assert.equal((await storedEntries()).length, 2);
  });

  it('7. 新規保存で同じ猫・同じ日付の重複は作れない', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ date: OTHER_DAY, text: '先にある記録' });
    await page.waitForSelector('.entry');

    // 今日の記録はないので新規画面が開く。そこで日付を既存の日に変える。
    await pressRecord();
    await fillAndSave({ date: OTHER_DAY, text: 'あとから作る記録' });

    assert.equal(await notice(), 'この日付にはすでに記録があります。');
    assert.equal((await storedEntries()).length, 1, '重複した記録が作られている');
  });

  it('8. 日付を既存の記録と同じ日に変更した編集は拒否される', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ date: OTHER_DAY, text: '先にある記録' });
    await page.waitForSelector('.entry');

    await pressRecord();
    await fillAndSave({ text: '今日の記録' });
    await page.waitForSelector('.entry');
    assert.equal(await entryCount(), 2);

    // 今日の記録を開き、既存の日付へ移そうとする
    assert.equal(await pressRecord(), '記録を編集');
    await fillAndSave({ date: OTHER_DAY });

    assert.equal(await notice(), 'この日付にはすでに記録があります。');
    assert.equal(await page.locator('.title').innerText(), '記録を編集', '編集画面から離れている');
  });

  it('9. 拒否されたとき、保存済みのデータは変化しない', async () => {
    await openDiary();
    await pressRecord();
    await fillAndSave({ date: OTHER_DAY, text: '先にある記録' });
    await page.waitForSelector('.entry');
    await pressRecord();
    await fillAndSave({ text: '今日の記録' });
    await page.waitForSelector('.entry');

    const before = await storedEntries();

    await pressRecord();
    await fillAndSave({ date: OTHER_DAY });
    await notice();

    assert.deepEqual(await storedEntries(), before, '拒否されたのに保存内容が変わっている');

    // 読み込み直しても2件のまま
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCat(page);
    assert.equal(await entryCount(), 2);
  });

  it('10. 既存の重複データも表示でき、削除して整理できる', async () => {
    // 旧仕様で作られた同じ日付の記録を2件書き込む（自動統合はしない）。
    await reset(page, app.base);
    await page.evaluate((day) => {
      window.localStorage.setItem(
        'neko-diary-v1',
        JSON.stringify({
          cats: [{ id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' }],
          entries: [
            { id: 'entry-a', catId: 'cat-ravi', date: day, photos: [], text: '記録A' },
            { id: 'entry-b', catId: 'cat-ravi', date: day, photos: [], text: '記録B' },
          ],
        }),
      );
    }, OTHER_DAY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openCat(page);

    assert.equal(await entryCount(), 2, '既存の重複データが読めていない');

    // 片方を削除して整理できる
    await page.locator('.entry-edit').first().click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });
    await page.getByRole('button', { name: 'この記録を削除' }).click();
    await page.getByRole('button', { name: '削除する' }).click();
    await page.waitForSelector('.entry');

    assert.equal(await entryCount(), 1);
    assert.equal((await storedEntries()).length, 1);
  });

  it('11. 写真を追加した今日の記録も、開き直すと編集になる', async () => {
    await openDiary();
    await pressRecord();
    await selectPhoto(page, 0);
    await fillAndSave({ text: '写真つき' });
    await page.waitForSelector('.entry');

    assert.equal(await pressRecord(), '記録を編集');
    assert.equal(await page.locator('.preview img').count(), 1, '写真が引き継がれていない');
  });

  it('12. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
