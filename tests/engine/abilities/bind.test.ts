import { describe, it, expect } from "vitest";
import { Bind } from "@engine/abilities/bind";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";

describe("Bind", () => {
  function setup() {
    const floor = new Floor(8, 1);
    floor.placeStairs(7, 0);
    const warrior = new Warrior();
    warrior.addAbilities("bind!");
    floor.add(warrior, 0, 0, "east");
    const ability = warrior.abilities.get("bind!") as Bind;
    return { floor, warrior, ability };
  }

  it("binds enemy in given direction", () => {
    const { floor, ability } = setup();
    const sludge = new Sludge();
    floor.add(sludge, 1, 0, "west");
    expect(sludge.isBound()).toBe(false);
    ability.perform("forward");
    expect(sludge.isBound()).toBe(true);
  });

  it("does nothing on empty space", () => {
    const { ability } = setup();
    // should not throw
    ability.perform("forward");
  });

  it("bound enemy cannot perform actions", () => {
    const { floor } = setup();
    const sludge = new Sludge();
    sludge.addAbilities("attack!");
    floor.add(sludge, 1, 0, "west");
    sludge.bind();
    // prepareTurn records action, performTurn should skip due to bound
    (sludge as any).prepareTurn();
    (sludge as any).performTurn();
    // warrior should not take damage
    const warrior = floor.units.find((u) => u.isWarrior())!;
    expect(warrior.health).toBe(20);
  });

  it("throws on invalid direction", () => {
    const { ability } = setup();
    expect(() => ability.perform("diagonal" as any)).toThrow(
      "Unknown direction"
    );
  });
});
