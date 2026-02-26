export type LocaleCode = "ja" | "en";

export interface LocalizedText {
  ja: string;
  en: string;
}

export interface ReferenceTag {
  name: string;
  value: LocalizedText;
}

export interface ReferenceItem {
  id: string;
  kind: "enum" | "class" | "method" | "property" | "group";
  name: string;
  owner?: string;
  signature?: string;
  description: LocalizedText;
  tags?: ReferenceTag[];
  examples?: LocalizedText;
}

export interface ReferenceSection {
  id: string;
  title: LocalizedText;
  intro?: LocalizedText;
  items: ReferenceItem[];
}

export interface ApiReferenceDocument {
  title: string;
  conventionsTitle: LocalizedText;
  conventions: LocalizedText[];
  sections: ReferenceSection[];
}

const t = (ja: string, en: string): LocalizedText => ({ ja, en });

export const apiReferenceDocument: ApiReferenceDocument = {
  title: "Python API Reference (Player / Samurai / Space)",
  conventionsTitle: t("規約", "Conventions"),
  conventions: [
    t("方向は `Direction` を使う（`FORWARD`, `RIGHT`, `BACKWARD`, `LEFT`）", "Use `Direction` (`FORWARD`, `RIGHT`, `BACKWARD`, `LEFT`) for relative directions."),
    t("地形は `Terrain` を使う（`FLOOR`, `WALL`, `STAIRS`）", "Use `Terrain` (`FLOOR`, `WALL`, `STAIRS`) for map terrain."),
    t("ユニット種別は `UnitKind` を使う（`ENEMY`, `CAPTIVE`, `ALLY`）", "Use `UnitKind` (`ENEMY`, `CAPTIVE`, `ALLY`) for occupant categories."),
    t("アクションメソッドは 1 ターンに 1 回のみ実行可能", "Action methods can be executed only once per turn."),
    t("感知メソッドは同一ターン内で複数回呼び出し可能", "Sense methods may be called multiple times within a turn."),
    t("`feel()` / `look()` は常に `Space` を返す（空マスは `space.unit is None` で判定する）", "`feel()` / `look()` always return `Space`; detect empty cells with `space.unit is None`."),
    t("無効な `Direction` を渡すと `RuntimeError` が発生する", "Passing an invalid `Direction` raises `RuntimeError`."),
    t("無効な `Space` を渡すと `RuntimeError` が発生する", "Passing an invalid `Space` raises `RuntimeError`."),
  ],
  sections: [
    {
      id: "direction-enum",
      title: t("Direction", "Direction"),
      items: [
        {
          id: "direction",
          kind: "enum",
          name: "Direction",
          signature: "enum Direction { FORWARD, RIGHT, BACKWARD, LEFT }",
          description: t("Samurai API で使用する相対方向。", "Relative direction values used by the Samurai API."),
        },
      ],
    },
    {
      id: "terrain-enum",
      title: t("Terrain", "Terrain"),
      items: [
        {
          id: "terrain",
          kind: "enum",
          name: "Terrain",
          signature: "enum Terrain { FLOOR, WALL, STAIRS }",
          description: t("Space の地形種別。", "Terrain type of a Space."),
        },
      ],
    },
    {
      id: "unitkind-enum",
      title: t("UnitKind", "UnitKind"),
      items: [
        {
          id: "unitkind",
          kind: "enum",
          name: "UnitKind",
          signature: "enum UnitKind { ENEMY, CAPTIVE, ALLY }",
          description: t("Space にいるユニットの種別。", "Unit category stored in `Space.unit`."),
        },
      ],
    },
    {
      id: "samurai-class",
      title: t("Class: Samurai", "Class: Samurai"),
      items: [
        {
          id: "samurai",
          kind: "class",
          name: "Samurai",
          signature: "class Samurai",
          description: t(
            "Player.play_turn() に渡されるターン限定の操作オブジェクト。行動（Action）と感知（Sense）APIを提供する。",
            "Turn-scoped control object passed to Player.play_turn(). Provides Action and Sense APIs.",
          ),
        },
        {
          id: "samurai-hp",
          kind: "property",
          owner: "Samurai",
          name: "hp",
          signature: "hp: int",
          description: t("現在HP。", "Current HP."),
          tags: [{ name: "@type", value: t("int", "int") }, { name: "@since", value: t("Level 3", "Level 3") }],
          examples: t("health = samurai.hp  # 現在のHP", "health = samurai.hp  # current HP"),
        },
        {
          id: "samurai-max-hp",
          kind: "property",
          owner: "Samurai",
          name: "max_hp",
          signature: "max_hp: int  # read-only",
          description: t("最大HP（変更不可）。", "Maximum HP (read-only)."),
          tags: [{ name: "@type", value: t("int", "int") }],
          examples: t("samurai.max_hp  # 20", "samurai.max_hp  # 20"),
        },
        {
          id: "samurai-atk",
          kind: "property",
          owner: "Samurai",
          name: "atk",
          signature: "atk: int  # read-only",
          description: t("攻撃力（変更不可）。", "Attack power (read-only)."),
          tags: [{ name: "@type", value: t("int", "int") }],
          examples: t("samurai.atk  # 5", "samurai.atk  # 5"),
        },
        {
          id: "samurai-action-methods",
          kind: "group",
          name: "Action Methods",
          description: t(
            "Action methods は同一ターン内で相互排他。複数の action メソッドを呼び出してはならない。",
            "Action methods are mutually exclusive within a turn. Do not call multiple action methods in the same turn.",
          ),
          tags: [
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
          ],
        },
        {
          id: "samurai-walk",
          kind: "method",
          owner: "Samurai",
          name: "walk",
          signature: "walk(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向へ 1 マス移動する。移動先が空でない場合は移動しない。", "Move one tile in the specified direction. Does not move if the destination is not empty."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 1", "Level 1") },
          ],
          examples: t(
            "samurai.walk()               # 前に歩く\nsamurai.walk(Direction.LEFT)  # 左に歩く",
            "samurai.walk()               # walk forward\nsamurai.walk(Direction.LEFT)  # walk left",
          ),
        },
        {
          id: "samurai-attack",
          kind: "method",
          owner: "Samurai",
          name: "attack",
          signature: "attack(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の隣接マスを近接攻撃する。後方攻撃はダメージが低下する。", "Melee attack the adjacent tile in the specified direction. Backward attacks deal reduced damage."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 2", "Level 2") },
          ],
          examples: t(
            "samurai.attack()                # 前方を攻撃\nsamurai.attack(Direction.RIGHT)  # 右を攻撃",
            "samurai.attack()                # attack forward\nsamurai.attack(Direction.RIGHT)  # attack right",
          ),
        },
        {
          id: "samurai-rest",
          kind: "method",
          owner: "Samurai",
          name: "rest",
          signature: "rest(self) -> None",
          description: t("HPを回復する。最大HP時は回復しない。", "Recover HP. No effect at max HP."),
          tags: [
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 3", "Level 3") },
          ],
          examples: t("samurai.rest()  # HPを回復", "samurai.rest()  # recover HP"),
        },
        {
          id: "samurai-rescue",
          kind: "method",
          owner: "Samurai",
          name: "rescue",
          signature: "rescue(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の捕虜を救出する。捕虜でない対象には効果なし。", "Rescue a captive in the specified direction. No effect on non-captive targets."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 5", "Level 5") },
          ],
          examples: t(
            "samurai.rescue()               # 前方の捕虜を救出\nsamurai.rescue(Direction.LEFT)  # 左の捕虜を救出",
            "samurai.rescue()               # rescue captive ahead\nsamurai.rescue(Direction.LEFT)  # rescue captive left",
          ),
        },
        {
          id: "samurai-shoot",
          kind: "method",
          owner: "Samurai",
          name: "shoot",
          signature: "shoot(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向へ射撃する。射程は 1〜3 マス。最初に見つかったユニットに命中する。", "Shoot in the specified direction. Range is 1-3 tiles and it hits the first unit found."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 8", "Level 8") },
          ],
          examples: t(
            "samurai.shoot()               # 前方に射撃\nsamurai.shoot(Direction.LEFT)  # 左に射撃",
            "samurai.shoot()               # shoot forward\nsamurai.shoot(Direction.LEFT)  # shoot left",
          ),
        },
        {
          id: "samurai-pivot",
          kind: "method",
          owner: "Samurai",
          name: "pivot",
          signature: "pivot(self, direction: Direction = Direction.BACKWARD) -> None",
          description: t("向きを変更する。既定値が `Direction.BACKWARD` である点に注意。", "Change facing direction. Note that the default is `Direction.BACKWARD`."),
          tags: [
            { name: "@param direction", value: t("Direction 回転先の相対方向。省略時は `Direction.BACKWARD`。", "Direction to rotate to. Defaults to `Direction.BACKWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 7", "Level 7") },
          ],
          examples: t(
            "samurai.pivot()               # 後ろを向く\nsamurai.pivot(Direction.LEFT)  # 左を向く",
            "samurai.pivot()               # turn around\nsamurai.pivot(Direction.LEFT)  # face left",
          ),
        },
        {
          id: "samurai-bind",
          kind: "method",
          owner: "Samurai",
          name: "bind",
          signature: "bind(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の隣接ユニットを拘束する。対象がいない場合は効果なし。", "Bind an adjacent unit in the specified direction. No effect if there is no target."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 12", "Level 12") },
          ],
          examples: t(
            "samurai.bind()               # 前方の敵を拘束\nsamurai.bind(Direction.LEFT)  # 左の敵を拘束",
            "samurai.bind()               # bind enemy ahead\nsamurai.bind(Direction.LEFT)  # bind enemy left",
          ),
        },
        {
          id: "samurai-detonate",
          kind: "method",
          owner: "Samurai",
          name: "detonate",
          signature: "detonate(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向に爆破攻撃を行う。範囲ダメージ。爆発系ユニットには連鎖爆発が発生する場合がある。", "Perform an explosive attack in the specified direction. Area damage; chain explosions may occur with explosive units."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@since", value: t("Level 17", "Level 17") },
          ],
          examples: t(
            "samurai.detonate()               # 前方に爆弾を起爆\nsamurai.detonate(Direction.LEFT)  # 左に爆弾を起爆",
            "samurai.detonate()               # detonate bomb ahead\nsamurai.detonate(Direction.LEFT)  # detonate bomb left",
          ),
        },
        {
          id: "samurai-sense-methods",
          kind: "group",
          name: "Sense Methods",
          description: t("Sense methods は同一ターン内で複数回呼び出し可能。", "Sense methods may be called multiple times within a turn."),
          tags: [
            { name: "@constraint", value: t("repeatable-within-turn", "repeatable-within-turn") },
          ],
        },
        {
          id: "samurai-feel",
          kind: "method",
          owner: "Samurai",
          name: "feel",
          signature: "feel(self, direction: Direction = Direction.FORWARD) -> Space",
          description: t("指定方向の隣接 1 マスを感知する。空マス判定は `space.unit is None` を使う。", "Sense one adjacent tile in the specified direction. Use `space.unit is None` to detect an empty cell."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("Space 感知したマス。", "Space object for the sensed tile.") },
            { name: "@since", value: t("Level 2", "Level 2") },
          ],
          examples: t(
            "space = samurai.feel()            # 前方のSpaceを取得\nspace = samurai.feel(Direction.BACKWARD)\nspace.unit                        # Occupant | None",
            "space = samurai.feel()            # get Space ahead\nspace = samurai.feel(Direction.BACKWARD)\nspace.unit                        # Occupant | None",
          ),
        },
        {
          id: "samurai-look",
          kind: "method",
          owner: "Samurai",
          name: "look",
          signature: "look(self, direction: Direction = Direction.FORWARD) -> list[Space]",
          description: t("指定方向の 1〜3 マス先を感知する。長さ 3 の配列を返し、各要素は Space。", "Sense tiles 1-3 spaces ahead in the specified direction. Returns a length-3 array of Space objects."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("list[Space] 長さ 3 の配列。", "list[Space] of length 3.") },
            { name: "@since", value: t("Level 8", "Level 8") },
          ],
          examples: t(
            "spaces = samurai.look()  # 前方のSpace配列\nfor space in spaces:\n    space.unit           # Occupant | None",
            "spaces = samurai.look()  # list of Spaces ahead\nfor space in spaces:\n    space.unit           # Occupant | None",
          ),
        },
        {
          id: "samurai-listen",
          kind: "method",
          owner: "Samurai",
          name: "listen",
          signature: "listen(self) -> list[Space]",
          description: t("フロア上の他ユニットの位置を取得する。自分自身は含まない。", "Return spaces occupied by other units on the floor. The samurai itself is excluded."),
          tags: [
            { name: "@return", value: t("list[Space] 他ユニットが存在するマスの配列。", "list[Space] containing spaces occupied by other units.") },
            { name: "@guarantee", value: t("返される各 `Space` では `space.unit is not None`。", "For each returned `Space`, `space.unit is not None`.") },
            { name: "@since", value: t("Level 13", "Level 13") },
          ],
          examples: t(
            "units = samurai.listen()       # 他ユニットのSpace配列\ntarget = units[0]\nsamurai.direction_of(target)  # 方向を取得",
            "units = samurai.listen()       # Spaces of other units\ntarget = units[0]\nsamurai.direction_of(target)  # get direction",
          ),
        },
        {
          id: "samurai-direction-of-stairs",
          kind: "method",
          owner: "Samurai",
          name: "direction_of_stairs",
          signature: "direction_of_stairs(self) -> Direction",
          description: t("階段の方向を相対方向で返す。", "Return the relative direction of the stairs."),
          tags: [
            { name: "@return", value: t("Direction 階段の方向。", "Direction of the stairs.") },
            { name: "@since", value: t("Level 10", "Level 10") },
          ],
          examples: t(
            "d = samurai.direction_of_stairs()  # 階段の方向\nsamurai.walk(d)",
            "d = samurai.direction_of_stairs()  # stairs direction\nsamurai.walk(d)",
          ),
        },
        {
          id: "samurai-direction-of",
          kind: "method",
          owner: "Samurai",
          name: "direction_of",
          signature: "direction_of(self, space: Space) -> Direction",
          description: t("指定した Space の方向を相対方向で返す。", "Return the relative direction of the specified Space."),
          tags: [
            { name: "@param space", value: t("Space 対象マス。", "Target Space.") },
            { name: "@return", value: t("Direction 対象マスの方向。", "Relative direction to the target space.") },
            { name: "@since", value: t("Level 13", "Level 13") },
          ],
          examples: t(
            "d = samurai.direction_of(space)  # Spaceへの方向\nsamurai.walk(d)",
            "d = samurai.direction_of(space)  # direction to Space\nsamurai.walk(d)",
          ),
        },
        {
          id: "samurai-distance-of",
          kind: "method",
          owner: "Samurai",
          name: "distance_of",
          signature: "distance_of(self, space: Space) -> int",
          description: t("指定した Space までの距離を返す（マンハッタン距離）。", "Return the distance to the specified Space (Manhattan distance)."),
          tags: [
            { name: "@param space", value: t("Space 対象マス。", "Target Space.") },
            { name: "@return", value: t("int マンハッタン距離。", "Manhattan distance as int.") },
            { name: "@since", value: t("Level 18", "Level 18") },
          ],
          examples: t("n = samurai.distance_of(space)  # マンハッタン距離", "n = samurai.distance_of(space)  # Manhattan distance"),
        },
      ],
    },
    {
      id: "space-class",
      title: t("Class: Space", "Class: Space"),
      items: [
        {
          id: "space",
          kind: "class",
          name: "Space",
          signature: "class Space",
          description: t("A map cell。地形（terrain）と占有ユニット（unit）を保持する。", "A map cell. Stores terrain and occupant (`unit`) information."),
        },
        {
          id: "space-terrain",
          kind: "property",
          owner: "Space",
          name: "terrain",
          signature: "terrain: Terrain",
          description: t("このマスの地形。`FLOOR`, `WALL`, `STAIRS` のいずれか。", "Terrain of the space. One of `FLOOR`, `WALL`, or `STAIRS`."),
          tags: [
            { name: "@type", value: t("Terrain", "Terrain") },
          ],
          examples: t("space.terrain == Terrain.WALL  # 壁かどうか", "space.terrain == Terrain.WALL  # is it a wall?"),
        },
        {
          id: "space-unit",
          kind: "property",
          owner: "Space",
          name: "unit",
          signature: "unit: Occupant | None",
          description: t("このマスにいるユニット。空マスなら `None`。", "Occupant in the space, or `None` if empty."),
          tags: [
            { name: "@type", value: t("Occupant | None", "Occupant | None") },
            { name: "@apiNote", value: t("階段の上にユニットがいる場合、`terrain == Terrain.STAIRS` かつ `unit is not None` になりうる。", "A unit may stand on stairs (`terrain == Terrain.STAIRS` and `unit is not None`).") },
          ],
          examples: t(
            "if space.unit is None:  # 空きマス\n    ...\nunit = space.unit\nunit.kind               # UnitKind",
            "if space.unit is None:  # empty tile\n    ...\nunit = space.unit\nunit.kind               # UnitKind",
          ),
        },
      ],
    },
    {
      id: "occupant-class",
      title: t("Class: Occupant", "Class: Occupant"),
      items: [
        {
          id: "occupant",
          kind: "class",
          name: "Occupant",
          signature: "class Occupant",
          description: t("Space 上のユニットを表す読み取り専用オブジェクト。", "Read-only object representing a unit on a Space."),
        },
        {
          id: "occupant-kind",
          kind: "property",
          owner: "Occupant",
          name: "kind",
          signature: "kind: UnitKind",
          description: t("ユニット種別。", "Occupant category."),
          tags: [{ name: "@type", value: t("UnitKind", "UnitKind") }],
          examples: t("unit.kind == UnitKind.ENEMY  # 敵かどうか", "unit.kind == UnitKind.ENEMY  # is it an enemy?"),
        },
        {
          id: "occupant-ticking",
          kind: "property",
          owner: "Occupant",
          name: "ticking",
          signature: "ticking: bool",
          description: t("時限爆弾状態かどうか。", "Whether the unit is in a ticking (timed-bomb) state."),
          tags: [
            { name: "@type", value: t("bool", "bool") },
            { name: "@remarks", value: t("典型用途は `kind == UnitKind.CAPTIVE` と組み合わせた優先救出判定。", "Typical use: prioritize rescue when combined with `kind == UnitKind.CAPTIVE`.") },
          ],
          examples: t("if unit.ticking:  # 時限爆弾あり\n    ...", "if unit.ticking:  # has timed bomb\n    ..."),
        },
      ],
    },
  ],
};

export interface StdlibModuleEntry {
  module: string;
  url: string;
  description: LocalizedText;
  examples?: LocalizedText;
}

export const stdlibModules: StdlibModuleEntry[] = [
  {
    module: "math",
    url: "https://docs.python.org/3/library/math.html",
    description: t(
      "数学関数を提供する標準ライブラリ。`math.ceil()`, `math.floor()` など。",
      "Standard library providing mathematical functions: `math.ceil()`, `math.floor()`, etc.",
    ),
    examples: t(
      "math.ceil(20 / 3)   # 切り上げ → 7\nmath.floor(20 / 3)  # 切り捨て → 6",
      "math.ceil(20 / 3)   # round up → 7\nmath.floor(20 / 3)  # round down → 6",
    ),
  },
];

export function pickText(value: LocalizedText, locale: LocaleCode): string {
  return value[locale];
}
