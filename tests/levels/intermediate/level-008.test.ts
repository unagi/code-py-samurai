import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import { level008 } from "../../../src/levels/intermediate";

describe("Intermediate Level 8", () => {
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
    "look",
    "detonate!",
  ];

  it("passes with solving strategy", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const spaces = t.doSense("look", "forward") as Space[];
        const fwd = t.doSense("feel", "forward") as Space;
        const units = t.doSense("listen") as Space[];

        // If first two spaces both have enemies, detonate
        if (
          spaces.length >= 2 &&
          spaces[0].unit && !spaces[0].unit.isSamurai() && !spaces[0].unit.isGolem() && !spaces[0].unit.isBound() &&
          spaces[1].unit && !spaces[1].unit.isSamurai() && !spaces[1].unit.isGolem() && !spaces[1].unit.isBound()
        ) {
          t.doAction("detonate!", "forward");
          return;
        }

        // If adjacent enemy, attack
        const fwdU = fwd.unit;
        if (fwdU && !fwdU.isSamurai() && !fwdU.isGolem() && !fwdU.isBound()) {
          t.doAction("attack!", "forward");
          return;
        }

        // Rescue adjacent captive
        if (fwdU?.isBound()) {
          t.doAction("rescue!", "forward");
          return;
        }

        // Check if there's a ticking captive - don't waste time resting
        const hasTicking = units.some(
          (s) => s.unit?.isBound() && s.unit.hasAbility("explode!"),
        );

        // Only rest if no ticking captive to save and health is low
        if (!hasTicking && health < 10) {
          t.doAction("rest!");
          return;
        }

        // Walk forward
        t.doAction("walk!", "forward");
      },
    };

    const level = new Level(level008);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level008);
    level.setup(player, inherited);
    // 3 units: thick_sludge + sludge + ticking captive
    expect(level.floor.otherUnits).toHaveLength(3);
    // Floor is 7x1
    expect(level.floor.width).toBe(7);
    expect(level.floor.height).toBe(1);
  });
});
