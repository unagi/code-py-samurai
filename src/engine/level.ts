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
  private _turnCount: number;
  private readonly _logger: ILogger;

  constructor(definition: LevelDefinition, logger?: ILogger) {
    this.definition = definition;
    this._timeBonus = definition.timeBonus;
    this._turnCount = 0;
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
    this.floor.placeStairs(stairs.x, stairs.y);

    // Create and place warrior
    this.warrior = new Warrior(this._logger);
    if (warDef.unitId) {
      this.warrior.setUnitId(warDef.unitId);
    }
    this.warrior.player = player;

    // Ability injection is runtime-driven from progression state.
    this.warrior.addAbilities(...new Set(existingAbilities));

    this.floor.add(this.warrior, warDef.x, warDef.y, warDef.direction);

    // Create and place enemy/captive units
    for (const unitDef of units) {
      this.placeUnit(unitDef);
    }

    this._timeBonus = this.definition.timeBonus;
    this._turnCount = 0;
  }

  /**
   * Run the level for up to maxTurns.
   */
  play(maxTurns: number = 1000): LevelResult {
    for (let n = 0; n < maxTurns; n++) {
      if (!this.step()) break;
    }

    return this.result();
  }

  /**
   * Execute exactly one turn. Returns true when the level can continue.
   */
  step(): boolean {
    if (this.passed() || this.failed()) return false;

    this._turnCount += 1;
    this._logger.log(`- turn ${this._turnCount} -`);

    // Prepare all units' turns (calls playTurn which records actions)
    const aliveUnits = this.floor.units;
    for (const unit of aliveUnits) {
      unit.prepareTurn();
    }

    // Perform all units' turns (executes recorded actions)
    for (const unit of this.floor.units) {
      unit.performTurn();
    }

    if (this._timeBonus > 0) {
      this._timeBonus--;
    }

    return !this.passed() && !this.failed();
  }

  result(): LevelResult {
    return this.getResult(this._turnCount);
  }

  get turnCount(): number {
    return this._turnCount;
  }

  passed(): boolean {
    return this.floor.stairsSpace.isPlayer();
  }

  failed(): boolean {
    return !this.warrior.isAlive();
  }

  private placeUnit(unitDef: LevelDefinition["units"][number]): void {
    const unit = createUnit(unitDef.type, this._logger);
    if (!unit) return;

    if (unitDef.unitId) {
      unit.setUnitId(unitDef.unitId);
    }
    if (unitDef.abilities && unitDef.abilities.length > 0) {
      unit.addAbilities(...unitDef.abilities);
    }
    this.floor.add(unit, unitDef.x, unitDef.y, unitDef.direction);

    if (unitDef.abilityConfig) {
      for (const [abilityName, config] of Object.entries(unitDef.abilityConfig)) {
        const ability = unit.abilities.get(abilityName);
        if (ability) {
          Object.assign(ability, config);
        }
      }
    }
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
    if (percent >= 1) return "S";
    if (percent >= 0.9) return "A";
    if (percent >= 0.8) return "B";
    if (percent >= 0.7) return "C";
    if (percent >= 0.6) return "D";
    return "F";
  }
}
