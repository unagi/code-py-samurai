import { describe, it, expect } from "vitest";
import { Level } from "@engine/level";
import { Turn } from "@engine/turn";
import type { IPlayer, ITurn } from "@engine/types";
import type { Space } from "@engine/space";
import type { RelativeDirection } from "@engine/direction";
import { level007 } from "../../../src/levels/intermediate";

const ALL_DIRS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

function findAdjacentDir(
  t: Turn,
  predicate: (s: Space) => boolean,
): RelativeDirection | null {
  for (const dir of ALL_DIRS) {
    const space = t.doSense("feel", dir) as Space;
    if (predicate(space)) return dir;
  }
  return null;
}

function collectAdjacentEnemies(t: Turn): RelativeDirection[] {
  const enemies: RelativeDirection[] = [];
  for (const dir of ALL_DIRS) {
    const space = t.doSense("feel", dir) as Space;
    const u = space.unit;
    if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) enemies.push(dir);
  }
  return enemies;
}

/** Clear the path toward a ticking captive, binding/attacking blockers. */
function rushTowardTicking(
  t: Turn,
  ticking: Space,
  adjacentEnemies: RelativeDirection[],
): void {
  const tickDir = t.doSense(
    "direction_of",
    ticking,
  ) as RelativeDirection;
  const spaceInDir = t.doSense("feel", tickDir) as Space;
  const u = spaceInDir.unit;
  if (u && !u.isSamurai() && !u.isGolem() && !u.isBound()) {
    if (adjacentEnemies.length >= 2) {
      const otherEnemy = adjacentEnemies.find((d) => d !== tickDir);
      if (otherEnemy) {
        t.doAction("bind!", otherEnemy);
        return;
      }
    }
    t.doAction("attack!", tickDir);
    return;
  }
  t.doAction("walk!", tickDir);
}

describe("Intermediate Level 7", () => {
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
  ];

  it("passes with solving strategy", () => {
    const player: IPlayer = {
      playTurn(turn: ITurn) {
        const t = turn as Turn;
        const units = t.doSense("listen") as Space[];

        // Priority 1: rescue adjacent ticking captive
        const tickingDir = findAdjacentDir(
          t,
          (s) => !!(s.unit?.isBound() && s.unit.hasAbility("explode!")),
        );
        if (tickingDir) {
          t.doAction("rescue!", tickingDir);
          return;
        }

        const ticking = units.find(
          (s) => s.unit?.isBound() && s.unit.hasAbility("explode!"),
        );
        const adjacentEnemies = collectAdjacentEnemies(t);

        // Priority 2: rush toward ticking captive
        if (ticking) {
          rushTowardTicking(t, ticking, adjacentEnemies);
          return;
        }

        // Priority 3: rescue adjacent captive
        const captiveDir = findAdjacentDir(t, (s) => !!s.unit?.isBound());
        if (captiveDir) {
          t.doAction("rescue!", captiveDir);
          return;
        }

        // Priority 4: attack adjacent enemies
        if (adjacentEnemies.length > 0) {
          t.doAction("attack!", adjacentEnemies[0]);
          return;
        }

        // Priority 5: walk toward remaining units
        if (units.length > 0) {
          const dir = t.doSense(
            "direction_of",
            units[0],
          ) as RelativeDirection;
          t.doAction("walk!", dir);
          return;
        }

        // Priority 6: head to stairs
        const stairsDir = t.doSense(
          "direction_of_stairs",
        ) as RelativeDirection;
        t.doAction("walk!", stairsDir);
      },
    };

    const level = new Level(level007);
    level.setup(player, inherited);
    const result = level.play();

    expect(result.passed).toBe(true);
    expect(result.failed).toBe(false);
  });

  it("has correct floor layout", () => {
    const player: IPlayer = { playTurn() {} };
    const level = new Level(level007);
    level.setup(player, inherited);
    // 5 units: 3 sludge + 1 ticking captive + 1 captive
    expect(level.floor.otherUnits).toHaveLength(5);
    // Floor is 5x3
    expect(level.floor.width).toBe(5);
    expect(level.floor.height).toBe(3);
  });
});
