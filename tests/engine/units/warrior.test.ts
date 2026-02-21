import { describe, it, expect, vi } from "vitest";
import { Warrior } from "@engine/units/warrior";
import { Floor } from "@engine/floor";
import type { IPlayer, ITurn } from "@engine/types";
import { Turn } from "@engine/turn";

function setup(abilities: string[] = []) {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const warrior = new Warrior();
  if (abilities.length > 0) {
    warrior.addAbilities(...abilities);
  }
  floor.add(warrior, 0, 0, "east");
  return { floor, warrior };
}

describe("Warrior", () => {
  it("has correct stats", () => {
    const warrior = new Warrior();
    expect(warrior.attackPower).toBe(5);
    expect(warrior.maxHealth).toBe(20);
    expect(warrior.health).toBe(20);
    expect(warrior.character).toBe("@");
    expect(warrior.name).toBe("Warrior");
    expect(warrior.shootPower).toBe(3);
  });

  it("isWarrior returns true", () => {
    const warrior = new Warrior();
    expect(warrior.isWarrior()).toBe(true);
    expect(warrior.isGolem()).toBe(false);
  });

  it("tracks score via earnPoints", () => {
    const warrior = new Warrior();
    expect(warrior.score).toBe(0);
    warrior.earnPoints(10);
    expect(warrior.score).toBe(10);
    warrior.earnPoints(5);
    expect(warrior.score).toBe(15);
  });

  it("delegates playTurn to player", () => {
    const { warrior } = setup(["walk!"]);
    const playTurnFn = vi.fn();
    const player: IPlayer = { playTurn: playTurnFn };
    warrior.player = player;
    warrior.prepareTurn();
    expect(playTurnFn).toHaveBeenCalledOnce();
    expect(playTurnFn.mock.calls[0][0]).toBeInstanceOf(Turn);
  });

  it("does nothing when no player set", () => {
    const { warrior } = setup(["walk!"]);
    // No player set, should not throw
    warrior.prepareTurn();
    // turn action should be null (no action recorded)
    expect(warrior["_currentTurn"]?.action).toBeNull();
  });

  it("takes damage and loses health", () => {
    const warrior = new Warrior();
    warrior.takeDamage(8);
    expect(warrior.health).toBe(12);
  });

  it("dies when health drops to 0", () => {
    const { warrior } = setup();
    expect(warrior.isAlive()).toBe(true);
    warrior.takeDamage(20);
    expect(warrior.isAlive()).toBe(false);
    expect(warrior.position).toBeNull();
  });

  it("creates abilities from registry", () => {
    const { warrior } = setup(["walk!", "feel", "attack!", "health", "rest!"]);
    expect(warrior.hasAbility("walk!")).toBe(true);
    expect(warrior.hasAbility("feel")).toBe(true);
    expect(warrior.hasAbility("attack!")).toBe(true);
    expect(warrior.hasAbility("health")).toBe(true);
    expect(warrior.hasAbility("rest!")).toBe(true);
  });

  it("sets custom player name", () => {
    const warrior = new Warrior();
    warrior.playerName = "Taro";
    expect(warrior.name).toBe("Taro");
  });
});
