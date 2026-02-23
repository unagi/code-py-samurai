# tools/ — スプライト制作パイプライン

## 全体フロー

```
Gemini生成画像 (スプライトシート)
  ↓  Phase 0: LLMが画像内容を読解してリネーム + meta.json 作成
  ↓
  ↓── (A) サムライ猫ルート:
  ↓     Phase 1: pipeline/phase1_extract.py — rembg + グリッドセル分離 (meta.json準拠)
  ↓     Phase 5-6: pipeline/phase56_normalize_assemble.py — 80px正規化 + シート組立
  ↓     Phase 8: pipeline/phase8_frame_audit.py — フレーム品質監査
  ↓
  ↓── (B) 敵キャラルート (gama等):
  ↓     extract_grid_cells.py — 赤セパレータ検出 + rembg + セル分離
  ↓     (目視で各セルの向きを判定 → 左右振り分け)
  ↓     frame_order.py — idle フレーム順序決定 (CV: edge+DT+ECC+距離行列)
  ↓     frame_order.py 出力から手動でスプライトシート組立
  ↓
  ↓  (中割りが必要な場合)
  ↓  ToonCrafter HF Space でフレーム補間
  ↓  pipeline/rembg_transparency.py — 出力フレームの背景除去
  ↓
完成スプライト → public/assets/
```

補足:
- `Phase 7` / `Phase 7S` は **検証用（本流不採用）**。単一フレームからの高品質モーション生成では再現性が不足した。
- 現在の本流は **端点フレームを先に用意 → ToonCrafter で中割り**。
- 敵キャラルート(B)は Gemini が方向指定を無視するため、セル単位の手作業が必要。

---

## Phase 0: リネーム + メタデータ作成

Gemini 生成画像は `Gemini_Generated_Image_<hash>.png` で納品される。
人間がファイル名から内容を判別できないため、LLM が画像を見て命名する。

### 手順
1. LLM に画像を見せる
2. 内容に基づいてリネーム: `samurai-01.png`, `tiles-01.png` 等
3. `*-meta.json` を作成（グリッド構造・行ごとのアニメーション名を定義）

### meta.json の例
```json
{
  "source": "samurai-01.png",
  "grid": { "rows": 4, "cols": 4 },
  "rows": [
    { "name": "idle-north", "frames": 4 },
    { "name": "idle-east", "frames": 4 },
    { "name": "idle-south", "frames": 4 },
    { "name": "idle-west", "frames": 4 }
  ]
}
```

---

## Phase 1: rembg 背景除去 + セル分離

```bash
# tools/ ディレクトリから実行
bash pipeline/run_phase1.sh samurai-01   # 単体
bash pipeline/run_phase1.sh all          # 全部
```

- rembg (u2net) で背景除去。GPU/CPU 両対応
- グリッドセルを自動検出して個別 PNG に分離
- 出力: `from_creator/gemini/_extracted/<source-name>/`

---

## 汎用グリッドセル分割: extract_grid_cells.py

Gemini 生成スプライトシートを赤セパレータ線で自動分割し、個別セル画像に分離する。
Phase 1 が meta.json 必須なのに対し、こちらは行数・列数の指定のみで動作する汎用ツール。

```bash
cd tools && uv run python pipeline/extract_grid_cells.py \
  ../from_creator/Gemini_Generated_Image_XXXX.png \
  -o ../from_creator/gemini/_cells/gama-01 \
  --rows 4 --cols 5
```

処理内容:
1. 赤色ピクセル（R>150, G<100, B<100）の行/列比率で赤セパレータ線を検出
2. 画像端3%以内の赤線は外枠として除外（内部セパレータのみ採用）
3. 各セルを切り出し → rembg (u2net) で背景除去 → タイトクロップ
4. `r{row}c{col}.png` 形式で保存（意味的ラベルは後工程で付与）

オプション:
- `--skip-rembg`: 背景除去をスキップ（デバッグ用）

出力例: `r1c1.png` ... `r4c5.png`（4×5 = 20セル）

---

## Idle フレーム順序決定: frame_order.py

