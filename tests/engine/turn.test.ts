import { describe, it, expect } from "vitest";
import { Turn } from "@engine/turn";
import { BaseAbility } from "@engine/abilities/base";
import type { IUnit } from "@engine/types";

// Minimal mock ability for testing
class MockSense extends BaseAbility {
  perform(...args: unknown[]): string {
    return `sensed:${args[0] ?? "default"}`;
  }
}

function createMockUnit(): IUnit {
  return {
    character: "@",
    position: null,
    health: 20,
    maxHealth: 20,
    attackPower: 5,
    shootPower: 0,
    abilities: new Map(),
    isBound: () => false,
    isWarrior: () => true,
    isGolem: () => false,
    hasAbility: () => false,
    toString: () => "Warrior",
    takeDamage: () => {},
    earnPoints: () => {},
    say: () => {},
    unbind: () => {},
    bind: () => {},
    setUnitId: () => {},
    addAbilities: () => {},
    prepareTurn: () => {},
    performTurn: () => {},
    playTurn: () => {},
  };
}

describe("Turn", () => {
  it("starts with no action", () => {
    const abilities = new Map<string, BaseAbility>();
    const turn = new Turn(abilities);
    expect(turn.action).toBeNull();
  });

  it("records a single action", () => {
    const abilities = new Map<string, BaseAbility>();
    abilities.set("walk!", new MockSense(createMockUnit()));
    const turn = new Turn(abilities);
    turn.doAction("walk!", "forward");
    expect(turn.action).toEqual(["walk!", "forward"]);
  });

  it("throws on second action", () => {
    const abilities = new Map<string, BaseAbility>();
    abilities.set("walk!", new MockSense(createMockUnit()));
    abilities.set("attack!", new MockSense(createMockUnit()));
    const turn = new Turn(abilities);
    turn.doAction("walk!", "forward");
    expect(() => turn.doAction("attack!", "forward")).toThrow(
      "Only one action can be performed per turn."
    );
  });

  it("calls sense perform and returns result", () => {
    const unit = createMockUnit();
    const abilities = new Map<string, BaseAbility>();
    abilities.set("feel", new MockSense(unit));
    const turn = new Turn(abilities);
    expect(turn.doSense("feel", "forward")).toBe("sensed:forward");
  });

  it("allows multiple sense calls per turn", () => {
    const unit = createMockUnit();
    const abilities = new Map<string, BaseAbility>();
    abilities.set("feel", new MockSense(unit));
    const turn = new Turn(abilities);
    expect(turn.doSense("feel", "forward")).toBe("sensed:forward");
    expect(turn.doSense("feel", "left")).toBe("sensed:left");
  });

  it("throws on unknown action", () => {
    const turn = new Turn(new Map());
    expect(() => turn.doAction("fly!")).toThrow("Unknown action: fly!");
  });

  it("throws on unknown sense", () => {
    const turn = new Turn(new Map());
    expect(() => turn.doSense("smell")).toThrow("Unknown sense: smell");
  });

  it("reports available actions and senses", () => {
    const unit = createMockUnit();
    const abilities = new Map<string, BaseAbility>();
    abilities.set("walk!", new MockSense(unit));
    abilities.set("feel", new MockSense(unit));
    const turn = new Turn(abilities);
    expect(turn.hasAction("walk!")).toBe(true);
    expect(turn.hasAction("attack!")).toBe(false);
    expect(turn.hasSense("feel")).toBe(true);
    expect(turn.hasSense("look")).toBe(false);
  });
});
