import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import { level007 } from "../../src/levels/beginner";

describe("Beginner Level 7", () => {
  const inherited = [
    "walk!", "feel", "attack!", "health", "rest!", "rescue!", "pivot!",
  ];

  it("is passed with pivot+fight+retreat strategy", () => {
    let pivoted = false;
    let lastHealth = 20;
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const fwd = t.doSense("feel", "forward") as Space;
        if (fwd.isWall() && !pivoted) {
          t.doAction("pivot!");
          pivoted = true;
        } else if (fwd.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if (health < 20 && health >= lastHealth) {
          t.doAction("rest!");
        } else if (health <= 10 && health < lastHealth && fwd.isEmpty()) {
          // Retreat from ranged damage to rest safely
          t.doAction("walk!", "backward");
        } else {
          t.doAction("walk!", "forward");
        }
        lastHealth = health;
      },
    };
    const level = new Level(level007);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
  });

  it("fails without pivoting", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const fwd = t.doSense("feel", "forward") as Space;
        if (fwd.isEmpty()) {
          t.doAction("walk!", "forward");
        }
      },
    };
    const level = new Level(level007);
    level.setup(player, inherited);
    const result = level.play(50);
    expect(result.passed).toBe(false);
  });
});
