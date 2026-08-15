// ペット日記のデータ保存。
// MVPなのでブラウザの localStorage だけを使う（サーバー・DBなし）。
// 写真はそのまま入れると容量制限（約5MB）をすぐ超えるので、
// 保存前に必ず縮小してから文字列(データURI)にする。
//
// 保存キーは公開済みのデータをそのまま読めるように変更しない。

const STORAGE_KEY = 'neko-diary-v1';

// 最初は何も登録されていない状態から始める。
const EMPTY_DATA = { cats: [], entries: [] };

// ペットの写真がないときに使う、淡い色のプレースホルダー画像を作る。
// 種類を問わず使うので、足あとにしている。
export function placeholderPhoto(color = '#f0e6dd') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="400" height="400" fill="${color}"/>
    <text x="200" y="245" font-size="150" text-anchor="middle">🐾</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function loadData() {
  if (typeof window === 'undefined') return EMPTY_DATA;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;

    const data = JSON.parse(raw);
    return {
      cats: Array.isArray(data.cats) ? data.cats : [],
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
  } catch {
    // 保存データが壊れていても、アプリが開けなくならないようにする。
    return EMPTY_DATA;
  }
}

// 保存に成功したら true。容量オーバーなどで失敗したら false。
export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// 選んだ写真を長辺800pxまで縮小し、JPEGのデータURIにして返す。
// これをしないと写真1枚で数MBになり、すぐ保存できなくなる。
export function shrinkImage(file, maxSize = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('写真を読み込めませんでした'));
    };

    img.src = url;
  });
}

export function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDate(value) {
  const [year, month, day] = value.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}
