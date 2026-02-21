import { describe, it, expect } from "vitest";
import { Sludge } from "@engine/units/sludge";
import { Warrior } from "@engine/units/warrior";
import { Floor } from "@engine/floor";

describe("Sludge", () => {
  it("has correct stats", () => {
    const sludge = new Sludge();
    expect(sludge.attackPower).toBe(3);
    expect(sludge.maxHealth).toBe(12);
    expect(sludge.health).toBe(12);
    expect(sludge.character).toBe("s");
    expect(sludge.name).toBe("Sludge");
  });

  it("is not warrior or golem", () => {
    const sludge = new Sludge();
    expect(sludge.isWarrior()).toBe(false);
    expect(sludge.isGolem()).toBe(false);
  });

  it("has feel and attack abilities", () => {
    const sludge = new Sludge();
    expect(sludge.hasAbility("feel")).toBe(true);
    expect(sludge.hasAbility("attack!")).toBe(true);
  });

  it("attacks player in front", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    floor.add(warrior, 3, 0, "east");
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");
    // Sludge faces west, warrior is at x=3 (forward for sludge)
    sludge.prepareTurn();
    const startHealth = warrior.health;
    sludge.performTurn();
    expect(warrior.health).toBe(startHealth - sludge.attackPower);
  });

  it("attacks player behind", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 2, 0, "west");
    const warrior = new Warrior();
    floor.add(warrior, 3, 0, "west");
    // Sludge faces west, warrior is at x=3 (backward for sludge)
    sludge.prepareTurn();
    sludge.performTurn();
    expect(warrior.health).toBeLessThan(20);
  });

  it("does nothing when no player nearby", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");
    sludge.prepareTurn();
    expect(() => sludge.performTurn()).not.toThrow();
  });

  it("takes damage and dies", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const sludge = new Sludge();
    floor.add(sludge, 4, 0, "west");
    expect(sludge.isAlive()).toBe(true);
    sludge.takeDamage(12);
    expect(sludge.isAlive()).toBe(false);
    expect(sludge.position).toBeNull();
  });
});
