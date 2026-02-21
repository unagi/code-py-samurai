import { describe, expect, it } from "vitest";

import { compilePythonPlayer } from "@runtime/python-player";

class FakeSpace {
  constructor(
    private readonly enemy: boolean,
    private readonly captive: boolean,
    private readonly empty: boolean,
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

  it("executes if/elif/else by sensed space and health", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        space = warrior.feel()\n        if space.is_enemy():\n            warrior.attack()\n        elif warrior.health() < 8:\n            warrior.rest()\n        else:\n            warrior.walk()`;

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

  it("throws on unsupported syntax", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        for x in range(3):\n            warrior.walk()`;

    expect(() => compilePythonPlayer(source)).toThrow(/unsupported/i);
  });
});
