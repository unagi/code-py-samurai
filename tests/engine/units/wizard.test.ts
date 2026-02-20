import { describe, it, expect } from "vitest";
import { Wizard } from "@engine/units/wizard";
import { Warrior } from "@engine/units/warrior";
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

  it("shoots player at range with high damage", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    floor.add(warrior, 0, 0, "east");
    const wizard = new Wizard();
    floor.add(wizard, 3, 0, "west");
    wizard.prepareTurn();
    wizard.performTurn();
    expect(warrior.health).toBe(20 - 11);
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
