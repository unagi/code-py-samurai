import type { ILogger } from "../types";
import captiveGameplay from "../unit-data/captive.gameplay.json";
import { createAbility } from "../abilities/index";
import { BaseUnit } from "./base";

/**
 * Captive - rescue target, starts bound.
 * Ported from RubyWarrior::Units::Captive
 */
export class Captive extends BaseUnit {
  protected static readonly ATTACK_POWER: number = captiveGameplay.stats.attackPower;
  protected static readonly MAX_HEALTH: number = captiveGameplay.stats.maxHealth;
  protected static readonly CHARACTER: string = captiveGameplay.symbol;
  protected static readonly NAME_KEY: string = captiveGameplay.nameKey;

  constructor(logger?: ILogger) {
    super(logger, createAbility);
    this.bind();
  }
}
