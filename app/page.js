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

// 画面は3つだけ。ルーティングは使わず、状態で切り替える。
export default function App() {
  const [data, setData] = useState({ cats: [], entries: [] });
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('home');
  const [currentCatId, setCurrentCatId] = useState(null);

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
        onNew={() => setView('new')}
      />
    );
  }

  if (view === 'new' && currentCat) {
    return (
      <NewEntryScreen
        cat={currentCat}
        onCancel={() => setView('cat')}
        onSave={(entry) => {
          const saved = update({ ...data, entries: [entry, ...data.entries] });
          if (!saved) return false;
          setView('cat');
          return true;
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

function CatScreen({ cat, entries, onBack, onNew }) {
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
            <p className="entry-date">{formatDate(entry.date)}</p>

            {entry.photos.length > 0 && (
              <div className={`entry-photos ${entry.photos.length === 1 ? 'single' : ''}`}>
                {entry.photos.map((photo, index) => (
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

function NewEntryScreen({ cat, onCancel, onSave }) {
  const [date, setDate] = useState(todayString());
  const [photos, setPhotos] = useState([]);
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const fileInput = useRef(null);

  async function pickPhotos(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    setMessage(files.length > room ? `写真は${MAX_PHOTOS}枚までです。` : '');

    try {
      const added = await Promise.all(files.slice(0, room).map((file) => shrinkImage(file)));
      setPhotos([...photos, ...added]);
    } catch {
      setMessage('写真を読み込めませんでした。別の写真をお試しください。');
    }

    // 同じ写真をもう一度選べるように入力をリセットする。
    event.target.value = '';
  }

  function save() {
    const ok = onSave({
      id: `entry-${Date.now()}`,
      catId: cat.id,
      date,
      photos,
      text: text.trim(),
    });

    if (!ok) {
      setMessage('保存できませんでした。写真の枚数を減らすか、古い記録を整理してください。');
    }
  }

  const canSave = photos.length > 0 || text.trim().length > 0;

  return (
    <main className="screen">
      <button className="back" onClick={onCancel}>
        ← {cat.name}の日記
      </button>

      <h1 className="title">今日の思い出</h1>

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
        <div className="field-label">写真（最大{MAX_PHOTOS}枚）</div>

        {photos.length > 0 && (
          <div className="preview-grid">
            {photos.map((photo, index) => (
              <div key={index} className="preview">
                <img src={photo} alt="" />
                <button
                  type="button"
                  aria-label="この写真を削除"
                  onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
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
    </main>
  );
}
