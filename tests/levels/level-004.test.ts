import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import { level004 } from "../../src/levels/beginner";

describe("Beginner Level 4", () => {
  // Inherited abilities from levels 1-3
  const inherited = ["walk!", "feel", "attack!", "health", "rest!"];

  it("is passed with health-tracking rest strategy", () => {
    let lastHealth = 20;
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const space = t.doSense("feel", "forward") as Space;
        if (!space.isEmpty() && space.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if (health < 20 && health >= lastHealth) {
          t.doAction("rest!");
        } else {
          t.doAction("walk!", "forward");
        }
        lastHealth = health;
      },
    };
    const level = new Level(level004);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("fails if samurai only walks", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };
    const level = new Level(level004);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.failed).toBe(true);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level004);
    level.setup(player, inherited);
    // 3 enemies: 2 thick sludge + 1 archer
    expect(level.floor.otherUnits).toHaveLength(3);
  });
});
