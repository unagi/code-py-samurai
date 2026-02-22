import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { Game } from "@engine/game";
import { Level } from "@engine/level";
import { Profile } from "@engine/profile";
import type { Tower } from "@engine/tower";
import type { IPlayer, ITurn, LevelDefinition } from "@engine/types";
import { beginnerTower, intermediateTower } from "../../src/levels";
import { compilePythonPlayer } from "@runtime/python-player";

type PythonSolutions = Record<number, string>;
type TowerFixtureName = "beginner" | "intermediate";

const FIXTURES_ROOT = new URL("./fixtures/python-tower-playthrough/", import.meta.url);

function loadPythonSolutions(towerName: TowerFixtureName): PythonSolutions {
  return Object.fromEntries(
    Array.from({ length: 9 }, (_, index) => {
      const levelNumber = index + 1;
      const fileName = `level-${String(levelNumber).padStart(3, "0")}.py`;
      const source = readFileSync(
        new URL(`${towerName}/${fileName}`, FIXTURES_ROOT),
        "utf8",
      ).trimEnd();
      return [levelNumber, source];
    }),
  ) as PythonSolutions;
}

const BEGINNER_SOLUTIONS = loadPythonSolutions("beginner");
const INTERMEDIATE_SOLUTIONS = loadPythonSolutions("intermediate");

function runTowerPlaythrough(
  tower: Tower,
  solutions: PythonSolutions,
): { totalScore: number; abilities: string[] } {
  const profile = new Profile("Tama", tower.name);
  profile.levelNumber = 1;
  const game = new Game(tower, profile);

  for (let levelNumber = 1; levelNumber <= tower.levelCount; levelNumber++) {
    const source = solutions[levelNumber];
    if (!source) {
      throw new Error(`Missing Python solution for ${tower.name} level ${levelNumber}`);
    }

    const player = compilePythonPlayer(source);
    const result = game.playLevel(player, 500);

    if (!result.passed || result.failed) {
      throw new Error(
        [
          `Failed ${tower.name} level ${levelNumber}`,
          `passed=${result.passed}`,
          `failed=${result.failed}`,
          `turns=${result.turns}`,
          `grade=${result.grade}`,
        ].join(" "),
      );
    }

    if (levelNumber < tower.levelCount) {
      expect(game.advanceLevel()).toBe(true);
      expect(profile.levelNumber).toBe(levelNumber + 1);
    }
  }

  expect(game.advanceLevel()).toBe(false);
  expect(profile.levelNumber).toBe(tower.levelCount);

  return {
    totalScore: profile.score,
    abilities: [...profile.abilities],
  };
}

class EpicPythonDispatchPlayer implements IPlayer {
  private currentLevelNumber: number | null = null;
  private readonly compiledPlayers = new Map<number, IPlayer>();

  constructor(private readonly solutions: PythonSolutions) {}

  setCurrentLevel(levelNumber: number): void {
    this.currentLevelNumber = levelNumber;
    if (!this.compiledPlayers.has(levelNumber)) {
      const source = this.solutions[levelNumber];
      if (!source) {
        throw new Error(`Missing Python solution for epic level ${levelNumber}`);
      }
      this.compiledPlayers.set(levelNumber, compilePythonPlayer(source));
    }
  }

  playTurn(turn: ITurn): void {
    if (this.currentLevelNumber === null) {
      throw new Error("Epic level is not set before playTurn.");
    }
    const player = this.compiledPlayers.get(this.currentLevelNumber);
    if (!player) {
      throw new Error(`Epic player for level ${this.currentLevelNumber} is not initialized.`);
    }
    player.playTurn(turn);
  }
}

function buildLevelIndexMap(tower: Tower): Map<LevelDefinition, number> {
  return new Map(tower.levels.map((def, index) => [def, index + 1]));
}

function runEpicTowerPlaythrough(
  tower: Tower,
  solutions: PythonSolutions,
): { totalScore: number; levelCount: number; gradeKeys: string[]; averageGrade: number | null } {
  const profile = new Profile("Tama", tower.name);
  const game = new Game(tower, profile);
  const dispatchPlayer = new EpicPythonDispatchPlayer(solutions);
  const levelIndexMap = buildLevelIndexMap(tower);

  const originalSetup = Level.prototype.setup;
  Level.prototype.setup = function patchedSetup(
    this: Level,
    player: IPlayer,
    existingAbilities: string[] = [],
  ): void {
    if (player === dispatchPlayer) {
      const levelNumber = levelIndexMap.get(this.definition);
      if (!levelNumber) {
        throw new Error(`Epic setup level not found in tower: ${tower.name}`);
      }
      dispatchPlayer.setCurrentLevel(levelNumber);
    }
    originalSetup.call(this, player, existingAbilities);
  };

  try {
    const result = game.playEpic(dispatchPlayer, 500);

    expect(result.passed).toBe(true);
    expect(result.levelResults).toHaveLength(tower.levelCount);
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.averageGrade).not.toBeNull();
    expect(Object.keys(result.epicGrades).length).toBeGreaterThan(0);
    expect(Object.keys(result.epicGrades).length).toBeLessThanOrEqual(tower.levelCount);

    expect(profile.isEpic()).toBe(true);
    expect(profile.epicScore).toBe(result.totalScore);
    expect(profile.averageGrade).toBe(result.averageGrade);

    return {
      totalScore: result.totalScore,
      levelCount: result.levelResults.length,
      gradeKeys: Object.keys(result.epicGrades),
      averageGrade: result.averageGrade,
    };
  } finally {
    Level.prototype.setup = originalSetup;
  }
}

describe("python tower playthrough", () => {
  it("completes beginner tower (levels 1-9) in sequence with Python players", () => {
    const result = runTowerPlaythrough(beginnerTower, BEGINNER_SOLUTIONS);

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.abilities).toContain("shoot!");
  });

  it("completes intermediate tower (levels 1-9) in sequence with Python players", () => {
    const result = runTowerPlaythrough(intermediateTower, INTERMEDIATE_SOLUTIONS);

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.abilities).toContain("distance_of");
  });

  it("completes beginner tower in Epic Mode with level-dispatched Python players", () => {
    const result = runEpicTowerPlaythrough(beginnerTower, BEGINNER_SOLUTIONS);

    expect(result.levelCount).toBe(9);
    expect(result.gradeKeys).toContain("9");
  });

  it("completes intermediate tower in Epic Mode with level-dispatched Python players", () => {
    const result = runEpicTowerPlaythrough(intermediateTower, INTERMEDIATE_SOLUTIONS);

    expect(result.levelCount).toBe(9);
    expect(result.gradeKeys).toContain("7");
  });
});
