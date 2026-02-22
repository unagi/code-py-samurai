import type { LogEntry } from "../log-entry";
import type { Position } from "../position";
import type { IUnit, ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
import { Turn } from "../turn";

/**
 * Mapping from unit display name to i18n nameKey (matching tiles.* keys).
 */
const NAME_TO_KEY: Record<string, string> = {
  Samurai: "samurai",
  Sludge: "sludge",
  "Thick Sludge": "thickSludge",
  Archer: "archer",
  Wizard: "wizard",
  Captive: "captive",
  Golem: "golem",
};

/**
 * Base class for all units (samurai, enemies, captives).
 * Ported from RubyWarrior::Units::Base
 */
export abstract class BaseUnit implements IUnit {
  protected static readonly ATTACK_POWER: number = 0;
  protected static readonly SHOOT_POWER: number = 0;
  protected static readonly MAX_HEALTH: number = 0;
  protected static readonly CHARACTER: string = "?";
  protected static readonly DISPLAY_NAME?: string;

  private _unitId: string;
  position: Position | null = null;
  private _health: number | null = null;
  private _bound: boolean = false;
  private _abilities: Map<string, BaseAbility> = new Map();
  protected _currentTurn: Turn | null = null;
  protected _logger: ILogger;

  constructor(logger?: ILogger) {
    this._logger = logger ?? { log: () => {} };
    this._unitId = this.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "") || "unit";
  }

  protected get unitClass(): typeof BaseUnit {
    return this.constructor as typeof BaseUnit;
  }

  get attackPower(): number {
    return this.unitClass.ATTACK_POWER;
  }
  get shootPower(): number {
    return this.unitClass.SHOOT_POWER;
  }
  get maxHealth(): number {
    return this.unitClass.MAX_HEALTH;
  }
  get character(): string {
    return this.unitClass.CHARACTER;
  }
  get name(): string {
    return this.unitClass.DISPLAY_NAME ?? this.constructor.name;
  }

  get unitId(): string {
    return this._unitId;
  }

  get nameKey(): string {
    return NAME_TO_KEY[this.name] ?? this.name.toLowerCase().replaceAll(/\s+/g, "");
  }

  setUnitId(id: string): void {
    const normalized = id.toLowerCase().replaceAll(/[^a-z0-9#_-]+/g, "");
    this._unitId = normalized.length > 0 ? normalized : this._unitId;
  }

  get health(): number {
    this._health ??= this.maxHealth;
    return this._health;
  }

  set health(value: number) {
    this._health = value;
  }

  get abilities(): Map<string, BaseAbility> {
    return this._abilities;
  }

  isAlive(): boolean {
    return this.position !== null;
  }

  isBound(): boolean {
    return this._bound;
  }

  bind(): void {
    this._bound = true;
  }

  unbind(): void {
    this.say({ key: "engine.released", params: {} });
    this._bound = false;
  }

  isSamurai(): boolean {
    return false;
  }

  isGolem(): boolean {
    return false;
  }

  hasAbility(name: string): boolean {
    return this._abilities.has(name);
  }

  takeDamage(amount: number): void {
    if (this.isBound()) {
      this.unbind();
    }
    this.health -= amount;
    this.say({ key: "engine.takeDamage", params: { amount, health: this.health } });
    if (this.health <= 0) {
      this.position = null;
      this.say({ key: "engine.dies", params: {} });
    }
  }

  earnPoints(_points: number): void {
    // Override in Samurai
  }

  say(entry: LogEntry): void {
    this._logger.log({ ...entry, unitId: entry.unitId ?? this._unitId });
  }

  addAbilities(...abilityNames: string[]): void {
    for (const name of abilityNames) {
      const ability = this.createAbility(name);
      if (ability) {
        this._abilities.set(name, ability);
      }
    }
  }

  protected createAbility(_name: string): BaseAbility | null {
    // Override in subclass or use ability registry
    return null;
  }

  nextTurn(): Turn {
    return new Turn(this._abilities);
  }

  prepareTurn(): void {
    this._currentTurn = this.nextTurn();
    this.playTurn(this._currentTurn);
  }

  performTurn(): void {
    if (this.position) {
      // Fire passTurn callbacks on all abilities
      for (const ability of this._abilities.values()) {
        ability.passTurn();
      }
      // Execute recorded action
      if (this._currentTurn?.action && !this.isBound()) {
        const [name, ...args] = this._currentTurn.action;
        const ability = this._abilities.get(name);
        if (ability) {
          ability.perform(...args);
        }
      }
    }
  }

  playTurn(_turn: Turn): void {
    // Override in subclass (enemy AI or player delegation)
  }

  toString(): string {
    return this.name;
  }
}
