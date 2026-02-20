import { describe, it, expect } from "vitest";
import { Walk } from "@engine/abilities/walk";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

describe("Walk", () => {
  function setup() {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("walk!");
    floor.add(warrior, 0, 0, "east");
    return { floor, warrior };
  }

  it("moves the unit forward into empty space", () => {
    const { warrior } = setup();
    const walk = warrior.abilities.get("walk!") as Walk;
    walk.perform("forward");
    expect(warrior.position!.x).toBe(1);
    expect(warrior.position!.y).toBe(0);
  });

  it("bumps into wall and doesn't move", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("walk!");
    floor.add(warrior, 0, 0, "west");
    const walk = warrior.abilities.get("walk!") as Walk;
    walk.perform("forward");
    // Should not have moved (wall at x=-1)
    expect(warrior.position!.x).toBe(0);
  });

  it("bumps into enemy and doesn't move", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const walk = warrior.abilities.get("walk!") as Walk;
    walk.perform("forward");
    expect(warrior.position!.x).toBe(0);
  });

  it("walks backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("walk!");
    floor.add(warrior, 3, 0, "east");
    const walk = warrior.abilities.get("walk!") as Walk;
    walk.perform("backward");
    expect(warrior.position!.x).toBe(2);
  });

  it("throws on invalid direction", () => {
    const { warrior } = setup();
    const walk = warrior.abilities.get("walk!") as Walk;
    expect(() => walk.perform("up" as any)).toThrow("Unknown direction");
  });
});
