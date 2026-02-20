import { describe, it, expect } from "vitest";
import { ThickSludge } from "@engine/units/thick-sludge";
import { Warrior } from "@engine/units/warrior";
import { Floor } from "@engine/floor";

describe("ThickSludge", () => {
  it("has correct stats (double health of sludge)", () => {
    const ts = new ThickSludge();
    expect(ts.maxHealth).toBe(24);
    expect(ts.health).toBe(24);
    expect(ts.attackPower).toBe(3);
    expect(ts.character).toBe("S");
    expect(ts.name).toBe("Thick Sludge");
  });

  it("is not warrior or golem", () => {
    const ts = new ThickSludge();
    expect(ts.isWarrior()).toBe(false);
    expect(ts.isGolem()).toBe(false);
  });

  it("inherits feel and attack abilities from Sludge", () => {
    const ts = new ThickSludge();
    expect(ts.hasAbility("feel")).toBe(true);
    expect(ts.hasAbility("attack!")).toBe(true);
  });

  it("attacks player when adjacent", () => {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    floor.add(warrior, 3, 0, "east");
    const ts = new ThickSludge();
    floor.add(ts, 4, 0, "west");
    ts.prepareTurn();
    ts.performTurn();
    expect(warrior.health).toBe(20 - 3);
  });
});
