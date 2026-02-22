import type {} from "./skulpt.d";
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
function injectGetattr(source: string): string {
  if (!/^class\s+Player\s*:/m.test(source)) {
    throw new PythonSyntaxError("class Player not found.");
  }
  const base =
    "class _PlayerBase:\n    def __getattr__(self, name):\n        return None\n\n";
  const modified = source.replace(
    /^(class\s+Player)\s*:/m,
    "$1(_PlayerBase):",
  );
  return base + modified;
}

/* ---------- JS ↔ Skulpt conversions ---------- */

const SPACE_METHODS: ReadonlyArray<readonly [string, string]> = [
  ["is_enemy", "isEnemy"],
  ["is_captive", "isCaptive"],
  ["is_stairs", "isStairs"],
  ["is_wall", "isWall"],
  ["is_ticking", "isTicking"],
];

/**
 * Map from Skulpt Space proxy → original JS Space object.
 * Used to unwrap Space arguments for direction_of/distance_of senses.
 * Cleared at the start of each playTurn call.
 */
const skToJsSpaceMap = new Map<unknown, unknown>();

/** Convert a JS Space-like object to a Skulpt Space instance (or None). */
function jsSpaceToSk(sk: SkNamespace, raw: unknown): unknown {
  if (raw == null) return sk.builtin.none.none$;

  const obj = raw as Record<string, unknown>;

  // Empty space → Python None
  const isEmptyFn = obj.isEmpty ?? obj.is_empty;
  if (typeof isEmptyFn === "function" && (isEmptyFn as () => boolean).call(obj)) {
    return sk.builtin.none.none$;
  }

  // Wrap as a Skulpt Space class whose methods delegate to the JS object
  const SpaceClass = sk.misceval.buildClass({}, (_$gbl, $loc) => {
    for (const [snake, camel] of SPACE_METHODS) {
      ((s, c) => {
        $loc[s] = new sk.builtin.func(() => {
          const fn = obj[s] ?? obj[c];
          if (typeof fn !== "function") {
            throw new TypeError(`Space method ${s}/${c} is not available.`);
          }
          return (fn as () => boolean).call(obj)
            ? sk.builtin.bool.true$
            : sk.builtin.bool.false$;
        });
      })(snake, camel);
    }
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

/* ---------- Warrior proxy ---------- */

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

/** Senses that take an optional direction string argument. */
const SENSE_NAMES = ["feel", "look", "listen", "direction_of_stairs"] as const;

/** Senses that take a Space object argument (requires unwrapping Skulpt proxy). */
const SPACE_SENSE_NAMES = ["direction_of", "distance_of"] as const;

/** Build a Skulpt Warrior instance that delegates to a RuntimeTurn. */
function buildWarriorInstance(sk: SkNamespace, turn: RuntimeTurn): unknown {
  const WarriorClass = sk.misceval.buildClass({}, (_$gbl, $loc) => {
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
            const dir = direction ? (sk.ffi.remapToJs(direction) as string) : "forward";
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
  }, "Warrior", []);

  return sk.misceval.callsimArray(WarriorClass, []);
}

/* ---------- Error helpers ---------- */

function extractSkErrorMessage(error: unknown): string {
  const skErr = error as { args?: { v?: Array<{ v?: string }> } };
  if (skErr?.args?.v?.[0]?.v) return skErr.args.v[0].v;
  if (error instanceof Error) return error.message;
  return String(error);
}

/* ---------- Public API ---------- */

export function compilePythonPlayer(source: string): IPlayer {
  if (source.trim().length === 0) {
    throw new PythonSyntaxError("Python source is empty.");
  }

  const sk = getSk();
  const processed = injectGetattr(source);

  // Compile and instantiate the Player class
  let playTurnMethod: unknown;
  try {
    const moduleName = `<player_${++moduleCounter}>`;
    const mod = sk.importMainWithBody(moduleName, false, processed);
    const PlayerClass = mod.tp$getattr(new sk.builtin.str("Player"));
    if (!PlayerClass) {
      throw new PythonSyntaxError("class Player not found.");
    }
    const playerInstance = sk.misceval.callsimArray(PlayerClass, []) as SkInstance;
    playTurnMethod = playerInstance.tp$getattr(new sk.builtin.str("play_turn"));
    // __getattr__ returns Sk.builtin.none.none$ for missing attrs, so check for that too
    if (!playTurnMethod || playTurnMethod === sk.builtin.none.none$) {
      throw new PythonSyntaxError("def play_turn(self, warrior) not found.");
    }
  } catch (error) {
    if (error instanceof PythonSyntaxError) throw error;
    throw new PythonSyntaxError(extractSkErrorMessage(error));
  }

  return {
    playTurn(turnInput: ITurn): void {
      try {
        skToJsSpaceMap.clear();
        const turn = asRuntimeTurn(turnInput);
        const warriorProxy = buildWarriorInstance(sk, turn);
        sk.misceval.callsimArray(playTurnMethod, [warriorProxy]);
      } catch (error) {
        if (error instanceof PythonSyntaxError || error instanceof PythonRuntimeError) {
          throw error;
        }
        throw new PythonRuntimeError(extractSkErrorMessage(error));
      }
    },
  };
}

export function isPythonPlayerCodeEmpty(source: string): boolean {
  return source.trim().length === 0;
}
