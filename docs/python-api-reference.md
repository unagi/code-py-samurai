# Python API Reference (Player / Warrior / Space)

現行実装（`src/runtime/python-player.ts`, `src/engine/*.ts`）に基づく、Python プレイヤー向け API リファレンスです。

## Conventions

- 方向引数は `RelativeDirection = "forward" | "right" | "backward" | "left"`
- アクションメソッドは 1 ターンに 1 回のみ実行可能
- 感知メソッドは同一ターン内で複数回呼び出し可能
- `feel()` / `look()` の空マス（階段含む）は `None` に正規化される

## Type Alias

### `RelativeDirection`

```text
"forward" | "right" | "backward" | "left"
```

## Class: `Player`

```java
/**
 * User-defined class executed by the game each turn.
 * 実装必須メソッドは play_turn(warrior) のみ。
 */
```

### `play_turn(self, warrior) -> None`

```java
/**
 * 1ターン分の行動を決定する。
 * @param warrior Warrior 現在ターンの操作対象。
 * @return None
 * @remarks 行動メソッド（walk/attack/rest...）はこのメソッド内で 1 回だけ実行できる。
 */
```

## Class: `Warrior`

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
 * @since GlobalLevel 3
 */
```

### Action Methods

```java
/**
 * Action methods are mutually exclusive within a turn.
 * @category action
 * @constraint one-action-per-turn
 * @apiNote 同一ターン内で複数の action メソッドを呼び出してはならない。
 * @implNote 現行実装は Python デコレーターではなく、ランタイム/エンジン側のターン状態管理
 *           （主に `src/engine/turn.ts` の `doAction()`）で制約を適用する。
 */
