import { describe, it, expect } from "vitest";
import { Look } from "@engine/abilities/look";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

describe("Look", () => {
  function setup() {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("look");
    floor.add(warrior, 0, 0, "east");
    return { floor, warrior };
  }

  it("returns array of 3 spaces", () => {
    const { warrior } = setup();
    const look = warrior.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(spaces).toHaveLength(3);
  });

  it("returns empty spaces when nothing ahead", () => {
    const { warrior } = setup();
    const look = warrior.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(spaces[0].isEmpty()).toBe(true);
    expect(spaces[1].isEmpty()).toBe(true);
    expect(spaces[2].isEmpty()).toBe(true);
  });

  it("detects enemy at distance 2", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    const look = warrior.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(spaces[0].isEmpty()).toBe(true);  // x=1
    expect(spaces[1].isEnemy()).toBe(true);  // x=2
    expect(spaces[2].isEmpty()).toBe(true);  // x=3
  });

  it("includes wall spaces when looking at boundary", () => {
    const { warrior } = setup();
    const look = warrior.abilities.get("look") as Look;
    const spaces = look.perform("backward");
    // warrior at x=0 facing east, backward is west: x=-1, x=-2, x=-3
    expect(spaces[0].isWall()).toBe(true);
    expect(spaces[1].isWall()).toBe(true);
    expect(spaces[2].isWall()).toBe(true);
  });
});
