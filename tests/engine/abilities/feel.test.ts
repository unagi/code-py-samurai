import { describe, it, expect } from "vitest";
import { Feel } from "@engine/abilities/feel";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("feel");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Feel", () => {
  it("returns empty space when nothing ahead", () => {
    const { samurai } = setup();
    const feel = samurai.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isEmpty()).toBe(true);
  });

  it("returns space with enemy when sludge ahead", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const feel = samurai.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isEmpty()).toBe(false);
    expect(space.isEnemy()).toBe(true);
  });

  it("returns wall space when facing wall", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    samurai.addAbilities("feel");
    floor.add(samurai, 0, 0, "west");
    const feel = samurai.abilities.get("feel") as Feel;
    const space = feel.perform("forward");
    expect(space.isWall()).toBe(true);
  });

  it("feels backward", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const feel = samurai.abilities.get("feel") as Feel;
    const backSpace = feel.perform("backward");
    // samurai at 0 facing east, backward = west = x-1 = wall
    expect(backSpace.isWall()).toBe(true);
  });

  it("throws on invalid direction", () => {
    const { samurai } = setup();
    const feel = samurai.abilities.get("feel") as Feel;
    expect(() => feel.perform("diagonal" as unknown as "forward")).toThrow("Unknown direction");
  });
});
