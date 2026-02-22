import { describe, it, expect } from "vitest";
import { Pivot } from "@engine/abilities/pivot";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";

function setup(direction: "north" | "east" | "south" | "west" = "east") {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("pivot!");
  floor.add(samurai, 3, 0, direction);
  return { samurai };
}

describe("Pivot", () => {
  it("pivots backward (default) - turns 180 degrees", () => {
    const { samurai } = setup("east");
    const pivot = samurai.abilities.get("pivot!") as Pivot;
    pivot.perform(); // default = backward
    expect(samurai.position!.direction).toBe("west");
  });

  it("pivots right - turns 90 degrees clockwise", () => {
    const { samurai } = setup("east");
    const pivot = samurai.abilities.get("pivot!") as Pivot;
    pivot.perform("right");
    expect(samurai.position!.direction).toBe("south");
  });

  it("pivots left - turns 90 degrees counter-clockwise", () => {
    const { samurai } = setup("east");
    const pivot = samurai.abilities.get("pivot!") as Pivot;
    pivot.perform("left");
    expect(samurai.position!.direction).toBe("north");
  });

  it("pivots forward - no rotation", () => {
    const { samurai } = setup("east");
    const pivot = samurai.abilities.get("pivot!") as Pivot;
    pivot.perform("forward");
    expect(samurai.position!.direction).toBe("east");
  });
});
