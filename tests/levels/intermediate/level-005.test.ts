import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import { Terrain } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level005 } from "../../../src/levels/intermediate";

describe("Intermediate Level 5", () => {
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
          if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) {
            t.doAction("attack!", dir);
            return;
          }
          if (u?.isBound()) {
            t.doAction("rescue!", dir);
            return;
          }
        }

        // If enemies/captives still exist, walk toward first one
        const nonStairsUnits = units.filter((u) => u.terrain !== Terrain.Stairs);
        if (nonStairsUnits.length > 0 || units.length > 0) {
          // Prioritize enemies/captives over stairs
          for (const s of units) {
            const u = s.unit;
            if ((u && !u.isSamurai() && !u.isGolem() && !u.isBound()) || u?.isBound()) {
              const dir = t.doSense(
                "direction_of",
                s,
              ) as RelativeDirection;
              t.doAction("walk!", dir);
              return;
            }
          }
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

    const level = new Level(level005);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level005);
    level.setup(player, inherited);
    // 3 units: 2 thick_sludge + 1 captive
    expect(level.floor.otherUnits).toHaveLength(3);
    // Floor is 5x2
    expect(level.floor.width).toBe(5);
    expect(level.floor.height).toBe(2);
  });
});
