import { describe, it, expect } from "vitest";
import { Archer } from "@engine/units/archer";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";
import { Floor } from "@engine/floor";

describe("Archer", () => {
  it("has correct stats", () => {
    const archer = new Archer();
    expect(archer.shootPower).toBe(3);
    expect(archer.maxHealth).toBe(7);
    expect(archer.health).toBe(7);
    expect(archer.character).toBe("a");
    expect(archer.name).toBe("Archer");
  });

  it("has look and shoot abilities", () => {
    const archer = new Archer();
    expect(archer.hasAbility("look")).toBe(true);
    expect(archer.hasAbility("shoot!")).toBe(true);
  });

  it("shoots player at range", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    floor.add(warrior, 0, 0, "east");
    const archer = new Archer();
    floor.add(archer, 3, 0, "west");
    archer.prepareTurn();
    archer.performTurn();
    expect(warrior.health).toBe(20 - 3);
  });

  it("does not shoot through obstacles", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    floor.add(warrior, 0, 0, "east");
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    const archer = new Archer();
    floor.add(archer, 3, 0, "west");
    // Sludge blocks line of sight
    archer.prepareTurn();
    archer.performTurn();
    expect(warrior.health).toBe(20); // warrior not hit
  });

  it("does nothing when no player in sight", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const archer = new Archer();
    floor.add(archer, 4, 0, "west");
    archer.prepareTurn();
    expect(() => archer.performTurn()).not.toThrow();
  });
});
