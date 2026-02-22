import type { ILogger, IPlayer } from "../types";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

export class Samurai extends BaseUnit {
  protected static readonly ATTACK_POWER: number = 5;
  protected static readonly SHOOT_POWER: number = 3;
  protected static readonly MAX_HEALTH: number = 20;
  protected static readonly CHARACTER: string = "@";
  protected static readonly NAME_KEY: string = "samurai";

  private _score: number = 0;
  private _name: string = "";
  private _player: IPlayer | null = null;

  constructor(logger?: ILogger) {
    super(logger, createAbility);
  }

  get name(): string {
    return this._name || "Samurai";
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

  isSamurai(): boolean {
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
}
