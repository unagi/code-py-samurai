import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level006 } from "../../../src/levels/intermediate";

describe("Intermediate Level 6", () => {
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
        const health = t.doSense("health") as number;
        const units = t.doSense("listen") as Space[];

        // Check adjacent spaces
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          const u = space.unit;
          // Rescue ticking captives immediately
          if (u?.isBound() && u.hasAbility("explode!")) {
            t.doAction("rescue!", dir);
            return;
          }
        }

        // If there's a ticking captive somewhere, rush toward it
        const ticking = units.find(
          (s) => s.unit?.isBound() && s.unit.hasAbility("explode!"),
        );
        if (ticking) {
          const tickDir = t.doSense(
            "direction_of",
            ticking,
          ) as RelativeDirection;
          const spaceInDir = t.doSense("feel", tickDir) as Space;
          const u = spaceInDir.unit;
          if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) {
            t.doAction("attack!", tickDir);
            return;
          }
          t.doAction("walk!", tickDir);
          return;
        }

        // Handle adjacent enemies/captives
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          const u = space.unit;
          if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) {
            t.doAction("attack!", dir);
            return;
          }
          if (u?.isBound()) {
            t.doAction("rescue!", dir);
            return;
          }
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

        // Rest if needed
        if (health < 15) {
          t.doAction("rest!");
          return;
        }

        // Head to stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level006);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level006);
    level.setup(player, inherited);
    // 4 units: 2 sludge + 2 captives (1 ticking)
    expect(level.floor.otherUnits).toHaveLength(4);
    // Floor is 6x2
    expect(level.floor.width).toBe(6);
    expect(level.floor.height).toBe(2);
  });
});
