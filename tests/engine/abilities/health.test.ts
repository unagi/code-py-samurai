import { describe, it, expect } from "vitest";
import { Health } from "@engine/abilities/health";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("health");
  floor.add(warrior, 0, 0, "east");
  return { warrior };
}

describe("Health", () => {
  it("returns current health at full", () => {
    const { warrior } = setup();
    const health = warrior.abilities.get("health") as Health;
    expect(health.perform()).toBe(20);
  });

  it("returns current health after damage", () => {
    const { warrior } = setup();
    warrior.takeDamage(7);
    const health = warrior.abilities.get("health") as Health;
    expect(health.perform()).toBe(13);
  });
});
