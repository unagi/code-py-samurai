import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import level002 from "../../../src/levels/intermediate/level-002";

describe("Intermediate Level 2", () => {
  const inherited = ["walk!", "feel", "direction_of_stairs"];

  it("passes with solving strategy", () => {
    const directions: RelativeDirection[] = [
      "forward",
      "left",
      "right",
      "backward",
    ];

    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;

        // Check all directions for enemies
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isEnemy()) {
            t.doAction("attack!", dir);
            return;
          }
        }

        // Rest if low health and no enemies adjacent
        if (health < 15) {
          t.doAction("rest!");
          return;
        }

        // Walk toward stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level002);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level002);
    level.setup(player, inherited);
    // 3 units: sludge, thick_sludge, sludge
    expect(level.floor.otherUnits).toHaveLength(3);
    // Floor is 4x2
    expect(level.floor.width).toBe(4);
    expect(level.floor.height).toBe(2);
  });
});
