# AI画像生成プロンプト ノウハウ集

PySamurai 向けグラフィックアセットをAI（Geminiなど）に依頼する際の知見をまとめたもの。
成功・失敗事例から導き出した再現性のある方針。

---

## 基本原則

### 1. CRITICAL RULES セクションは必須

失敗パターンを明示的に禁止するセクションを毎回必ず含めること。
省略すると、AIが「装飾的・アーティスティック」な出力をしがちになる。

**必ず含める禁止事項テンプレート:**

```
CRITICAL RULES:
- Each swatch is a FLAT, UNIFORM texture — like a color/pattern
  fill, NOT a painting or illustration.
- NO borders, NO corner decorations, NO edge elements,
  NO vignetting, NO focal points.
- The pattern must look IDENTICAL at every point within the
  swatch — any spot should be interchangeable with any other.
- Think "seamless Photoshop pattern tile" not "artwork".
```

### 2. メタファーで意図を伝える

技術的な説明だけでなく、AIが理解しやすいメタファーを添える。

| 伝えたいこと | 効果的なメタファー |
|------------|-----------------|
| シームレスなテクスチャ | `"seamless Photoshop pattern tile" not "artwork"` |
| 均一なパターン | `"any spot should be interchangeable with any other"` |
| 鮮明なアイコン | `"bold dungeon-stairs ICON filling most of the tile"` |

### 3. 具体的なゲームタイトルで参照を共有する

抽象的なスタイル指定よりも、AIが学習したゲームタイトルを参照すると精度が上がる。

**実績あり:**
- スタイル全般: `GBA-era pixel art, Pokemon Ruby/Sapphire cave style`
- 階段アイコン: `like classic Dragon Quest or Final Fantasy stairs`
- パレット: `GBA 16-color palette`

### 4. 赤線セパレーターで切り出し位置を指示する

複数タイルを1枚の画像に収める際、切り出し境界を明示させる。
後処理（スクリプトでの分割）がしやすくなる。

```
separated by bright red 2px lines
```

白背景 + 赤線の組み合わせが最も視認性が高く、スクリプト分割にも向いている。

---

## タイル生成戦略

### 複数タイルは一括依頼が有効（★重要）

**成功事例:** 4タイルを2×2グリッドで一括依頼 → FLOOR・STAIRS・WALL が1回で生成
**失敗事例:** 壁タイル2枚を別プロンプトで依頼 → 整合性が崩れた

**理由:** AIは文脈から各タイルの相互関係を推定するため、
関連するタイルをまとめて依頼した方が全体の色調・テクスチャの一貫性が保たれる。

**推奨:** まず全タイルを一括で叩き出し、再制作が必要なものだけ個別依頼。

### 個別再依頼の際は元プロンプト構造を維持する

一括プロンプトで成功した部分を「雛形」として保持し、
個別依頼時も同じ構造（スタイル定義 → CRITICAL RULES → 個別説明）を崩さない。

---

## 壁タイル（cave-wall / cave-wall-top）特有の難しさ

壁タイルは「構造的分割（上半分/下半分）」と「均一テクスチャ」の両立が求められ、
AIが最も苦手とするパターン。

**失敗パターン:**
- 上半分と下半分の境界が曖昧になる
- 天面と側面が同じ明度になってしまう
- 天面テクスチャが cave-wall と cave-wall-top で一致しない

**対策:**

1. **色調の差を強調して指示する**
   ```
   Top half (ceiling surface): DARKER stone, almost charcoal — as if in shadow
   Bottom half (cliff face): LIGHTER stone — as if lit from the front
   These must be clearly distinguishable at a glance.
   ```

2. **天面の共有を "Copy-paste, same pixels" と表現する**
   ```
   Right tile (wall-top): Take the EXACT same dark stone texture from the
   top half of the left tile. Copy-paste identical texture, full square.
   No cliff face, no ledge line whatsoever.
   ```

3. **2枚を1プロンプトで依頼する際も、4タイル一括の CRITICAL RULES を省略しない**

---

## プロンプトテンプレート

### タイルセット一括依頼テンプレート

