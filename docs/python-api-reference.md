# Python API リファレンス（ゲーム内クラス）

このドキュメントは、プレイヤーコード（Python）から利用できる主要クラスの参照です。
現行実装（`src/runtime/python-player.ts` / `src/engine/*.ts`）に合わせて記載しています。

## 対象クラス

- `Player`（ユーザーが定義するクラス）
- `Warrior`（各ターンで渡される操作対象）
- `Space`（周囲のマスを表すオブジェクト）

## まず重要なポイント

- `warrior.feel()` は `Space` を返すとは限らず、空マス（階段含む）は `None`
- `Space` を得る主な方法は `feel()` / `look()` / `listen()`
- 方向引数は `"forward" | "right" | "backward" | "left"`
- 1ターンに実行できるアクションは 1 つだけ

## 型イメージ（Python）

```python
from typing import Literal, Optional

RelativeDirection = Literal["forward", "right", "backward", "left"]

class Player:
    def play_turn(self, warrior: "Warrior") -> None: ...

class Warrior:
    hp: int

    def walk(self, direction: RelativeDirection = "forward") -> None: ...
    def attack(self, direction: RelativeDirection = "forward") -> None: ...
    def rest(self) -> None: ...
    def rescue(self, direction: RelativeDirection = "forward") -> None: ...
    def shoot(self, direction: RelativeDirection = "forward") -> None: ...
    def pivot(self, direction: RelativeDirection = "backward") -> None: ...
    def bind(self, direction: RelativeDirection = "forward") -> None: ...
    def detonate(self, direction: RelativeDirection = "forward") -> None: ...

    def feel(self, direction: RelativeDirection = "forward") -> Optional["Space"]: ...
    def look(self, direction: RelativeDirection = "forward") -> list[Optional["Space"]]: ...
    def listen(self) -> list["Space"]: ...
    def direction_of_stairs(self) -> RelativeDirection: ...
    def direction_of(self, space: "Space") -> RelativeDirection: ...
    def distance_of(self, space: "Space") -> int: ...

class Space:
    def is_enemy(self) -> bool: ...
    def is_captive(self) -> bool: ...
    def is_stairs(self) -> bool: ...
    def is_wall(self) -> bool: ...
    def is_ticking(self) -> bool: ...
```

## `class Player`

ユーザーが実装するクラスです。ゲーム側は毎ターン `play_turn()` を呼びます。

### `play_turn(warrior) -> None`

- 引数 `warrior`: そのターンに操作する `Warrior`
- 戻り値: `None`
- 役割: 1ターン分の行動を決める

基本形:

```python
class Player:
    def play_turn(self, warrior):
        space = warrior.feel()
        if space is None:
            warrior.walk()
        elif space.is_enemy():
            warrior.attack()
        else:
            warrior.walk()
```

## `class Warrior`

プレイヤーコードから毎ターン渡されるオブジェクトです。行動（action）と感知（sense）を行います。

### 属性

#### `hp: int`

- 現在HP（体力）

例:

```python
if warrior.hp < 8:
    warrior.rest()
```

### アクションメソッド（1ターンに1つ）

以下は行動メソッドです。1ターンに複数呼ぶと失敗します。

| メソッド | シグネチャ | 概要 |
|---|---|---|
| `walk` | `walk(direction="forward") -> None` | 指定方向へ1マス移動（空いている場合） |
| `attack` | `attack(direction="forward") -> None` | 隣接マスを近接攻撃 |
| `rest` | `rest() -> None` | HP回復 |
| `rescue` | `rescue(direction="forward") -> None` | 捕虜を救出 |
| `shoot` | `shoot(direction="forward") -> None` | 直線1〜3マス先を射撃（最初の対象に命中） |
| `pivot` | `pivot(direction="backward") -> None` | 向きを変更（既定は後ろ向き） |
| `bind` | `bind(direction="forward") -> None` | 隣接ユニットを拘束 |
| `detonate` | `detonate(direction="forward") -> None` | 爆破攻撃（範囲ダメージ） |

