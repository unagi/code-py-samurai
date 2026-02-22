import { Level, type LevelResult } from "./level";
import { Profile } from "./profile";
import { Tower } from "./tower";
import type { ILogger, IPlayer } from "./types";
import {
  getSamuraiAbilitiesAtLevel,
  getSamuraiAbilityIncrement,
  samuraiAbilitiesToEngineAbilities,
} from "./samurai-abilities";

export interface GameResult {
  passed: boolean;
  levelResults: LevelResult[];
  totalScore: number;
  averageGrade: number | null;
  epicGrades: Record<number, string>;
}

/**
 * Game - orchestrates overall game flow.
 * Ported from RubyWarrior::Game
 */
export class Game {
  readonly tower: Tower;
  readonly profile: Profile;
  private readonly _logger: ILogger;

  constructor(tower: Tower, profile: Profile, logger?: ILogger) {
    this.tower = tower;
    this.profile = profile;
    this._logger = logger ?? { log: () => {} };
  }

  /**
   * Normal Mode: play the current level.
   */
  playLevel(player: IPlayer, maxTurns?: number): LevelResult {
    const levelDef = this.tower.getLevel(this.profile.levelNumber);
    if (!levelDef) {
      throw new Error(`Level ${this.profile.levelNumber} not found`);
    }

    const level = new Level(levelDef, this._logger);
    const baselineAbilities = samuraiAbilitiesToEngineAbilities(
      getSamuraiAbilitiesAtLevel(this.tower.name, this.profile.levelNumber),
    );
    level.setup(player, [...new Set([...baselineAbilities, ...this.profile.abilities])]);
    const result = level.play(maxTurns);

    if (result.passed) {
      this.profile.score += result.totalScore;
      const increment = getSamuraiAbilityIncrement(this.tower.name, this.profile.levelNumber);
      const unlockedFromProgression = samuraiAbilitiesToEngineAbilities(increment);
      this.profile.addAbilities(...new Set(unlockedFromProgression));
    }

    return result;
  }

  /**
   * Advance to the next level after passing the current one.
   */
  advanceLevel(): boolean {
    const next = this.profile.levelNumber + 1;
    if (!this.tower.hasLevel(next)) return false;
    this.profile.levelNumber = next;
    return true;
  }

  /**
   * Epic Mode: play ALL levels in sequence.
   */
  playEpic(player: IPlayer, maxTurns?: number): GameResult {
    this.profile.enableEpicMode();

    const levelResults: LevelResult[] = [];
    const epicGrades: Record<number, string> = {};
    let allPassed = true;

    for (let n = 1; n <= this.tower.levelCount; n++) {
      const levelDef = this.tower.getLevel(n)!;
      const level = new Level(levelDef, this._logger);

      // In epic mode, abilities accumulate from all levels up to current
      const accumulatedAbilities = this.getAccumulatedAbilities(n);
      level.setup(player, accumulatedAbilities);
      const result = level.play(maxTurns);
      levelResults.push(result);

      if (result.passed) {
        this.profile.currentEpicScore += result.totalScore;
        if (levelDef.aceScore > 0) {
          this.profile.currentEpicGrades[n] =
            result.totalScore / levelDef.aceScore;
          epicGrades[n] = result.grade!;
        }
      } else {
        allPassed = false;
        break;
      }
    }

    this.profile.updateEpicScore();

    return {
      passed: allPassed,
      levelResults,
      totalScore: this.profile.currentEpicScore,
      averageGrade: this.profile.calculateAverageGrade(),
      epicGrades,
    };
  }

  private getAccumulatedAbilities(upToLevel: number): string[] {
    return samuraiAbilitiesToEngineAbilities(
      getSamuraiAbilitiesAtLevel(this.tower.name, upToLevel),
    );
  }
}
