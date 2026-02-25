import { Floor } from "./floor";
import type { ILogger, IPlayer, LevelDefinition } from "./types";
import { Samurai } from "./units/samurai";
import { createUnit } from "./units/index";

export interface LevelResult {
  passed: boolean;
  failed: boolean;
  turns: number;
  samuraiScore: number;
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
  samurai!: Samurai;
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
   * Build the floor, place units, and configure the samurai.
   */
  setup(player: IPlayer, existingAbilities: string[] = []): void {
    const { floor: floorDef, stairs, samurai: warDef, units } =
      this.definition;

    // Create floor
    this.floor = new Floor(floorDef.width, floorDef.height);
    this.floor.placeStairs(stairs.x, stairs.y);

    // Create and place samurai
    this.samurai = new Samurai(this._logger);
    if (warDef.unitId) {
      this.samurai.setUnitId(warDef.unitId);
    }
    this.samurai.player = player;

    // Ability injection is runtime-driven from progression state.
    this.samurai.addAbilities(...new Set(existingAbilities));

    this.floor.add(this.samurai, warDef.x, warDef.y, warDef.direction);

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
    this._logger.log({ key: "engine.turn", params: { turn: this._turnCount } });

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
    const unit = this.floor.stairsSpace.unit;
    return Boolean(unit && (unit.isSamurai() || unit.isGolem()));
  }

  failed(): boolean {
    return !this.samurai.isAlive();
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
    const samuraiScore = this.samurai.score;
    const timeBonus = this._timeBonus;
    const clearBonus = this.floor.otherUnits.length === 0
      ? Math.round((samuraiScore + timeBonus) * 0.2)
      : 0;
    const totalScore = samuraiScore + timeBonus + clearBonus;
    const aceScore = this.definition.aceScore;
    const grade = aceScore > 0
      ? Level.gradeLetter(totalScore / aceScore)
      : null;

    return {
      passed,
      failed,
      turns,
      samuraiScore,
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
