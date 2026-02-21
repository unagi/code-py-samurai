import { describe, it, expect } from "vitest";
import { Attack } from "@engine/abilities/attack";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("attack!");
  floor.add(warrior, 0, 0, "east");
  return { floor, warrior };
}

describe("Attack", () => {
  it("deals attackPower damage to enemy in direction", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const startHealth = sludge.health;
    const attack = warrior.abilities.get("attack!") as Attack;
    attack.perform("forward");
    expect(sludge.health).toBe(startHealth - warrior.attackPower);
  });

  it("deals half damage when attacking backward", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("attack!");
    floor.add(warrior, 3, 0, "east");
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "east");
    const startHealth = sludge.health;
    const attack = warrior.abilities.get("attack!") as Attack;
    attack.perform("backward");
    const expectedDamage = Math.ceil(warrior.attackPower / 2);
    expect(sludge.health).toBe(startHealth - expectedDamage);
  });

  it("earns points when killing enemy", () => {
    const { floor, warrior } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    // Deal enough damage to kill (sludge has 12 HP, warrior attackPower=5)
    sludge.health = 3; // will die from 5 damage
    const attack = warrior.abilities.get("attack!") as Attack;
    attack.perform("forward");
    expect(sludge.isAlive()).toBe(false);
    expect(warrior.score).toBe(sludge.maxHealth);
  });

  it("does nothing when attacking empty space", () => {
    const { warrior } = setup();
    const attack = warrior.abilities.get("attack!") as Attack;
    // Should not throw
    attack.perform("forward");
    expect(warrior.score).toBe(0);
  });

  it("throws on invalid direction", () => {
    const { warrior } = setup();
    const attack = warrior.abilities.get("attack!") as Attack;
    expect(() => attack.perform("diagonal" as any)).toThrow("Unknown direction");
  });
});
