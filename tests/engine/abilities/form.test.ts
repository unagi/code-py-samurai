import { describe, it, expect } from "vitest";
import { Form } from "@engine/abilities/form";
import { Floor } from "@engine/floor";
import { Warrior } from "@engine/units/warrior";
import { Sludge } from "@engine/units/sludge";
import { Golem } from "@engine/units/golem";

function setup() {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  warrior.addAbilities("form!");
  floor.add(warrior, 3, 0, "east");
  const ability = warrior.abilities.get("form!") as Form;
  return { floor, warrior, ability };
}

describe("Form", () => {
  it("creates golem in empty adjacent space", () => {
    const { floor, ability } = setup();
    ability.perform("forward");
    const golem = floor.get(4, 0);
    expect(golem).toBeDefined();
    expect(golem!.isGolem()).toBe(true);
  });

  it("golem gets half warrior HP (floor division)", () => {
    const { floor, warrior, ability } = setup();
    expect(warrior.health).toBe(20);
    ability.perform("forward");
    const golem = floor.get(4, 0)!;
    expect(golem.health).toBe(10); // floor(20/2)
    expect(warrior.health).toBe(10);
  });

  it("does nothing if space is occupied", () => {
    const { floor, warrior, ability } = setup();
    floor.add(new Sludge(), 4, 0, "west");
    ability.perform("forward");
    // warrior health unchanged
    expect(warrior.health).toBe(20);
    // no golem created (sludge still there)
    const unit = floor.get(4, 0);
    expect(unit!.isGolem()).toBe(false);
  });

  it("golem executes callback each turn", () => {
    const { floor, ability } = setup();
    const actions: string[] = [];
    ability.perform("forward", (turn) => {
      actions.push("called");
      turn.doAction("walk!", "forward");
    });
    const golem = floor.get(4, 0)!;
    golem.prepareTurn();
    expect(actions).toEqual(["called"]);
  });

  it("golem has walk, feel, and attack abilities", () => {
    const { floor, ability } = setup();
    ability.perform("forward");
    const golem = floor.get(4, 0)! as Golem;
    expect(golem.hasAbility("walk!")).toBe(true);
    expect(golem.hasAbility("feel")).toBe(true);
    expect(golem.hasAbility("attack!")).toBe(true);
  });
});
