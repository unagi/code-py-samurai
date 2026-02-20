import { describe, it, expect } from "vitest";
import { Shoot } from "@engine/abilities/shoot";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

describe("Shoot", () => {
  function setup() {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("shoot!");
    floor.add(warrior, 0, 0, "east");
    return { floor, warrior };
  }

  it("hits enemy at range 1", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const startHealth = sludge.health;
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - warrior.shootPower);
  });

  it("hits first enemy at range 2 (skips empty space)", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    const startHealth = sludge.health;
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - warrior.shootPower);
  });

  it("hits first enemy at range 3", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 3, 0, "west");
    const startHealth = sludge.health;
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - warrior.shootPower);
  });

  it("hits first unit only (doesn't pierce)", () => {
    const { floor, warrior } = setup();
    const sludge1 = new Sludge();
    const sludge2 = new Sludge();
    floor.add(sludge1, 1, 0, "west");
    floor.add(sludge2, 2, 0, "west");
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge1.health).toBeLessThan(sludge1.maxHealth);
    expect(sludge2.health).toBe(sludge2.maxHealth);
  });

  it("does nothing when no target in range", () => {
    const { warrior } = setup();
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(warrior.score).toBe(0);
  });

  it("earns points when killing with shoot", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    sludge.health = 2; // low enough to die from shootPower=3
    const shoot = warrior.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.isAlive()).toBe(false);
    expect(warrior.score).toBe(sludge.maxHealth);
  });
});
