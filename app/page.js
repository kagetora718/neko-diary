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
// 代表写真はカード表示なので、日記の写真より小さくてよい。
const CAT_PHOTO_SIZE = 400;
const DUPLICATE_MESSAGE = 'この日付にはすでに記録があります。';
const SAVE_PHOTO_MESSAGE = '写真を保存できませんでした。別の写真をお試しください。';

// 1匹のペットにつき1日1件。同じペット・同じ日付の記録を探す。
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

  // localStorage に保存できたときだけ画面の状態を進める。
  // 保存できていないのに見た目だけ変わると、次に開いたときに元へ戻ってしまう。
  function update(next) {
    if (!saveData(next)) return false;
    setData(next);
    return true;
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
        onToggleImportant={(entryId) =>
          update({
            ...data,
            entries: data.entries.map((entry) =>
              // important がない既存データは false 扱いなので、押すと大切な日になる。
              entry.id === entryId ? { ...entry, important: !entry.important } : entry,
            ),
          })
        }
        onChangePhoto={(photo) =>
          update({
            ...data,
            cats: data.cats.map((cat) => (cat.id === currentCat.id ? { ...cat, photo } : cat)),
          })
        }
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
      onAddCat={(name, photo) => update({ ...data, cats: [...data.cats, newCat(name, photo)] })}
    />
  );
}

// 保存済みデータに photos がない場合でも表示できるようにする（移行処理は行わない）。
function entryPhotos(entry) {
  return Array.isArray(entry.photos) ? entry.photos : [];
}

function newCat(name, photo) {
  return {
    id: `cat-${Date.now()}`,
    name,
    // 写真を選ばなかった場合は今までどおりプレースホルダーを使う。
    photo: photo || placeholderPhoto('#f3ebe3'),
  };
}

/* ---------- 写真を1枚だけ選ぶ（ペットの代表写真用） ---------- */

// 日記の写真追加と同じ作法。value は await より前に同期的に空にする。
function SinglePhotoPicker({ label, onPick, onError }) {
  const fileInput = useRef(null);

  async function pick(event) {
    const input = event.target;
    const [file] = Array.from(input.files || []);
    input.value = '';
    if (!file) return;

    try {
      onPick(await shrinkImage(file, CAT_PHOTO_SIZE));
    } catch {
      onError();
    }
  }

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" onChange={pick} hidden />
      <button type="button" className="btn btn-soft" onClick={() => fileInput.current.click()}>
        {label}
      </button>
    </>
  );
}

/* ---------- 画面1：ホーム ---------- */

function HomeScreen({ cats, entries, onSelect, onAddCat }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState('');

  function submit(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    // 保存できなかったときは追加できたことにしない。
    if (!onAddCat(trimmed, photo)) {
      setMessage(SAVE_PHOTO_MESSAGE);
      return;
    }

    setName('');
    setPhoto(null);
    setMessage('');
    setAdding(false);
  }

  return (
    <main className="screen">
      <h1 className="title">ペット日記</h1>
      <p className="lead">ペットとの大切な日常を、写真と言葉で残す。</p>

      {cats.length === 0 && (
        <p className="empty">
          まだ登録がありません。
          <br />
          まずはペットを追加してみましょう。
        </p>
      )}

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
              placeholder="ペットの名前"
              autoFocus
            />

            <div className="stack">
              {photo && (
                <div className="cat-photo-preview">
                  <img src={photo} alt="" />
                </div>
              )}
              <SinglePhotoPicker
                label={photo ? '写真を選び直す' : '写真を選ぶ（あとからでも可）'}
                onPick={(next) => {
                  setPhoto(next);
                  setMessage('');
                }}
                onError={() => setMessage('写真を読み込めませんでした。別の写真をお試しください。')}
              />
              <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
                追加する
              </button>
              <button type="button" className="back" onClick={() => setAdding(false)}>
                キャンセル
              </button>
            </div>

            {message && <p className="notice">{message}</p>}
          </form>
        ) : (
          <button className="btn btn-outline" onClick={() => setAdding(true)}>
            ＋ ペットを追加
          </button>
        )}
      </div>
    </main>
  );
}

/* ---------- 画面2：ペットごとの日記一覧 ---------- */

