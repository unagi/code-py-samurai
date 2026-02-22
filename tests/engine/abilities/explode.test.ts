import { describe, it, expect } from "vitest";
import { Explode } from "@engine/abilities/explode";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";
import { Captive } from "@engine/units/captive";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("walk!", "feel", "attack!");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Explode", () => {
  it("deals 100 damage to all units on floor when performed", () => {
    const { floor, samurai } = setup();
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 3, 0, "west");
    const sludge = new Sludge();
    floor.add(sludge, 5, 0, "west");

    const explode = captive.abilities.get("explode!") as Explode;
    explode.perform();

    // all units should be dead (100 damage is lethal)
    expect(samurai.health).toBeLessThanOrEqual(0);
    expect(samurai.position).toBeNull();
    expect(sludge.position).toBeNull();
    expect(captive.position).toBeNull();
  });

  it("decrements time on passTurn", () => {
    const { floor } = setup();
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 3, 0, "west");
    const explode = captive.abilities.get("explode!") as Explode;
    explode.time = 5;

    explode.passTurn();
    expect(explode.time).toBe(4);
  });

  it("auto-triggers at time 0", () => {
    const { floor, samurai } = setup();
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 3, 0, "west");
    const explode = captive.abilities.get("explode!") as Explode;
    explode.time = 1;

    explode.passTurn(); // time goes 1→0, triggers explosion
    expect(samurai.position).toBeNull(); // killed by explosion
  });

  it("does nothing when time is null", () => {
    const { floor, samurai } = setup();
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 3, 0, "west");
    const explode = captive.abilities.get("explode!") as Explode;
    explode.time = null;

    explode.passTurn();
    expect(samurai.health).toBe(20); // no damage
  });

  it("does not tick when unit is dead (position null)", () => {
    const { floor } = setup();
    const captive = new Captive();
    captive.addAbilities("explode!");
    floor.add(captive, 3, 0, "west");
    const explode = captive.abilities.get("explode!") as Explode;
    explode.time = 2;

    // Kill the captive (rescue removes position via unbind + we set null)
    captive.position = null;

    explode.passTurn();
    expect(explode.time).toBe(2); // unchanged, no tick
  });
});
