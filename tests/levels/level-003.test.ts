import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import type { IPlayer, ITurn } from "@engine/types";
import { Turn } from "@engine/turn";
import type { Space } from "@engine/space";
import { level003 } from "../../src/levels/beginner";

describe("Beginner Level 3", () => {
  it("is passed with rest+feel+attack+walk strategy", () => {
    // Level 3 gives: health, rest!, plus inherited feel, attack! from level 2
    // 4 sludges at positions 2, 4, 5, 7
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const space = t.doSense("feel", "forward") as Space;
        if (space.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if ((t.doSense("health") as number) < 20) {
          t.doAction("rest!");
        } else {
          t.doAction("walk!", "forward");
        }
      },
    };

    const level = new Level(level003);
    // Level 3 inherits abilities from previous levels
    level.setup(player, ["feel", "attack!", "walk!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("warrior earns points from 4 sludges (48 total)", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const space = t.doSense("feel", "forward") as Space;
        if (space.isEnemy()) {
          t.doAction("attack!", "forward");
        } else if ((t.doSense("health") as number) < 20) {
          t.doAction("rest!");
        } else {
          t.doAction("walk!", "forward");
        }
      },
    };

    const level = new Level(level003);
    level.setup(player, ["feel", "attack!", "walk!"]);
    const result = level.play();

    expect(result.warriorScore).toBe(48); // 4 * 12 = 48
  });

  it("fails without resting (warrior dies)", () => {
    // No resting - just attack and walk
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const space = t.doSense("feel", "forward") as Space;
        if (space.isEmpty()) {
          t.doAction("walk!", "forward");
        } else {
          t.doAction("attack!", "forward");
        }
      },
    };

    const level = new Level(level003);
    level.setup(player, ["feel", "attack!", "walk!"]);
    const result = level.play();

    // Without healing, 4 sludges dealing 3 damage each turn is too much
    expect(result.failed).toBe(true);
  });
});
