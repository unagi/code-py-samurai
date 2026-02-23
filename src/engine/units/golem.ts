import type { ILogger } from "../types";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import golemGameplay from "../unit-data/golem.gameplay.json";
import { BaseUnit } from "./base";

/**
 * Golem - player-controlled unit created by form! ability.
 * Gets half of samurai's HP and executes a player-defined callback.
 * Ported from RubyWarrior::Units::Golem
 */
export class Golem extends BaseUnit {
  protected static readonly ATTACK_POWER: number = golemGameplay.stats.attackPower;
  protected static readonly CHARACTER: string = golemGameplay.symbol;
  protected static readonly NAME_KEY: string = golemGameplay.nameKey;

  private _maxHealth: number = 0;
  private _turnCallback: ((turn: Turn) => void) | null = null;

  constructor(logger?: ILogger) {
    super(logger, createAbility);
  }

  get maxHealth(): number {
    return this._maxHealth;
  }

  set maxHealthValue(value: number) {
    this._maxHealth = value;
  }

  isGolem(): boolean {
    return true;
  }

  set turnCallback(callback: (turn: Turn) => void) {
    this._turnCallback = callback;
  }

  playTurn(turn: Turn): void {
    if (this._turnCallback) {
      this._turnCallback(turn);
    }
  }
}
