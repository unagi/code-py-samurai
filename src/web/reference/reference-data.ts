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
}

export interface ReferenceSection {
  id: string;
  title: LocalizedText;
  intro?: LocalizedText;
  items: ReferenceItem[];
}

export interface AvailabilityRow {
  level: number;
  apis: string[];
}

export interface ApiReferenceDocument {
  title: string;
  subtitle: LocalizedText;
  conventionsTitle: LocalizedText;
  conventions: LocalizedText[];
  sections: ReferenceSection[];
  availabilityTitle: LocalizedText;
  availabilityRows: AvailabilityRow[];
}

const t = (ja: string, en: string): LocalizedText => ({ ja, en });

export const apiReferenceDocument: ApiReferenceDocument = {
  title: "Python API Reference (Player / Warrior / Space)",
  subtitle: t(
    "学習者向け Python API の仕様（ドキュメント先行）です。",
    "Learner-facing Python API specification (docs-first).",
  ),
  conventionsTitle: t("Conventions", "Conventions"),
  conventions: [
    t("方向は `Direction` を使う（`FORWARD`, `RIGHT`, `BACKWARD`, `LEFT`）", "Use `Direction` (`FORWARD`, `RIGHT`, `BACKWARD`, `LEFT`) for relative directions."),
    t("地形は `Terrain` を使う（`FLOOR`, `WALL`, `STAIRS`）", "Use `Terrain` (`FLOOR`, `WALL`, `STAIRS`) for map terrain."),
    t("ユニット種別は `UnitKind` を使う（`ENEMY`, `CAPTIVE`, `ALLY`）", "Use `UnitKind` (`ENEMY`, `CAPTIVE`, `ALLY`) for occupant categories."),
    t("アクションメソッドは 1 ターンに 1 回のみ実行可能", "Action methods can be executed only once per turn."),
    t("感知メソッドは同一ターン内で複数回呼び出し可能", "Sense methods may be called multiple times within a turn."),
    t("`feel()` / `look()` は常に `Space` を返す（空マスは `space.unit is None` で判定する）", "`feel()` / `look()` always return `Space`; detect empty cells with `space.unit is None`."),
  ],
  sections: [
    {
      id: "direction-enum",
      title: t("Enum: Direction", "Enum: Direction"),
      items: [
        {
          id: "direction",
          kind: "enum",
          name: "Direction",
          signature: "enum Direction { FORWARD, RIGHT, BACKWARD, LEFT }",
          description: t("Warrior API で使用する相対方向。", "Relative direction values used by the Warrior API."),
          tags: [
            { name: "@values", value: t("FORWARD | RIGHT | BACKWARD | LEFT", "FORWARD | RIGHT | BACKWARD | LEFT") },
          ],
        },
      ],
    },
    {
      id: "terrain-enum",
      title: t("Enum: Terrain", "Enum: Terrain"),
      items: [
        {
          id: "terrain",
          kind: "enum",
          name: "Terrain",
          signature: "enum Terrain { FLOOR, WALL, STAIRS }",
          description: t("Space の地形種別。", "Terrain type of a Space."),
          tags: [
            { name: "@values", value: t("FLOOR | WALL | STAIRS", "FLOOR | WALL | STAIRS") },
          ],
        },
      ],
    },
    {
      id: "unitkind-enum",
      title: t("Enum: UnitKind", "Enum: UnitKind"),
      items: [
        {
          id: "unitkind",
          kind: "enum",
          name: "UnitKind",
          signature: "enum UnitKind { ENEMY, CAPTIVE, ALLY }",
          description: t("Space にいるユニットの種別。", "Unit category stored in `Space.unit`."),
          tags: [
            { name: "@values", value: t("ENEMY | CAPTIVE | ALLY", "ENEMY | CAPTIVE | ALLY") },
          ],
        },
      ],
    },
    {
      id: "player-class",
      title: t("Class: Player", "Class: Player"),
      items: [
        {
          id: "player",
          kind: "class",
          name: "Player",
          signature: "class Player",
          description: t(
            "各ターンで実行されるユーザー定義クラス。実装必須メソッドは `play_turn(warrior)` のみ。",
            "User-defined class executed each turn. The only required method is `play_turn(warrior)`.",
          ),
        },
        {
          id: "player-play-turn",
          kind: "method",
          owner: "Player",
          name: "play_turn",
          signature: "play_turn(self, warrior) -> None",
          description: t(
            "1ターン分の行動を決定する。行動メソッド（walk / attack / rest ...）はこのメソッド内で 1 回だけ実行できる。",
            "Decides the action for one turn. Action methods (walk / attack / rest ...) may be executed only once inside this method.",
          ),
          tags: [
            { name: "@param warrior", value: t("Warrior 現在ターンの操作対象", "Warrior control object for the current turn") },
            { name: "@return", value: t("None", "None") },
          ],
        },
      ],
    },
    {
      id: "warrior-class",
      title: t("Class: Warrior", "Class: Warrior"),
      items: [
        {
          id: "warrior",
          kind: "class",
          name: "Warrior",
          signature: "class Warrior",
          description: t(
            "Player.play_turn() に渡されるターン限定の操作オブジェクト。行動（Action）と感知（Sense）APIを提供する。",
            "Turn-scoped control object passed to Player.play_turn(). Provides Action and Sense APIs.",
          ),
        },
        {
          id: "warrior-hp",
          kind: "property",
          owner: "Warrior",
          name: "hp",
          signature: "hp: int",
          description: t("現在HP。", "Current HP."),
          tags: [{ name: "@type", value: t("int", "int") }, { name: "@since", value: t("Level 3", "Level 3") }],
        },
        {
          id: "warrior-action-methods",
          kind: "group",
          name: "Action Methods",
          description: t(
            "Action methods は同一ターン内で相互排他。複数の action メソッドを呼び出してはならない。",
            "Action methods are mutually exclusive within a turn. Do not call multiple action methods in the same turn.",
          ),
          tags: [
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
          ],
        },
        {
          id: "warrior-walk",
          kind: "method",
          owner: "Warrior",
          name: "walk",
          signature: "walk(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向へ 1 マス移動する。移動先が空でない場合は移動しない。", "Move one tile in the specified direction. Does not move if the destination is not empty."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@since", value: t("Level 1", "Level 1") },
          ],
        },
        {
          id: "warrior-attack",
          kind: "method",
          owner: "Warrior",
          name: "attack",
          signature: "attack(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の隣接マスを近接攻撃する。後方攻撃はダメージが低下する。", "Melee attack the adjacent tile in the specified direction. Backward attacks deal reduced damage."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@remarks", value: t("後方攻撃はダメージが低下する。", "Backward attacks deal less damage.") },
            { name: "@since", value: t("Level 2", "Level 2") },
          ],
        },
        {
          id: "warrior-rest",
          kind: "method",
          owner: "Warrior",
          name: "rest",
          signature: "rest(self) -> None",
          description: t("HPを回復する。最大HP時は回復しない。", "Recover HP. No effect at max HP."),
          tags: [
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@since", value: t("Level 3", "Level 3") },
          ],
        },
        {
          id: "warrior-rescue",
          kind: "method",
          owner: "Warrior",
          name: "rescue",
          signature: "rescue(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の捕虜を救出する。捕虜でない対象には効果なし。", "Rescue a captive in the specified direction. No effect on non-captive targets."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@remarks", value: t("捕虜でない対象には効果なし。", "No effect when the target is not a captive.") },
            { name: "@since", value: t("Level 5", "Level 5") },
          ],
        },
        {
          id: "warrior-shoot",
          kind: "method",
          owner: "Warrior",
          name: "shoot",
          signature: "shoot(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向へ射撃する。射程は 1〜3 マス。最初に見つかったユニットに命中する。", "Shoot in the specified direction. Range is 1-3 tiles and it hits the first unit found."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@remarks", value: t("射程は 1〜3 マス。最初に見つかったユニットに命中する。", "Range is 1-3 tiles and it hits the first unit found.") },
            { name: "@since", value: t("Level 8", "Level 8") },
          ],
        },
        {
          id: "warrior-pivot",
          kind: "method",
          owner: "Warrior",
          name: "pivot",
          signature: "pivot(self, direction: Direction = Direction.BACKWARD) -> None",
          description: t("向きを変更する。既定値が `Direction.BACKWARD` である点に注意。", "Change facing direction. Note that the default is `Direction.BACKWARD`."),
          tags: [
            { name: "@param direction", value: t("Direction 回転先の相対方向。省略時は `Direction.BACKWARD`。", "Direction to rotate to. Defaults to `Direction.BACKWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@since", value: t("Level 7", "Level 7") },
          ],
        },
        {
          id: "warrior-bind",
          kind: "method",
          owner: "Warrior",
          name: "bind",
          signature: "bind(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向の隣接ユニットを拘束する。対象がいない場合は効果なし。", "Bind an adjacent unit in the specified direction. No effect if there is no target."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@remarks", value: t("対象がいない場合は効果なし。", "No effect if there is no target.") },
            { name: "@since", value: t("Level 12", "Level 12") },
          ],
        },
        {
          id: "warrior-detonate",
          kind: "method",
          owner: "Warrior",
          name: "detonate",
          signature: "detonate(self, direction: Direction = Direction.FORWARD) -> None",
          description: t("指定方向に爆破攻撃を行う。範囲ダメージ。爆発系ユニットには連鎖爆発が発生する場合がある。", "Perform an explosive attack in the specified direction. Area damage; chain explosions may occur with explosive units."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("None", "None") },
            { name: "@category", value: t("action", "action") },
            { name: "@constraint", value: t("one-action-per-turn", "one-action-per-turn") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@since", value: t("Level 17", "Level 17") },
          ],
        },
        {
          id: "warrior-sense-methods",
          kind: "group",
          name: "Sense Methods",
          description: t("Sense methods は同一ターン内で複数回呼び出し可能。", "Sense methods may be called multiple times within a turn."),
          tags: [
            { name: "@category", value: t("sense", "sense") },
            { name: "@constraint", value: t("repeatable-within-turn", "repeatable-within-turn") },
          ],
        },
        {
          id: "warrior-feel",
          kind: "method",
          owner: "Warrior",
          name: "feel",
          signature: "feel(self, direction: Direction = Direction.FORWARD) -> Space",
          description: t("指定方向の隣接 1 マスを感知する。空マス判定は `space.unit is None` を使う。", "Sense one adjacent tile in the specified direction. Use `space.unit is None` to detect an empty cell."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("Space 感知したマス。", "Space object for the sensed tile.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@apiNote", value: t("空マス判定は `space.unit is None` を使用する。", "Use `space.unit is None` to check for empty cells.") },
            { name: "@since", value: t("Level 2", "Level 2") },
          ],
        },
        {
          id: "warrior-look",
          kind: "method",
          owner: "Warrior",
          name: "look",
          signature: "look(self, direction: Direction = Direction.FORWARD) -> list[Space]",
          description: t("指定方向の 1〜3 マス先を感知する。長さ 3 の配列を返し、各要素は Space。", "Sense tiles 1-3 spaces ahead in the specified direction. Returns a length-3 array of Space objects."),
          tags: [
            { name: "@param direction", value: t("Direction 相対方向。省略時は `Direction.FORWARD`。", "Direction. Defaults to `Direction.FORWARD`.") },
            { name: "@return", value: t("list[Space] 長さ 3 の配列。", "list[Space] of length 3.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@throws", value: t("RuntimeError 無効な方向を指定した場合。", "RuntimeError when an invalid direction is given.") },
            { name: "@apiNote", value: t("空マス判定は各要素の `space.unit is None` を使用する。", "Use `space.unit is None` on each element to check emptiness.") },
            { name: "@since", value: t("Level 8", "Level 8") },
          ],
        },
        {
          id: "warrior-listen",
          kind: "method",
          owner: "Warrior",
          name: "listen",
          signature: "listen(self) -> list[Space]",
          description: t("フロア上の他ユニットの位置を取得する。自分自身は含まない。", "Return spaces occupied by other units on the floor. The warrior itself is excluded."),
          tags: [
            { name: "@return", value: t("list[Space] 他ユニットが存在するマスの配列。", "list[Space] containing spaces occupied by other units.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@remarks", value: t("自分自身は含まない。", "Does not include the warrior itself.") },
            { name: "@guarantee", value: t("返される各 `Space` では `space.unit is not None`。", "For each returned `Space`, `space.unit is not None`.") },
            { name: "@since", value: t("Level 13", "Level 13") },
          ],
        },
        {
          id: "warrior-direction-of-stairs",
          kind: "method",
          owner: "Warrior",
          name: "direction_of_stairs",
          signature: "direction_of_stairs(self) -> Direction",
          description: t("階段の方向を相対方向で返す。", "Return the relative direction of the stairs."),
          tags: [
            { name: "@return", value: t("Direction 階段の方向。", "Direction of the stairs.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@since", value: t("Level 10", "Level 10") },
          ],
        },
        {
          id: "warrior-direction-of",
          kind: "method",
          owner: "Warrior",
          name: "direction_of",
          signature: "direction_of(self, space: Space) -> Direction",
          description: t("指定した Space の方向を相対方向で返す。", "Return the relative direction of the specified Space."),
          tags: [
            { name: "@param space", value: t("Space 対象マス。", "Target Space.") },
            { name: "@return", value: t("Direction 対象マスの方向。", "Relative direction to the target space.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@throws", value: t("RuntimeError 無効な Space を渡した場合。", "RuntimeError when an invalid Space is provided.") },
            { name: "@since", value: t("Level 13", "Level 13") },
          ],
        },
        {
          id: "warrior-distance-of",
          kind: "method",
          owner: "Warrior",
          name: "distance_of",
          signature: "distance_of(self, space: Space) -> int",
          description: t("指定した Space までの距離を返す（マンハッタン距離）。", "Return the distance to the specified Space (Manhattan distance)."),
          tags: [
            { name: "@param space", value: t("Space 対象マス。", "Target Space.") },
            { name: "@return", value: t("int マンハッタン距離。", "Manhattan distance as int.") },
            { name: "@category", value: t("sense", "sense") },
            { name: "@throws", value: t("RuntimeError 無効な Space を渡した場合。", "RuntimeError when an invalid Space is provided.") },
            { name: "@since", value: t("Level 18", "Level 18") },
          ],
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
        },
      ],
    },
  ],
  availabilityTitle: t("Availability by Level", "Availability by Level"),
  availabilityRows: [
    { level: 1, apis: ["walk()"] },
    { level: 2, apis: ["feel()", "attack()"] },
    { level: 3, apis: ["rest()", "hp"] },
    { level: 5, apis: ["rescue()"] },
    { level: 7, apis: ["pivot()"] },
    { level: 8, apis: ["look()", "shoot()"] },
    { level: 10, apis: ["direction_of_stairs()"] },
    { level: 12, apis: ["bind()"] },
    { level: 13, apis: ["listen()", "direction_of(space)"] },
    { level: 17, apis: ["detonate()"] },
    { level: 18, apis: ["distance_of(space)"] },
  ],
};

export function pickText(value: LocalizedText, locale: LocaleCode): string {
  return value[locale];
}
