import { describe, it, expect } from "vitest";
import { DistanceOf } from "@engine/abilities/distance-of";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";

function setup() {
  const floor = new Floor(6, 4);
  floor.placeStairs(5, 3);
  const samurai = new Samurai();
  samurai.addAbilities("distance_of");
  floor.add(samurai, 2, 2, "east");
  const ability = samurai.abilities.get("distance_of") as DistanceOf;
  return { floor, samurai, ability };
}

describe("DistanceOf", () => {
  it("returns 0 for same position", () => {
    const { floor, ability } = setup();
    const space = floor.space(2, 2);
    expect(ability.perform(space)).toBe(0);
  });

  it("returns 1 for adjacent space", () => {
    const { floor, ability } = setup();
    const space = floor.space(3, 2);
    expect(ability.perform(space)).toBe(1);
  });

  it("returns 2 for diagonal space", () => {
    const { floor, ability } = setup();
    const space = floor.space(3, 3);
    expect(ability.perform(space)).toBe(2);
  });

  it("returns correct Manhattan distance for far space", () => {
    const { floor, ability } = setup();
    const space = floor.space(5, 0);
    expect(ability.perform(space)).toBe(5); // |5-2| + |0-2| = 3+2
  });
});
