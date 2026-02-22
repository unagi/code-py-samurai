import { describe, it, expect } from "vitest";
import { DirectionOf } from "@engine/abilities/direction-of";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(6, 4);
  floor.placeStairs(5, 3);
  const samurai = new Samurai();
  samurai.addAbilities("direction_of");
  floor.add(samurai, 2, 2, "east");
  const ability = samurai.abilities.get("direction_of") as DirectionOf;
  return { floor, samurai, ability };
}

describe("DirectionOf", () => {
  it("returns forward for space ahead", () => {
    const { floor, ability } = setup();
    const space = floor.space(4, 2);
    expect(ability.perform(space)).toBe("forward");
  });

  it("returns backward for space behind", () => {
    const { floor, ability } = setup();
    const space = floor.space(0, 2);
    expect(ability.perform(space)).toBe("backward");
  });

  it("returns left for space to the left", () => {
    // facing east, north = left
    const { floor, ability } = setup();
    const space = floor.space(2, 0);
    expect(ability.perform(space)).toBe("left");
  });

  it("returns right for space to the right", () => {
    // facing east, south = right
    const { floor, ability } = setup();
    const space = floor.space(2, 3);
    expect(ability.perform(space)).toBe("right");
  });

  it("works with space containing a unit", () => {
    const { floor, ability } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 4, 2, "west");
    const space = sludge.position!.space();
    expect(ability.perform(space)).toBe("forward");
  });
});
