import { describe, it, expect } from "vitest";
import { Walk } from "@engine/abilities/walk";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("walk!");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Walk", () => {
  it("moves the unit forward into empty space", () => {
    const { samurai } = setup();
    const walk = samurai.abilities.get("walk!") as Walk;
    walk.perform("forward");
    expect(samurai.position!.x).toBe(1);
    expect(samurai.position!.y).toBe(0);
  });

  it("bumps into wall and doesn't move", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    samurai.addAbilities("walk!");
    floor.add(samurai, 0, 0, "west");
    const walk = samurai.abilities.get("walk!") as Walk;
    walk.perform("forward");
    // Should not have moved (wall at x=-1)
    expect(samurai.position!.x).toBe(0);
  });

  it("bumps into enemy and doesn't move", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const walk = samurai.abilities.get("walk!") as Walk;
    walk.perform("forward");
    expect(samurai.position!.x).toBe(0);
  });

  it("walks backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    samurai.addAbilities("walk!");
    floor.add(samurai, 3, 0, "east");
    const walk = samurai.abilities.get("walk!") as Walk;
    walk.perform("backward");
    expect(samurai.position!.x).toBe(2);
  });

  it("throws on invalid direction", () => {
    const { samurai } = setup();
    const walk = samurai.abilities.get("walk!") as Walk;
    expect(() => walk.perform("up" as unknown as "forward")).toThrow("Unknown direction");
  });
});
