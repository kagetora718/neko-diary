// 月間カレンダー表示の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, startApp } from './helpers.mjs';

const PORT = 3115;

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
const THIS_YEAR = now.getFullYear();
const THIS_MONTH = now.getMonth(); // 0始まり
const pad = (n) => String(n).padStart(2, '0');
const dateString = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// 1x1 の赤いPNG（写真つき記録の判定用）。
const TINY_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// 記録を localStorage に直接置いてから開く。
async function seed(entries, cats) {
  await reset(page, app.base);
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem('neko-diary-v1', JSON.stringify(payload));
    },
    {
      cats: cats || [
        { id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' },
        { id: 'cat-atom', name: 'アトム', photo: 'data:image/svg+xml;utf8,<svg/>' },
      ],
      entries,
    },
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function openCalendar(name) {
  await openCat(page, name);
  await page.getByRole('button', { name: 'カレンダー' }).click();
  await page.waitForSelector('.calendar-grid');
}

const title = () => page.locator('.calendar-title').innerText();
const dayCells = () => page.locator('.calendar-cell:not(.is-blank)').count();
const blanks = () => page.locator('.calendar-cell.is-blank').count();
const marked = () => page.locator('.calendar-cell.has-entry').count();

describe('月間カレンダー', () => {
  it('1. 一覧とカレンダーを切り替えられる', async () => {
    await seed([]);
    await openCat(page);

    // 初期表示は一覧
    assert.equal(await page.locator('.calendar-grid').count(), 0);
    assert.equal(await page.locator('.section-label').count(), 1);

    await page.getByRole('button', { name: 'カレンダー' }).click();
    assert.equal(await page.locator('.calendar-grid').count(), 1);
    assert.equal(await page.locator('.section-label').count(), 0, '一覧が残っている');

    await page.getByRole('button', { name: '一覧' }).click();
    assert.equal(await page.locator('.calendar-grid').count(), 0);
    assert.equal(await page.locator('.section-label').count(), 1);
  });

  it('2. 現在の年月が表示される', async () => {
    await seed([]);
    await openCalendar();
    assert.equal(await title(), `${THIS_YEAR}年${THIS_MONTH + 1}月`);
  });

  it('3. 前の月へ移動できる', async () => {
    await seed([]);
    await openCalendar();

    await page.getByRole('button', { name: '前の月' }).click();
    const prev = new Date(THIS_YEAR, THIS_MONTH - 1, 1);
    assert.equal(await title(), `${prev.getFullYear()}年${prev.getMonth() + 1}月`);
  });

  it('4. 次の月へ移動できる', async () => {
    await seed([]);
    await openCalendar();

    await page.getByRole('button', { name: '次の月' }).click();
    const next = new Date(THIS_YEAR, THIS_MONTH + 1, 1);
    assert.equal(await title(), `${next.getFullYear()}年${next.getMonth() + 1}月`);
  });

  it('5. 月初の曜日位置と月末の日数が正しい（2024年2月＝うるう年）', async () => {
    await seed([]);
    await openCalendar();

    // 2024年2月まで戻す
    const back = (THIS_YEAR - 2024) * 12 + (THIS_MONTH - 1);
    for (let i = 0; i < back; i++) await page.getByRole('button', { name: '前の月' }).click();

    assert.equal(await title(), '2024年2月');
    assert.equal(await dayCells(), 29, 'うるう年の2月が29日になっていない');
    assert.equal(await blanks(), 4, '2024年2月1日は木曜なので空白は4つ');
    assert.equal(await page.locator('.calendar-weekday').count(), 7);
  });

  it('6. 月末の日数が月ごとに正しい（2024年4月＝30日）', async () => {
    await seed([]);
    await openCalendar();

    const back = (THIS_YEAR - 2024) * 12 + (THIS_MONTH - 3);
    for (let i = 0; i < back; i++) await page.getByRole('button', { name: '前の月' }).click();

    assert.equal(await title(), '2024年4月');
    assert.equal(await dayCells(), 30);
    assert.equal(await blanks(), 1, '2024年4月1日は月曜なので空白は1つ');
  });

  it('7. 記録がある日に写真サムネイルが出る', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 5);
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: day, photos: [TINY_PHOTO], text: '写真つき' },
    ]);
    await openCalendar();

    assert.equal(await marked(), 1);
    assert.equal(await page.locator('.calendar-thumb').count(), 1, 'サムネイルが出ていない');
    assert.equal(await page.locator('.calendar-dot').count(), 0);
  });

  it('8. 写真のない記録でも「記録あり」と分かる', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 6);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [], text: '文章だけ' }]);
    await openCalendar();

    assert.equal(await marked(), 1);
    assert.equal(await page.locator('.calendar-thumb').count(), 0);
    assert.equal(await page.locator('.calendar-dot').count(), 1, '記録ありの印が出ていない');
  });

  it('9. 選択中のペットの記録だけが出る（別のペットの同じ日は出ない）', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 7);
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: day, photos: [TINY_PHOTO], text: 'ラヴィ' },
      { id: 'e2', catId: 'cat-atom', date: day, photos: [], text: 'アトム' },
    ]);

    await openCalendar();
    assert.equal(await marked(), 1, 'ラヴィの月に他のペットの記録が出ている');
    assert.equal(await page.locator('.calendar-thumb').count(), 1);

    await page.getByRole('button', { name: '← ホーム' }).click();
    await openCalendar(/アトム/);
    assert.equal(await marked(), 1);
    assert.equal(await page.locator('.calendar-dot').count(), 1, 'アトム側の記録が違う');
  });

  it('10. 別の月の記録は表示されない', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 8);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [], text: '今月' }]);
    await openCalendar();
    assert.equal(await marked(), 1);

    await page.getByRole('button', { name: '次の月' }).click();
    assert.equal(await marked(), 0, '翌月に今月の記録が出ている');
  });

  it('11. 記録がある日をタップすると既存の編集画面が開く', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 9);
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: day, photos: [TINY_PHOTO], text: 'この日の記録' },
    ]);
    await openCalendar();

    await page.locator('.calendar-cell.has-entry').click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });

    assert.equal(await page.locator('.title').innerText(), '記録を編集');
    assert.equal(await page.locator('.textarea').inputValue(), 'この日の記録');
    assert.equal(await page.locator('input[type=date]').inputValue(), day);
  });

  it('12. 記録がない日はボタンにならない（新規作成は行わない）', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 10);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [], text: 'ある日' }]);
    await openCalendar();

    const buttons = await page.locator('.calendar-cell').evaluateAll((cells) =>
      cells.filter((c) => c.tagName === 'BUTTON').length,
    );
    assert.equal(buttons, 1, '記録のない日まで押せるようになっている');
  });

  it('13. 320px幅で横にはみ出さない', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 11);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [TINY_PHOTO], text: '' }]);
    await page.setViewportSize({ width: 320, height: 800 });
    await openCalendar();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, `横に ${overflow}px はみ出している`);
  });

  it('14. 390px幅で横にはみ出さない', async () => {
    const day = dateString(THIS_YEAR, THIS_MONTH, 12);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [TINY_PHOTO], text: '' }]);
    await page.setViewportSize({ width: 390, height: 844 });
    await openCalendar();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, `横に ${overflow}px はみ出している`);

    // 7列が保たれていること
    const columns = await page.evaluate(
      () => getComputedStyle(document.querySelector('.calendar-grid')).gridTemplateColumns.split(' ').length,
    );
    assert.equal(columns, 7);

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('15. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