注記:

- 方向引数を省略した場合の既定値はメソッドごとに異なります（`pivot()` だけ `"backward"`）
- `form()` はエンジン内部にありますが、現行の通常レベル進行では未解放です（このリファレンスでは実戦用 API を優先して省略）

### 感知メソッド（同一ターン内で複数回可）

#### `feel(direction="forward") -> Space | None`

隣接1マスを調べます。

- 敵・捕虜・壁など「対象がある」場合: `Space`
- 空マス（階段含む）: `None`

安全な書き方:

```python
space = warrior.feel()
if space is None:
    warrior.walk()
elif space.is_enemy():
    warrior.attack()
```

#### `look(direction="forward") -> list[Space | None]`

指定方向の 1〜3 マス先を配列で返します（長さ 3）。

- 各要素は `feel()` と同様に `Space` または `None`
- 例: `spaces[0]` は1マス先

```python
spaces = warrior.look("forward")
first = spaces[0]
if first is not None and first.is_enemy():
    warrior.shoot()
```

#### `listen() -> list[Space]`

フロア上の他ユニットの位置を `Space` の配列で返します。

- 自分自身は含みません
- `None` は含みません（ユニットのいるマスだけ返る）

```python
for unit in warrior.listen():
    if unit.is_captive():
        direction = warrior.direction_of(unit)
        warrior.walk(direction)
        break
```

#### `direction_of_stairs() -> RelativeDirection`

階段の方向（相対方向）を返します。

```python
warrior.walk(warrior.direction_of_stairs())
```

#### `direction_of(space) -> RelativeDirection`

指定した `Space` がある方向（相対方向）を返します。

- `space` は通常 `listen()` / `look()` / `feel()` で取得したものを渡します

#### `distance_of(space) -> int`

指定した `Space` までの距離を返します。

- 距離はマンハッタン距離です
- `space` は通常 `listen()` / `look()` / `feel()` で取得したものを渡します

## `class Space`

周囲のマスやユニットの情報を表すオブジェクトです。

### `Space` をどこで得るか

| 取得元 | 戻り値 |
|---|---|
| `warrior.feel(...)` | `Space | None` |
| `warrior.look(...)` | `list[Space | None]` |
| `warrior.listen()` | `list[Space]` |

### メソッド

#### `is_enemy() -> bool`

そのマスに敵ユニットがいるかどうか。

#### `is_captive() -> bool`

そのマスに捕虜（拘束されたユニット）がいるかどうか。

#### `is_wall() -> bool`

そのマスが壁（場外）かどうか。

#### `is_ticking() -> bool`

時限爆弾つきユニット（爆発カウント中）かどうか。

Lv15（中級6）のような「時限爆弾付き捕虜」対策では、`is_captive()` と組み合わせます。

```python
space = warrior.feel("left")
if space is not None and space.is_captive() and space.is_ticking():
    warrior.rescue("left")
```

#### `is_stairs() -> bool`

そのマスが階段かどうか。

注意:

- Python 仕様では空マス（階段含む）は `None` になるため、`feel()` / `look()` では `is_stairs()` を使う機会は少なめです
- 階段探索は `warrior.direction_of_stairs()` を使うのが基本です

### Python では使わない（または非公開）判定

- `is_empty()` は使いません（Python では `space is None` を使う）
- エンジン内部の `camelCase` 名は Python では `snake_case` に変換されています

## レベル解放（主要 API）

メソッドはレベル進行で順次解放されます。特に中級塔はグローバルLv10開始です。

- 例: 中級6 = グローバルLv15

| グローバルLv | 中級塔ローカルLv | 解放される主な API |
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

## 関連ドキュメント

- `docs/rubywarrior-to-pythonic.md`（RubyWarrior 由来仕様との差分）

