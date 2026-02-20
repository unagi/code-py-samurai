import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import type { IPlayer, ITurn } from "@engine/types";
import { Turn } from "@engine/turn";
import level001 from "../../src/levels/beginner/level-001";

describe("Beginner Level 1", () => {
  it("is passed by walking forward every turn", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("completes in 7 turns (8 cells, start at 0, stairs at 7)", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    expect(result.turns).toBe(7);
  });

  it("earns time bonus (15 - 7 turns = 8)", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    expect(result.timeBonus).toBe(8); // 15 initial - 7 turns
  });

  it("gets S grade with clear bonus", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        (turn as Turn).doAction("walk!", "forward");
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    // No enemies, so warrior score = 0
    // Time bonus = 8
    // Clear bonus = round((0 + 8) * 0.2) = 2 (no other units)
    // Total = 0 + 8 + 2 = 10
    // ace_score = 10, grade = S
    expect(result.warriorScore).toBe(0);
    expect(result.clearBonus).toBe(2);
    expect(result.totalScore).toBe(10);
    expect(result.grade).toBe("S");
  });

  it("fails when player does nothing", () => {
    const player: IPlayer = {
      playTurn(_turn: ITurn) {
        // Do nothing - should timeout
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play(20); // Limit turns

    expect(result.passed).toBe(false);
    // Warrior is still alive, just didn't reach stairs
    expect(result.failed).toBe(false);
  });
});
