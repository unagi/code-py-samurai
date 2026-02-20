import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import level005 from "../../src/levels/beginner/level-005";

describe("Beginner Level 5", () => {
  const inherited = ["walk!", "feel", "attack!", "health", "rest!"];

  it("is passed with rescue+fight strategy", () => {
    let lastHealth = 20;
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const space = t.doSense("feel", "forward") as Space;
        if (space.isCaptive()) {
          t.doAction("rescue!", "forward");
        } else if (space.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if (health < 20 && health >= lastHealth) {
          t.doAction("rest!");
        } else {
          t.doAction("walk!", "forward");
        }
        lastHealth = health;
      },
    };
    const level = new Level(level005);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
    expect(result.warriorScore).toBeGreaterThan(0);
  });

  it("has captives on the floor", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level005);
    level.setup(player, inherited);
    // 2 captives + 2 archers + 1 thick sludge = 5 other units
    expect(level.floor.otherUnits).toHaveLength(5);
  });
});
