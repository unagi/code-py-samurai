# ガマ刷新（Gemini依頼テンプレ / 4×5）

目的:
- 敵キャラ `gama`（Sludge）を刷新する
- `west` / `east` の2系統を最初から確保する
- 4行×5列=20セルで依頼し、右下1セルはダミー（WM吸収用）
- 抽出後に `public/assets` 登録へ繋げる（`offence->attack`, `disappear->death`）

> 5x5=25セルは生成精度が落ちるため不採用。4×5=20セルが安全圏、4×6=24セルがギリギリ。

---

## Gemini への依頼文（コピペ用）

```text
Create a 4-row x 5-column sprite sheet grid (20 cells total) for a Japanese folklore toad enemy ("gama", sludge-like toad warrior) for a game.

STYLE (very important):
- Pixel art game sprite sheet
- Enemy style: black outline, textured shading, slightly realistic animal body proportions (not super chibi)
- Consistent character design in every cell: same toad, same colors, same body size, same line weight
- Cute-but-dangerous fantasy enemy (not horror, not grotesque)
- Japanese folklore inspired atmosphere
- Keep the same toad character and same palette across the entire sheet

SHEET / CELL RULES:
- 4 rows x 5 columns grid
- One character per cell
- Equal-size cells
- White background around the grid is OK
- Use bright red separator lines between cells (rows and columns) for easy slicing
- Keep the character centered in each cell
- No scenery, no floor line, no cast shadow, no extra background elements
- This is a sprite sheet, not an illustration

IMPORTANT WATERMARK RULE:
- The bottom-right cell (row 4, col 5) is a DUMMY cell reserved for watermark overlap.
- Put NO character there. Make it empty / simple filler only.

MOTION / FRAME INTENT (must be visually meaningful, not only color changes):
- idle frames must show actual idle motion cues (small body sway, breathing, mouth movement, subtle posture variation)
- offence frames must look like attack/spit action (wind-up / release)
- damaged frames must look like flinch / hit reaction
- disappear frames must look like death/disappear progression
- Do NOT fake motion by changing only texture/colors while keeping the exact same pose

DIRECTION DEFINITIONS:
- west = character facing left
- east = character facing right

CELL ASSIGNMENT (strict, 4 rows x 5 columns):
Row1: west idle 1, west idle 2, west idle 3, west idle 4, west idle 5
Row2: west offence 1, west offence 2, west damaged 1, west disappear 1, west disappear 2
Row3: east idle 1, east idle 2, east idle 3, east idle 4, east idle 5
Row4: east offence 1, east offence 2, east damaged 1, east disappear 1, DUMMY (empty)

CHARACTER DESIGN NOTES (gama):
- Big squat toad body, heavy and sluggish silhouette
- Japanese folklore toad vibe
- Thick limbs, wide mouth, sturdy stance
- Can have poison-spit attack expression for offence frames
- Black outlines, textured shading, earthy colors (greens/browns/purples are OK)
- Keep readability at small sprite size

CRITICAL RULES:
- Keep exact character identity consistent across all 19 usable cells
- No human-like clothing unless very minimal and consistent across all cells
- No dramatic camera angle changes
- No zoom differences between cells
- No extra props appearing/disappearing except attack effect cues
- Motion must be pose/silhouette change, not just recoloring
```

---

## 期待される内訳（19セル利用）

- `west`: 10セル
  - `idle` x5
  - `offence` x2
  - `damaged` x1
  - `disappear` x2
- `east`: 9セル
  - `idle` x5
  - `offence` x2
  - `damaged` x1
  - `disappear` x1
- `r4c5`: ダミー（WM吸収）

> east disappear が1フレーム少ないが、最低構成（各方向1f）は満たす。
> 必要に応じ west disappear を左右反転して補完可能。

---

## 抽出後の命名（作業用）

- `idle-west-f0.png` ... `idle-west-f4.png`
- `offence-west-f0.png`, `offence-west-f1.png`
- `damaged-west-f0.png`
- `disappear-west-f0.png`, `disappear-west-f1.png`
- `idle-east-f0.png` ... `idle-east-f4.png`
- `offence-east-f0.png`, `offence-east-f1.png`
- `damaged-east-f0.png`
- `disappear-east-f0.png`

最終 `public/assets` 登録時のマッピング:
- `offence` -> `attack`
- `disappear` -> `death`
- `west` -> `left`
- `east` -> `right`

---

## 納品チェック（最低限）

- 右下セル（r4c5）がダミーになっている
- `west` / `east` の向きが混在していない
- idle が「色差分」ではなく「姿勢/口/体幹の微差分」になっている
- offence / damaged / disappear が見分けられる
- 全セルで同一個体に見える（配色・線・体格が揃っている）
