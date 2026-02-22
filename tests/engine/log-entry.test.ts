import { describe, it, expect } from "vitest";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";
import { ThickSludge } from "@engine/units/thick-sludge";
import { Archer } from "@engine/units/archer";
import { Captive } from "@engine/units/captive";
import { Golem } from "@engine/units/golem";
import { Wizard } from "@engine/units/wizard";
import { Floor } from "@engine/floor";
import { Space } from "@engine/space";
import type { LogEntry } from "@engine/log-entry";
import type { ILogger } from "@engine/types";

class CapturingLogger implements ILogger {
  entries: LogEntry[] = [];
  log(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

describe("BaseUnit.nameKey", () => {
  it("returns correct key for each unit type", () => {
    expect(new Warrior().nameKey).toBe("warrior");
    expect(new Sludge().nameKey).toBe("sludge");
    expect(new ThickSludge().nameKey).toBe("thickSludge");
    expect(new Archer().nameKey).toBe("archer");
    expect(new Wizard().nameKey).toBe("wizard");
    expect(new Captive().nameKey).toBe("captive");
    expect(new Golem().nameKey).toBe("golem");
  });
});

describe("Space.nameKey", () => {
  function makeFloor(w = 8, h = 1): Floor {
    const f = new Floor(w, h);
    f.placeStairs(w - 1, 0);
    return f;
  }

  it("returns unit nameKey when occupied", () => {
    const floor = makeFloor();
    const sludge = new Sludge();
    floor.add(sludge, 3, 0, "east");
    const space = floor.space(3, 0);
    expect(space.nameKey).toBe("sludge");
  });

  it('returns "wall" for out-of-bounds', () => {
    const floor = makeFloor();
    const space = new Space(floor, -1, 0);
    expect(space.nameKey).toBe("wall");
  });

  it('returns "nothing" for empty space', () => {
    const floor = makeFloor();
    const space = floor.space(1, 0);
    expect(space.nameKey).toBe("nothing");
  });
});

function setupWarrior(): { logger: CapturingLogger; warrior: Warrior; floor: Floor } {
  const logger = new CapturingLogger();
  const warrior = new Warrior(logger);
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  floor.add(warrior, 0, 0, "east");
  warrior.addAbilities("walk!", "attack!", "rest!");
  return { logger, warrior, floor };
}

describe("LogEntry emission", () => {
  it("walk emits engine.walk", () => {
    const { logger, warrior } = setupWarrior();
    warrior.abilities.get("walk!")!.perform("forward");
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ key: "engine.walk", params: { direction: "forward" } }),
    );
  });

  it("attack miss emits engine.attackMiss", () => {
    const { logger, warrior } = setupWarrior();
    warrior.abilities.get("attack!")!.perform("forward");
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ key: "engine.attackMiss", params: { direction: "forward" } }),
    );
  });

  it("attack hit emits engine.attackHit with target nameKey", () => {
    const { logger, warrior, floor } = setupWarrior();
    const sludge = new Sludge(logger);
    floor.add(sludge, 1, 0, "west");
    warrior.abilities.get("attack!")!.perform("forward");
    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        key: "engine.attackHit",
        params: { direction: "forward", target: "sludge" },
      }),
    );
  });

  it("takeDamage emits engine.takeDamage", () => {
    const { logger, warrior } = setupWarrior();
    warrior.takeDamage(3);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({
        key: "engine.takeDamage",
        params: { amount: 3, health: 17 },
      }),
    );
  });

  it("rest emits engine.restHeal", () => {
    const { logger, warrior } = setupWarrior();
    warrior.takeDamage(5);
    logger.entries.length = 0;
    warrior.abilities.get("rest!")!.perform();
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ key: "engine.restHeal" }),
    );
  });

  it("idle emits engine.idle when no action", () => {
    const { logger, warrior } = setupWarrior();
    warrior.prepareTurn();
    warrior.performTurn();
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ key: "engine.idle", params: {} }),
    );
  });

  it("earnPoints emits engine.earnPoints", () => {
    const { logger, warrior } = setupWarrior();
    warrior.earnPoints(10);
    expect(logger.entries).toContainEqual(
      expect.objectContaining({ key: "engine.earnPoints", params: { points: 10 } }),
    );
  });
});
