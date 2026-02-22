import { describe, it, expect } from "vitest";
import { Rescue } from "@engine/abilities/rescue";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Captive } from "@engine/units/captive";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("rescue!");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Rescue", () => {
  it("rescues a captive and earns 20 points", () => {
    const { floor, samurai } = setup();
    const captive = new Captive();
    floor.add(captive, 1, 0, "west");
    expect(captive.isBound()).toBe(true);
    const rescue = samurai.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(samurai.score).toBe(20);
    // Captive removed from floor
    expect(captive.position).toBeNull();
  });

  it("does nothing when no captive ahead", () => {
    const { samurai } = setup();
    const rescue = samurai.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(samurai.score).toBe(0);
  });

  it("does not rescue enemies", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const rescue = samurai.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(samurai.score).toBe(0);
    expect(sludge.position).not.toBeNull();
  });

  it("rescues backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    samurai.addAbilities("rescue!");
    floor.add(samurai, 3, 0, "east");
    const captive = new Captive();
    floor.add(captive, 2, 0, "east");
    const rescue = samurai.abilities.get("rescue!") as Rescue;
    rescue.perform("backward");
    expect(samurai.score).toBe(20);
  });
});
