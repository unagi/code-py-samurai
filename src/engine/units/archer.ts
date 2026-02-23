import archerGameplay from "../unit-data/archer.gameplay.json";
import { RangedEnemy } from "./ranged-enemy";

/**
 * Archer - ranged enemy that shoots the player.
 * Ported from RubyWarrior::Units::Archer
 */
export class Archer extends RangedEnemy {
  protected static readonly SHOOT_POWER: number = archerGameplay.stats.shootPower ?? archerGameplay.stats.attackPower;
  protected static readonly MAX_HEALTH: number = archerGameplay.stats.maxHealth;
  protected static readonly CHARACTER: string = archerGameplay.symbol;
  protected static readonly NAME_KEY: string = archerGameplay.nameKey;
}
