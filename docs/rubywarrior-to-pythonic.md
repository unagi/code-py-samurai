# RubyWarrior から Pythonic 仕様へ変更した点

このプロジェクトは RubyWarrior をベースにしつつ、Python 初学者向けに一部 API を変更しています。

関連:

- `docs/python-api-reference.md`（`Player` / `Warrior` / `Space` の参照）

## 方針

- Ruby 由来の表現より、Python で読みやすい表現を優先する
- 判定メソッドの列挙より、型と属性で読めるクラス設計を優先する
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

### 1. 方向の表現（`Direction` の導入）

- 旧（RubyWarrior 的）:
  - 方向は文字列表現（Ruby 側ではシンボル相当）を直接渡して扱う
  - 例: `warrior.walk(:left)` / `warrior.feel(:forward)`
- 現在（Pythonic 仕様）:
  - `Direction` を使って方向を表す
  - 例: `warrior.walk(Direction.LEFT)` / `warrior.feel(Direction.FORWARD)`

狙い:

- 「取りうる値の集合」をコード上で明示する
- 学習者に型安全な書き方を先に提示する

### 2. `Space` のモデル（地形 + 占有ユニット）

- 旧（RubyWarrior 的）:
  - `Space` に対する判定メソッドで状態を読む（例: `is_empty?`, `is_wall?`, `is_enemy?`）
- 現在（Pythonic 仕様）:
  - `Space` は「マス（セル）」として扱う
  - 地形は `space.terrain`
  - ユニットは `space.unit`

これにより、複合状態を自然に表現できる:

- 例: 階段の上に敵がいる
  - `space.terrain == Terrain.STAIRS`
  - `space.unit is not None`
  - `space.unit.kind == UnitKind.ENEMY`

### 3. 空判定・対象判定の書き方

- 旧（RubyWarrior 的）:
  - `space.is_empty?`
  - `space.is_enemy?`
  - `space.is_captive?`
- 現在（Pythonic 仕様）:
  - 空判定: `space.unit is None`
  - 対象判定: `space.unit.kind == UnitKind.ENEMY` など
  - 状態判定: `space.unit.ticking`

推奨例:

```python
space = warrior.feel(Direction.FORWARD)
if space.unit is None:
    warrior.walk(Direction.FORWARD)
elif space.unit.kind == UnitKind.ENEMY:
    warrior.attack(Direction.FORWARD)
```

### 4. 命名

- Python 側は `snake_case` を使用
  - 例: `warrior.direction_of_stairs()`
- 型・列挙は Python らしい `PascalCase` / `UPPER_CASE` を使用
  - 例: `Direction.LEFT`, `Terrain.STAIRS`, `UnitKind.CAPTIVE`
- エンジン内部の camelCase はランタイム層で吸収する

## 実装・教材上のガイドライン

- 新しいレベル文・Tips・サンプルコードは `Direction` / `Terrain` / `UnitKind` を使う
- `Space` の説明は `terrain` と `unit` を中心に行う
- `is_empty()` / `is_enemy()` など判定メソッド前提の説明は追加しない
- 条件分岐は次の順を推奨する
  1. `space = warrior.feel(Direction.FORWARD)`
  2. `if space.unit is None:`
  3. `elif space.unit.kind == UnitKind.ENEMY:` のように対象別に分岐

## 互換性メモ

- この変更は Python レイヤーの仕様変更であり、既存の RubyWarrior 互換表現とは異なる
- 学習体験の一貫性を優先し、Python 初学者にとって自然な書き方に寄せている
