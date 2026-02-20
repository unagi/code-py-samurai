import { describe, it, expect } from "vitest";
import { DirectionOfStairs } from "@engine/abilities/direction-of-stairs";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";

describe("DirectionOfStairs", () => {
  function setup(
    warriorX: number,
    warriorY: number,
    direction: "north" | "east" | "south" | "west",
    stairsX: number,
    stairsY: number
  ) {
    const floor = new Floor(6, 4);
    floor.placeStairs(stairsX, stairsY);
    const warrior = new Warrior();
    warrior.addAbilities("direction_of_stairs");
    floor.add(warrior, warriorX, warriorY, direction);
    const ability = warrior.abilities.get(
      "direction_of_stairs"
    ) as DirectionOfStairs;
    return { floor, warrior, ability };
  }

  it("returns forward when stairs are ahead", () => {
    const { ability } = setup(0, 1, "east", 3, 1);
    expect(ability.perform()).toBe("forward");
  });

  it("returns backward when stairs are behind", () => {
    const { ability } = setup(3, 1, "east", 0, 1);
    expect(ability.perform()).toBe("backward");
  });

  it("returns left when stairs are to the left", () => {
    // facing east, stairs to the north = left
    const { ability } = setup(0, 2, "east", 0, 0);
    expect(ability.perform()).toBe("left");
  });

  it("returns right when stairs are to the right", () => {
    // facing east, stairs to the south = right
    const { ability } = setup(0, 0, "east", 0, 2);
    expect(ability.perform()).toBe("right");
  });
});
