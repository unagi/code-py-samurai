import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import { level009 } from "../../src/levels/beginner";

describe("Beginner Level 9", () => {
  const inherited = [
    "walk!", "feel", "attack!", "health", "rest!", "rescue!", "pivot!",
    "look", "shoot!",
  ];

  it("is passed with pivot-west-first strategy", () => {
    // Strategy: immediately pivot west, shoot archer, walk to stairs@0
    // East enemies (TS@7, wizard@9) can't reach warrior going west
    let pivoted = false;
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const fwd = t.doSense("feel", "forward") as Space;

        if (!pivoted) {
          t.doAction("pivot!");
          pivoted = true;
          return;
        }

        // Look forward (west) and shoot enemies
        const spaces = t.doSense("look", "forward") as Space[];
        for (const space of spaces) {
          if (space.isEnemy()) {
            t.doAction("shoot!", "forward");
            return;
          }
          if (!space.isEmpty()) break;
        }

        // Rescue captives, walk forward
        if (fwd.isCaptive()) {
          t.doAction("rescue!", "forward");
        } else if (fwd.isEnemy()) {
          t.doAction("attack!", "forward");
        } else {
          t.doAction("walk!", "forward");
        }
      },
    };
    const level = new Level(level009);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level009);
    level.setup(player, inherited);
    expect(level.floor.otherUnits).toHaveLength(5);
  });

  it("fails if warrior only walks", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };
    const level = new Level(level009);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.failed).toBe(true);
  });
});