function CatScreen({ cat, entries, onBack, onNew, onEdit, onToggleImportant, onChangePhoto }) {
  const [tab, setTab] = useState('list');
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <main className="screen">
      <button className="back" onClick={onBack}>
        ← ホーム
      </button>

      <div className="cat-header">
        <img src={cat.photo} alt={cat.name} />
        <div>
          <h1 className="title">{cat.name}</h1>
          <button type="button" className="cat-photo-edit" onClick={() => setChangingPhoto(true)}>
            写真を変更
          </button>
        </div>
      </div>

      {changingPhoto && (
        <div className="stack">
          <SinglePhotoPicker
            label="写真を選ぶ"
            onPick={(photo) => {
              // 保存できなかったときは成功扱いにしない。
              if (!onChangePhoto(photo)) {
                setMessage(SAVE_PHOTO_MESSAGE);
                return;
              }
              setChangingPhoto(false);
              setMessage('');
            }}
            onError={() => setMessage('写真を読み込めませんでした。別の写真をお試しください。')}
          />
          <button type="button" className="back" onClick={() => setChangingPhoto(false)}>
            キャンセル
          </button>
        </div>
      )}

      {message && <p className="notice">{message}</p>}

      <div className="stack">
        <button className="btn btn-primary" onClick={onNew}>
          今日の思い出を残す
        </button>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === 'list' ? 'tab is-on' : 'tab'}
          onClick={() => setTab('list')}
        >
          一覧
        </button>
        <button
          type="button"
          className={tab === 'calendar' ? 'tab is-on' : 'tab'}
          onClick={() => setTab('calendar')}
        >
          カレンダー
        </button>
      </div>

      {tab === 'calendar' ? (
        <MonthCalendar entries={entries} onOpen={onEdit} />
      ) : (
        <ListView entries={entries} onEdit={onEdit} onToggleImportant={onToggleImportant} />
      )}
    </main>
  );
}

function ListView({ entries, onEdit, onToggleImportant }) {
  return (
    <>
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
              <div className="entry-head-left">
                <p className="entry-date">{formatDate(entry.date)}</p>
                <button
                  type="button"
                  className={entry.important ? 'entry-star is-on' : 'entry-star'}
                  aria-label="大切な日"
                  aria-pressed={entry.important === true}
                  onClick={() => onToggleImportant(entry.id)}
                >
                  {entry.important ? '★' : '☆'}
                </button>
              </div>
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
    </>
  );
}

/* ---------- 月間カレンダー ---------- */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

// 年月選択で遡れる年数。過去を見返せれば十分なので、未来年は出さない。
const YEAR_SPAN = 20;

function yearOptions(shownYear) {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let year = thisYear; year >= thisYear - YEAR_SPAN; year--) years.push(year);

  // ‹ › でこの範囲の外へ移動している場合でも、今見ている年を選べるようにする。
  if (!years.includes(shownYear)) {
    years.push(shownYear);
    years.sort((a, b) => b - a);
  }

  return years;
}

// 'YYYY-MM-DD'。todayString() と同じ形にそろえる。
function dateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 月のマス目を作る。頭の空白は月初の曜日ぶん。
function monthCells(year, month) {
  const blanks = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
}

// カレンダー用のデータは持たず、そのつど entries から引く。
function MonthCalendar({ entries, onOpen }) {
  const [shown, setShown] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState(shown);

  function move(step) {
    setShown((current) => {
      const next = new Date(current.year, current.month + step, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  const byDate = new Map(entries.map((entry) => [entry.date, entry]));

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" className="calendar-move" aria-label="前の月" onClick={() => move(-1)}>
          ‹
        </button>
        <button
          type="button"
          className="calendar-title"
          aria-label="年月を選ぶ"
          onClick={() => {
            setDraft(shown);
            setPicking(true);
          }}
        >
          {shown.year}年{shown.month + 1}月
        </button>
        <button type="button" className="calendar-move" aria-label="次の月" onClick={() => move(1)}>
          ›
        </button>
      </div>

      {picking && (
        <div className="calendar-picker">
          <select
            className="calendar-select"
            aria-label="年"
            value={draft.year}
            onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })}
          >
            {yearOptions(shown.year).map((year) => (
              <option key={year} value={year}>
                {year}年
              </option>
            ))}
          </select>

          <select
            className="calendar-select"
            aria-label="月"
            value={draft.month}
            onChange={(event) => setDraft({ ...draft, month: Number(event.target.value) })}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}月
              </option>
            ))}
          </select>

          <button
            type="button"
            className="calendar-go"
            onClick={() => {
              setShown(draft);
              setPicking(false);
            }}
          >
            移動
          </button>
          <button type="button" className="calendar-cancel" onClick={() => setPicking(false)}>
            キャンセル
          </button>
        </div>
      )}

      <div className="calendar-grid">
        {WEEKDAYS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}

        {monthCells(shown.year, shown.month).map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} className="calendar-cell is-blank" />;

          const entry = byDate.get(dateString(shown.year, shown.month, day));
          const photo = entry ? entryPhotos(entry)[0] : null;

          // 記録がない日は押せないままにする（その日の新規作成は行わない）。
          if (!entry) {
            return (
              <div key={day} className="calendar-cell">
                <span className="calendar-day">{day}</span>
              </div>
            );
          }

          return (
            <button
              key={day}
              type="button"
              className="calendar-cell has-entry"
              aria-label={`${shown.month + 1}月${day}日の記録`}
              onClick={() => onOpen(entry.id)}
            >
              <span className="calendar-day">{day}</span>
              {/* 大切な日の印。ここでは表示だけで、切り替えは一覧から行う。 */}
              {entry.important && <span className="calendar-star">★</span>}
              {photo ? (
                <img className="calendar-thumb" src={photo} alt="" />
              ) : (
                <span className="calendar-dot" />
              )}
            </button>
          );
        })}
      </div>
    </div>
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
        <div className="field-label">写真（最大{MAX_PHOTOS}枚）</div>

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
        <p className="hint">
          {photos.length}/{MAX_PHOTOS}枚
        </p>
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
