"""B案の背景を作る。タイルで繰り返さず、1枚絵として散らす。"""
import random

W, H = 1280, 960
rng = random.Random(20260815)

SYMBOLS = """
  <!-- 白×茶グレーの長毛猫。写真の子がモデル。 -->

  <!-- 正面すわり -->
  <g id="cat-front">
    <path d="M96 146 C126 142 142 120 136 96 C132 80 116 76 110 86 C104 96 114 102 116 112
             C119 126 108 134 92 136 Z" fill="url(#tabbyG)"/>
    <g stroke="#8a7565" stroke-width="1.1" opacity="0.35" fill="none">
      <path d="M104 138 C112 134 118 128 121 121"/>
      <path d="M112 130 C118 124 122 116 122 108"/>
    </g>

    <path d="M66 164 C30 164 16 148 20 122 C23 102 31 88 42 79 C48 74 58 71 66 71
             C74 71 84 74 90 79 C101 88 109 102 112 122 C116 148 102 164 66 164 Z"
          fill="url(#whiteG)" stroke="#ddd0be" stroke-width="1.5"/>
    <path d="M66 158 C44 158 33 146 34 128 C35 112 46 100 66 100 C86 100 97 112 98 128
             C99 146 88 158 66 158 Z" fill="#fffefb" opacity="0.9"/>
    <g stroke="#e6d9c8" stroke-width="1.1" opacity="0.8" fill="none">
      <path d="M52 112 C50 122 51 134 55 144"/>
      <path d="M66 108 C65 120 65 134 67 146"/>
      <path d="M80 112 C82 122 81 134 77 144"/>
    </g>
    <ellipse cx="45" cy="156" rx="12" ry="8.5" fill="#fffefb" stroke="#ddd0be" stroke-width="1.3"/>
    <ellipse cx="87" cy="156" rx="12" ry="8.5" fill="#fffefb" stroke="#ddd0be" stroke-width="1.3"/>
    <g stroke="#e2d4c2" stroke-width="1" fill="none">
      <path d="M41 152 L41 158 M45 151 L45 158 M49 152 L49 158"/>
      <path d="M83 152 L83 158 M87 151 L87 158 M91 152 L91 158"/>
    </g>

    <path d="M40 30 L31 3 L58 20 Z" fill="#95816f"/>
    <path d="M90 30 L99 3 L72 20 Z" fill="#95816f"/>
    <path d="M42 27 L37 11 L54 21 Z" fill="#eaada7"/>
    <path d="M88 27 L93 11 L76 21 Z" fill="#eaada7"/>

    <path d="M65 20 C84 20 97 33 98 52 C99 68 92 80 80 85 C74 87 56 87 50 85
             C38 80 31 68 32 52 C33 33 46 20 65 20 Z" fill="url(#tabbyG)"/>
    <path d="M32 56 L22 60 L33 63 L24 68 L36 68 Z" fill="#a3907f"/>
    <path d="M98 56 L108 60 L97 63 L106 68 L94 68 Z" fill="#a3907f"/>

    <path d="M65 36 C70 36 74 43 74 51 C74 56 72 60 71 63 C77 65 82 70 82 76
             C82 83 74 88 65 88 C56 88 48 83 48 76 C48 70 53 65 59 63
             C58 60 56 56 56 51 C56 43 60 36 65 36 Z" fill="#fdfaf4"/>

    <path d="M44 55 C48 47 58 47 61 55 C57 62 48 62 44 55 Z" fill="#a9c06a"/>
    <path d="M69 55 C72 47 82 47 86 55 C82 62 73 62 69 55 Z" fill="#a9c06a"/>
    <ellipse cx="52.5" cy="55" rx="1.9" ry="5.4" fill="#4a4033"/>
    <ellipse cx="77.5" cy="55" rx="1.9" ry="5.4" fill="#4a4033"/>
    <circle cx="50.6" cy="52.6" r="1.5" fill="#ffffff"/>
    <circle cx="75.6" cy="52.6" r="1.5" fill="#ffffff"/>
    <path d="M44 55 C48 47 58 47 61 55" fill="none" stroke="#7b6a58" stroke-width="1.2"/>
    <path d="M69 55 C72 47 82 47 86 55" fill="none" stroke="#7b6a58" stroke-width="1.2"/>

    <path d="M65 68 C68 68 70 70 70 72 C70 74.5 67.5 76 65 76 C62.5 76 60 74.5 60 72 C60 70 62 68 65 68 Z"
          fill="#e08f95"/>
    <path d="M65 76 L65 79 M58 83 C61 86 65 85 65 80 M72 83 C69 86 65 85 65 80"
          fill="none" stroke="#b09a86" stroke-width="1.4" stroke-linecap="round"/>
    <g stroke="#cdbfae" stroke-width="1.1" stroke-linecap="round" fill="none">
      <path d="M46 72 L18 66"/><path d="M46 77 L17 78"/><path d="M47 81 L20 89"/>
      <path d="M84 72 L112 66"/><path d="M84 77 L113 78"/><path d="M83 81 L110 89"/>
    </g>
  </g>

  <!-- 後ろ姿ですわる -->
  <g id="cat-back">
    <path d="M94 146 C122 148 140 130 137 106 C134 90 120 82 112 89 C104 96 113 104 115 113
             C118 126 110 134 92 134 Z" fill="url(#tabbyG)"/>
    <path d="M62 154 C26 154 14 137 19 111 C24 83 40 66 62 66 C84 66 100 83 105 111
             C110 137 98 154 62 154 Z" fill="url(#whiteG)" stroke="#ddd0be" stroke-width="1.5"/>
    <path d="M36 92 C46 78 64 74 78 82 C90 88 94 102 89 113 C79 101 54 99 40 108
             C33 103 32 97 36 92 Z" fill="url(#tabbyG)"/>
    <g stroke="#e6d9c8" stroke-width="1.1" opacity="0.75" fill="none">
      <path d="M46 122 C44 132 45 142 49 150"/>
      <path d="M62 120 C61 132 61 142 63 150"/>
      <path d="M78 122 C80 132 79 142 75 150"/>
    </g>
    <path d="M40 26 L32 1 L58 19 Z" fill="#95816f"/>
    <path d="M82 26 L90 1 L64 19 Z" fill="#95816f"/>
    <path d="M42 24 L38 11 L54 20 Z" fill="#c2a294"/>
    <path d="M80 24 L84 11 L68 20 Z" fill="#c2a294"/>
    <path d="M61 18 C80 18 92 31 92 48 C92 62 82 72 61 72 C40 72 30 62 30 48 C30 31 42 18 61 18 Z"
          fill="url(#tabbyG)"/>
    <g stroke="#8a7565" stroke-width="1.2" opacity="0.4" fill="none">
      <path d="M46 30 C50 38 50 48 47 56"/>
      <path d="M61 26 C63 36 63 48 61 58"/>
      <path d="M76 30 C72 38 72 48 75 56"/>
    </g>
  </g>

  <!-- ごろんと寝ころぶ -->
  <g id="cat-lying">
    <path d="M170 78 C196 82 212 64 206 42 C202 27 188 24 183 34 C178 44 188 49 189 58
             C191 69 181 74 166 71 Z" fill="url(#tabbyG)"/>
    <ellipse cx="104" cy="74" rx="74" ry="38" fill="url(#whiteG)" stroke="#ddd0be" stroke-width="1.5"/>
    <path d="M122 40 C142 33 164 38 174 52 C160 49 140 49 128 54 Z" fill="url(#tabbyG)"/>
    <ellipse cx="92" cy="70" rx="50" ry="27" fill="#fffefb" opacity="0.95"/>
    <g stroke="#e6d9c8" stroke-width="1.1" opacity="0.8" fill="none">
      <path d="M70 56 C66 66 66 78 70 88"/>
      <path d="M92 52 C89 64 89 78 92 90"/>
      <path d="M114 56 C118 66 118 78 114 88"/>
    </g>
    <path d="M62 46 C57 33 63 24 72 26 C79 28 79 37 74 46 Z" fill="#fffefb" stroke="#ddd0be" stroke-width="1.2"/>
    <path d="M96 42 C93 29 100 21 108 24 C115 27 113 36 108 44 Z" fill="#fffefb" stroke="#ddd0be" stroke-width="1.2"/>
    <ellipse cx="68" cy="30" rx="8.5" ry="6.5" fill="#fffefb" stroke="#ddd0be" stroke-width="1.1"/>
    <ellipse cx="104" cy="26" rx="8.5" ry="6.5" fill="#fffefb" stroke="#ddd0be" stroke-width="1.1"/>
    <path d="M18 46 L8 22 L34 38 Z" fill="#95816f"/>
    <path d="M54 40 L64 18 L40 32 Z" fill="#95816f"/>
    <path d="M21 44 L14 28 L31 39 Z" fill="#eaada7"/>
    <path d="M52 38 L58 24 L42 32 Z" fill="#eaada7"/>
    <path d="M38 34 C56 34 66 46 65 62 C64 76 54 86 38 86 C22 86 10 76 9 62 C8 46 20 34 38 34 Z"
          fill="url(#tabbyG)"/>
    <path d="M38 50 C43 50 46 56 46 62 C46 66 45 69 44 71 C49 73 53 77 53 81
             C53 87 46 91 38 91 C30 91 24 87 24 81 C24 77 28 73 32 71
             C31 69 30 66 30 62 C30 56 33 50 38 50 Z" fill="#fdfaf4"/>
    <path d="M18 64 C21 57 29 57 32 64 C29 70 21 70 18 64 Z" fill="#a9c06a"/>
    <path d="M44 62 C47 55 55 55 58 62 C55 68 47 68 44 62 Z" fill="#a9c06a"/>
    <ellipse cx="25" cy="64" rx="1.7" ry="4.8" fill="#4a4033"/>
    <ellipse cx="51" cy="62" rx="1.7" ry="4.8" fill="#4a4033"/>
    <circle cx="23.4" cy="61.8" r="1.3" fill="#ffffff"/>
    <circle cx="49.4" cy="59.8" r="1.3" fill="#ffffff"/>
    <path d="M38 76 C40.5 76 42.5 77.6 42.5 79.4 C42.5 81.5 40.5 82.8 38 82.8
             C35.5 82.8 33.5 81.5 33.5 79.4 C33.5 77.6 35.5 76 38 76 Z" fill="#e08f95"/>
    <g stroke="#cdbfae" stroke-width="1.1" stroke-linecap="round" fill="none">
      <path d="M20 80 L-2 82"/><path d="M22 85 L2 92"/>
      <path d="M56 76 L78 74"/><path d="M56 81 L76 86"/>
    </g>
  </g>

  <!-- 肉球 -->
  <g id="paw">
    <ellipse cx="0" cy="6" rx="11" ry="9"/>
    <ellipse cx="-10" cy="-6" rx="4.2" ry="5.4" transform="rotate(-18 -10 -6)"/>
    <ellipse cx="-3.4" cy="-11" rx="4.2" ry="5.6"/>
    <ellipse cx="3.6" cy="-11" rx="4.2" ry="5.6"/>
    <ellipse cx="10.2" cy="-6" rx="4.2" ry="5.4" transform="rotate(18 10.2 -6)"/>
  </g>

  <!-- ハート（線） -->
  <path id="heart" fill="none" stroke-width="2" stroke-linejoin="round"
    d="M0 10 C -10 1, -13 -7, -6.5 -10 C -2.6 -12, 0 -9, 0 -6 C 0 -9, 2.6 -12, 6.5 -10 C 13 -7, 10 1, 0 10 Z"/>

  <!-- 小枝 -->
  <g id="sprig" stroke-width="1.7" stroke-linecap="round" fill="none">
    <path d="M0 20 C 1.5 8, 1.5 -6, 0 -20"/>
    <path d="M0 10 C -7 8, -11 2, -11 -3 C -5 -3, -1 2, 0 6" class="leaf"/>
    <path d="M0 3 C 7 1, 11 -5, 11 -10 C 5 -10, 1 -5, 0 -1" class="leaf"/>
    <path d="M0 -6 C -6 -8, -10 -14, -10 -19 C -4 -19, 0 -14, 0 -10" class="leaf"/>
  </g>

  <!-- 毛糸玉 -->
  <g id="yarn">
    <circle cx="0" cy="0" r="13"/>
    <g fill="none" stroke="#fdfaf6" stroke-width="1.5" opacity="0.9">
      <path d="M-12 -4 C -4 -11, 6 -11, 12 -3"/>
      <path d="M-12 3 C -4 -3, 6 -3, 12 4"/>
      <path d="M-6 -11 C -11 -3, -10 6, -3 12"/>
      <path d="M4 -12 C 0 -4, 1 6, 8 11"/>
    </g>
  </g>

  <!-- さかな -->
  <g id="fish">
    <path d="M-14 0 C-9 -8 3 -10 11 -4 L18 -8 L16 0 L18 8 L11 4 C3 10 -9 8 -14 0 Z"/>
    <circle cx="4" cy="-2" r="1.6" fill="#fdfaf6"/>
  </g>

  <!-- すず -->
  <g id="bell">
    <circle cx="0" cy="0" r="10"/>
    <path d="M-9 1 L9 1" stroke="#fdfaf6" stroke-width="1.6" fill="none"/>
    <circle cx="0" cy="5" r="2.2" fill="#fdfaf6"/>
    <rect x="-2" y="-13" width="4" height="4" rx="1.4"/>
  </g>

  <!-- 小花 -->
  <g id="flower">
    <circle cx="0" cy="-7.5" r="4.5"/>
    <circle cx="7.1" cy="-2.3" r="4.5"/>
    <circle cx="4.4" cy="6.1" r="4.5"/>
    <circle cx="-4.4" cy="6.1" r="4.5"/>
    <circle cx="-7.1" cy="-2.3" r="4.5"/>
    <circle cx="0" cy="0" r="3.2" fill="#f2d49f"/>
  </g>

  <!-- はね -->
  <g id="feather">
    <path d="M0 16 C -8 6, -9 -6, 0 -16 C 9 -6, 8 6, 0 16 Z"/>
    <path d="M0 16 L0 -14" stroke="#fdfaf6" stroke-width="1.2" fill="none" opacity="0.8"/>
  </g>
"""

