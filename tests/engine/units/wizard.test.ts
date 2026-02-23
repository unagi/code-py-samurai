import { describe, it, expect } from "vitest";
import wizardGameplay from "@engine/unit-data/wizard.gameplay.json";
import { Wizard } from "@engine/units/wizard";
import { Samurai } from "@engine/units/samurai";
import { Floor } from "@engine/floor";

describe("Wizard", () => {
  it("has correct stats (high shoot damage, low health)", () => {
    const wizard = new Wizard();
    expect(wizard.shootPower).toBe(11);
    expect(wizard.maxHealth).toBe(3);
    expect(wizard.health).toBe(3);
    expect(wizard.character).toBe("w");
    expect(wizard.name).toBe("Wizard");
  });

  it("has look and shoot abilities", () => {
    const wizard = new Wizard();
    expect(wizard.hasAbility("look")).toBe(true);
    expect(wizard.hasAbility("shoot!")).toBe(true);
  });

  it("matches gameplay JSON for base parameters", () => {
    const wizard = new Wizard();

    expect(wizard.maxHealth).toBe(wizardGameplay.stats.maxHealth);
    expect(wizard.shootPower).toBe(wizardGameplay.stats.shootPower ?? wizardGameplay.stats.attackPower);
    expect(wizard.character).toBe(wizardGameplay.symbol);
    expect(wizard.nameKey).toBe(wizardGameplay.nameKey);
  });

  it("shoots player at range with high damage", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    floor.add(samurai, 0, 0, "east");
    const wizard = new Wizard();
    floor.add(wizard, 3, 0, "west");
    wizard.prepareTurn();
    wizard.performTurn();
    expect(samurai.health).toBe(20 - 11);
  });

  it("dies easily (low health)", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const wizard = new Wizard();
    floor.add(wizard, 4, 0, "west");
    wizard.takeDamage(3);
    expect(wizard.isAlive()).toBe(false);
  });
});
