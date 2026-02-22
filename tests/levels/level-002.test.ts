import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import type { IPlayer, ITurn } from "@engine/types";
import { Turn } from "@engine/turn";
import type { Space } from "@engine/space";
import { level002 } from "../../src/levels/beginner";

describe("Beginner Level 2", () => {
  it("is passed by feel+attack/walk strategy", () => {
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

    const level = new Level(level002);
    level.setup(player, ["walk!", "feel", "attack!"]);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("earns samurai score from killing sludge (12 HP)", () => {
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

    const level = new Level(level002);
    level.setup(player, ["walk!", "feel", "attack!"]);
    const result = level.play();

    expect(result.samuraiScore).toBe(12); // Sludge maxHealth = 12
  });

  it("samurai takes damage from sludge attacks", () => {
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

    const level = new Level(level002);
    level.setup(player, ["walk!", "feel", "attack!"]);
    level.play();

    // Samurai should have taken some damage from Sludge (attack=3)
    expect(level.samurai.health).toBeLessThan(20);
  });

  it("fails if samurai only walks (dies to sludge)", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };

    const level = new Level(level002);
    level.setup(player, ["walk!"]);
    const result = level.play();

    // Walking into sludge means bumping, then getting attacked
    // Eventually samurai dies
    expect(result.failed).toBe(true);
  });
});
