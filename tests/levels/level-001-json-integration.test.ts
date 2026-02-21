import { describe, expect, it } from "vitest";

import { Level } from "@engine/level";
import { compilePythonPlayer } from "@runtime/python-player";

import level001 from "../../src/levels/beginner/level-001";

describe("beginner level 001 json integration", () => {
  it("clears with simple walk strategy", () => {
    const source = `class Player:\n    def play_turn(self, warrior):\n        warrior.walk()`;
    const player = compilePythonPlayer(source);
    const level = new Level(level001);
    level.setup(player);

    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.turns).toBe(7);
  });
});
