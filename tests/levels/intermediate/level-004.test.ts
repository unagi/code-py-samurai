import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import level004 from "../../../src/levels/intermediate/level-004";

describe("Intermediate Level 4", () => {
  const inherited = [
    "walk!",
    "feel",
    "direction_of_stairs",
    "attack!",
    "health",
    "rest!",
    "rescue!",
    "bind!",
  ];

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
        const units = t.doSense("listen") as Space[];

        // Check adjacent enemies and captives
        const adjacentEnemies: RelativeDirection[] = [];
        let adjacentCaptive: RelativeDirection | null = null;
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isEnemy()) {
            adjacentEnemies.push(dir);
          } else if (space.isCaptive()) {
            adjacentCaptive = dir;
          }
        }

        // If adjacent enemy, attack it
        if (adjacentEnemies.length > 0) {
          t.doAction("attack!", adjacentEnemies[0]);
          return;
        }

        // Rescue adjacent captive
        if (adjacentCaptive) {
          t.doAction("rescue!", adjacentCaptive);
          return;
        }

        // Rest if health is low and no adjacent enemies
        if (health < 15) {
          t.doAction("rest!");
          return;
        }

        // Walk toward first unit (enemy or captive)
        if (units.length > 0) {
          const target = units[0];
          const dir = t.doSense(
            "direction_of",
            target,
          ) as RelativeDirection;
          t.doAction("walk!", dir);
          return;
        }

        // Head to stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level004);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level004);
    level.setup(player, inherited);
    // 5 units: 2 captives + 2 sludge + 1 thick_sludge
    expect(level.floor.otherUnits).toHaveLength(5);
    // Floor is 4x3
    expect(level.floor.width).toBe(4);
    expect(level.floor.height).toBe(3);
  });
});