```
GBA-era pixel art, Pokemon Ruby/Sapphire cave style.
16-color palette: deep browns, warm tans, charcoal.
Chunky pixels, hard edges, dithering only.
Create a [N×M] grid of [タイル数] square texture swatches on white
background, separated by bright red 2px lines.
Label below: "[ラベル]". Leave 40px blank padding at bottom.
CRITICAL RULES:
- Each swatch is a FLAT, UNIFORM texture — like a color/pattern
  fill, NOT a painting or illustration.
- NO borders, NO corner decorations, NO edge elements,
  NO vignetting, NO focal points.
- The pattern must look IDENTICAL at every point within the
  swatch — any spot should be interchangeable with any other.
- Think "seamless Photoshop pattern tile" not "artwork".
[位置] — [名前]: [説明]
[位置] — [名前]: [説明]
...
```

### 壁タイル再依頼テンプレート（改善版）

```
GBA-era pixel art, Pokemon Ruby/Sapphire cave style.
16-color palette: deep browns, warm tans, charcoal.
Chunky pixels, hard edges, dithering only.
2 square texture swatches side by side on white background,
separated by a bright red 2px vertical line.
Label below: "CAVE WALLS". Leave 40px blank padding at bottom.
CRITICAL RULES:
- Each swatch is a FLAT, UNIFORM texture — like a color/pattern
  fill, NOT a painting or illustration.
- NO borders, NO corner decorations, NO edge elements,
  NO vignetting, NO focal points.
- The pattern must look IDENTICAL at every point within the
  swatch — any spot should be interchangeable with any other.
- Think "seamless Photoshop pattern tile" not "artwork".
Left — WALL (side view, 3/4 top-down view):
  Top half: DARK charcoal stone surface (ceiling/top face). Deep shadow tone.
  Bottom half: LIGHTER warm-brown cliff face (visible front). Subtle cracks OK.
  One sharp horizontal ledge line divides them. Both halves are flat uniform textures.
Right — WALL (top only):
  The EXACT same dark charcoal stone texture as the top half of the left tile.
  Copy-paste identical texture. Fill the entire square.
  No cliff face, no ledge line, no gradient — just uniform dark rock.
Both tiles seamlessly tile with copies of themselves.
```

---

## キャラクタースプライト生成戦略

### SPRITE_SPEC.md の基本仕様

- キャンバス: 80×80px、有効描画エリア: 中央寄り 48×48px
- 右下 20×20px は空白（ウォーターマーク対策）
- 透過PNG必須、全フレーム横並びスプライトシート

### 方向数の整理

| キャラ | 方向 | 備考 |
|--------|------|------|
| サムライ猫（プレイヤー） | 4方向（N/E/S/W） | idle/walk/attack のみ。rest/damaged/death は左右 |
| ガマ・大蛇・サル・タヌキ・クマ | **左右のみ** | 上下（北・南）は不要 |
| ツル | 1方向のみ | bound/rescued |

### 一括生成で一貫性を確保する（★最重要）

**同一キャラの全アニメーション状態は必ず1回のプロンプトで生成すること。**

- 一括生成 → スプライト間の色・体型・線の太さが一致
- 複数回に分けて生成 → 一貫性が崩れるリスクが高い

**レイアウト:** 状態を行、フレームを列にしたグリッド形式が有効。
赤線セパレーターで行・列の両方を区切る。

### 左右対称キャラは水平反転で生成コストを削減

左向き指示自体は可能（主人公猫で実績あり）。ただし**作画が安定しない**ため、
左向きで良品を得るまで複数回試行するコストが高い。

左右対称なキャラクター（ガマ・大蛇・サルなど敵キャラ全般）は：
1. **方向を指定せず**生成（Geminiが出しやすい方向に任せる）
2. 出力された方向をそのまま採用
3. 画像を水平反転してもう一方向を作成

→ 試行回数が減り、生成コストを大幅削減できる。

攻撃エフェクト（紫液など）の向きも反転後に自然に逆向きになるため問題なし。

### グリッド形式の問題と対処方針

グリッド形式（複数行×複数列）には以下の制約がある：
- 列数増加 → Gemini が全体を縮小 → キャラが小さくなる
- ATTACKエフェクト・DEATHの横倒しなどがセル境界をまたいで途切れる
- セル境界の制御指示は効果なし

**しかしグリッド形式は維持する（★重要な理由）:**