```

#### `walk(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向へ 1 マス移動する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 移動先が空でない場合は移動しない。
 * @since GlobalLevel 1
 */
```

#### `attack(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向の隣接マスを近接攻撃する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 後方攻撃はダメージが低下する（エンジン実装準拠）。
 * @since GlobalLevel 2
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
 * @since GlobalLevel 3
 */
```

#### `rescue(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向の捕虜を救出する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 捕虜でない対象には効果なし。
 * @since GlobalLevel 5
 */
```

#### `shoot(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向へ射撃する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 射程は 1〜3 マス。最初に見つかったユニットに命中する。
 * @since GlobalLevel 8
 */
```

#### `pivot(self, direction: RelativeDirection = "backward") -> None`

```java
/**
 * 向きを変更する。
 * @param direction RelativeDirection 回転先の相対方向。省略時は "backward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 既定値が "backward" である点に注意。
 * @since GlobalLevel 7
 */
```

#### `bind(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向の隣接ユニットを拘束する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 対象がいない場合は効果なし。
 * @since GlobalLevel 12
 */
```

#### `detonate(self, direction: RelativeDirection = "forward") -> None`

```java
/**
 * 指定方向に爆破攻撃を行う。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return None
 * @category action
 * @constraint one-action-per-turn
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 範囲ダメージ。爆発系ユニットには連鎖爆発が発生する場合がある。
 * @since GlobalLevel 17
 */
```

### Sense Methods

```java
/**
 * Sense methods may be called multiple times within a turn.
 * @category sense
 * @constraint repeatable-within-turn
 * @implNote 現行実装では action と sense を別系統で管理し、sense 呼び出し回数に制限は設けていない。
 */
```

#### `feel(self, direction: RelativeDirection = "forward") -> Space | None`

```java
/**
 * 指定方向の隣接 1 マスを感知する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return Space | None 対象（敵/捕虜/壁など）がある場合は Space、空マス（階段含む）は None。
 * @category sense
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks Python 仕様では is_empty() ではなく None 判定を使用する。
 * @since GlobalLevel 2
 */
```

#### `look(self, direction: RelativeDirection = "forward") -> list[Space | None]`

```java
/**
 * 指定方向の 1〜3 マス先を感知する。
 * @param direction RelativeDirection 相対方向。省略時は "forward"。
 * @return list[Space | None] 長さ 3 の配列。各要素は Space または None。
 * @category sense
 * @throws RuntimeError 不正な方向文字列を指定した場合。
 * @remarks 空マス（階段含む）は None に正規化される。
 * @since GlobalLevel 8
 */
```

#### `listen(self) -> list[Space]`

```java
/**
 * フロア上の他ユニットの位置を取得する。
 * @return list[Space] 他ユニットが存在するマスの Space 配列。None は含まない。
 * @category sense
 * @remarks 自分自身は含まない。
 * @since GlobalLevel 13
 */
```

#### `direction_of_stairs(self) -> RelativeDirection`

```java
/**
 * 階段の方向を相対方向で返す。
 * @return RelativeDirection 階段の方向。
 * @category sense
 * @since GlobalLevel 10
 */
```

#### `direction_of(self, space: Space) -> RelativeDirection`

```java
/**
 * 指定した Space の方向を相対方向で返す。
 * @param space Space 対象マス。通常は feel()/look()/listen() の戻り値を使用する。
 * @return RelativeDirection 対象マスの方向。
 * @category sense
 * @throws RuntimeError None や不正なオブジェクトを渡した場合。
 * @since GlobalLevel 13
 */
```

#### `distance_of(self, space: Space) -> int`

```java
/**
 * 指定した Space までの距離を返す。
 * @param space Space 対象マス。通常は feel()/look()/listen() の戻り値を使用する。
 * @return int マンハッタン距離。
 * @category sense
 * @throws RuntimeError None や不正なオブジェクトを渡した場合。
 * @since GlobalLevel 18
 */
```

### Not Exposed (Current Python Runtime)

#### `form(self, ...)`

```java
/**
 * エンジン内部には能力実装が存在するが、現行の通常レベル進行では Python Warrior API として未公開。
 * @remarks src/runtime/python-player.ts の ACTION_ENTRIES に未登録。
 */
```

## Class: `Space`

```java
/**
 * Map cell / target descriptor returned by sense APIs.
 * 周囲マスやユニットの状態判定に使用する。
 */
```

### Acquisition

```java
/**
 * 取得元一覧
 * @source Warrior.feel(...)   -> Space | None
 * @source Warrior.look(...)   -> list[Space | None]
 * @source Warrior.listen()    -> list[Space]
 */
```

### `is_enemy(self) -> bool`

```java
/**
 * マス上の対象が敵ユニットかを判定する。
 * @return bool 敵ユニットなら True。
 */
```

### `is_captive(self) -> bool`

```java
/**
 * マス上の対象が捕虜（拘束状態）かを判定する。
 * @return bool 捕虜なら True。
 */
```

### `is_stairs(self) -> bool`

```java
/**
 * マスが階段かを判定する。
 * @return bool 階段なら True。
 * @remarks 現行 Python 仕様では階段マスは feel()/look() で None に正規化されるため、実運用で呼ぶ機会は少ない。
 */
```

### `is_wall(self) -> bool`

```java
/**
 * マスが壁（場外）かを判定する。
 * @return bool 壁なら True。
 */
```

### `is_ticking(self) -> bool`

```java
/**
 * マス上の対象が時限爆弾状態かを判定する。
 * @return bool 時限爆弾付きユニットなら True。
 * @remarks 典型用途は is_captive() と組み合わせた優先救出判定（中級6 / GlobalLevel 15）。
 */
```

## Availability Table (Global Level)

| GlobalLevel | Local (Intermediate) | API |
|---|---:|---|
| 1 | - | `walk()` |
| 2 | - | `feel()`, `attack()` |
| 3 | - | `rest()`, `hp` |
| 5 | - | `rescue()` |
| 7 | - | `pivot()` |
| 8 | - | `look()`, `shoot()` |
| 10 | 1 | `direction_of_stairs()` |
| 12 | 3 | `bind()` |
| 13 | 4 | `listen()`, `direction_of(space)` |
| 17 | 8 | `detonate()` |
| 18 | 9 | `distance_of(space)` |

## Related

- `docs/rubywarrior-to-pythonic.md`
