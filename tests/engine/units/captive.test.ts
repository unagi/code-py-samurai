import { describe, it, expect } from "vitest";
import captiveGameplay from "@engine/unit-data/captive.gameplay.json";
import { Captive } from "@engine/units/captive";
import { Floor } from "@engine/floor";

describe("Captive", () => {
  it("has correct stats", () => {
    const captive = new Captive();
    expect(captive.maxHealth).toBe(1);
    expect(captive.health).toBe(1);
    expect(captive.attackPower).toBe(0);
    expect(captive.character).toBe("C");
    expect(captive.name).toBe("Captive");
  });

  it("matches gameplay JSON for base parameters", () => {
    const captive = new Captive();

    expect(captive.maxHealth).toBe(captiveGameplay.stats.maxHealth);
    expect(captive.attackPower).toBe(captiveGameplay.stats.attackPower);
    expect(captive.character).toBe(captiveGameplay.symbol);
    expect(captive.nameKey).toBe(captiveGameplay.nameKey);
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

  it("is not samurai, enemy, or golem", () => {
    const captive = new Captive();
    expect(captive.isSamurai()).toBe(false);
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
