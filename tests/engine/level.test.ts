import { describe, expect, it } from "vitest";

import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import { level001 } from "../../src/levels/beginner";

const walkingPlayer: IPlayer = {
  playTurn(turn: ITurn): void {
    (turn as Turn).doAction("walk!", "forward");
  },
};

describe("Level setup", () => {
  it("ignores unknown unit types gracefully", () => {
    const definition = {
      ...level001,
      units: [{ type: "unknown-monster", x: 3, y: 0, direction: "east" as const }],
    };
    const level = new Level(definition);
    // Should not throw even though unit type is unrecognised
    level.setup(walkingPlayer, ["walk!"]);
    // Only the warrior should be on the floor
    expect(level.floor.units.length).toBe(1);
  });
});

describe("Level step API", () => {
  it("updates turn count one step at a time", () => {
    const level = new Level(level001);
    level.setup(walkingPlayer, ["walk!"]);

    expect(level.turnCount).toBe(0);

    level.step();
    expect(level.turnCount).toBe(1);

    level.step();
    expect(level.turnCount).toBe(2);
  });

  it("produces same result as play() with equivalent turns", () => {
    const stepped = new Level(level001);
    stepped.setup(walkingPlayer, ["walk!"]);
    while (stepped.step()) {
      // keep stepping until done
    }

    const played = new Level(level001);
    played.setup(walkingPlayer, ["walk!"]);

    expect(stepped.result()).toEqual(played.play());
  });
});