# 大きなシルエット。重ならないよう手で置く。
BIG = [
    ("cat-front", 62, 660, 1.75, -2, "#ffffff", 0.95),
    ("cat-back", 128, 84, 1.7, 2, "#ffffff", 0.92),
    ("cat-lying", 900, 150, 1.5, -3, "#ffffff", 0.92),
    ("cat-front", 700, 560, 1.6, 3, "#ffffff", 0.9),
    ("cat-back", 470, 800, 1.15, -4, "#ffffff", 0.55),
    ("cat-lying", 1050, 700, 1.05, 2, "#ffffff", 0.5),
]

SMALL_KINDS = [
    # 足あとは濃い色のまま、大きさは動物より控えめにする。
    ("paw", ["#8a7266", "#7d675c", "#967d6f"], (0.40, 0.55), (0.85, 1.20)),
    ("paw", ["#8a7266", "#967d6f", "#87705f"], (0.40, 0.55), (0.80, 1.15)),
    ("paw", ["#7d675c", "#8a7266"], (0.38, 0.52), (0.75, 1.10)),
    ("sprig", ["#a8bda3", "#b3c4ad", "#9fb59a"], (0.5, 0.72), (0.9, 1.4)),
    ("heart", ["#eaa7b4", "#e6b79a"], (0.55, 0.78), (0.9, 1.3)),
    ("flower", ["#f1c6ce", "#eebfae", "#f2cbbd"], (0.6, 0.82), (0.85, 1.25)),
    ("yarn", ["#f3c9cf", "#eec7bd"], (0.55, 0.78), (0.85, 1.15)),
    ("fish", ["#bcc9cf", "#c9d3d6"], (0.5, 0.7), (0.85, 1.15)),
    ("bell", ["#eccf9a", "#e8c98f"], (0.5, 0.7), (0.75, 1.0)),
]

