import { describe, it, expect } from "vitest";
import { Listen } from "@engine/abilities/listen";
import { Floor } from "@engine/floor";
import { Samurai } from "@engine/units/samurai";
import { Sludge } from "@engine/units/sludge";
import { Captive } from "@engine/units/captive";

function setup() {
  const floor = new Floor(6, 4);
  floor.placeStairs(5, 3);
  const samurai = new Samurai();
  samurai.addAbilities("listen");
  floor.add(samurai, 0, 0, "east");
  const ability = samurai.abilities.get("listen") as Listen;
  return { floor, samurai, ability };
}

describe("Listen", () => {
  it("returns empty array when no other units", () => {
    const { ability } = setup();
    expect(ability.perform()).toEqual([]);
  });

  it("returns spaces for all other units", () => {
    const { floor, ability } = setup();
    floor.add(new Sludge(), 2, 0, "west");
    floor.add(new Sludge(), 4, 2, "west");
    const spaces = ability.perform();
    expect(spaces).toHaveLength(2);
  });

  it("does not include self", () => {
    const { floor, ability } = setup();
    floor.add(new Sludge(), 1, 0, "west");
    const spaces = ability.perform();
    expect(spaces).toHaveLength(1);
    const [sx, sy] = spaces[0].location;
    expect(sx).toBe(1);
    expect(sy).toBe(0);
  });

  it("includes both enemies and captives", () => {
    const { floor, ability } = setup();
    floor.add(new Sludge(), 2, 0, "west");
    floor.add(new Captive(), 3, 0, "west");
    const spaces = ability.perform();
    expect(spaces).toHaveLength(2);
    expect(spaces.some((s) => s.isEnemy())).toBe(true);
    expect(spaces.some((s) => s.isCaptive())).toBe(true);
  });
});