| | グリッド形式（1回生成） | ストリップ形式（複数回生成） |
|---|---|---|
| セル境界制御 | ❌ 効かない | ✅ 問題なし |
| 一貫性保証 | ✅ **1回生成内で確保** | ❌ **根本的に不可能** |
| 後処理対処 | ✅ クリッピングで対応可 | ❌ 対処の手段がない |

プロンプト間の一貫性はプロンプト設計でどうにもならない問題。
セル境界のはみ出しは後処理クリッピングで対処できる。
→ **グリッド形式の欠点の方がまだ対処可能。**

**後処理方針:**
- セル境界をまたいだエフェクトは切り出し時にクリッピングして許容
- ウォーターマークが被るセルは最大フレーム数+1列で右下を空ける

### キャラクタースプライト一括依頼テンプレート（グリッド形式）

```
[スタイル定義（キャラ名・色・体型・参照スタイル）]

Create a full sprite sheet grid for [キャラ名].
Layout: [状態数] rows × [最大フレーム数+1] columns grid.
White background. Bright red 2px lines separating ALL cells (rows and columns).
Label each row on the left. Label below: "[キャラ名]". 40px blank padding at bottom.

Per frame: 80×80px. Solid CYAN (#00FFFF) background.
Character fills upper-center 48×48px area.

Row 1 — [状態名] ([フレーム数] frames):
  F1: [説明]
  F2: [説明]
  ...

CRITICAL: Keep ALL frames consistent — same [色指定], same character size,
same line weight throughout the entire sheet.
```

### ⚠️ Gemini固有の制約（2026-02 確認済み）

| 制約 | 詳細 | 対策 |
|------|------|------|
| 透過PNG出力不可 | 透過背景は指定しても出力されない | **シアン背景（`#00FFFF`）**を指定 → rembg で後処理。マゼンタ（`#FF00FF`）は紫系エフェクトと色衝突するため不可 |
| 左向き指示が不安定 | 左向き自体は可能（主人公猫で実績あり）だが作画が安定しないため試行コストが高い | 左右対称キャラは**方向指定なし**で生成 → 出力方向をそのまま採用 → スクリプトで反転 |
| 右下ウォーターマーク衝突 | Geminiは右下セルにウォーターマークを入れるため、最大フレーム行が右下を占有すると衝突する | 最大フレーム数+1列のグリッド（例：最大5fなら6列）にして右下を空けさせる |

### ⚠️ 画像添付は逆効果（使ってはいけない）

Geminiへの画像添付は **使用禁止**。

- 添付画像をAIが加工・変形してしまい、指示テキストが効かなくなる
- デザインの一貫性はテキストプロンプトのスタイル記述のみで担保する

### デザイン確定フェーズの進め方

1. **デザイン確定シート**（2×2グリッド、各状態の代表フレーム1枚）をテキストのみで生成・承認
2. 承認されたら、**同じスタイル記述を維持したまま**全状態一括スプライトシートを依頼
3. 左向き確定後、水平反転で右向きを生成

**ポイント:** デザイン確定プロンプトのスタイル記述（キャラ造形・色・線の太さ）を
一字一句そのまま流用することで、一貫性を言語的に担保する。

---

## 成功・失敗事例ログ

| 日付 | 依頼内容 | 結果 | 備考 |
|------|---------|------|------|
| 2026-02 | 洞窟4タイル一括（2×2グリッド） | ✅ FLOOR・STAIRS 成功、WALL は再制作必要 | 一括依頼は有効 |
| 2026-02 | 壁2タイル個別（CRITICAL RULES省略） | ❌ 失敗 | CRITICAL RULESの省略が原因と推定 |
| 2026-02 | ガマ デザイン確定シート（テキストのみ） | ✅ 成功 | 画像添付なしで良質なデザインが得られた |
| - | 画像添付によるキャラ再現依頼 | ❌ 非推奨 | AIが画像を加工してしまい指示が効かなくなる |
| 2026-02 | ガマ全状態一括（5列・80px帯・F4説明変更） | ✅ 採用 | ウォーターマーク解消・一貫性確保・F4残影なし。シアン背景指定がマゼンタで出力、毒液が青系に変色（背景との混同）は許容 |
