import { describe, it, expect } from "vitest";
import { Shoot } from "@engine/abilities/shoot";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("shoot!");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Shoot", () => {
  it("hits enemy at range 1", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const startHealth = sludge.health;
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - samurai.shootPower);
  });

  it("hits first enemy at range 2 (skips empty space)", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    const startHealth = sludge.health;
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - samurai.shootPower);
  });

  it("hits first enemy at range 3", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 3, 0, "west");
    const startHealth = sludge.health;
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.health).toBe(startHealth - samurai.shootPower);
  });

  it("hits first unit only (doesn't pierce)", () => {
    const { floor, samurai } = setup();
    const sludge1 = new Sludge();
    const sludge2 = new Sludge();
    floor.add(sludge1, 1, 0, "west");
    floor.add(sludge2, 2, 0, "west");
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge1.health).toBeLessThan(sludge1.maxHealth);
    expect(sludge2.health).toBe(sludge2.maxHealth);
  });

  it("does nothing when no target in range", () => {
    const { samurai } = setup();
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(samurai.score).toBe(0);
  });

  it("earns points when killing with shoot", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    sludge.health = 2; // low enough to die from shootPower=3
    const shoot = samurai.abilities.get("shoot!") as Shoot;
    shoot.perform("forward");
    expect(sludge.isAlive()).toBe(false);
    expect(samurai.score).toBe(sludge.maxHealth);
  });
});
