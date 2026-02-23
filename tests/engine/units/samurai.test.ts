import { describe, it, expect, vi } from "vitest";
import samuraiGameplay from "@engine/unit-data/samurai.gameplay.json";
import { Samurai } from "@engine/units/samurai";
import { Floor } from "@engine/floor";
import type { IPlayer } from "@engine/types";
import { Turn } from "@engine/turn";

function setup(abilities: string[] = []) {
  const floor = new Floor(8, 1);
  floor.placeStairs(7, 0);
  const samurai = new Samurai();
  if (abilities.length > 0) {
    samurai.addAbilities(...abilities);
  }
  floor.add(samurai, 0, 0, "east");
  return { floor, samurai };
}

describe("Samurai", () => {
  it("has correct stats", () => {
    const samurai = new Samurai();
    expect(samurai.attackPower).toBe(5);
    expect(samurai.maxHealth).toBe(20);
    expect(samurai.health).toBe(20);
    expect(samurai.character).toBe("@");
    expect(samurai.name).toBe("Samurai");
    expect(samurai.shootPower).toBe(3);
  });

  it("isSamurai returns true", () => {
    const samurai = new Samurai();
    expect(samurai.isSamurai()).toBe(true);
    expect(samurai.isGolem()).toBe(false);
  });

  it("matches gameplay JSON for base parameters", () => {
    const samurai = new Samurai();

    expect(samurai.attackPower).toBe(samuraiGameplay.stats.attackPower);
    expect(samurai.shootPower).toBe(samuraiGameplay.stats.shootPower);
    expect(samurai.maxHealth).toBe(samuraiGameplay.stats.maxHealth);
    expect(samurai.character).toBe(samuraiGameplay.symbol);
    expect(samurai.nameKey).toBe(samuraiGameplay.nameKey);
  });

  it("tracks score via earnPoints", () => {
    const samurai = new Samurai();
    expect(samurai.score).toBe(0);
    samurai.earnPoints(10);
    expect(samurai.score).toBe(10);
    samurai.earnPoints(5);
    expect(samurai.score).toBe(15);
  });

  it("delegates playTurn to player", () => {
    const { samurai } = setup(["walk!"]);
    const playTurnFn = vi.fn();
    const player: IPlayer = { playTurn: playTurnFn };
    samurai.player = player;
    samurai.prepareTurn();
    expect(playTurnFn).toHaveBeenCalledOnce();
    expect(playTurnFn.mock.calls[0][0]).toBeInstanceOf(Turn);
  });

  it("does nothing when no player set", () => {
    const { samurai } = setup(["walk!"]);
    // No player set, should not throw
    samurai.prepareTurn();
    // turn action should be null (no action recorded)
    expect(samurai["_currentTurn"]?.action).toBeNull();
  });

  it("takes damage and loses health", () => {
    const samurai = new Samurai();
    samurai.takeDamage(8);
    expect(samurai.health).toBe(12);
  });

  it("dies when health drops to 0", () => {
    const { samurai } = setup();
    expect(samurai.isAlive()).toBe(true);
    samurai.takeDamage(20);
    expect(samurai.isAlive()).toBe(false);
    expect(samurai.position).toBeNull();
  });

  it("creates abilities from registry", () => {
    const { samurai } = setup(["walk!", "feel", "attack!", "health", "rest!"]);
    expect(samurai.hasAbility("walk!")).toBe(true);
    expect(samurai.hasAbility("feel")).toBe(true);
    expect(samurai.hasAbility("attack!")).toBe(true);
    expect(samurai.hasAbility("health")).toBe(true);
    expect(samurai.hasAbility("rest!")).toBe(true);
  });

  it("sets custom player name", () => {
    const samurai = new Samurai();
    samurai.playerName = "Taro";
    expect(samurai.name).toBe("Taro");
  });
});
