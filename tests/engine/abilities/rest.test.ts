import { describe, it, expect } from "vitest";
import { Rest } from "@engine/abilities/rest";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("rest!");
  floor.add(warrior, 0, 0, "east");
  return { warrior };
}

describe("Rest", () => {
  it("heals 10% of max health", () => {
    const { warrior } = setup();
    warrior.takeDamage(10); // health = 10
    const rest = warrior.abilities.get("rest!") as Rest;
    rest.perform();
    // 10% of 20 = 2
    expect(warrior.health).toBe(12);
  });

  it("does not heal above max health", () => {
    const { warrior } = setup();
    warrior.takeDamage(1); // health = 19
    const rest = warrior.abilities.get("rest!") as Rest;
    rest.perform();
    expect(warrior.health).toBe(20);
  });

  it("does nothing at full health", () => {
    const { warrior } = setup();
    const rest = warrior.abilities.get("rest!") as Rest;
    rest.perform();
    expect(warrior.health).toBe(20);
  });

  it("heals correctly over multiple rests", () => {
    const { warrior } = setup();
    warrior.takeDamage(15); // health = 5
    const rest = warrior.abilities.get("rest!") as Rest;
    rest.perform(); // +2 → 7
    rest.perform(); // +2 → 9
    rest.perform(); // +2 → 11
    expect(warrior.health).toBe(11);
  });
});
