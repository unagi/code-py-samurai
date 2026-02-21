import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level009 } from "../../../src/levels/intermediate";

describe("Intermediate Level 9", () => {
  const inherited = [
    "walk!",
    "feel",
    "direction_of_stairs",
    "attack!",
    "health",
    "rest!",
    "rescue!",
    "bind!",
    "listen",
    "direction_of",
    "look",
    "detonate!",
    "distance_of",
  ];

  it("passes with solving strategy", () => {
    const directions: RelativeDirection[] = [
      "forward",
      "left",
      "right",
      "backward",
    ];

    // Strategy: bind adjacent enemies, rescue bound ones to clear
    // quickly, rest minimally, rush toward ticking captive.
    // Uses bind+rescue as primary clearing method (2 turns per enemy,
    // no damage taken from bound enemies).

    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const units = t.doSense("listen") as Space[];

        // Scan adjacent spaces
        const adjacentEnemies: RelativeDirection[] = [];
        const adjacentBound: RelativeDirection[] = [];
        let adjacentTickingCaptive: RelativeDirection | null = null;
        let adjacentNonTickingCaptive: RelativeDirection | null = null;

        for (const dir of directions) {
          const space = t.doSense("feel", dir) as Space;
          if (space.isEnemy()) {
            adjacentEnemies.push(dir);
          } else if (space.isCaptive() && space.isTicking()) {
            adjacentTickingCaptive = dir;
          } else if (space.isCaptive() && !space.isTicking()) {
            adjacentNonTickingCaptive = dir;
            adjacentBound.push(dir);
          }
        }

        // Priority 1: rescue ticking captive immediately
        if (adjacentTickingCaptive) {
          t.doAction("rescue!", adjacentTickingCaptive);
          return;
        }

        // Priority 2: bind enemies to reduce damage (bind+rescue
        // is more efficient than attacking)
        if (adjacentEnemies.length >= 2) {
          t.doAction("bind!", adjacentEnemies[0]);
          return;
        }

        if (adjacentEnemies.length === 1) {
          // If there are also bound units, bind this one too
          // so we can rescue them all safely
          if (adjacentBound.length > 0) {
            t.doAction("bind!", adjacentEnemies[0]);
            return;
          }
          // Otherwise attack the lone enemy
          t.doAction("attack!", adjacentEnemies[0]);
          return;
        }

        // Priority 3: rescue bound units (removes them, earns points)
        if (adjacentBound.length > 0) {
          t.doAction("rescue!", adjacentBound[0]);
          return;
        }

        // Priority 4: if there's a ticking captive, rush toward it
        // even at low health
        const tickingCaptive = units.find(
          (u) => u.isCaptive() && u.isTicking(),
        );
        if (tickingCaptive) {
          // Rest only if critically low and not too urgent
          const dist = t.doSense(
            "distance_of",
            tickingCaptive,
          ) as number;
          if (health < 5 && dist > 2) {
            t.doAction("rest!");
            return;
          }
          const dir = t.doSense(
            "direction_of",
            tickingCaptive,
          ) as RelativeDirection;
          // If we can't walk that direction, try another empty dir
          const space = t.doSense("feel", dir) as Space;
          if (space.isEmpty() || space.isStairs()) {
            t.doAction("walk!", dir);
            return;
          }
          // Blocked by something; try other empty directions
          // that move us closer
          for (const d of directions) {
            const s = t.doSense("feel", d) as Space;
            if (s.isEmpty()) {
              t.doAction("walk!", d);
              return;
            }
          }
          // All blocked, rest
          t.doAction("rest!");
          return;
        }

        // Priority 5: rest if health is low
        if (health < 10) {
          t.doAction("rest!");
          return;
        }

        // Priority 6: rescue non-ticking captive
        if (adjacentNonTickingCaptive) {
          t.doAction("rescue!", adjacentNonTickingCaptive);
          return;
        }

        const captive = units.find((u) => u.isCaptive());
        if (captive) {
          const dir = t.doSense(
            "direction_of",
            captive,
          ) as RelativeDirection;
          t.doAction("walk!", dir);
          return;
        }

        // Priority 7: walk toward enemies
        const enemy = units.find((u) => u.isEnemy());
        if (enemy) {
          const dir = t.doSense(
            "direction_of",
            enemy,
          ) as RelativeDirection;
          t.doAction("walk!", dir);
          return;
        }

        // Priority 8: head to stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level009);
    level.setup(player, inherited);
    const result = level.play(200);

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level009);
    level.setup(player, inherited);
    // 9 units: 7 sludge + 1 ticking captive + 1 captive
    expect(level.floor.otherUnits).toHaveLength(9);
    // Floor is 4x3
    expect(level.floor.width).toBe(4);
    expect(level.floor.height).toBe(3);
  });
});
