// 初回アクセスの状態と、ペット向けの文言の自動テスト。
//
// 実行: npm test

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reset, startApp } from './helpers.mjs';

const PORT = 3118;

let app;
let page;

before(async () => {
  app = await startApp(PORT);
  page = app.page;
});

after(async () => {
  await app?.stop();
});

// 何も保存されていない、初めて開いた状態にする。
async function firstVisit() {
  await reset(page, app.base, []);
  await page.waitForSelector('.title');
}

const stored = () => page.evaluate(() => window.localStorage.getItem('neko-diary-v1'));

describe('初回アクセスとペット向けの文言', () => {
  it('1. 初回アクセスでサンプルのペットが登録されない', async () => {
    await firstVisit();

    assert.equal(await page.locator('.cat-card').count(), 0, 'サンプルデータが登録されている');
    const body = await page.locator('body').innerText();
    for (const name of ['ラヴィ', 'アトム', 'レイエンダ']) {
      assert.doesNotMatch(body, new RegExp(name), `${name} が表示されている`);
    }
  });

  it('2. 初回アクセスでは localStorage へ勝手に書き込まない', async () => {
    await firstVisit();
    assert.equal(await stored(), null, '開いただけで保存されている');
  });

  it('3. 登録がないときは案内が出る', async () => {
    await firstVisit();

    const empty = await page.locator('.empty').innerText();
    assert.match(empty, /まだ登録がありません/);
    assert.match(empty, /ペット/);
    assert.equal(await page.getByRole('button', { name: '＋ ペットを追加' }).count(), 1);
  });

  it('4. アプリ名が「ペット日記」になっている', async () => {
    await firstVisit();

    assert.equal(await page.locator('.title').innerText(), 'ペット日記');
    assert.equal(await page.title(), 'ペット日記');
  });

  it('5. 画面に猫限定の文言が残っていない', async () => {
    await firstVisit();
    assert.doesNotMatch(await page.locator('body').innerText(), /猫|ねこ/);

    // 追加フォームの中も確認する
    await page.getByRole('button', { name: '＋ ペットを追加' }).click();
    const placeholder = await page.locator('.input').getAttribute('placeholder');
    assert.equal(placeholder, 'ペットの名前');
    assert.doesNotMatch(await page.locator('body').innerText(), /猫|ねこ/);
  });

  it('6. 写真を選ばずに追加すると足あとのプレースホルダーになる', async () => {
    await firstVisit();
    await page.getByRole('button', { name: '＋ ペットを追加' }).click();
    await page.locator('.input').fill('もも');
    await page.getByRole('button', { name: '追加する' }).click();

    await page.waitForSelector('.cat-card');
    const src = await page.locator('.cat-card img').getAttribute('src');
    assert.match(src, /^data:image\/svg\+xml/);
    assert.match(decodeURIComponent(src), /🐾/, '足あとになっていない');
    assert.doesNotMatch(decodeURIComponent(src), /🐱/, '猫の絵文字が残っている');
  });

  it('7. 追加したペットは登録され、案内は消える', async () => {
    await firstVisit();
    await page.getByRole('button', { name: '＋ ペットを追加' }).click();
    await page.locator('.input').fill('こむぎ');
    await page.getByRole('button', { name: '追加する' }).click();

    await page.waitForSelector('.cat-card');
    assert.equal(await page.locator('.cat-card').count(), 1);
    assert.equal(await page.locator('.empty').count(), 0, '案内が残っている');

    // 再読み込みしても残る
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cat-card');
    assert.match(await page.locator('.cat-card').innerText(), /こむぎ/);
  });

  it('8. 既存ユーザーの保存データは消さずに読み込む', async () => {
    await reset(page, app.base, []);
    await page.evaluate(() => {
      window.localStorage.setItem(
        'neko-diary-v1',
        JSON.stringify({
          cats: [{ id: 'cat-ravi', name: 'ラヴィ', photo: 'data:image/svg+xml;utf8,<svg/>' }],
          entries: [
            { id: 'e1', catId: 'cat-ravi', date: '2025-04-01', photos: [], text: '前からの記録' },
          ],
        }),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cat-card');

    assert.equal(await page.locator('.cat-card').count(), 1);
    assert.match(await page.locator('.cat-card').innerText(), /ラヴィ/);

    await page.getByRole('button', { name: /ラヴィ/ }).click();
    await page.waitForSelector('.entry');
    assert.equal(await page.locator('.entry-text').innerText(), '前からの記録');

    // 読み込んだだけで保存内容が書き換わっていないこと
    const saved = JSON.parse(await stored());
    assert.equal(saved.cats.length, 1);
    assert.equal(saved.entries.length, 1);
  });

  it('9. 保存データが壊れていても、サンプルを入れずに空で開く', async () => {
    await reset(page, app.base, []);
    await page.evaluate(() => window.localStorage.setItem('neko-diary-v1', '{壊れている'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.title');

    assert.equal(await page.locator('.cat-card').count(), 0);
    assert.equal(await page.locator('.empty').count(), 1);
  });

  it('10. 一連の操作でJavaScriptエラーが発生しない', () => {
    assert.deepEqual(app.jsErrors, []);
  });
});
