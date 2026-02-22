import { describe, expect, it } from "vitest";

import { Level } from "@engine/level";
import { compilePythonPlayer } from "@runtime/python-player";

import { level001, level002, level003 } from "../../src/levels/beginner";

describe("python runtime level integration", () => {
  it("clears beginner level 1 with walk strategy", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        samurai.walk()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level001);
    level.setup(player, ["walk!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.turns).toBe(7);
  });

  it("clears beginner level 2 with feel+attack strategy", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space is None:\n            samurai.walk()\n        else:\n            samurai.attack()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level002);
    level.setup(player, ["walk!", "feel", "attack!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.samuraiScore).toBe(12);
  });

  it("clears beginner level 3 with rest+attack strategy", () => {
    const source = `class Player:\n    def play_turn(self, samurai):\n        space = samurai.feel()\n        if space is None:\n            if samurai.hp < 20:\n                samurai.rest()\n            else:\n                samurai.walk()\n        elif space.is_enemy():\n            samurai.attack()\n        elif samurai.hp < 20:\n            samurai.rest()\n        else:\n            samurai.walk()`;

    const player = compilePythonPlayer(source);
    const level = new Level(level003);
    level.setup(player, ["feel", "attack!", "walk!", "health", "rest!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.samuraiScore).toBe(48);
  });
});
