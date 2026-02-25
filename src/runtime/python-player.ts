import type { SkInstance, SkNamespace } from "./skulpt";
import type { ITurn, IPlayer } from "@engine/types";
import { asRuntimeTurn, type RuntimeTurn } from "./bridge";
import { PythonRuntimeError, PythonSyntaxError } from "./errors";

/* ---------- Skulpt access ---------- */

let moduleCounter = 0;
let skConfigured = false;

function getSk(): SkNamespace {
  if (!globalThis.Sk) {
    throw new Error("Skulpt is not loaded.");
  }
  const sk = globalThis.Sk;
  if (!skConfigured) {
    sk.configure({
      output: () => {},
      read: (path: string) => {
        if (sk.builtinFiles?.files[path] !== undefined) {
          return sk.builtinFiles.files[path];
        }
        throw new Error(`Module not found: ${path}`);
      },
      __future__: sk.python3,
    });
    skConfigured = true;
  }
  return sk;
}

/* ---------- Source preprocessing ---------- */

/**
 * Inject a base class with `__getattr__` returning None, so that
 * uninitialized `self.xxx` returns None instead of raising AttributeError.
 * This matches Ruby Warrior's nil-default behaviour for instance variables.
 *
 * Uses inheritance instead of source injection to avoid indentation issues
 * (user code may use 2-space, 4-space, or tab indentation).
 */
interface InjectResult {
  source: string;
  /** Number of lines added as preamble (to adjust error line numbers). */
  preambleLines: number;
}

function injectGetattr(source: string): InjectResult {
  if (!/^class\s+Player\s*:/m.test(source)) {
    throw new PythonSyntaxError("class Player not found.");
  }
  const preamble = [
    "class Direction:",
    "    FORWARD = 'forward'",
    "    RIGHT = 'right'",
    "    BACKWARD = 'backward'",
    "    LEFT = 'left'",
    "",
    "class Terrain:",
    "    FLOOR = 'f'",
    "    WALL = 'w'",
    "    STAIRS = 's'",
    "",
    "class UnitKind:",
    "    ENEMY = 'e'",
    "    CAPTIVE = 'c'",
    "    ALLY = 'a'",
    "",
    "class _PlayerBase:",
    "    def __getattr__(self, name):",
    "        return None",
    "",
    "",
  ];
  const base = preamble.join("\n");
  const modified = source.replace(
    /^(class\s+Player)\s*:/m,
    "$1(_PlayerBase):",
  );
  return { source: base + modified, preambleLines: preamble.length };
}

/* ---------- JS ↔ Skulpt conversions ---------- */

const TERRAIN_VALUES = {
  FLOOR: "f",
  WALL: "w",
  STAIRS: "s",
} as const;

const UNIT_KIND_VALUES = {
  ENEMY: "e",
  CAPTIVE: "c",
  ALLY: "a",
} as const;

/**
 * Map from Skulpt Space proxy → original JS Space object.
 * Used to unwrap Space arguments for direction_of/distance_of senses.
 * Cleared at the start of each playTurn call.
 */
const skToJsSpaceMap = new Map<unknown, unknown>();

function getMethod(
  obj: Record<string, unknown>,
  snake: string,
  camel: string,
): ((...args: unknown[]) => unknown) | undefined {
  const snakeFn = obj[snake];
  if (typeof snakeFn === "function") {
    return snakeFn as (...args: unknown[]) => unknown;
  }
  const camelFn = obj[camel];
  if (typeof camelFn === "function") {
    return camelFn as (...args: unknown[]) => unknown;
  }
  return undefined;
}

function callOptionalSpacePredicate(
  obj: Record<string, unknown>,
  snake: string,
  camel: string,
): boolean | undefined {
  const fn = getMethod(obj, snake, camel);
  if (!fn) return undefined;
  return Boolean(fn.call(obj));
}

function getTerrainValue(obj: Record<string, unknown>): string {
  if (typeof obj.terrain === "string") return obj.terrain;
  if (callOptionalSpacePredicate(obj, "is_wall", "isWall")) return TERRAIN_VALUES.WALL;
  if (callOptionalSpacePredicate(obj, "is_stairs", "isStairs")) return TERRAIN_VALUES.STAIRS;
  return TERRAIN_VALUES.FLOOR;
}

