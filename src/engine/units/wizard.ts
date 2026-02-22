import { RangedEnemy } from "./ranged-enemy";

/**
 * Wizard - deadly ranged enemy with high shoot damage.
 * Ported from RubyWarrior::Units::Wizard
 */
export class Wizard extends RangedEnemy {
  protected static readonly SHOOT_POWER: number = 11;
  protected static readonly MAX_HEALTH: number = 3;
  protected static readonly CHARACTER: string = "w";
}
