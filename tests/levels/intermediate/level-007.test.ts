import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import level007 from "../../../src/levels/intermediate/level-007";

describe("Intermediate Level 7", () => {
  const inherited = [
    "walk!",
    "feel",
    "direction_of_stairs",
    "attack!",
    "health",
    "rest!",
    "rescue!",
    "bind!",
    "listen",
    "direction_of",
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
        const units = t.doSense("listen") as Space[];

        // Check adjacent for ticking captive (urgent rescue)
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isCaptive() && space.isTicking()) {
            t.doAction("rescue!", dir);
            return;
          }
        }

        // Find the ticking captive direction (priority target)
        const ticking = units.find(
          (u) => u.isCaptive() && u.isTicking(),
        );

        // Count adjacent enemies
        const adjacentEnemies: RelativeDirection[] = [];
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isEnemy()) {
            adjacentEnemies.push(dir);
          }
        }

        // If ticking captive exists, rush toward it
        if (ticking) {
          const tickDir = t.doSense(
            "direction_of",
            ticking,
          ) as RelativeDirection;

          // If enemy is in the direction of the ticking captive, attack it
          const spaceInDir = t.doSense("feel", tickDir) as Space;
          if (spaceInDir.isEnemy()) {
            // Bind other enemies if multiple are adjacent
            if (adjacentEnemies.length >= 2) {
              const otherEnemy = adjacentEnemies.find(
                (d) => d !== tickDir,
              );
              if (otherEnemy) {
                t.doAction("bind!", otherEnemy);
                return;
              }
            }
            t.doAction("attack!", tickDir);
            return;
          }

          // Walk toward ticking captive
          t.doAction("walk!", tickDir);
          return;
        }

        // No ticking captive - handle adjacent captives
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isCaptive()) {
            t.doAction("rescue!", dir);
            return;
          }
        }

        // Attack adjacent enemies
        if (adjacentEnemies.length > 0) {
          t.doAction("attack!", adjacentEnemies[0]);
          return;
        }

        // Walk toward remaining units
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

    const level = new Level(level007);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level007);
    level.setup(player, inherited);
    // 5 units: 3 sludge + 1 ticking captive + 1 captive
    expect(level.floor.otherUnits).toHaveLength(5);
    // Floor is 5x3
    expect(level.floor.width).toBe(5);
    expect(level.floor.height).toBe(3);
  });
});
