import { Floor } from "./floor";
import type { ILogger, IPlayer, LevelDefinition } from "./types";
import { Warrior } from "./units/warrior";
import { createUnit } from "./units/index";

export interface LevelResult {
  passed: boolean;
  failed: boolean;
  turns: number;
  warriorScore: number;
  timeBonus: number;
  clearBonus: number;
  totalScore: number;
  grade: string | null;
}

/**
 * Level - manages a single level's gameplay.
 * Ported from RubyWarrior::Level
 */
export class Level {
  readonly definition: LevelDefinition;
  floor!: Floor;
  warrior!: Warrior;
  private _timeBonus: number;
  private _logger: ILogger;

  constructor(definition: LevelDefinition, logger?: ILogger) {
    this.definition = definition;
    this._timeBonus = definition.timeBonus;
    this._logger = logger ?? { log: () => {} };
  }

  /**
   * Build the floor, place units, and configure the warrior.
   */
  setup(player: IPlayer, existingAbilities: string[] = []): void {
    const { floor: floorDef, stairs, warrior: warDef, units } =
      this.definition;

    // Create floor
    this.floor = new Floor(floorDef.width, floorDef.height);
    this.floor.placeStairs(stairs[0], stairs[1]);

    // Create and place warrior
    this.warrior = new Warrior(this._logger);
    this.warrior.player = player;

    // Add existing abilities from profile + level-defined abilities
    const allAbilities = [...new Set([...existingAbilities, ...warDef.abilities])];
    this.warrior.addAbilities(...allAbilities);

    this.floor.add(this.warrior, warDef.x, warDef.y, warDef.direction, (u, pos) => {
      (u as Warrior).position = pos;
    });

    // Create and place enemy/captive units
    for (const unitDef of units) {
      const unit = createUnit(unitDef.type, this._logger);
      if (unit) {
        this.floor.add(unit, unitDef.x, unitDef.y, unitDef.direction, (u, pos) => {
          (u as any).position = pos;
        });
      }
    }

    this._timeBonus = this.definition.timeBonus;
  }

  /**
   * Run the level for up to maxTurns.
   */
  play(maxTurns: number = 1000): LevelResult {
    let turnCount = 0;

    for (let n = 0; n < maxTurns; n++) {
      if (this.passed() || this.failed()) break;

      turnCount = n + 1;
      this._logger.log(`- turn ${turnCount} -`);
      this._logger.log(this.floor.character());

      // Prepare all units' turns (calls playTurn which records actions)
      const aliveUnits = this.floor.units;
      for (const unit of aliveUnits) {
        (unit as any).prepareTurn();
      }

      // Perform all units' turns (executes recorded actions)
      for (const unit of this.floor.units) {
        (unit as any).performTurn();
      }

      if (this._timeBonus > 0) {
        this._timeBonus--;
      }
    }

    return this.getResult(turnCount);
  }

  passed(): boolean {
    return this.floor.stairsSpace.isPlayer();
  }

  failed(): boolean {
    return !this.warrior.isAlive();
  }

  private getResult(turns: number): LevelResult {
    const passed = this.passed();
    const failed = this.failed();
    const warriorScore = this.warrior.score;
    const timeBonus = this._timeBonus;
    const clearBonus = this.floor.otherUnits.length === 0
      ? Math.round((warriorScore + timeBonus) * 0.2)
      : 0;
    const totalScore = warriorScore + timeBonus + clearBonus;
    const aceScore = this.definition.aceScore;
    const grade = aceScore > 0
      ? Level.gradeLetter(totalScore / aceScore)
      : null;

    return {
      passed,
      failed,
      turns,
      warriorScore,
      timeBonus,
      clearBonus,
      totalScore,
      grade,
    };
  }

  static gradeLetter(percent: number): string {
    if (percent >= 1.0) return "S";
    if (percent >= 0.9) return "A";
    if (percent >= 0.8) return "B";
    if (percent >= 0.7) return "C";
    if (percent >= 0.6) return "D";
    return "F";
  }
}
