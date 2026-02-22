import { describe, expect, it } from "vitest";

import { compilePythonPlayer } from "@runtime/python-player";
import { PythonSyntaxError } from "@runtime/errors";

class FakeSpace {
  constructor(
    private readonly enemy: boolean,
    private readonly captive: boolean,
    private readonly empty: boolean,
    private readonly ticking: boolean = false,
  ) {}

  isEnemy(): boolean {
    return this.enemy;
  }

  isCaptive(): boolean {
    return this.captive;
  }

  isEmpty(): boolean {
    return this.empty;
  }

  isStairs(): boolean {
    return false;
  }

  isWall(): boolean {
    return false;
  }

  isTicking(): boolean {
    return this.ticking;
  }
}

class FakeTurn {
  action: [string, ...unknown[]] | null = null;
  private readonly senses: Record<string, (...args: unknown[]) => unknown>;
  private readonly actions = new Set<string>([
    "walk!",
    "attack!",
    "rest!",
    "rescue!",
    "shoot!",
    "pivot!",
    "bind!",
    "detonate!",
  ]);

  constructor(senses: Record<string, (...args: unknown[]) => unknown>) {
    this.senses = senses;
  }

  doAction(name: string, ...args: unknown[]): void {
    if (!this.actions.has(name)) {
      throw new Error(`Unknown action: ${name}`);
    }
    if (this.action) {
      throw new Error("Only one action can be performed per turn.");
    }
    this.action = [name, ...args];
  }

  doSense(name: string, ...args: unknown[]): unknown {
    const fn = this.senses[name];
    if (!fn) {
      throw new Error(`Unknown sense: ${name}`);
    }
    return fn(...args);
  }

  hasAction(name: string): boolean {
    return this.actions.has(name);
  }

  hasSense(name: string): boolean {
    return Boolean(this.senses[name]);
  }
}

