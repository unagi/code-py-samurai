import { RangedEnemy } from "./ranged-enemy";

/**
 * Archer - ranged enemy that shoots the player.
 * Ported from RubyWarrior::Units::Archer
 */
export class Archer extends RangedEnemy {
  protected static readonly SHOOT_POWER: number = 3;
  protected static readonly MAX_HEALTH: number = 7;
  protected static readonly CHARACTER: string = "a";
}
