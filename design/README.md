# design

デザインの素材置き場。**アプリのビルドには含まれない。**

## pet-background-b

ホーム画面の背景として検討中の案（B案）。飼い猫をモデルにしたイラストを散らしたもの。

| ファイル | 用途 |
|---|---|
| `pet-background-b.jpg` | 1280×960 / 45KB。実際に使うならこれ |
| `pet-background-b.svg` | 元データ。拡大・色の調整はこちらから |
| `pet-background-b.gen.py` | SVGを組み立てるスクリプト。配置や大きさを変えたいとき用 |

現在ホームで使っているのは `app/pet-background.jpg` の方。差し替える場合は、
`design/pet-background-b.jpg` を `app/pet-background.jpg` に置き換える。

SVGを直したあとにJPEGを作り直す手順：

```
python3 design/pet-background-b.gen.py   # SVGを生成（カレントに出力）
# SVGを1280×960でスクリーンショットしてPNG化 → JPEGへ変換
```
