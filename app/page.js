'use client';

import { useEffect, useRef, useState } from 'react';
import {
  formatDate,
  loadData,
  placeholderPhoto,
  saveData,
  shrinkImage,
  todayString,
} from '../lib/storage';

const MAX_PHOTOS = 5;
const DUPLICATE_MESSAGE = 'この日付にはすでに記録があります。';

// 1匹の猫につき1日1件。同じ猫・同じ日付の記録を探す。
// exceptId を渡すと、その記録自身は当たらない（日付を変えずに編集した場合）。
function findEntryOfDay(entries, catId, date, exceptId) {
  return entries.find(
    (entry) => entry.catId === catId && entry.date === date && entry.id !== exceptId,
  );
}

// 画面は3つだけ。ルーティングは使わず、状態で切り替える。
export default function App() {
  const [data, setData] = useState({ cats: [], entries: [] });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('home');
  const [currentCatId, setCurrentCatId] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);

  // localStorage はブラウザにしかないので、表示後に読み込む。
  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  function update(next) {
    setData(next);
    return saveData(next);
  }

  function openCat(catId) {
    setCurrentCatId(catId);
    setView('cat');
  }

  if (!ready) return <main className="screen" />;

  const currentCat = data.cats.find((cat) => cat.id === currentCatId);

  if (view === 'cat' && currentCat) {
    return (
      <CatScreen
        cat={currentCat}
        entries={data.entries.filter((entry) => entry.catId === currentCat.id)}
        onBack={() => setView('home')}
        onNew={() => {
          // その日の記録がもうあるなら、新しく作らずにそれを編集する。
          const today = findEntryOfDay(data.entries, currentCat.id, todayString());
          if (today) {
            setEditingEntryId(today.id);
            setView('edit');
            return;
          }
          setView('new');
        }}
        onEdit={(entryId) => {
          setEditingEntryId(entryId);
          setView('edit');
        }}
      />
    );
  }

  if (view === 'new' && currentCat) {
    return (
      <EntryScreen
        cat={currentCat}
        onCancel={() => setView('cat')}
        onSave={(entry) => {
          // 日付を変えて保存された場合も、その日の記録が二重にならないようにする。
          if (findEntryOfDay(data.entries, currentCat.id, entry.date)) return DUPLICATE_MESSAGE;

          const saved = update({ ...data, entries: [entry, ...data.entries] });
          if (!saved) return false;
          setView('cat');
          return true;
        }}
      />
    );
  }

  const editingEntry = data.entries.find((entry) => entry.id === editingEntryId);

  if (view === 'edit' && currentCat && editingEntry) {
    return (
      <EntryScreen
        cat={currentCat}
        entry={editingEntry}
        onCancel={() => setView('cat')}
        onSave={(next) => {
          // 移動先の日付にすでに記録がある場合は、統合せず保存を中止する。
          if (findEntryOfDay(data.entries, currentCat.id, next.date, next.id)) {
            return DUPLICATE_MESSAGE;
          }

          const saved = update({
            ...data,
            entries: data.entries.map((entry) => (entry.id === next.id ? next : entry)),
          });
          if (!saved) return false;
          setView('cat');
          return true;
        }}
        onDelete={() => {
          update({
            ...data,
            entries: data.entries.filter((entry) => entry.id !== editingEntry.id),
          });
          setEditingEntryId(null);
          setView('cat');
        }}
      />
    );
  }

  return (
    <HomeScreen
      cats={data.cats}
      entries={data.entries}
      onSelect={openCat}
      onAddCat={(name) => update({ ...data, cats: [...data.cats, newCat(name)] })}
    />
  );
}

// 保存済みデータに photos がない場合でも表示できるようにする（移行処理は行わない）。
function entryPhotos(entry) {
  return Array.isArray(entry.photos) ? entry.photos : [];
}

function newCat(name) {
  return {
    id: `cat-${Date.now()}`,
    name,
    photo: placeholderPhoto('#f3ebe3'),
  };
}

/* ---------- 画面1：ホーム ---------- */

