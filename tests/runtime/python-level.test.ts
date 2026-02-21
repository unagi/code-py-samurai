import { describe, expect, it } from "vitest";

import { Level } from "@engine/level";
import { compilePythonPlayer } from "@runtime/python-player";

import { level001, level002, level003 } from "../../src/levels/beginner";

describe("python runtime level integration", () => {
  it("clears beginner level 1 with walk strategy", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        warrior.walk()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.turns).toBe(7);
  });

  it("clears beginner level 2 with feel+attack strategy", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        space = warrior.feel()\n        if space is None:\n            warrior.walk()\n        else:\n            warrior.attack()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level002);
    level.setup(player, ["walk!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.warriorScore).toBe(12);
  });

  it("clears beginner level 3 with rest+attack strategy", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        space = warrior.feel()\n        if space is None:\n            if warrior.hp < 20:\n                warrior.rest()\n            else:\n                warrior.walk()\n        elif space.is_enemy():\n            warrior.attack()\n        elif warrior.hp < 20:\n            warrior.rest()\n        else:\n            warrior.walk()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level003);
    level.setup(player, ["feel", "attack!", "walk!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.warriorScore).toBe(48);
  });
});
