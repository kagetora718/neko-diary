// カレンダーの年月選択の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { openCat, reset, startApp } from './helpers.mjs';

const PORT = 3117;

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

// 過去へ飛ぶ先。現在年より前で、選択できる範囲（現在年-20年）に入る年。
const PAST_YEAR = THIS_YEAR - 6;
const PAST_MONTH = 2; // 3月

const TINY_PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const pad = (n) => String(n).padStart(2, '0');
const dateString = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

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
}

async function openCalendar(name) {
  await openCat(page, name);
  await page.getByRole('button', { name: 'カレンダー' }).click();
  await page.waitForSelector('.calendar-grid');
}

const title = () => page.locator('.calendar-title').innerText();
const yearSelect = () => page.locator('.calendar-select').first();
const monthSelect = () => page.locator('.calendar-select').nth(1);

async function openPicker() {
  await page.locator('.calendar-title').click();
  await page.waitForSelector('.calendar-picker');
}

// 年月を選んで「移動」まで行う。
async function jumpTo(year, month) {
  await openPicker();
  await yearSelect().selectOption(String(year));
  await monthSelect().selectOption(String(month));
  await page.getByRole('button', { name: '移動' }).click();
}

describe('カレンダーの年月選択', () => {
  it('1. 年月表示が押せるようになっている', async () => {
    await seed([]);
    await openCalendar();

    const tag = await page.locator('.calendar-title').evaluate((n) => n.tagName);
    assert.equal(tag, 'BUTTON');
    assert.equal(await title(), `${THIS_YEAR}年${THIS_MONTH + 1}月`);
  });

  it('2. 押すと年月選択が開く', async () => {
    await seed([]);
    await openCalendar();
    assert.equal(await page.locator('.calendar-picker').count(), 0, '最初から開いている');

    await openPicker();
    assert.equal(await page.locator('.calendar-select').count(), 2, '年と月の選択が出ていない');
    assert.equal(await page.getByRole('button', { name: '移動' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'キャンセル' }).count(), 1);
  });

  it('3. 表示中の年が初期選択されている', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    assert.equal(await yearSelect().inputValue(), String(THIS_YEAR));
  });

  it('4. 表示中の月が初期選択されている', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    assert.equal(await monthSelect().inputValue(), String(THIS_MONTH));
  });

  it('5. 前月へ移動したあとに開くと、その年月が初期値になる', async () => {
    await seed([]);
    await openCalendar();
    await page.getByRole('button', { name: '前の月' }).click();
    await openPicker();

    const prev = new Date(THIS_YEAR, THIS_MONTH - 1, 1);
    assert.equal(await yearSelect().inputValue(), String(prev.getFullYear()));
    assert.equal(await monthSelect().inputValue(), String(prev.getMonth()));
  });

  it('6. 別の年・別の月を選べる', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    await yearSelect().selectOption(String(PAST_YEAR));
    await monthSelect().selectOption(String(PAST_MONTH));

    assert.equal(await yearSelect().inputValue(), String(PAST_YEAR));
    assert.equal(await monthSelect().inputValue(), String(PAST_MONTH));

    // 「移動」を押すまでは表示は変わらない
    assert.equal(await title(), `${THIS_YEAR}年${THIS_MONTH + 1}月`);
  });

  it('7. 移動を押すとその年月へ飛び、選択UIは閉じる', async () => {
    await seed([]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    assert.equal(await title(), `${PAST_YEAR}年${PAST_MONTH + 1}月`);
    assert.equal(await page.locator('.calendar-picker').count(), 0, '選択UIが閉じていない');
  });

  it('8. キャンセルすると元の年月のまま', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    await yearSelect().selectOption(String(PAST_YEAR));
    await monthSelect().selectOption(String(PAST_MONTH));
    await page.getByRole('button', { name: 'キャンセル' }).click();

    assert.equal(await page.locator('.calendar-picker').count(), 0);
    assert.equal(await title(), `${THIS_YEAR}年${THIS_MONTH + 1}月`, '移動してしまっている');
  });

  it('9. 選べる年は現在年までで、未来年は出ない', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    const years = await yearSelect()
      .locator('option')
      .evaluateAll((options) => options.map((o) => Number(o.value)));

    assert.equal(Math.max(...years), THIS_YEAR, '未来年が選べる');
    assert.equal(Math.min(...years), THIS_YEAR - 20);
    assert.equal(years.length, 21);
  });

  it('10. 月は1月から12月まで選べる', async () => {
    await seed([]);
    await openCalendar();
    await openPicker();

    const months = await monthSelect()
      .locator('option')
      .evaluateAll((options) => options.map((o) => o.innerText));

    assert.equal(months.length, 12);
    assert.equal(months[0], '1月');
    assert.equal(months[11], '12月');
  });

  it('11. 移動先の写真サムネイルと記録の点が正しく出る', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(PAST_YEAR, PAST_MONTH, 4), photos: [TINY_PHOTO], text: '写真あり' },
      { id: 'e2', catId: 'cat-ravi', date: dateString(PAST_YEAR, PAST_MONTH, 9), photos: [], text: '写真なし' },
    ]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    assert.equal(await page.locator('.calendar-cell.has-entry').count(), 2);
    assert.equal(await page.locator('.calendar-thumb').count(), 1);
    assert.equal(await page.locator('.calendar-dot').count(), 1);
  });

  it('12. 移動先の大切な日に★が出る', async () => {
    await seed([
      { id: 'e1', catId: 'cat-ravi', date: dateString(PAST_YEAR, PAST_MONTH, 5), photos: [], text: '大切', important: true },
      { id: 'e2', catId: 'cat-ravi', date: dateString(PAST_YEAR, PAST_MONTH, 6), photos: [], text: 'ふつう' },
    ]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    assert.equal(await page.locator('.calendar-star').count(), 1);
  });

  it('13. 移動先で日付を押すと既存の記録が編集画面で開く', async () => {
    const day = dateString(PAST_YEAR, PAST_MONTH, 7);
    await seed([{ id: 'e1', catId: 'cat-ravi', date: day, photos: [], text: '昔のできごと' }]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    await page.locator('.calendar-cell.has-entry').click();
    await page.waitForSelector('input[type=file]', { state: 'attached' });

    assert.equal(await page.locator('.title').innerText(), '記録を編集');
    assert.equal(await page.locator('.textarea').inputValue(), '昔のできごと');
    assert.equal(await page.locator('input[type=date]').inputValue(), day);
  });

  it('14. 移動先でも別の猫の記録は混ざらない', async () => {
    await seed([
      { id: 'e1', catId: 'cat-atom', date: dateString(PAST_YEAR, PAST_MONTH, 8), photos: [TINY_PHOTO], text: 'アトム' },
      { id: 'e2', catId: 'cat-ravi', date: dateString(PAST_YEAR, PAST_MONTH, 10), photos: [], text: 'ラヴィ' },
    ]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    assert.equal(await page.locator('.calendar-cell.has-entry').count(), 1, '他の猫の記録が出ている');
    assert.equal(await page.locator('.calendar-thumb').count(), 0);
    assert.equal(await page.locator('.calendar-dot').count(), 1);
  });

  it('15. 移動したあとも前月・翌月ボタンが従来どおり動く', async () => {
    await seed([]);
    await openCalendar();
    await jumpTo(PAST_YEAR, PAST_MONTH);

    await page.getByRole('button', { name: '次の月' }).click();
    assert.equal(await title(), `${PAST_YEAR}年${PAST_MONTH + 2}月`);

    await page.getByRole('button', { name: '前の月' }).click();
    assert.equal(await title(), `${PAST_YEAR}年${PAST_MONTH + 1}月`);
  });

  it('16. 年をまたぐ移動でも前月・翌月が正しい（1月の前は前年12月）', async () => {
    await seed([]);
    await openCalendar();
    await jumpTo(PAST_YEAR, 0); // 1月

    await page.getByRole('button', { name: '前の月' }).click();
    assert.equal(await title(), `${PAST_YEAR - 1}年12月`);
  });

  it('17. 320px幅で年月選択が横にはみ出さない', async () => {
    await seed([]);
    await page.setViewportSize({ width: 320, height: 800 });
    await openCalendar();
    await openPicker();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, `横に ${overflow}px はみ出している`);

    const columns = await page.evaluate(
      () =>
        getComputedStyle(document.querySelector('.calendar-grid')).gridTemplateColumns.split(' ')
          .length,
    );
    assert.equal(columns, 7, 'カレンダーの7列が崩れている');
  });

  it('18. 390px幅で年月選択が横にはみ出さず、押せる大きさがある', async () => {
    await seed([]);
    await page.setViewportSize({ width: 390, height: 844 });
    await openCalendar();
    await openPicker();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.equal(overflow, 0, `横に ${overflow}px はみ出している`);

    for (const target of ['.calendar-title', '.calendar-select', '.calendar-go']) {
      const box = await page.locator(target).first().boundingBox();
      assert.ok(box.height >= 36, `${target} が押しづらい (${box.height}px)`);
    }

    await page.setViewportSize({ width: 820, height: 1180 });
  });

  it('19. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
