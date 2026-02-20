import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import level006 from "../../src/levels/beginner/level-006";

describe("Beginner Level 6", () => {
  const inherited = ["walk!", "feel", "attack!", "health", "rest!", "rescue!"];

  it("is passed with backward-rescue then forward-fight strategy", () => {
    let lastHealth = 20;
    let captiveRescued = false;
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const fwd = t.doSense("feel", "forward") as Space;
        const bwd = t.doSense("feel", "backward") as Space;

        if (!captiveRescued) {
          // Phase 1: go backward to rescue captive
          if (bwd.isCaptive()) {
            t.doAction("rescue!", "backward");
            captiveRescued = true;
            lastHealth = health;
            return;
          } else if (bwd.isWall()) {
            captiveRescued = true;
            // Fall through to phase 2 below
          } else {
            t.doAction("walk!", "backward");
            lastHealth = health;
            return;
          }
        }

        // Phase 2: fight forward with retreat+rest
        if (fwd.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if (health < 20 && health >= lastHealth) {
          t.doAction("rest!");
        } else if (health <= 10 && health < lastHealth && fwd.isEmpty()) {
          t.doAction("walk!", "backward");
        } else {
          t.doAction("walk!", "forward");
        }
        lastHealth = health;
      },
    };
    const level = new Level(level006);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.passed).toBe(true);
  });

  it("fails if warrior only walks forward", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };
    const level = new Level(level006);
    level.setup(player, inherited);
    const result = level.play();
    expect(result.failed).toBe(true);
  });
});
