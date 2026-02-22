import { describe, it, expect } from "vitest";
import { Attack } from "@engine/abilities/attack";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("attack!");
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Attack", () => {
  it("deals attackPower damage to enemy in direction", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const startHealth = sludge.health;
    const attack = samurai.abilities.get("attack!") as Attack;
    attack.perform("forward");
    expect(sludge.health).toBe(startHealth - samurai.attackPower);
  });

  it("deals half damage when attacking backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const samurai = new Samurai();
    samurai.addAbilities("attack!");
    floor.add(samurai, 3, 0, "east");
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "east");
    const startHealth = sludge.health;
    const attack = samurai.abilities.get("attack!") as Attack;
    attack.perform("backward");
    const expectedDamage = Math.ceil(samurai.attackPower / 2);
    expect(sludge.health).toBe(startHealth - expectedDamage);
  });

  it("earns points when killing enemy", () => {
    const { floor, samurai } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    // Deal enough damage to kill (sludge has 12 HP, samurai attackPower=5)
    sludge.health = 3; // will die from 5 damage
    const attack = samurai.abilities.get("attack!") as Attack;
    attack.perform("forward");
    expect(sludge.isAlive()).toBe(false);
    expect(samurai.score).toBe(sludge.maxHealth);
  });

  it("does nothing when attacking empty space", () => {
    const { samurai } = setup();
    const attack = samurai.abilities.get("attack!") as Attack;
    // Should not throw
    attack.perform("forward");
    expect(samurai.score).toBe(0);
  });

  it("throws on invalid direction", () => {
    const { samurai } = setup();
    const attack = samurai.abilities.get("attack!") as Attack;
    expect(() => attack.perform("diagonal" as unknown as "forward")).toThrow("Unknown direction");
  });
});
