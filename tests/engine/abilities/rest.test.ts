import { describe, it, expect } from "vitest";
import { Rest } from "@engine/abilities/rest";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("rest!");
  floor.add(samurai, 0, 0, "east");
  return { samurai };
}

describe("Rest", () => {
  it("heals 10% of max health", () => {
    const { samurai } = setup();
    samurai.takeDamage(10); // health = 10
    const rest = samurai.abilities.get("rest!") as Rest;
    rest.perform();
    // 10% of 20 = 2
    expect(samurai.health).toBe(12);
  });

  it("does not heal above max health", () => {
    const { samurai } = setup();
    samurai.takeDamage(1); // health = 19
    const rest = samurai.abilities.get("rest!") as Rest;
    rest.perform();
    expect(samurai.health).toBe(20);
  });

  it("does nothing at full health", () => {
    const { samurai } = setup();
    const rest = samurai.abilities.get("rest!") as Rest;
    rest.perform();
    expect(samurai.health).toBe(20);
  });

  it("heals correctly over multiple rests", () => {
    const { samurai } = setup();
    samurai.takeDamage(15); // health = 5
    const rest = samurai.abilities.get("rest!") as Rest;
    rest.perform(); // +2 → 7
    rest.perform(); // +2 → 9
    rest.perform(); // +2 → 11
    expect(samurai.health).toBe(11);
  });
});
