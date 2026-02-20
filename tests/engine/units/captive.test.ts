import { describe, it, expect } from "vitest";
import { Captive } from "@engine/units/captive";
import { Floor } from "@engine/floor";

describe("Captive", () => {
  it("has correct stats", () => {
    const captive = new Captive();
    expect(captive.maxHealth).toBe(1);
    expect(captive.health).toBe(1);
    expect(captive.character).toBe("C");
    expect(captive.name).toBe("Captive");
  });

  it("starts bound", () => {
    const captive = new Captive();
    expect(captive.isBound()).toBe(true);
  });

  it("can be unbound", () => {
    const captive = new Captive();
    captive.unbind();
    expect(captive.isBound()).toBe(false);
  });

  it("is not warrior, enemy, or golem", () => {
    const captive = new Captive();
    expect(captive.isWarrior()).toBe(false);
    expect(captive.isGolem()).toBe(false);
  });

  it("shows as captive in Space", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const captive = new Captive();
    floor.add(captive, 3, 0, "east");
    const space = floor.space(3, 0);
    expect(space.isCaptive()).toBe(true);
    expect(space.isEnemy()).toBe(false);
  });
});