function getOccupantInfo(
  obj: Record<string, unknown>,
): { kind: string; ticking: boolean } | null {
  const unit = obj.unit as any;

  const enemy = callOptionalSpacePredicate(obj, "is_enemy", "isEnemy");
  const captive = callOptionalSpacePredicate(obj, "is_captive", "isCaptive");
  const ticking =
    (unit && typeof unit.hasAbility === "function"
      ? unit.hasAbility("explode!")
      : callOptionalSpacePredicate(obj, "is_ticking", "isTicking")) ?? false;

  if (unit !== undefined) {
    // If it's a real unit, use its methods. If it's a POJO, use predicates if available.
    const isBound = typeof unit.isBound === "function" ? unit.isBound() : captive;
    if (isBound) return { kind: UNIT_KIND_VALUES.CAPTIVE, ticking };

    const isSamurai = typeof unit.isSamurai === "function" ? unit.isSamurai() : false;
    const isGolem = typeof unit.isGolem === "function" ? unit.isGolem() : false;
    const isEnemy =
      typeof unit.isSamurai === "function" ? !isSamurai && !isGolem : enemy;

    if (isEnemy) return { kind: UNIT_KIND_VALUES.ENEMY, ticking };
    return { kind: UNIT_KIND_VALUES.ALLY, ticking };
  }

  if (captive) return { kind: UNIT_KIND_VALUES.CAPTIVE, ticking };
  if (enemy) return { kind: UNIT_KIND_VALUES.ENEMY, ticking };

  const isWall = callOptionalSpacePredicate(obj, "is_wall", "isWall") ?? false;
  if (isWall) return null;

  const isEmpty = callOptionalSpacePredicate(obj, "is_empty", "isEmpty");
  if (isEmpty === true) return null;

  const isStairs = callOptionalSpacePredicate(obj, "is_stairs", "isStairs") ?? false;
  if (isStairs) return null;

  return null;
}

function jsOccupantToSk(sk: SkNamespace, obj: Record<string, unknown>): unknown {
  const info = getOccupantInfo(obj);
  if (!info) return sk.builtin.none.none$;

  const OccupantClass = sk.misceval.buildClass({}, (_$gbl, $loc) => {
    const kindGetter = new sk.builtin.func(() => new sk.builtin.str(info.kind));
    $loc.kind = sk.misceval.callsimOrSuspendArray(sk.builtins.property, [kindGetter]);

    const tickingGetter = new sk.builtin.func(() =>
      info.ticking ? sk.builtin.bool.true$ : sk.builtin.bool.false$,
    );
    $loc.ticking = sk.misceval.callsimOrSuspendArray(sk.builtins.property, [tickingGetter]);
  }, "Occupant", []);

  return sk.misceval.callsimArray(OccupantClass, []);
}

/** Convert a JS Space-like object to a Skulpt Space instance (or None). */
function jsSpaceToSk(sk: SkNamespace, raw: unknown): unknown {
  if (raw == null) return sk.builtin.none.none$;

  const obj = raw as Record<string, unknown>;

  // Wrap as a Skulpt Space class whose methods delegate to the JS object
  const SpaceClass = sk.misceval.buildClass({}, (_$gbl, $loc) => {
    const terrainGetter = new sk.builtin.func(() => new sk.builtin.str(getTerrainValue(obj)));
    $loc.terrain = sk.misceval.callsimOrSuspendArray(sk.builtins.property, [terrainGetter]);

    const unitGetter = new sk.builtin.func(() => jsOccupantToSk(sk, obj));
    $loc.unit = sk.misceval.callsimOrSuspendArray(sk.builtins.property, [unitGetter]);
  }, "Space", []);

  const instance = sk.misceval.callsimArray(SpaceClass, []);
  skToJsSpaceMap.set(instance, raw);
  return instance;
}

/** Convert a raw doSense result to a Skulpt value. */
function senseResultToSk(sk: SkNamespace, value: unknown): unknown {
  if (value == null) return sk.builtin.none.none$;
  if (typeof value === "number") return new sk.builtin.int_(value);
  if (typeof value === "string") return new sk.builtin.str(value);
  if (Array.isArray(value)) {
    return new sk.builtin.list(value.map((item) => jsSpaceToSk(sk, item)));
  }
  return jsSpaceToSk(sk, value);
}

/* ---------- Samurai proxy ---------- */

const ACTION_ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ["walk", "walk!"],
  ["attack", "attack!"],
  ["rest", "rest!"],
  ["rescue", "rescue!"],
  ["shoot", "shoot!"],
  ["pivot", "pivot!"],
  ["bind", "bind!"],
  ["detonate", "detonate!"],
  ["form", "form!"],
];

const ACTION_DEFAULT_DIRECTIONS: Readonly<Record<string, string>> = {
  "pivot!": "backward",
};

/** Senses that take an optional direction string argument. */
const SENSE_NAMES = ["feel", "look", "listen", "direction_of_stairs"] as const;

/** Senses that take a Space object argument (requires unwrapping Skulpt proxy). */
const SPACE_SENSE_NAMES = ["direction_of", "distance_of"] as const;