function HomeScreen({ cats, entries, onSelect, onAddCat }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    onAddCat(trimmed);
    setName('');
    setAdding(false);
  }

  return (
    <main className="screen">
      <h1 className="title">ねこ日記</h1>
      <p className="lead">猫との大切な日常を、写真と言葉で残す。</p>

      <div className="cat-grid">
        {cats.map((cat) => {
          const count = entries.filter((entry) => entry.catId === cat.id).length;
          return (
            <button key={cat.id} className="cat-card" onClick={() => onSelect(cat.id)}>
              <img src={cat.photo} alt={cat.name} />
              <div className="cat-card-name">
                {cat.name}
                <div className="cat-card-count">
                  {count > 0 ? `${count}件の記録` : 'まだ記録がありません'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="stack">
        {adding ? (
          <form onSubmit={submit}>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="猫の名前"
              autoFocus
            />
            <div className="stack">
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                追加する
              </button>
              <button type="button" className="back" onClick={() => setAdding(false)}>
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-outline" onClick={() => setAdding(true)}>
            ＋ 猫を追加
          </button>
        )}
      </div>
    </main>
  );
}

/* ---------- 画面2：猫ごとの日記一覧 ---------- */

function CatScreen({ cat, entries, onBack, onNew, onEdit }) {
  return (
    <main className="screen">
      <button className="back" onClick={onBack}>
        ← ホーム
      </button>

      <div className="cat-header">
        <img src={cat.photo} alt={cat.name} />
        <h1 className="title">{cat.name}</h1>
      </div>

      <div className="stack">
        <button className="btn btn-primary" onClick={onNew}>
          今日の思い出を残す
        </button>
      </div>

      <p className="section-label">これまでの記録</p>

      {entries.length === 0 ? (
        <p className="empty">
          まだ記録がありません。
          <br />
          今日の1枚から残してみましょう。
        </p>
      ) : (
        entries.map((entry) => (
          <article key={entry.id} className="entry">
            <div className="entry-head">
              <p className="entry-date">{formatDate(entry.date)}</p>
              <button type="button" className="entry-edit" onClick={() => onEdit(entry.id)}>
                編集
              </button>
            </div>

            {entryPhotos(entry).length > 0 && (
              <div className={`entry-photos ${entryPhotos(entry).length === 1 ? 'single' : ''}`}>
                {entryPhotos(entry).map((photo, index) => (
                  <img key={index} src={photo} alt="" />
                ))}
              </div>
            )}

            {entry.text && <p className="entry-text">{entry.text}</p>}
          </article>
        ))
      )}
    </main>
  );
}

/* ---------- 画面3：新規記録 ---------- */

// 新規作成と編集で同じ画面を使う。entry があれば編集。
function EntryScreen({ cat, entry, onCancel, onSave, onDelete }) {
  const editing = Boolean(entry);
  const [date, setDate] = useState(entry ? entry.date : todayString());
  const [photos, setPhotos] = useState(entry ? entryPhotos(entry) : []);
  const [text, setText] = useState(entry ? entry.text || '' : '');
  const [message, setMessage] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileInput = useRef(null);

  async function pickPhotos(event) {
    const input = event.target;
    const files = Array.from(input.files || []);

    // 入力のリセットは await より前に、同期的に行う。
    // iPad Safari は value が残っている間、次の選択で change を発火しないため、
    // 縮小の完了を待ってからリセットすると2枚目以降を追加できなくなる。
    input.value = '';
    if (files.length === 0) return;

    const room = Math.max(0, MAX_PHOTOS - photos.length);
    setMessage(files.length > room ? `写真は${MAX_PHOTOS}枚までです。` : '');

    try {
      const added = await Promise.all(files.slice(0, room).map((file) => shrinkImage(file)));
      // 縮小を待つ間に別の写真が追加されている場合があるので、
      // 閉じ込めた photos ではなく最新の state に足す。
      setPhotos((current) => [...current, ...added].slice(0, MAX_PHOTOS));
    } catch {
      setMessage('写真を読み込めませんでした。別の写真をお試しください。');
    }
  }

  function save() {
    // 編集時は既存の entry の形をそのまま保ち、id と catId を引き継ぐ。
    // 保存できた場合は true、できなかった場合は理由の文言か false が返る。
    const result = onSave({
      ...(entry || {}),
      id: entry ? entry.id : `entry-${Date.now()}`,
      catId: cat.id,
      date,
      photos,
      text: text.trim(),
    });

    if (result === true) return;

    setMessage(
      typeof result === 'string'
        ? result
        : '保存できませんでした。写真の枚数を減らすか、古い記録を整理してください。',
    );
  }

  const canSave = photos.length > 0 || text.trim().length > 0;

  return (
    <main className="screen">
      <button className="back" onClick={onCancel}>
        ← {cat.name}の日記
      </button>

      <h1 className="title">{editing ? '記録を編集' : '今日の思い出'}</h1>

      <div className="field">
        <div className="field-label">日付</div>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div className="field">
        <div className="field-label">写真（1枚ずつ追加・最大{MAX_PHOTOS}枚）</div>

        {photos.length > 0 && (
          <div className="preview-grid">
            {photos.map((photo, index) => (
              <div key={index} className="preview">
                <img src={photo} alt="" />
                <button
                  type="button"
                  aria-label="この写真を削除"
                  onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={pickPhotos}
          hidden
        />
        <button
          type="button"
          className="btn btn-soft"
          onClick={() => fileInput.current.click()}
          disabled={photos.length >= MAX_PHOTOS}
        >
          写真を追加
        </button>
        <p className="hint">写真は1枚ずつ追加できます（{photos.length}/{MAX_PHOTOS}枚）。</p>
      </div>

      <div className="field">
        <div className="field-label">日記</div>
        <textarea
          className="textarea"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="今日のできごとや、感じたことを一言。"
        />
        <p className="hint">キーボードのマイクボタンから音声入力も使えます。</p>
      </div>

      {message && <p className="notice">{message}</p>}

      <div className="stack">
        <button className="btn btn-primary" onClick={save} disabled={!canSave}>
          保存する
        </button>
      </div>

      {editing &&
        (confirmingDelete ? (
          <div className="confirm">
            <p className="confirm-text">この記録を削除しますか？</p>
            <div className="stack">
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                削除する
              </button>
              <button type="button" className="back" onClick={() => setConfirmingDelete(false)}>
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <button type="button" className="delete-link" onClick={() => setConfirmingDelete(true)}>
              この記録を削除
            </button>
          </div>
        ))}
    </main>
  );
}
