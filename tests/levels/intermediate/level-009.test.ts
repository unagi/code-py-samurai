import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level009 } from "../../../src/levels/intermediate";

type AdjacentScan = {
  enemies: RelativeDirection[];
  bound: RelativeDirection[];
  tickingCaptive: RelativeDirection | null;
  nonTickingCaptive: RelativeDirection | null;
};

const ALL_DIRS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

function scanAdjacent(t: Turn): AdjacentScan {
  const scan: AdjacentScan = {
    enemies: [],
    bound: [],
    tickingCaptive: null,
    nonTickingCaptive: null,
  };
  for (const dir of ALL_DIRS) {
    const space = t.doSense("feel", dir) as Space;
    if (space.isEnemy()) {
      scan.enemies.push(dir);
    } else if (space.isCaptive() && space.isTicking()) {
      scan.tickingCaptive = dir;
    } else if (space.isCaptive()) {
      scan.nonTickingCaptive = dir;
      scan.bound.push(dir);
    }
  }
  return scan;
}

/** Bind or attack adjacent enemies. Returns true if an action was taken. */
function handleEnemies(t: Turn, scan: AdjacentScan): boolean {
  if (scan.enemies.length >= 2) {
    t.doAction("bind!", scan.enemies[0]);
    return true;
  }
  if (scan.enemies.length === 1) {
    const action = scan.bound.length > 0 ? "bind!" : "attack!";
    t.doAction(action, scan.enemies[0]);
    return true;
  }
  return false;
}

/** Rush toward a ticking captive, resting only if critically low. */
function rushTowardTicking(
  t: Turn,
  target: Space,
  health: number,
): void {
  const dist = t.doSense("distance_of", target) as number;
  if (health < 5 && dist > 2) {
    t.doAction("rest!");
    return;
  }
  const dir = t.doSense("direction_of", target) as RelativeDirection;
  const space = t.doSense("feel", dir) as Space;
  if (space.isEmpty() || space.isStairs()) {
    t.doAction("walk!", dir);
    return;
  }
  for (const d of ALL_DIRS) {
    const s = t.doSense("feel", d) as Space;
    if (s.isEmpty()) {
      t.doAction("walk!", d);
      return;
    }
  }
  t.doAction("rest!");
}

function walkToward(t: Turn, target: Space): void {
  const dir = t.doSense("direction_of", target) as RelativeDirection;
  t.doAction("walk!", dir);
}

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
    // Strategy: bind adjacent enemies, rescue bound ones to clear
    // quickly, rest minimally, rush toward ticking captive.
    // Uses bind+rescue as primary clearing method (2 turns per enemy,
    // no damage taken from bound enemies).

    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const health = t.doSense("health") as number;
        const units = t.doSense("listen") as Space[];
        const scan = scanAdjacent(t);

        // Priority 1: rescue ticking captive immediately
        if (scan.tickingCaptive) {
          t.doAction("rescue!", scan.tickingCaptive);
          return;
        }

        // Priority 2: bind/attack adjacent enemies
        if (handleEnemies(t, scan)) return;

        // Priority 3: rescue bound units (removes them, earns points)
        if (scan.bound.length > 0) {
          t.doAction("rescue!", scan.bound[0]);
          return;
        }

        // Priority 4: rush toward ticking captive even at low health
        const ticking = units.find(
          (u) => u.isCaptive() && u.isTicking(),
        );
        if (ticking) {
          rushTowardTicking(t, ticking, health);
          return;
        }

        // Priority 5: rest if health is low
        if (health < 10) {
          t.doAction("rest!");
          return;
        }

        // Priority 6: rescue non-ticking captive
        if (scan.nonTickingCaptive) {
          t.doAction("rescue!", scan.nonTickingCaptive);
          return;
        }

        const captive = units.find((u) => u.isCaptive());
        if (captive) {
          walkToward(t, captive);
          return;
        }

        // Priority 7: walk toward enemies
        const enemy = units.find((u) => u.isEnemy());
        if (enemy) {
          walkToward(t, enemy);
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