describe("compilePythonPlayer", () => {
  it("throws on empty source (no default injection)", () => {
    expect(() => compilePythonPlayer("   \n\n")).toThrow(/empty/i);
  });

  it("executes if/elif/else by sensed space and hp property", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space is None:\n            if samurai.hp < 8:\n                samurai.rest()\n            else:\n                samurai.walk()\n        elif space.is_enemy():\n            samurai.attack()\n        elif samurai.hp < 8:\n            samurai.rest()\n        else:\n            samurai.walk()`;

    const player = compilePythonPlayer(source);

    const enemyTurn = new FakeTurn({
      feel: () => new FakeSpace(true, false, false),
      health: () => 20,
    });
    player.playTurn(enemyTurn as never);
    expect(enemyTurn.action).toEqual(["attack!", "forward"]);

    const lowHpTurn = new FakeTurn({
      feel: () => new FakeSpace(false, false, true),
      health: () => 5,
    });
    player.playTurn(lowHpTurn as never);
    expect(lowHpTurn.action).toEqual(["rest!"]);

    const walkTurn = new FakeTurn({
      feel: () => new FakeSpace(false, false, true),
      health: () => 12,
    });
    player.playTurn(walkTurn as never);
    expect(walkTurn.action).toEqual(["walk!", "forward"]);
  });

  it("supports is not None", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space is not None:\n            samurai.attack()\n        else:\n            samurai.walk()`;

    const player = compilePythonPlayer(source);
    const enemyTurn = new FakeTurn({
      feel: () => new FakeSpace(true, false, false),
    });
    player.playTurn(enemyTurn as never);
    expect(enemyTurn.action).toEqual(["attack!", "forward"]);
  });

  it("supports for loops (Skulpt executes full Python)", () => {
    // Use a sense (non-action) in the loop body so it doesn't hit the
    // one-action-per-turn restriction, then perform a single action after.
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        total = 0",
      "        for x in range(3):",
      "            total = total + samurai.hp",
      "        if total > 0:",
      "            samurai.walk()",
    ].join("\n");

    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({ health: () => 5 });
    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("accepts 2-space indentation", () => {
    const source = `class Player:\n  def play_turn(self, samurai):\n    samurai.walk()`;
    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({});
    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("accepts tab indentation", () => {
    const source = "class Player:\n\tdef play_turn(self, samurai):\n\t\tsamurai.walk()";
    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({});
    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("throws at runtime on unknown samurai method/attribute", () => {
    // Skulpt compiles any valid Python; errors surface at runtime
    const singPlayer = compilePythonPlayer(
      "class Player:\n    def play_turn(self, samurai):\n        samurai.sing()",
    );
    const turn1 = new FakeTurn({});
    expect(() => singPlayer.playTurn(turn1 as never)).toThrow(/attribute/i);

    const energyPlayer = compilePythonPlayer(
      "class Player:\n    def play_turn(self, samurai):\n        if samurai.energy < 1:\n            samurai.walk()",
    );
    const turn2 = new FakeTurn({ health: () => 20 });
    expect(() => energyPlayer.playTurn(turn2 as never)).toThrow(/attribute/i);
  });

  it("throws PythonSyntaxError on bad indentation and stray elif", () => {
    expect(() =>
      compilePythonPlayer(
        "class Player:\n    def play_turn(self, samurai):\n        if samurai.hp < 10:\n        samurai.walk()",
      ),
    ).toThrow(PythonSyntaxError);

    expect(() =>
      compilePythonPlayer(
        "class Player:\n    def play_turn(self, samurai):\n        elif samurai.hp < 10:\n            samurai.walk()",
      ),
    ).toThrow(PythonSyntaxError);
  });

  it("handles pass statement without error", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        pass`;
    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({});
    player.playTurn(turn as never);
    expect(turn.action).toBeNull();
  });

  it("skips rest! when action is unavailable", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        samurai.rest()`;
    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({});
    // Remove rest! from available actions to test the guard branch
    (turn as unknown as { actions: Set<string> }).actions.delete("rest!");
    player.playTurn(turn as never);
    expect(turn.action).toBeNull();
  });

  it("throws TypeError when predicate is not a function", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space.is_enemy():\n            samurai.walk()`;
    const player = compilePythonPlayer(source);

    const turn = new FakeTurn({
      feel: () => ({ is_enemy: "not a function" }),
    });

    expect(() => player.playTurn(turn as never)).toThrow(/not available/i);
  });

  it("supports self.xxx instance variables persisted across turns", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        if self.prev_hp is not None:",
      "            if samurai.hp < self.prev_hp:",
      "                samurai.attack()",
      "            elif samurai.hp < 15:",
      "                samurai.rest()",
      "            else:",
      "                samurai.walk()",
      "        else:",
      "            samurai.walk()",
      "        self.prev_hp = samurai.hp",
    ].join("\n");

    const player = compilePythonPlayer(source);

    // Turn 1: self.prev_hp is None (undefined) → walk, then self.prev_hp = 20
    const turn1 = new FakeTurn({ health: () => 20 });
    player.playTurn(turn1 as never);
    expect(turn1.action).toEqual(["walk!", "forward"]);

    // Turn 2: self.prev_hp = 20, hp = 15 → hp < prev_hp → attack
    const turn2 = new FakeTurn({ health: () => 15 });
    player.playTurn(turn2 as never);
    expect(turn2.action).toEqual(["attack!", "forward"]);

    // Turn 3: self.prev_hp = 15, hp = 15 → not damaged, hp < 15 false → walk
    const turn3 = new FakeTurn({ health: () => 15 });
    player.playTurn(turn3 as never);
    expect(turn3.action).toEqual(["walk!", "forward"]);

    // Turn 4: self.prev_hp = 15, hp = 10 → hp < prev_hp → attack
    const turn4 = new FakeTurn({ health: () => 10 });
    player.playTurn(turn4 as never);
    expect(turn4.action).toEqual(["attack!", "forward"]);

    // Turn 5: self.prev_hp = 10, hp = 10 → not damaged, hp < 15 → rest
    const turn5 = new FakeTurn({ health: () => 10 });
    player.playTurn(turn5 as never);
    expect(turn5.action).toEqual(["rest!"]);
  });

  it("self.xxx returns undefined (not error) when not yet assigned", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        if self.flag is None:",
      "            samurai.walk()",
      "        else:",
      "            samurai.attack()",
      "        self.flag = 1",
    ].join("\n");

    const player = compilePythonPlayer(source);

    // Turn 1: self.flag is undefined → treated as None → walk
    const turn1 = new FakeTurn({});
    player.playTurn(turn1 as never);
    expect(turn1.action).toEqual(["walk!", "forward"]);

    // Turn 2: self.flag = 1 → not None → attack
    const turn2 = new FakeTurn({});
    player.playTurn(turn2 as never);
    expect(turn2.action).toEqual(["attack!", "forward"]);
  });

  it("supports and/or boolean operators", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        space = samurai.feel()",
      "        if space.is_enemy():",
      "            samurai.attack()",
      "        elif samurai.hp < 20 and samurai.hp >= self.prev_hp:",
      "            samurai.rest()",
      "        else:",
      "            samurai.walk()",
      "        self.prev_hp = samurai.hp",
    ].join("\n");

    const player = compilePythonPlayer(source);

    // Turn 1: no enemy, hp=20 (<20 false) → walk
    const turn1 = new FakeTurn({
      feel: () => new FakeSpace(false, false, false),
      health: () => 20,
    });
    player.playTurn(turn1 as never);
    expect(turn1.action).toEqual(["walk!", "forward"]);

    // Turn 2: no enemy, hp=15 (<20 true, >=20 false → and fails) → walk
    const turn2 = new FakeTurn({
      feel: () => new FakeSpace(false, false, false),
      health: () => 15,
    });
    player.playTurn(turn2 as never);
    expect(turn2.action).toEqual(["walk!", "forward"]);

    // Turn 3: no enemy, hp=15 (<20 true, >=15 true → and succeeds) → rest
    const turn3 = new FakeTurn({
      feel: () => new FakeSpace(false, false, false),
      health: () => 15,
    });
    player.playTurn(turn3 as never);
    expect(turn3.action).toEqual(["rest!"]);
  });

  it("supports or operator", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        space = samurai.feel()",
      "        if space.is_enemy() or space.is_captive():",
      "            samurai.attack()",
      "        else:",
      "            samurai.walk()",
    ].join("\n");

    const player = compilePythonPlayer(source);

    // enemy → attack
    const turn1 = new FakeTurn({
      feel: () => new FakeSpace(true, false, false),
    });
    player.playTurn(turn1 as never);
    expect(turn1.action).toEqual(["attack!", "forward"]);

    // captive → attack
    const turn2 = new FakeTurn({
      feel: () => new FakeSpace(false, true, false),
    });
    player.playTurn(turn2 as never);
    expect(turn2.action).toEqual(["attack!", "forward"]);

    // neither → walk
    const turn3 = new FakeTurn({
      feel: () => new FakeSpace(false, false, false),
    });
    player.playTurn(turn3 as never);
    expect(turn3.action).toEqual(["walk!", "forward"]);
  });

  it("wraps non-Error throws as PythonRuntimeError", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space.is_enemy():\n            samurai.walk()`;
    const player = compilePythonPlayer(source);

    const turn = new FakeTurn({
      feel: () => ({
        isEmpty: () => false,
        isEnemy: () => {
          throw "boom";
        },
      }),
    });

    expect(() => player.playTurn(turn as never)).toThrow(/boom/);
  });

  it("supports space.is_ticking() predicate", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        space = samurai.feel()",
      "        if space is not None and space.is_ticking():",
      "            samurai.rescue()",
      "        else:",
      "            samurai.walk()",
    ].join("\n");

    const player = compilePythonPlayer(source);

    const tickingTurn = new FakeTurn({
      feel: () => new FakeSpace(false, true, false, true),
    });
    player.playTurn(tickingTurn as never);
    expect(tickingTurn.action).toEqual(["rescue!", "forward"]);

    const normalTurn = new FakeTurn({
      feel: () => new FakeSpace(false, true, false, false),
    });
    player.playTurn(normalTurn as never);
    expect(normalTurn.action).toEqual(["walk!", "forward"]);
  });

  it("provides Direction/Terrain/UnitKind constants and Space/Occupant properties", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        left = samurai.feel(Direction.LEFT)",
      "        if left.terrain == Terrain.WALL:",
      "            samurai.walk(Direction.FORWARD)",
      "            return",
      "        fwd = samurai.feel(Direction.FORWARD)",
      "        if fwd.unit is not None and fwd.unit.kind == UnitKind.ENEMY:",
      "            samurai.attack(Direction.FORWARD)",
      "            return",
      "        samurai.walk(Direction.LEFT)",
    ].join("\n");

    const player = compilePythonPlayer(source);

    const turn = new FakeTurn({
      feel: (direction?: unknown) => {
        if (direction === "left") {
          return {
            isEmpty: () => false,
            isEnemy: () => false,
            isCaptive: () => false,
            isWall: () => true,
            isStairs: () => false,
            isTicking: () => false,
          };
        }
        return new FakeSpace(true, false, false);
      },
      health: () => 20,
    });

    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("returns Space for empty cells (feel no longer returns None for empty floor)", () => {
    const source = [
      "class Player:",
      "    def play_turn(self, samurai):",
      "        space = samurai.feel()",
      "        if space.unit is None and space.terrain == Terrain.FLOOR:",
      "            samurai.walk()",
      "        else:",
      "            samurai.attack()",
    ].join("\n");

    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({
      feel: () => new FakeSpace(false, false, true),
    });
    player.playTurn(turn as never);
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("uses backward as the default pivot direction", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        samurai.pivot()`;
    const player = compilePythonPlayer(source);
    const turn = new FakeTurn({});
    player.playTurn(turn as never);
    expect(turn.action).toEqual(["pivot!", "backward"]);
  });
});
