import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level003 } from "../../../src/levels/intermediate";

describe("Intermediate Level 3", () => {
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

        // Count enemies and find them
        const enemies: RelativeDirection[] = [];
        let captiveDir: RelativeDirection | null = null;
        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          const u = space.unit;
          if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) {
            enemies.push(dir);
          } else if (u?.isBound()) {
            captiveDir = dir;
          }
        }

        // If 2+ enemies, bind one to reduce threat
        if (enemies.length >= 2) {
          t.doAction("bind!", enemies[0]);
          return;
        }

        // If 1 enemy, attack it
        if (enemies.length === 1) {
          t.doAction("attack!", enemies[0]);
          return;
        }

        // Rescue captive if nearby
        if (captiveDir) {
          t.doAction("rescue!", captiveDir);
          return;
        }

        // Walk toward stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level003);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level003);
    level.setup(player, inherited);
    // 4 units: 3 sludge + 1 captive
    expect(level.floor.otherUnits).toHaveLength(4);
    // Floor is 3x3
    expect(level.floor.width).toBe(3);
    expect(level.floor.height).toBe(3);
  });
});