Idle アニメーションのフレーム順序を CV で自動決定するツール。

### アルゴリズム

```
入力: N枚の idle フレーム（向き混在可）
  ↓ [1] 正規化: target_size(320px) の正方形に縮小フィット + 指定フレームを左右反転
  ↓ [2] Gaussian blur + Canny → エッジ画像
  ↓ [3] Distance Transform（輪郭の"近さ"を連続値で計測）
  ↓ [4] Phase Correlation（粗: 平行移動推定）→ ECC Euclidean（精: 回転+微調整）
  ↓ [5] アライン済み DT 画像の L1 距離で NxN 距離行列を構築
  ↓ [6] 最遠ペア → 最近傍チェイン → 2-opt 改善でパス決定
  ↓ [7] A→B1→C→B2 サイクル選定（4フレーム idle ループ用）
出力: report.json, distance_matrix.png, cycle_contact.png
```

### サイクル構造（A→B1→C→B2）

ゲーム内ループ: `...A→B1→C→B2→A→B1→C→B2→...`
- **A**: 端点（静止ポーズ寄り）
- **C**: A から最も遠い端点（動きのピーク）
- **B1**: 行き（A→C）の中間フレーム
- **B2**: 帰り（C→A）の中間フレーム

> ping-pong (A→B→C→B→A) ではなく、4フレーム全てが異なるサイクル。
> B2→A の遷移が滑らかであることが重要。

### 左右で異なる C 端点

距離行列に特徴的な C 端点が複数ある場合、左右で別の C 端点を採用することで
アニメーションに変化を持たせる。A 端点は C からの最大距離で自動選択。

```bash
# 左向き idle（C端 = r3c3）
cd tools && uv run python pipeline/frame_order.py \
  ../from_creator/gemini/_cells/gama-01 \
  --files r1c1.png r1c2.png r1c3.png r1c4.png r1c5.png \
          r3c1.png r3c2.png r3c3.png r3c4.png r3c5.png \
  --flip r3c1.png \
  --endpoints r1c4 r3c3 \
  --cycle-length 4 \
  -o ../_cells/gama-01/_idle_ordered

# 右向き idle（C端 = r1c3、別パターン）
cd tools && uv run python pipeline/frame_order.py \
  ../from_creator/gemini/_cells/gama-01 \
  --files r1c1.png r1c2.png r1c3.png r1c4.png r1c5.png \
          r3c1.png r3c2.png r3c3.png r3c4.png r3c5.png \
  --flip r3c1.png \
  --endpoints r1c4 r1c3 \
  --cycle-length 4 \
  -o ../_cells/gama-01/_idle_ordered_right
```

出力:
- `distance_matrix.png` — 距離行列ヒートマップ
- `ordered_contact.png` — 全フレーム順序
- `cycle_contact.png` — A→B1→C→B2 サイクル
- `report.json` — 全数値データ
- `normalized/` — 正規化済み個別フレーム（320×320px）

---

## Phase 5-6: 正規化 + スプライトシート組立

```bash
cd tools && uv run python pipeline/phase56_normalize_assemble.py
```

- 抽出フレームを 80×80px に正規化
- 方向・アニメーションごとにスプライトシートを組み立て

---

## Phase 8: フレーム品質監査

```bash
cd tools && uv run python pipeline/phase8_frame_audit.py
```

- 各フレームの構造的品質を自動評価
- 出力: `from_creator/gemini/_audit/`

---

## Phase 7: Stable Diffusion 単フレーム派生 + 差分ゲート（検証用 / 本流不採用）

2枚補間ではなく、1枚入力から「次フレーム候補」を複数生成するルート。  
最終採否は人間レビューだが、先に機械判定で候補を絞る。

### 現状の結論（2026-02）

- **本流採用しない**（御蔵入り）
- 単一フレーム入力では、狙った部位の形状変化よりも **全身の色味・質感の揺れ** が出やすい
- パラメータ調整（`strength` / `control-scale` / prompt）を重ねても、用途要件（しっぽだけ明確に動く）を安定して満たせなかった
- 再挑戦する場合は、まず「ROI固定合成（しっぽ以外を元フレームで固定）」などの**構造的な拘束**を実装してから行う（パラメータ調整を先にやらない）

