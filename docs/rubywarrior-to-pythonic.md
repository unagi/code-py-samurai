# RubyWarrior から Pythonic 仕様へ変更した点

このプロジェクトは RubyWarrior をベースにしつつ、Python 初学者向けに一部 API を変更しています。

関連:

- `docs/python-api-reference.md`（`Player` / `Warrior` / `Space` の参照）

## 方針

- Ruby 由来の表現より、Python で読みやすい表現を優先する
- 「空かどうか」の判定は `None` で統一する
- 旧仕様のメソッドチェーン依存を減らす

## ドキュメント方針（学習者向け）

このプロジェクトでは、学習者向けドキュメント（例: `docs/python-api-reference.md`）について、
実装都合よりも「学習者が理解しやすい API 契約」を優先して記述します。

- 実装詳細（内部表現・互換のための受け入れ・ランタイム都合）は原則として前面に出さない
- 公式の説明は型安全で読みやすい書き方を優先する（例: `Direction.LEFT`）
- `Space` は「判定メソッドの集合」よりも「地形 + 占有ユニット」の概念モデルで説明する
  - 理由: 「階段の上に敵がいる」などの複合状態を自然に表現できるため
- レベル解放の説明は、学習者が画面で見るレベル番号を基準にする
  - `GlobalLevel` や塔ローカル番号など内部都合の表現は使わない
- 実行エンジンに Skulpt を使う都合上、内部実装は CPython 的な理想形と少し異なることがある
  - ただし、学習者向けに公開する API 契約（名前・意味・使い方）は守る
  - ドキュメントはこの「公開契約」を基準に記述し、実装都合は必要最小限のみ扱う

この方針により、学習者には一貫したモデルを提示しつつ、実装側は段階的に改善できるようにします。

## 主な差分

### 1. `feel()` の戻り値

- 旧（RubyWarrior 的）:
  - `warrior.feel()` は常に `Space` を返す
  - 例: `warrior.feel().is_empty()`
- 現在（Pythonic）:
  - 空マス（階段含む）なら `None`
  - 敵/捕虜/壁など対象があるときは `Space` 相当オブジェクト

推奨例:

```python
space = warrior.feel()
if space is None:
    warrior.walk()
else:
    warrior.attack()
```

### 2. 空判定 API

- 旧:
  - `space.is_empty()`
- 現在:
  - `space is None`

注意:

- `warrior.feel().is_empty()` は使用しない
- `space` が `None` でないことを確認してから `space.is_enemy()` などを呼ぶ

### 3. 命名

- Python 側は `snake_case` を使用
  - 例: `warrior.direction_of_stairs()`
- エンジン内部の camelCase はランタイム層で吸収する

## 実装・教材上のガイドライン

- 新しいレベル文・Tips・サンプルコードは `is None` を使う
- `is_empty()` 前提の説明は追加しない
- 条件分岐は次の順を推奨する
  1. `space = warrior.feel()`
  2. `if space is None:`
  3. `elif space.is_enemy():` のように対象別に分岐

## 互換性メモ

- この変更は Python レイヤーの仕様変更であり、既存の RubyWarrior 互換表現とは異なる
- 学習体験の一貫性を優先し、Python 初学者にとって自然な書き方に寄せている
