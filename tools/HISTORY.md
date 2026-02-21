# tools/ — 失敗した手法の記録

試して失敗・放棄した手法のログ。同じ轍を踏まないための参考資料。

---

## 1. ImageMagick flood-fill 透過
- **手法**: 画像の8点 (四隅 + 各辺中央) から flood-fill で背景を透明化
- **パラメータ**: `-fuzz 6%` (透過), `-fuzz 15%` (トリム), 下部10%カット (ラベル除去)
- **結果**: サムライ猫を含む全キャラ (15画像) の切り出しに成功
- **問題**: 全パラメータが手動チューニング。画像ごとに調整が必要で汎用性なし
- **教訓**: rembg の方がパラメータ不要で圧倒的に使いやすい

## 2. PIL 閾値ベース背景判定
- **手法**: `R<80,G<80,B<80` → 暗い背景、`R>140` かつ RGB差<25 → チェッカーボード、として透明化
- **結果**: idle/walk/tiles の切り出しに成功
- **問題**: 閾値がハードコード。画像の色味が変わると破綻

## 3. Node.js sharp 版グリッド分割
- **手法**: sharp ライブラリでグリッド分割
- **結果**: 精度不足で放棄。Python版に移行

## 4. PowerShell グリッド検出
- **手法**: ImageMagick + PowerShell でグリッド線を検出
- **結果**: 文字化け問題 (Shift-JIS/UTF-8混在) で出力が読めず放棄

## 5. ToonCrafter ローカル推論 (RTX 4060)
- **目的**: キーフレーム間の中間フレームをAI生成し、アニメーションを滑らかにする
- **環境**: RTX 4060 (8GB VRAM), PyTorch 2.0+cu118, 10.5GB モデル
- **問題1**: xformers 0.0.27 が PyTorch 2.4 必須。SDPA fallback を実装したが全フレーム真っ黒
- **問題2**: fp32 だと VRAM 溢れ (21GB peak)、Windows WDDM で system RAM に退避するが 42分/25steps
- **結論**: RTX 4060 では実用不可。HF Space (クラウド) 版を使うこと → PIPELINE.md 参照

## 6. Lab 色空間 色補正
- **目的**: ToonCrafter 出力の色ずれ (オレンジ耳問題等) を Reinhard color transfer で補正
- **結果**: 部分的に改善したが、根本的な品質改善には至らず

## 7. Stable Diffusion ControlNet フレーム補正
- **目的**: SD + ControlNet (Canny/Lineart) でフレーム品質を改善
- **結果**: 実装途中で中断。フレーム間の一貫性維持が困難
