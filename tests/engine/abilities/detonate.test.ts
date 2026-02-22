import { describe, it, expect } from "vitest";
import { Detonate } from "@engine/abilities/detonate";
import { Explode } from "@engine/abilities/explode";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";
import { Captive } from "@engine/units/captive";

function setup() {
  const floor = new Floor(8, 3);
  floor.placeStairs(7, 1);
  const samurai = new Samurai();
  samurai.addAbilities("detonate!");
  floor.add(samurai, 0, 1, "east");
  const ability = samurai.abilities.get("detonate!") as Detonate;
  return { floor, samurai, ability };
}

describe("Detonate", () => {
  it("deals 8 damage to center target", () => {
    const { floor, ability } = setup();
    const sludge = new Sludge(); // 12 HP
    floor.add(sludge, 1, 1, "west");

    ability.perform("forward");
    expect(sludge.health).toBe(12 - 8);
  });

  it("deals 4 damage to adjacent targets", () => {
    const { floor, ability } = setup();
    // forward=1, right=1 => (1, 2) when facing east from (0,1)
    const s1 = new Sludge();
    floor.add(s1, 1, 2, "west");

    ability.perform("forward");
    expect(s1.health).toBe(12 - 4);
  });

  it("deals 4 damage to self at (0,0) offset", () => {
    const { samurai, ability } = setup();
    ability.perform("forward");
    // samurai takes 4 self-damage from the [0,0] bomb
    expect(samurai.health).toBe(20 - 4);
  });

  it("triggers chain explosion on ticking captive", () => {
    const { floor, samurai, ability } = setup();
    // Place a ticking captive at the center
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 1, 1, "west");
    const explode = captive.abilities.get("explode!") as Explode;
    explode.time = 10;

    ability.perform("forward");

    // Chain explosion kills everyone with 100 damage
    expect(samurai.position).toBeNull();
    expect(captive.position).toBeNull();
  });

  it("does not crash on empty spaces", () => {
    const { ability } = setup();
    expect(() => ability.perform("forward")).not.toThrow();
  });

  it("throws on invalid direction", () => {
    const { ability } = setup();
    expect(() => ability.perform("up" as unknown as "forward")).toThrow("Unknown direction");
  });
});
