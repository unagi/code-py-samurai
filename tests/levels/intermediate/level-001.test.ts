import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { RelativeDirection } from "@engine/direction";
import level001 from "../../../src/levels/intermediate/level-001";

describe("Intermediate Level 1", () => {
  it("passes with solving strategy", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const dir = t.doSense("direction_of_stairs") as RelativeDirection;
        t.doAction("walk!", dir);
      },
    };

    const level = new Level(level001);
    level.setup(player);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level001);
    level.setup(player);
    // No units on this level
    expect(level.floor.otherUnits).toHaveLength(0);
    // Floor is 6x4
    expect(level.floor.width).toBe(6);
    expect(level.floor.height).toBe(4);
  });
});
