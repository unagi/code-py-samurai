import type { ILogger, IPlayer } from "../types";
import type { BaseAbility } from "../abilities/base";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

export class Warrior extends BaseUnit {
  private _score: number = 0;
  private _name: string = "";
  private _player: IPlayer | null = null;

  constructor(logger?: ILogger) {
    super(logger);
  }

  get attackPower(): number {
    return 5;
  }

  get shootPower(): number {
    return 3;
  }

  get maxHealth(): number {
    return 20;
  }

  get character(): string {
    return "@";
  }

  get name(): string {
    return this._name || "Warrior";
  }

  set playerName(name: string) {
    this._name = name;
  }

  get score(): number {
    return this._score;
  }

  set player(player: IPlayer) {
    this._player = player;
  }

  isWarrior(): boolean {
    return true;
  }

  earnPoints(points: number): void {
    this._score += points;
    this.say({ key: "engine.earnPoints", params: { points } });
  }

  playTurn(turn: Turn): void {
    if (this._player) {
      this._player.playTurn(turn);
    }
  }

  performTurn(): void {
    if (this._currentTurn?.action === null) {
      this.say({ key: "engine.idle", params: {} });
    }
    super.performTurn();
  }

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
