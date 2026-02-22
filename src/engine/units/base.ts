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

  // Override in subclass
  get attackPower(): number {
    return 0;
  }
  get shootPower(): number {
    return 0;
  }
  get maxHealth(): number {
    return 0;
  }
  get character(): string {
    return "?";
  }
  get name(): string {
    return this.constructor.name;
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
