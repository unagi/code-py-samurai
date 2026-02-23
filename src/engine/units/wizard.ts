import wizardGameplay from "../unit-data/wizard.gameplay.json";
import { RangedEnemy } from "./ranged-enemy";

/**
 * Wizard - deadly ranged enemy with high shoot damage.
 * Ported from RubyWarrior::Units::Wizard
 */
export class Wizard extends RangedEnemy {
  protected static readonly SHOOT_POWER: number = wizardGameplay.stats.shootPower ?? wizardGameplay.stats.attackPower;
  protected static readonly MAX_HEALTH: number = wizardGameplay.stats.maxHealth;
  protected static readonly CHARACTER: string = wizardGameplay.symbol;
  protected static readonly NAME_KEY: string = wizardGameplay.nameKey;
}
