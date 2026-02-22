import type { ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

/**
 * Golem - player-controlled unit created by form! ability.
 * Gets half of samurai's HP and executes a player-defined callback.
 * Ported from RubyWarrior::Units::Golem
 */
export class Golem extends BaseUnit {
  private _maxHealth: number = 0;
  private _turnCallback: ((turn: Turn) => void) | null = null;

  constructor(logger?: ILogger) {
    super(logger);
  }

  get attackPower(): number {
    return 3;
  }

  get maxHealth(): number {
    return this._maxHealth;
  }

  set maxHealthValue(value: number) {
    this._maxHealth = value;
  }

  get character(): string {
    return "G";
  }

  get name(): string {
    return "Golem";
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

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
