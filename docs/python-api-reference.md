# Python API Reference (Player / Samurai / Space)

このドキュメントは、学習者向け Python API の仕様（ドキュメント先行）です。

## Conventions

- 方向は `Direction` を使う（`FORWARD`, `RIGHT`, `BACKWARD`, `LEFT`）
- 地形は `Terrain` を使う（`FLOOR`, `WALL`, `STAIRS`）
- ユニット種別は `UnitKind` を使う（`ENEMY`, `CAPTIVE`, `ALLY`）
- アクションメソッドは 1 ターンに 1 回のみ実行可能
- 感知メソッドは同一ターン内で複数回呼び出し可能
- `feel()` / `look()` は常に `Space` を返す（空マスは `space.unit is None` で判定する）

## Enum: `Direction`

```java
/**
 * Samurai API で使用する相対方向。
 * @values FORWARD | RIGHT | BACKWARD | LEFT
 */
```

## Enum: `Terrain`

```java
/**
 * Space の地形種別。
 * @values FLOOR | WALL | STAIRS
 */
```

## Enum: `UnitKind`

```java
/**
 * Space にいるユニットの種別。
 * @values ENEMY | CAPTIVE | ALLY
 */
```

## Class: `Player`

```java
/**
 * User-defined class executed by the game each turn.
 * 実装必須メソッドは play_turn(samurai) のみ。
 */
```

### `play_turn(self, samurai) -> None`

```java
/**
 * 1ターン分の行動を決定する。
 * @param samurai Samurai 現在ターンの操作対象。
 * @return None
 * @remarks 行動メソッド（walk/attack/rest...）はこのメソッド内で 1 回だけ実行できる。
 */
```

## Class: `Samurai`

```java
/**
 * Turn-scoped control object passed to Player.play_turn().
 * 行動（Action）と感知（Sense）APIを提供する。
 */
```

### Property: `hp: int`

```java
/**
 * 現在HP。
 * @type int
 * @since Level 3
 */
```

### Action Methods

```java
/**
 * Action methods are mutually exclusive within a turn.
 * @category action
 * @constraint one-action-per-turn
 * @apiNote 同一ターン内で複数の action メソッドを呼び出してはならない。
 */
```

#### `walk(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向へ 1 マス移動する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 移動先が空でない場合は移動しない。
 * @since Level 1
 */
```

#### `attack(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向の隣接マスを近接攻撃する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 後方攻撃はダメージが低下する。
 * @since Level 2
 */
```

#### `rest(self) -> None`

```java
/**
 * HPを回復する。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @remarks 最大HP時は回復しない。
 * @since Level 3
 */
```

#### `rescue(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向の捕虜を救出する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 捕虜でない対象には効果なし。
 * @since Level 5
 */
```

#### `shoot(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向へ射撃する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 射程は 1〜3 マス。最初に見つかったユニットに命中する。
 * @since Level 8
 */
```

#### `pivot(self, direction: Direction = Direction.BACKWARD) -> None`

```java
/**
 * 向きを変更する。
 * @param direction Direction 回転先の相対方向。省略時は `Direction.BACKWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 既定値が `Direction.BACKWARD` である点に注意。
 * @since Level 7
 */
```

#### `bind(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向の隣接ユニットを拘束する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 対象がいない場合は効果なし。
 * @since Level 12
 */
```

#### `detonate(self, direction: Direction = Direction.FORWARD) -> None`

```java
/**
 * 指定方向に爆破攻撃を行う。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 無効な方向を指定した場合。
 * @remarks 範囲ダメージ。爆発系ユニットには連鎖爆発が発生する場合がある。
 * @since Level 17
 */
```

### Sense Methods

```java
/**
 * Sense methods may be called multiple times within a turn.
 * @category sense
 * @constraint repeatable-within-turn
 */
```

#### `feel(self, direction: Direction = Direction.FORWARD) -> Space`

```java
/**
 * 指定方向の隣接 1 マスを感知する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return Space 感知したマス。
 * @category sense
 * @throws RuntimeError 無効な方向を指定した場合。
 * @apiNote 空マス判定は `space.unit is None` を使用する。
 * @since Level 2
 */
```

#### `look(self, direction: Direction = Direction.FORWARD) -> list[Space]`

```java
/**
 * 指定方向の 1〜3 マス先を感知する。
 * @param direction Direction 相対方向。省略時は `Direction.FORWARD`。
 * @return list[Space] 長さ 3 の配列。各要素は Space。
 * @category sense
 * @throws RuntimeError 無効な方向を指定した場合。
 * @apiNote 空マス判定は各要素の `space.unit is None` を使用する。
 * @since Level 8
 */
```

#### `listen(self) -> list[Space]`

```java
/**
 * フロア上の他ユニットの位置を取得する。
 * @return list[Space] 他ユニットが存在するマスの Space 配列。
 * @category sense
 * @remarks 自分自身は含まない。
 * @guarantee 返される各 `Space` では `space.unit is not None`。
 * @since Level 13
 */
```

#### `direction_of_stairs(self) -> Direction`

```java
/**
 * 階段の方向を相対方向で返す。
 * @return Direction 階段の方向。
 * @category sense
 * @since Level 10
 */
```

#### `direction_of(self, space: Space) -> Direction`

```java
/**
 * 指定した Space の方向を相対方向で返す。
 * @param space Space 対象マス。
 * @return Direction 対象マスの方向。
 * @category sense
 * @throws RuntimeError 無効な Space を渡した場合。
 * @since Level 13
 */
```

#### `distance_of(self, space: Space) -> int`

```java
/**
 * 指定した Space までの距離を返す。
 * @param space Space 対象マス。
 * @return int マンハッタン距離。
 * @category sense
 * @throws RuntimeError 無効な Space を渡した場合。
 * @since Level 18
 */
```

## Class: `Space`

```java
/**
 * A map cell.
 * 地形（terrain）と占有ユニット（unit）を保持する。
 */
```

### Property: `terrain: Terrain`

```java
/**
 * このマスの地形。
 * @type Terrain
 * @remarks `FLOOR`, `WALL`, `STAIRS` のいずれか。
 */
```

### Property: `unit: Occupant | None`

```java
/**
 * このマスにいるユニット。
 * @type Occupant | None
 * @remarks 空マスなら None。
 * @apiNote 階段の上にユニットがいる場合、`terrain == Terrain.STAIRS` かつ `unit is not None` になりうる。
 */
```

## Class: `Occupant`

```java
/**
 * Space 上のユニットを表す読み取り専用オブジェクト。
 */
```

### Property: `kind: UnitKind`

```java
/**
 * ユニット種別。
 * @type UnitKind
 */
```

### Property: `ticking: bool`

```java
/**
 * 時限爆弾状態かどうか。
 * @type bool
 * @remarks 典型用途は `kind == UnitKind.CAPTIVE` と組み合わせた優先救出判定。
 */
```

## Availability by Level

| Level | API |
|---:|---|
| 1 | `walk()` |
| 2 | `feel()`, `attack()` |
| 3 | `rest()`, `hp` |
| 5 | `rescue()` |
| 7 | `pivot()` |
| 8 | `look()`, `shoot()` |
| 10 | `direction_of_stairs()` |
| 12 | `bind()` |
| 13 | `listen()`, `direction_of(space)` |
| 17 | `detonate()` |
| 18 | `distance_of(space)` |
