import { describe, it, expect } from "vitest";
import { Golem } from "@engine/units/golem";
import { Floor } from "@engine/floor";
import { Turn } from "@engine/turn";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const golem = new Golem();
  golem.maxHealthValue = 10;
  golem.health = 10;
  golem.addAbilities("walk!", "feel", "attack!");
  floor.add(golem, 0, 0, "east");
  return { floor, golem };
}

describe("Golem", () => {
  it("isGolem returns true", () => {
    const { golem } = setup();
    expect(golem.isGolem()).toBe(true);
  });

  it("isWarrior returns false", () => {
    const { golem } = setup();
    expect(golem.isWarrior()).toBe(false);
  });

  it("has character G", () => {
    const { golem } = setup();
    expect(golem.character).toBe("G");
  });

  it("has attackPower 3", () => {
    const { golem } = setup();
    expect(golem.attackPower).toBe(3);
  });

  it("executes turn callback", () => {
    const { golem } = setup();
    let called = false;
    golem.turnCallback = (_turn: Turn) => {
      called = true;
    };
    (golem as any).prepareTurn();
    expect(called).toBe(true);
  });

  it("does nothing when no callback set", () => {
    const { golem } = setup();
    // Should not throw
    (golem as any).prepareTurn();
  });
});
