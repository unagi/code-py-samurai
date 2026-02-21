# tools/ — スプライト制作パイプライン

## 全体フロー

```
Gemini生成画像 (スプライトシート)
  ↓  Phase 0: LLMが画像内容を読解してリネーム + meta.json 作成
  ↓  Phase 1: pipeline/phase1_extract.py — rembg 背景除去 + グリッドセル分離
  ↓  Phase 5-6: pipeline/phase56_normalize_assemble.py — 正規化 + スプライトシート組立
  ↓  Phase 8: pipeline/phase8_frame_audit.py — フレーム品質監査
  ↓
  ↓  (中割りが必要な場合)
  ↓  ToonCrafter HF Space でフレーム補間
  ↓  pipeline/rembg_transparency.py — 出力フレームの背景除去
  ↓
完成スプライト → public/assets/
```

---

## Phase 0: リネーム + メタデータ作成

Gemini 生成画像は `Gemini_Generated_Image_<hash>.png` で納品される。
人間がファイル名から内容を判別できないため、LLM が画像を見て命名する。

### 手順
1. LLM に画像を見せる
2. 内容に基づいてリネーム: `warrior-01.png`, `tiles-01.png` 等
3. `*-meta.json` を作成（グリッド構造・行ごとのアニメーション名を定義）

### meta.json の例
```json
{
  "source": "warrior-01.png",
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
bash pipeline/run_phase1.sh warrior-01   # 単体
bash pipeline/run_phase1.sh all          # 全部
```

- rembg (u2net) で背景除去。GPU/CPU 両対応
- グリッドセルを自動検出して個別 PNG に分離
- 出力: `from_creator/gemini/_extracted/<source-name>/`

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

## ToonCrafter 中割り生成 (HF Space)

キーフレーム間の中間フレームを AI 生成してアニメーションを滑らかにする。
ローカル実行は RTX 4060 では不可（→ HISTORY.md #5）。HF Space を使用する。

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
