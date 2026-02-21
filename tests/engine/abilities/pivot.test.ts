import { describe, it, expect } from "vitest";
import { Pivot } from "@engine/abilities/pivot";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";

function setup(direction: "north" | "east" | "south" | "west" = "east") {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("pivot!");
  floor.add(warrior, 3, 0, direction);
  return { warrior };
}

describe("Pivot", () => {
  it("pivots backward (default) - turns 180 degrees", () => {
    const { warrior } = setup("east");
    const pivot = warrior.abilities.get("pivot!") as Pivot;
    pivot.perform(); // default = backward
    expect(warrior.position!.direction).toBe("west");
  });

  it("pivots right - turns 90 degrees clockwise", () => {
    const { warrior } = setup("east");
    const pivot = warrior.abilities.get("pivot!") as Pivot;
    pivot.perform("right");
    expect(warrior.position!.direction).toBe("south");
  });

  it("pivots left - turns 90 degrees counter-clockwise", () => {
    const { warrior } = setup("east");
    const pivot = warrior.abilities.get("pivot!") as Pivot;
    pivot.perform("left");
    expect(warrior.position!.direction).toBe("north");
  });

  it("pivots forward - no rotation", () => {
    const { warrior } = setup("east");
    const pivot = warrior.abilities.get("pivot!") as Pivot;
    pivot.perform("forward");
    expect(warrior.position!.direction).toBe("east");
  });
});
