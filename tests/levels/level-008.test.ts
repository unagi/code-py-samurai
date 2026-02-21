import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import { level008 } from "../../src/levels/beginner";

describe("Beginner Level 8", () => {
  const inherited = [
    "walk!", "feel", "attack!", "health", "rest!", "rescue!", "pivot!",
  ];

  it("is passed with look+shoot+rescue strategy", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const fwd = t.doSense("feel", "forward") as Space;
        if (fwd.isCaptive()) {
          t.doAction("rescue!", "forward");
          return;
        }
        // Look forward for enemies to shoot
        const spaces = t.doSense("look", "forward") as Space[];
        for (const space of spaces) {
          if (space.isEnemy()) {
            t.doAction("shoot!", "forward");
            return;
          }
          if (!space.isEmpty()) break;
        }
        // Walk forward if nothing to do
        t.doAction("walk!", "forward");
      },
    };
    const level = new Level(level008);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("cannot pass by walking only (blocked by captive)", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };
    const level = new Level(level008);
    level.setup(player, inherited);
    const result = level.play(50);
    // Warrior bumps into captive forever, never passes
    expect(result.passed).toBe(false);
  });
});
