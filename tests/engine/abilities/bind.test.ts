import { describe, it, expect } from "vitest";
import { Bind } from "@engine/abilities/bind";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  samurai.addAbilities("bind!");
  floor.add(samurai, 0, 0, "east");
  const ability = samurai.abilities.get("bind!") as Bind;
  return { floor, samurai, ability };
}

describe("Bind", () => {
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
    expect(() => ability.perform("forward")).not.toThrow();
  });

  it("bound enemy cannot perform actions", () => {
    const { floor } = setup();
    const sludge = new Sludge();
    sludge.addAbilities("attack!");
    floor.add(sludge, 1, 0, "west");
    sludge.bind();
    // prepareTurn records action, performTurn should skip due to bound
    sludge.prepareTurn();
    sludge.performTurn();
    // samurai should not take damage
    const samurai = floor.units.find((u) => u.isSamurai())!;
    expect(samurai.health).toBe(20);
  });

  it("throws on invalid direction", () => {
    const { ability } = setup();
    expect(() => ability.perform("diagonal" as unknown as "forward")).toThrow(
      "Unknown direction"
    );
  });
});