/** Build a Skulpt Samurai instance that delegates to a RuntimeTurn. */
function buildSamuraiInstance(sk: SkNamespace, turn: RuntimeTurn): unknown {
  const SamuraiClass = sk.misceval.buildClass({}, (_$gbl, $loc) => {
    // hp property
    const hpGetter = new sk.builtin.func(() =>
      new sk.builtin.int_(turn.doSense("health") as number),
    );
    $loc.hp = sk.misceval.callsimOrSuspendArray(sk.builtins.property, [hpGetter]);

    // Action methods
    for (const [pyName, engineName] of ACTION_ENTRIES) {
      ((py, eng) => {
        $loc[py] = new sk.builtin.func((_self: unknown, direction?: unknown) => {
          if (!turn.hasAction(eng)) return sk.builtin.none.none$;
          if (eng === "rest!") {
            turn.doAction(eng);
          } else {
            const dir = direction
              ? (sk.ffi.remapToJs(direction) as string)
              : (ACTION_DEFAULT_DIRECTIONS[eng] ?? "forward");
            turn.doAction(eng, dir);
          }
          return sk.builtin.none.none$;
        });
      })(pyName, engineName);
    }

    // Sense methods (direction-argument senses)
    for (const senseName of SENSE_NAMES) {
      ((sn) => {
        $loc[sn] = new sk.builtin.func((_self: unknown, direction?: unknown) => {
          const args: unknown[] = [];
          if (direction) args.push(sk.ffi.remapToJs(direction));
          const result = turn.doSense(sn, ...args);
          return senseResultToSk(sk, result);
        });
      })(senseName);
    }

    // Sense methods (Space-argument senses: direction_of, distance_of)
    for (const senseName of SPACE_SENSE_NAMES) {
      ((sn) => {
        $loc[sn] = new sk.builtin.func((_self: unknown, spaceArg?: unknown) => {
          const jsSpace = spaceArg ? skToJsSpaceMap.get(spaceArg) : undefined;
          const result = turn.doSense(sn, jsSpace);
          return senseResultToSk(sk, result);
        });
      })(senseName);
    }
  }, "Samurai", []);

  return sk.misceval.callsimArray(SamuraiClass, []);
}

/* ---------- Error helpers ---------- */

interface SkErrorInfo {
  message: string;
  line: number | undefined;
  column: number | undefined;
}

function extractSkErrorInfo(error: unknown): SkErrorInfo {
  const skErr = error as {
    args?: { v?: Array<{ v?: string }> };
    traceback?: Array<{ lineno?: number; colno?: number }>;
  };
  const message = skErr?.args?.v?.[0]?.v
    ?? (error instanceof Error ? error.message : String(error));
  const tb = skErr?.traceback?.[0];
  return {
    message,
    line: tb?.lineno,
    column: tb?.colno,
  };
}

/* ---------- Public API ---------- */

export function compilePythonPlayer(source: string): IPlayer {
  if (source.trim().length === 0) {
    throw new PythonSyntaxError("Python source is empty.");
  }

  const sk = getSk();
  const inject = injectGetattr(source);

  // Compile and instantiate the Player class
  let playTurnMethod: unknown;
  try {
    const moduleName = `<player_${++moduleCounter}>`;
    const mod = sk.importMainWithBody(moduleName, false, inject.source);
    const PlayerClass = mod.tp$getattr(new sk.builtin.str("Player"));
    if (!PlayerClass) {
      throw new PythonSyntaxError("class Player not found.");
    }
    const playerInstance = sk.misceval.callsimArray(PlayerClass, []) as SkInstance;
    playTurnMethod = playerInstance.tp$getattr(new sk.builtin.str("play_turn"));
    // __getattr__ returns Sk.builtin.none.none$ for missing attrs, so check for that too
    if (!playTurnMethod || playTurnMethod === sk.builtin.none.none$) {
      throw new PythonSyntaxError("def play_turn(self, samurai) not found.");
    }
  } catch (error) {
    if (error instanceof PythonSyntaxError) throw error;
    const info = extractSkErrorInfo(error);
    const adjustedLine = info.line !== undefined
      ? Math.max(1, info.line - inject.preambleLines)
      : undefined;
    throw new PythonSyntaxError(info.message, adjustedLine, info.column);
  }

  return {
    playTurn(turnInput: ITurn): void {
      try {
        skToJsSpaceMap.clear();
        const turn = asRuntimeTurn(turnInput);
        const samuraiProxy = buildSamuraiInstance(sk, turn);
        sk.misceval.callsimArray(playTurnMethod, [samuraiProxy]);
      } catch (error) {
        if (error instanceof PythonSyntaxError || error instanceof PythonRuntimeError) {
          throw error;
        }
        throw new PythonRuntimeError(extractSkErrorInfo(error).message);
      }
    },
  };
}

export function isPythonPlayerCodeEmpty(source: string): boolean {
  return source.trim().length === 0;
}