### 再発防止メモ（重要）

- `1枚入力 → SDで次フレーム捏造` を本番スプライト生成の主戦略にしない
- 「差分が増えた」は成功条件ではない（色差分で稼げてしまう）
- 目標は **局所形状運動**（例: tail内差分↑ + tail外差分↓）

### 品質最優先ポリシー（必須）

- 画像生成ジョブでのフォールバックは**禁止**。
- 幾何学変形（回転・拡縮・平行移動）でモーションを作らない。
- ControlNet / モデル / variant 読み込みに失敗した場合は、その場で停止して環境を修復する。
- `--allow-runtime-fallbacks` は品質検証・本番生成では使用しない。
- 「通過率を上げるための閾値緩和」は、目視品質が下がる場合は不採用とする。
- 代替モデルや `--control none` への切替は、品質検証をやり直す前提でのみ明示的に実施する。

失敗時の原則:
1. 破損キャッシュを削除
2. 同一モデルを再取得
3. 同一条件で再実行（勝手に条件を変えない）

### 実行例

```bash
cd tools
uv run python pipeline/phase7_sd_nextframe.py \
  ../public/assets/sprites/samurai-cat/idle-east-frames/frame_01.png \
  -o ../from_creator/gemini/_sd_nextframe/idle-east-f01 \
  --candidates 6 \
  --strength 0.08 \
  --seed 1234
```

### 出力

- `source_rgb.png`: 元フレーム（作業解像度）
- `target_pose_rgb.png`: 目標ポーズ（軽微変形）
- `control_canny.png`: ControlNet拘束画像（`--control canny`時）
- `candidates/candidate_*.png`: 生成候補
- `report.json`: 差分スコアと PASS/FAIL
- `contact_sheet.png`: 目視レビュー用一覧

### 判定ロジック

- 自動判定（PASS条件）:
  - 前景領域の平均差分が `[min_diff, max_diff]` 範囲
  - エッジIoUが `min_edge_iou` 以上
  - 前景重心ズレが `max_centroid_shift` 以下
  - 前景面積比が `[min_area_ratio, max_area_ratio]` 範囲
- 最終判定:
  - `contact_sheet.png` を人間が確認して採否を決定

### 注意

- 初回実行時はモデルダウンロードで時間がかかる
- `tools/pyproject.toml` の前提は Python `>=3.12,<3.14`
- 差分しきい値はキャラごとに再調整が必要

---

## Phase 7S: セマンティックモーション生成 (AnimateDiff + ControlNet)（検証用 / 本流不採用）

呼び出し側は `intent` のみを指定し、内部でモーション専用モデルを使ってフレーム列を生成する。  
「腕を上げる」「呼吸する」などを幾何学変形で作らない。

### 現状の結論（2026-02）

- **本流採用しない**（御蔵入り）
- `motion-target` / `motion-focus-cells` は現実装では主に**評価用**で、生成拘束としては効かない
- 同一 `source` / 同一 `conditioning` を全フレームへ複製しているため、形状モーションより再描画差（色味・テクスチャ差）が出やすい
- 強い設定（差分量増加）でも、差分はしっぽ局所より全身に散りやすい

### 再発防止メモ（重要）

- `tail_sway_*` のような prompt/intents を増やしても、生成拘束が無い限り根本解決にならない
- 先に必要なのはパラメータ調整ではなく、次のどちらか:
  - フレームごとに異なる条件画像（tailの端点/中間形状）
  - ROI固定合成（しっぽ以外固定）+ ROI内/外の分離評価

### 実行例