# 大きなシルエットの周りは避けて、小物を散らす。
big_zones = [(x + 60 * s, y + 70 * s, 105 * s) for _, x, y, s, _, _, _ in BIG]
placed = []


def ok(x, y, r=56):
    for bx, by, br in big_zones:
        if (x - bx) ** 2 + (y - by) ** 2 < (br + r * 0.5) ** 2:
            return False
    for px, py in placed:
        if (x - px) ** 2 + (y - py) ** 2 < r * r:
            return False
    return True


smalls = []
attempts = 0
while len(smalls) < 72 and attempts < 12000:
    attempts += 1
    x = rng.uniform(20, W - 20)
    y = rng.uniform(20, H - 20)
    if not ok(x, y):
        continue
    placed.append((x, y))
    name, colors, (o1, o2), (s1, s2) = rng.choice(SMALL_KINDS)
    smalls.append(
        (name, x, y, rng.uniform(s1, s2), rng.uniform(-35, 35),
         rng.choice(colors), rng.uniform(o1, o2))
    )

# にじみ
blobs = []
for _ in range(11):
    blobs.append((
        rng.uniform(0, W), rng.uniform(0, H),
        rng.uniform(150, 330), rng.uniform(110, 210),
        rng.choice(["#fbeef1", "#f7e9dc", "#fdf3ea", "#f3ece2", "#eef1e9", "#f9e8e6"]),
    ))

parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
    '<defs>',
    '<filter id="soft" x="-40%" y="-40%" width="180%" height="180%">'
    '<feGaussianBlur stdDeviation="40"/></filter>',
    '<filter id="edge" x="-20%" y="-20%" width="140%" height="140%">'
    '<feGaussianBlur stdDeviation="0.5"/></filter>',
    '<radialGradient id="whiteG" cx="38%" cy="28%" r="78%">'
    '<stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#eee4d6"/>'
    '</radialGradient>',
    '<radialGradient id="tabbyG" cx="36%" cy="24%" r="80%">'
    '<stop offset="0%" stop-color="#b6a596"/><stop offset="100%" stop-color="#8b7867"/>'
    '</radialGradient>',
    SYMBOLS,
    '</defs>',
    f'<rect width="{W}" height="{H}" fill="#fdfaf6"/>',
    '<g filter="url(#soft)" opacity="0.8">',
]
for x, y, rx, ry, fill in blobs:
    parts.append(f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{rx:.0f}" ry="{ry:.0f}" fill="{fill}"/>')
parts.append('</g>')

# 大きなシルエットは輪郭をぼかして水彩っぽく
parts.append('<g filter="url(#edge)">')
for name, x, y, s, rot, fill, op in BIG:
    parts.append(
        f'<use href="#{name}" fill="{fill}" opacity="{op}" '
        f'transform="translate({x} {y}) rotate({rot}) scale({s})"/>'
    )
parts.append('</g>')

for name, x, y, s, rot, color, op in smalls:
    stroke = f' stroke="{color}"' if name in ("heart", "sprig") else ''
    style = ' style="color:%s"' % color if name == "sprig" else ''
    parts.append(
        f'<use href="#{name}" fill="{color}"{stroke}{style} opacity="{op:.2f}" '
        f'transform="translate({x:.0f} {y:.0f}) rotate({rot:.0f}) scale({s:.2f})"/>'
    )

parts.append(f'<rect width="{W}" height="{H}" fill="#fdfaf6" opacity="0.14"/>')
parts.append('</svg>')

open('pet-bg-b.svg', 'w').write('\n'.join(parts))
print('motifs:', len(smalls), 'blobs:', len(blobs))
