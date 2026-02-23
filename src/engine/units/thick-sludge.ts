import thickSludgeGameplay from "../unit-data/thick-sludge.gameplay.json";
import { Sludge } from "./sludge";

/**
 * ThickSludge - stronger variant of Sludge.
 * Ported from RubyWarrior::Units::ThickSludge
 */
export class ThickSludge extends Sludge {
  protected static readonly ATTACK_POWER: number = thickSludgeGameplay.stats.attackPower;
  protected static readonly MAX_HEALTH: number = thickSludgeGameplay.stats.maxHealth;
  protected static readonly CHARACTER: string = thickSludgeGameplay.symbol;
  protected static readonly DISPLAY_NAME: string = thickSludgeGameplay.displayName;
  protected static readonly NAME_KEY: string = thickSludgeGameplay.nameKey;
}
