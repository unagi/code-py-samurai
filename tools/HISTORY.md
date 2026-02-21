# tools/ — スプライトパイプライン開発履歴

## 確立したパイプライン

```
Gemini生成画像 (スプライトシート)
  ↓  LLMが画像内容を読解してリネーム (warrior-01.png, tiles-01.png 等)
  ↓  meta.json を作成 (グリッド構造・アニメーション名の定義)
  ↓  pipeline/phase1_extract.py — rembg (GPU/u2net) で背景除去 + グリッドセル分離
  ↓  pipeline/phase56_normalize_assemble.py — 正規化 + スプライトシート組み立て
  ↓  pipeline/phase8_frame_audit.py — フレーム品質監査
  ↓
完成スプライト → public/assets/
```

### 重要な前提
- Gemini生成画像はハッシュ名 (`Gemini_Generated_Image_xxx.png`) で納品される
- 人間がファイル名から内容を判別できないため、LLMが画像を見て意味のある名前に変更する工程が必須
- リネーム + meta.json 作成が Phase 1 の入口

### 背景除去: rembg (u2net)
- `pipeline/rembg_transparency.py` として単体ツール化済み
- デフォルトパラメータ (u2net, パラメータ調整なし) で十分な精度
- GPU (CUDA) / CPU 両対応

---

## 失敗した手法

### 1. ImageMagick flood-fill 透過 (extract_sprites.sh)
- **手法**: 画像の8点 (四隅 + 各辺中央) から flood-fill で背景を透明化
- **パラメータ**: `-fuzz 6%` (透過), `-fuzz 15%` (トリム), 下部10%カット (ラベル除去)
- **結果**: サムライ猫を含む全キャラ (15画像) の切り出しに成功
- **問題**: 全パラメータが手動チューニング。画像ごとに調整が必要で汎用性なし
- **教訓**: rembg の方がパラメータ不要で圧倒的に使いやすい

### 2. PIL 閾値ベース背景判定 (split_sprites.py)
- **手法**: `R<80,G<80,B<80` → 暗い背景、`R>140` かつ RGB差<25 → チェッカーボード、として透明化
- **結果**: idle/walk/tiles の切り出しに成功
- **問題**: 閾値がハードコード。画像の色味が変わると破綻

### 3. Node.js sharp 版 (split_sprites.mjs)
- **手法**: sharp ライブラリでグリッド分割
- **結果**: 精度不足で放棄。Python版に移行

### 4. PowerShell グリッド検出 (find_grid.ps1)
- **手法**: ImageMagick + PowerShell でグリッド線を検出
- **結果**: 文字化け問題 (Shift-JIS/UTF-8混在) で出力が読めず放棄

### 5. ToonCrafter 中割り生成 (ローカル RTX 4060)
- **目的**: キーフレーム間の中間フレームをAI生成し、アニメーションを滑らかにする
- **環境**: RTX 4060 (8GB VRAM), PyTorch 2.0+cu118, 10.5GB モデル
- **問題1**: xformers 0.0.27 が PyTorch 2.4 必須。SDPA fallback を実装したが全フレーム真っ黒
- **問題2**: fp32 だと VRAM 溢れ (21GB peak)、Windows WDDM で system RAM に退避するが42分/25steps
- **結論**: RTX 4060 では実用不可。HF Space (クラウド) 版は動作確認済み
- **成果物**: `preview/tooncrafter-preview.html` (HF Space生成フレームの確認用)

### 6. Lab 色空間 色補正 (color_correction.py)
- **目的**: ToonCrafter 出力の色ずれ (オレンジ耳問題等) を Reinhard color transfer で補正
- **結果**: 部分的に改善したが、根本的な品質改善には至らず

### 7. Stable Diffusion ControlNet フレーム補正 (sd_frame_correction.py)
- **目的**: SD + ControlNet (Canny/Lineart) でフレーム品質を改善
- **結果**: 実装途中で中断。フレーム間の一貫性維持が困難
