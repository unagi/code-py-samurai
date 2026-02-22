import { describe, expect, it } from "vitest";

import { Game } from "@engine/game";
import { Level } from "@engine/level";
import { Profile } from "@engine/profile";
import type { Tower } from "@engine/tower";
import type { IPlayer, ITurn, LevelDefinition } from "@engine/types";
import { beginnerTower, intermediateTower } from "../../src/levels";
import { compilePythonPlayer } from "@runtime/python-player";

function py(lines: string[]): string {
  return lines.join("\n");
}

type PythonSolutions = Record<number, string>;

const BEGINNER_SOLUTIONS: PythonSolutions = {
  1: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        warrior.walk()",
  ]),
  2: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        space = warrior.feel()",
    "        if space is None:",
    "            warrior.walk()",
    "        else:",
    "            warrior.attack()",
  ]),
  3: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        space = warrior.feel()",
    "        if space is None:",
    "            if warrior.hp < 20:",
    "                warrior.rest()",
    "            else:",
    "                warrior.walk()",
    "        elif space.is_enemy():",
    "            warrior.attack()",
    "        elif warrior.hp < 20:",
    "            warrior.rest()",
    "        else:",
    "            warrior.walk()",
  ]),
  4: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        space = warrior.feel()",
    "        if space is not None and space.is_enemy():",
    "            warrior.attack()",
    "        elif health < 20 and self.last_health is not None and health >= self.last_health:",
    "            warrior.rest()",
    "        else:",
    "            warrior.walk()",
    "        self.last_health = health",
  ]),
  5: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        space = warrior.feel()",
    "        if space is not None and space.is_captive():",
    "            warrior.rescue()",
    "        elif space is not None and space.is_enemy():",
    "            warrior.attack()",
    "        elif health < 20 and self.last_health is not None and health >= self.last_health:",
    "            warrior.rest()",
    "        else:",
    "            warrior.walk()",
    "        self.last_health = health",
  ]),
  6: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        fwd = warrior.feel()",
    "        bwd = warrior.feel('backward')",
    "        if not self.captive_rescued:",
    "            if bwd is not None and bwd.is_captive():",
    "                warrior.rescue('backward')",
    "                self.captive_rescued = True",
    "                self.last_health = health",
    "                return",
    "            elif bwd is not None and bwd.is_wall():",
    "                self.captive_rescued = True",
    "            else:",
    "                warrior.walk('backward')",
    "                self.last_health = health",
    "                return",
    "        if fwd is not None and fwd.is_enemy():",
    "            warrior.attack()",
    "        elif health < 20 and self.last_health is not None and health >= self.last_health:",
    "            warrior.rest()",
    "        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:",
    "            warrior.walk('backward')",
    "        else:",
    "            warrior.walk()",
    "        self.last_health = health",
  ]),
  7: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        fwd = warrior.feel()",
    "        if fwd is not None and fwd.is_wall() and not self.pivoted:",
    "            warrior.pivot('backward')",
    "            self.pivoted = True",
    "        elif fwd is not None and fwd.is_enemy():",
    "            warrior.attack()",
    "        elif health < 20 and self.last_health is not None and health >= self.last_health:",
    "            warrior.rest()",
    "        elif health <= 10 and self.last_health is not None and health < self.last_health and fwd is None:",
    "            warrior.walk('backward')",
    "        else:",
    "            warrior.walk()",
    "        self.last_health = health",
  ]),
  8: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        fwd = warrior.feel()",
    "        if fwd is not None and fwd.is_captive():",
    "            warrior.rescue()",
    "            return",
    "        for space in warrior.look():",
    "            if space is None:",
    "                continue",
    "            if space.is_enemy():",
    "                warrior.shoot()",
    "                return",
    "            break",
    "        warrior.walk()",
  ]),
  9: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        fwd = warrior.feel()",
    "        if not self.pivoted:",
    "            warrior.pivot('backward')",
    "            self.pivoted = True",
    "            return",
    "        for space in warrior.look():",
    "            if space is None:",
    "                continue",
    "            if space.is_enemy():",
    "                warrior.shoot()",
    "                return",
    "            break",
    "        if fwd is not None and fwd.is_captive():",
    "            warrior.rescue()",
    "        elif fwd is not None and fwd.is_enemy():",
    "            warrior.attack()",
    "        else:",
    "            warrior.walk()",
  ]),
};

