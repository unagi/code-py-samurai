import { describe, it, expect } from "vitest";
import { Health } from "@engine/abilities/health";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("health");
  floor.add(samurai, 0, 0, "east");
  return { samurai };
}

describe("Health", () => {
  it("returns current health at full", () => {
    const { samurai } = setup();
    const health = samurai.abilities.get("health") as Health;
    expect(health.perform()).toBe(20);
  });

  it("returns current health after damage", () => {
    const { samurai } = setup();
    samurai.takeDamage(7);
    const health = samurai.abilities.get("health") as Health;
    expect(health.perform()).toBe(13);
  });
});
