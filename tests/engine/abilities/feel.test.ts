import { describe, it, expect } from "vitest";
import { Feel } from "@engine/abilities/feel";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

describe("Feel", () => {
  function setup() {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("feel");
    floor.add(warrior, 0, 0, "east");
    return { floor, warrior };
  }

  it("returns empty space when nothing ahead", () => {
    const { warrior } = setup();
    const feel = warrior.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isEmpty()).toBe(true);
  });

  it("returns space with enemy when sludge ahead", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const feel = warrior.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isEmpty()).toBe(false);
    expect(space.isEnemy()).toBe(true);
  });

  it("returns wall space when facing wall", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("feel");
    floor.add(warrior, 0, 0, "west");
    const feel = warrior.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isWall()).toBe(true);
  });

  it("feels backward", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const feel = warrior.abilities.get("feel") as Feel;
    const backSpace = feel.perform("backward");
    // warrior at 0 facing east, backward = west = x-1 = wall
    expect(backSpace.isWall()).toBe(true);
  });

  it("throws on invalid direction", () => {
    const { warrior } = setup();
    const feel = warrior.abilities.get("feel") as Feel;
    expect(() => feel.perform("diagonal" as any)).toThrow("Unknown direction");
  });
});
