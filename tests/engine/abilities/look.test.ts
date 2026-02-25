import { describe, it, expect } from "vitest";
import { Look } from "@engine/abilities/look";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";
import { Terrain } from "@engine/types";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("look");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Look", () => {
  it("returns array of 3 spaces", () => {
    const { samurai } = setup();
    const look = samurai.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(spaces).toHaveLength(3);
  });

  it("returns empty spaces when nothing ahead", () => {
    const { samurai } = setup();
    const look = samurai.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(!spaces[0].unit && spaces[0].terrain === Terrain.Floor).toBe(true);
    expect(!spaces[1].unit && spaces[1].terrain === Terrain.Floor).toBe(true);
    expect(!spaces[2].unit && spaces[2].terrain === Terrain.Floor).toBe(true);
  });

  it("detects enemy at distance 2", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    const look = samurai.abilities.get("look") as Look;
    const spaces = look.perform("forward");
    expect(!spaces[0].unit && spaces[0].terrain === Terrain.Floor).toBe(true);  // x=1
    expect(spaces[1].unit).toBe(sludge);  // x=2
    expect(!spaces[2].unit && spaces[2].terrain === Terrain.Floor).toBe(true);  // x=3
  });

  it("includes wall spaces when looking at boundary", () => {
    const { samurai } = setup();
    const look = samurai.abilities.get("look") as Look;
    const spaces = look.perform("backward");
    // samurai at x=0 facing east, backward is west: x=-1, x=-2, x=-3
    expect(spaces[0].terrain).toBe(Terrain.Wall);
    expect(spaces[1].terrain).toBe(Terrain.Wall);
    expect(spaces[2].terrain).toBe(Terrain.Wall);
  });
});