const INTERMEDIATE_SOLUTIONS: PythonSolutions = {
  1: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  2: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_enemy():",
    "                warrior.attack(d)",
    "                return",
    "        if warrior.hp < 15:",
    "            warrior.rest()",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  3: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        enemies = []",
    "        captive_dir = None",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_enemy():",
    "                enemies.append(d)",
    "            elif space is not None and space.is_captive():",
    "                captive_dir = d",
    "        if len(enemies) >= 2:",
    "            warrior.bind(enemies[0])",
    "            return",
    "        if len(enemies) == 1:",
    "            warrior.attack(enemies[0])",
    "            return",
    "        if captive_dir is not None:",
    "            warrior.rescue(captive_dir)",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  4: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        units = warrior.listen()",
    "        adjacent_enemies = []",
    "        adjacent_captive = None",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_enemy():",
    "                adjacent_enemies.append(d)",
    "            elif space is not None and space.is_captive():",
    "                adjacent_captive = d",
    "        if len(adjacent_enemies) > 0:",
    "            warrior.attack(adjacent_enemies[0])",
    "            return",
    "        if adjacent_captive is not None:",
    "            warrior.rescue(adjacent_captive)",
    "            return",
    "        if health < 15:",
    "            warrior.rest()",
    "            return",
    "        if len(units) > 0:",
    "            warrior.walk(warrior.direction_of(units[0]))",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  5: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        units = warrior.listen()",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_enemy():",
    "                warrior.attack(d)",
    "                return",
    "            if space is not None and space.is_captive():",
    "                warrior.rescue(d)",
    "                return",
    "        for unit in units:",
    "            if unit.is_enemy() or unit.is_captive():",
    "                warrior.walk(warrior.direction_of(unit))",
    "                return",
    "        if health < 15:",
    "            warrior.rest()",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  6: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        units = warrior.listen()",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_captive() and space.is_ticking():",
    "                warrior.rescue(d)",
    "                return",
    "        ticking = None",
    "        for unit in units:",
    "            if unit.is_captive() and unit.is_ticking():",
    "                ticking = unit",
    "                break",
    "        if ticking is not None:",
    "            tick_dir = warrior.direction_of(ticking)",
    "            blocker = warrior.feel(tick_dir)",
    "            if blocker is not None and blocker.is_enemy():",
    "                warrior.attack(tick_dir)",
    "                return",
    "            warrior.walk(tick_dir)",
    "            return",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is not None and space.is_enemy():",
    "                warrior.attack(d)",
    "                return",
    "            if space is not None and space.is_captive():",
    "                warrior.rescue(d)",
    "                return",
    "        if len(units) > 0:",
    "            warrior.walk(warrior.direction_of(units[0]))",
    "            return",
    "        if health < 15:",
    "            warrior.rest()",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  7: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        dirs = ['forward', 'left', 'right', 'backward']",
    "        units = warrior.listen()",
    "        ticking_dir = None",
    "        adjacent_enemies = []",
    "        captive_dir = None",
    "        for d in dirs:",
    "            space = warrior.feel(d)",
    "            if space is None:",
    "                continue",
    "            if space.is_captive() and space.is_ticking():",
    "                ticking_dir = d",
    "            elif space.is_enemy():",
    "                adjacent_enemies.append(d)",
    "            elif space.is_captive() and captive_dir is None:",
    "                captive_dir = d",
    "        if ticking_dir is not None:",
    "            warrior.rescue(ticking_dir)",
    "            return",
    "        ticking = None",
    "        for unit in units:",
    "            if unit.is_captive() and unit.is_ticking():",
    "                ticking = unit",
    "                break",
    "        if ticking is not None:",
    "            tick_dir = warrior.direction_of(ticking)",
    "            space_in_dir = warrior.feel(tick_dir)",
    "            if space_in_dir is not None and space_in_dir.is_enemy():",
    "                if len(adjacent_enemies) >= 2:",
    "                    for d in adjacent_enemies:",
    "                        if d != tick_dir:",
    "                            warrior.bind(d)",
    "                            return",
    "                warrior.attack(tick_dir)",
    "                return",
    "            warrior.walk(tick_dir)",
    "            return",
    "        if captive_dir is not None:",
    "            warrior.rescue(captive_dir)",
    "            return",
    "        if len(adjacent_enemies) > 0:",
    "            warrior.attack(adjacent_enemies[0])",
    "            return",
    "        if len(units) > 0:",
    "            warrior.walk(warrior.direction_of(units[0]))",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
  8: py([
    "class Player:",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        spaces = warrior.look()",
    "        fwd = warrior.feel()",
    "        units = warrior.listen()",
    "        if len(spaces) >= 2:",
    "            a = spaces[0]",
    "            b = spaces[1]",
    "            if a is not None and b is not None and a.is_enemy() and b.is_enemy():",
    "                warrior.detonate()",
    "                return",
    "        if fwd is not None and fwd.is_enemy():",
    "            warrior.attack()",
    "            return",
    "        if fwd is not None and fwd.is_captive():",
    "            warrior.rescue()",
    "            return",
    "        has_ticking = False",
    "        for unit in units:",
    "            if unit.is_captive() and unit.is_ticking():",
    "                has_ticking = True",
    "                break",
    "        if (not has_ticking) and health < 10:",
    "            warrior.rest()",
    "            return",
    "        warrior.walk()",
  ]),
  9: py([
    "class Player:",
    "    def _scan_adjacent(self, warrior):",
    "        enemies = []",
    "        bound_dirs = []",
    "        ticking_captive_dir = None",
    "        non_ticking_captive_dir = None",
    "        for d in ['forward', 'left', 'right', 'backward']:",
    "            space = warrior.feel(d)",
    "            if space is None:",
    "                continue",
    "            if space.is_enemy():",
    "                enemies.append(d)",
    "            elif space.is_captive() and space.is_ticking():",
    "                ticking_captive_dir = d",
    "            elif space.is_captive():",
    "                if non_ticking_captive_dir is None:",
    "                    non_ticking_captive_dir = d",
    "                bound_dirs.append(d)",
    "        return enemies, bound_dirs, ticking_captive_dir, non_ticking_captive_dir",
    "",
    "    def _walk_toward(self, warrior, target):",
    "        warrior.walk(warrior.direction_of(target))",
    "",
    "    def _rush_toward_ticking(self, warrior, target, health):",
    "        dist = warrior.distance_of(target)",
    "        if health < 5 and dist > 2:",
    "            warrior.rest()",
    "            return",
    "        d = warrior.direction_of(target)",
    "        space = warrior.feel(d)",
    "        if space is None or space.is_stairs():",
    "            warrior.walk(d)",
    "            return",
    "        for alt in ['forward', 'left', 'right', 'backward']:",
    "            s = warrior.feel(alt)",
    "            if s is None:",
    "                warrior.walk(alt)",
    "                return",
    "        warrior.rest()",
    "",
    "    def play_turn(self, warrior):",
    "        health = warrior.hp",
    "        units = warrior.listen()",
    "        enemies, bound_dirs, ticking_dir, non_ticking_dir = self._scan_adjacent(warrior)",
    "        if ticking_dir is not None:",
    "            warrior.rescue(ticking_dir)",
    "            return",
    "        if len(enemies) >= 2:",
    "            warrior.bind(enemies[0])",
    "            return",
    "        if len(enemies) == 1:",
    "            if len(bound_dirs) > 0:",
    "                warrior.bind(enemies[0])",
    "            else:",
    "                warrior.attack(enemies[0])",
    "            return",
    "        if len(bound_dirs) > 0:",
    "            warrior.rescue(bound_dirs[0])",
    "            return",
    "        ticking = None",
    "        for unit in units:",
    "            if unit.is_captive() and unit.is_ticking():",
    "                ticking = unit",
    "                break",
    "        if ticking is not None:",
    "            self._rush_toward_ticking(warrior, ticking, health)",
    "            return",
    "        if health < 10:",
    "            warrior.rest()",
    "            return",
    "        if non_ticking_dir is not None:",
    "            warrior.rescue(non_ticking_dir)",
    "            return",
    "        captive = None",
    "        for unit in units:",
    "            if unit.is_captive():",
    "                captive = unit",
    "                break",
    "        if captive is not None:",
    "            self._walk_toward(warrior, captive)",
    "            return",
    "        enemy = None",
    "        for unit in units:",
    "            if unit.is_enemy():",
    "                enemy = unit",
    "                break",
    "        if enemy is not None:",
    "            self._walk_toward(warrior, enemy)",
    "            return",
    "        warrior.walk(warrior.direction_of_stairs())",
  ]),
};

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