```bash
cd tools
uv run python pipeline/phase7_semantic_motion.py \
  ../public/assets/sprites/samurai-cat/idle-east-frames/frame_01.png \
  -o ../from_creator/gemini/_semantic_motion/idle-east-frame01 \
  --intent tail_sway_small \
  --base-model stable-diffusion-v1-5/stable-diffusion-v1-5 \
  --motion-adapter guoyww/animatediff-motion-adapter-v1-5-2 \
  --controlnet-model ../from_creator/_models/control_v11p_sd15_lineart \
  --conditioning-mode lineart_anime \
  --num-frames 8 \
  --motion-target tail \
  --motion-grid 4x4 \
  --motion-focus-cells r3c1,r4c1 \
  --require-temporal-wave \
  --post-upscale-chain \
  --upscayl-bin "C:/Program Files/Upscayl/resources/bin/upscayl-bin.exe" \
  --upscayl-model-dir "C:/Program Files/Upscayl/resources/models" \
  --upscayl-model-name upscayl-standard-4x \
  --upscayl-passes 2 \
  --upscayl-scale-per-pass 2 \
  --post-downscale-filter bicubic \
  --seed 5201 \
  --device cuda
```

### 生成結果

- `frames/frame_*.png`: 生成フレーム列
- `selected/sway_*.png`: 品質スコアで選別した採用候補
- `contact_sheet.png`: 目視レビュー用
- `report.json`: 定量指標と採否

### ルール

- intent 指定で動かす（`idle_sway_small` / `tail_sway_small` / `idle_breath_small` / `raise_arm_small`）
- 幾何学変形（回転・拡縮・平行移動）は禁止
- 読み込み失敗時のランタイムフォールバックは禁止（必要時のみ明示的に許可）
- 差分評価は前景中心 + 可変グリッド（`--motion-grid`）で行う
- 動かす部位（例: tail）は `--motion-target` と `--motion-focus-cells` をセットで指定する
- `--post-upscale-chain` 有効時は selected 出力に Upscayl 2段処理（例: 2x→2x→元サイズ）を適用する

---

## ToonCrafter 中割り生成 (HF Space)

キーフレーム間の中間フレームを AI 生成してアニメーションを滑らかにする。
ローカル実行は RTX 4060 では不可（→ HISTORY.md #5）。HF Space を使用する。

### 現在の推奨方針（本流）

- **最優先**: 2フレーム以上（端点フレーム）を先に用意して ToonCrafter を使う
- `Phase 7` / `Phase 7S` は本番のフレーム生成手段として使わない
- 単一フレームしかない場合は、まず「フレーム抽出可能なイラスト生成」で端点フレーム確保を優先する

### 再現手順

1. **HF Space**: https://huggingface.co/spaces/Doubiiu/tooncrafter
2. **入力画像**:
   - Image1 (開始フレーム): `idle-east-f0_512x320.png` (512×320px)
   - Image2 (終了フレーム): `idle-east-f2_512x320.png` (512×320px)
   - ※ Phase 1 で抽出した個別フレームを 512×320 にリサイズして使用
3. **パラメータ**:
   - Prompt: (空欄)
   - Steps: 25 (デフォルト)
   - FPS: 10 (デフォルト)
   - Output frames: 16
4. **出力**: 16フレームの動画 → フレーム分解して個別 PNG に
5. **後処理**: rembg で背景除去
   ```bash
   cd tools && uv run python pipeline/rembg_transparency.py <input_dir> -o <output_dir>
   ```

### 品質について
- フレーム 3〜6 付近が最も品質が高い（キーフレームに近い）
- 中間フレーム (8〜12付近) は色ずれ・形状崩れが発生しやすい
- 現時点の出力は `public/assets/sprites/samurai-cat/idle-east-frames/` に仮格納

---

## 単体ツール: rembg 背景除去

任意の RGB 画像に対して rembg (u2net) で背景除去する汎用ツール。

```bash
# 単一ファイル
cd tools && uv run python pipeline/rembg_transparency.py input.png -o output.png

# ディレクトリ一括
cd tools && uv run python pipeline/rembg_transparency.py input_dir/ -o output_dir/

# GPU 使用
cd tools && uv run python pipeline/rembg_transparency.py input_dir/ -o output_dir/ --gpu
```

- デフォルトパラメータ (u2net) でチューニング不要
- ToonCrafter 出力 (白背景 RGB) に対して動作確認済み
