# Asset Workspace

`SPRITE_SPEC.md` に沿って、画像作業は次の3段階で運用します。

## ディレクトリ

- `assets/incoming/raw/`
  - 納品された原本（未加工）を置く場所
- `assets/review/sessions/YYYY-MM-DD/`
  - 透過処理・比較画像など、動作確認用の中間生成物
- `assets/delivery/`
  - `final/` が採用確定版（Git管理対象）
  - `staging/` `mapped/` は中間生成物（Git管理対象外）
- `public/assets/`
  - アプリが実際に読み込む本番配置
  - `sprites/` `tiles/` `effects/` `ui/`

## 推奨フロー

1. 納品物を `assets/incoming/raw/` に格納
2. 加工・比較を `assets/review/sessions/YYYY-MM-DD/` で実施
3. 採用版を `assets/delivery/final/` に集約
4. 実装反映時に `public/assets/` へ同期

## 補足

- 中間作業ログは `assets/review/sessions/` 配下に出力し、必要時のみローカル参照する
- `public/assets/sprites/` の第一階層は `role` 名で統一する（`warrior`, `sludge`, `thick-sludge`, `archer`, `wizard`, `captive`, `golem`）
- 迷うパックは `unknown` に置き、`assets/specs/role-pack-overrides.tsv` で確定後に再配置する
