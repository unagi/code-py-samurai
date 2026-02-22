import { describe, expect, it } from "vitest";

import { level001 } from "../../src/levels/beginner";
import { LevelSession } from "../../src/runtime/level-session";

describe("LevelSession", () => {
  it("sets up a playable level and exposes board/unit snapshots", () => {
    const session = new LevelSession();
    session.setup(
      level001,
      `class Player:\n    def play_turn(self, samurai):\n        samurai.walk()`,
      ["walk!"],
    );

    expect(session.canPlay).toBe(true);
    expect(session.hasSetupError).toBe(false);
    expect(session.hasLastValidPlayer).toBe(true);
    expect(session.board).toContain("@");
    expect(session.result).not.toBeNull();
    expect(session.result?.passed).toBe(false);
    expect(session.samuraiHealth).toBeTypeOf("number");
    expect(session.samuraiMaxHealth).toBeTypeOf("number");
    expect(session.unitSnapshots).toEqual([
      { unitId: "samurai", x: 0, y: 0, direction: "east" },
    ]);
  });

  it("logs setup error and fallback message when invalid code follows a valid player", () => {
    const session = new LevelSession();
    session.setup(
      level001,
      `class Player:\n    def play_turn(self, samurai):\n        samurai.walk()`,
      ["walk!"],
    );

    session.setup(level001, "class Player:\n    pass", ["walk!"]);

    expect(session.hasSetupError).toBe(true);
    expect(session.hasLastValidPlayer).toBe(true);
    expect(session.canPlay).toBe(false);
    expect(session.board).toContain("@");
    expect(session.entries.map((entry) => entry.key)).toContain("logs.pythonError");
    expect(session.entries.map((entry) => entry.key)).toContain("logs.systemFallback");
  });

  it("catches runtime errors during step and disables further play", () => {
    const session = new LevelSession();
    session.setup(
      level001,
      `class Player:\n    def play_turn(self, samurai):\n        x = not_defined_value`,
      [],
    );

    expect(session.canPlay).toBe(true);
    expect(session.step()).toBe(false);
    expect(session.canPlay).toBe(false);
    expect(session.entries.map((entry) => entry.key)).toContain("logs.pythonError");
  });

  it("returns false from resetWithLastValid when no valid player exists", () => {
    const session = new LevelSession();
    session.setup(level001, "class Player:\n    pass");

    expect(session.resetWithLastValid(level001)).toBe(false);
  });

  it("exposes fallback-only state when initial setup fails without a valid player", () => {
    const session = new LevelSession();
    session.setup(level001, "class Player:\n    pass");

    expect(session.hasSetupError).toBe(true);
    expect(session.hasLastValidPlayer).toBe(false);
    expect(session.canPlay).toBe(false);
    expect(session.board).toContain("@");
    expect(session.step()).toBe(false);
    expect(session.result).toBeNull();
    expect(session.samuraiHealth).toBeNull();
    expect(session.samuraiMaxHealth).toBeNull();
    expect(session.unitSnapshots).toEqual([]);
  });

  it("can reset using the last valid player after a setup error", () => {
    const session = new LevelSession();
    session.setup(
      level001,
      `class Player:\n    def play_turn(self, samurai):\n        samurai.walk()`,
      ["walk!"],
    );
    session.setup(level001, "class Player:\n    pass", ["walk!"]);

    expect(session.resetWithLastValid(level001)).toBe(true);
    expect(session.hasSetupError).toBe(false);
    expect(session.canPlay).toBe(true);
    expect(session.board).toContain("@");
  });
});
