import { describe, it, expect } from "vitest";
import { Rescue } from "@engine/abilities/rescue";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Captive } from "@engine/units/captive";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("rescue!");
  floor.add(warrior, 0, 0, "east");
  return { floor, warrior };
}

describe("Rescue", () => {
  it("rescues a captive and earns 20 points", () => {
    const { floor, warrior } = setup();
    const captive = new Captive();
    floor.add(captive, 1, 0, "west");
    expect(captive.isBound()).toBe(true);
    const rescue = warrior.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(warrior.score).toBe(20);
    // Captive removed from floor
    expect(captive.position).toBeNull();
  });

  it("does nothing when no captive ahead", () => {
    const { warrior } = setup();
    const rescue = warrior.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(warrior.score).toBe(0);
  });

  it("does not rescue enemies", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const rescue = warrior.abilities.get("rescue!") as Rescue;
    rescue.perform("forward");
    expect(warrior.score).toBe(0);
    expect(sludge.position).not.toBeNull();
  });

  it("rescues backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("rescue!");
    floor.add(warrior, 3, 0, "east");
    const captive = new Captive();
    floor.add(captive, 2, 0, "east");
    const rescue = warrior.abilities.get("rescue!") as Rescue;
    rescue.perform("backward");
    expect(warrior.score).toBe(20);
  });
});
