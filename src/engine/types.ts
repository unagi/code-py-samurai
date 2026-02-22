import type { AbsoluteDirection } from "./direction";
import type { LogEntry } from "./log-entry";
import type { Position } from "./position";
import type { Space } from "./space";
import type { BaseAbility } from "./abilities/base";
import type { Turn } from "./turn";

/**
 * Minimal interface for Floor, used by Position/Space to avoid circular deps.
 */
export interface IFloor {
  width: number;
  height: number;
  stairsLocation: [number, number];
  units: IUnit[];
  outOfBounds(x: number, y: number): boolean;
  get(x: number, y: number): IUnit | undefined;
  space(x: number, y: number): Space;
  add(unit: IUnit, x: number, y: number, direction?: AbsoluteDirection): void;
}

/**
 * Minimal interface for Unit, used by Space/Ability to avoid circular deps.
 */
export interface IUnit {
  character: string;
  position: Position | null;
  health: number;
  readonly maxHealth: number;
  readonly attackPower: number;
  readonly shootPower: number;
  readonly abilities: Map<string, BaseAbility>;
  isBound(): boolean;
  isSamurai(): boolean;
  isGolem(): boolean;
  hasAbility(name: string): boolean;
  toString(): string;
  takeDamage(amount: number): void;
  earnPoints(points: number): void;
  readonly nameKey: string;
  say(entry: LogEntry): void;
  unbind(): void;
  bind(): void;
  setUnitId(id: string): void;
  addAbilities(...names: string[]): void;
  prepareTurn(): void;
  performTurn(): void;
  playTurn(turn: Turn): void;
}

/**
 * Log collector for game messages.
 */
export interface ILogger {
  log(entry: LogEntry): void;
}

/**
 * Player interface - the user-provided code.
 */
export interface IPlayer {
  playTurn(turn: ITurn): void;
}

/**
 * Turn interface exposed to player code.
 */
export interface ITurn {
  readonly action: [string, ...unknown[]] | null;
}

/**
 * Level definition data.
 */
export interface LevelDefinition {
  timeBonus: number;
  aceScore: number;
  floor: {
    width: number;
    height: number;
  };
  stairs: MapPoint;
  samurai: {
    unitId?: string;
    x: number;
    y: number;
    direction: AbsoluteDirection;
    abilities?: SamuraiAbilitySet;
  };
  units: Array<{
    unitId?: string;
    type: string;
    x: number;
    y: number;
    direction: AbsoluteDirection;
    abilities?: string[];
    abilityConfig?: Record<string, Record<string, unknown>>;
  }>;
}

/**
 * Target JSON schema for map/layout migration.
 * Existing LevelDefinition can be converted into this shape.
 */
export interface MapPoint {
  x: number;
  y: number;
}

export interface MapSamuraiDefinition {
  unitId?: string;
  position: MapPoint;
  direction: AbsoluteDirection;
  abilities?: SamuraiAbilitySet;
}

export interface MapUnitDefinition {
  unitId?: string;
  type: string;
  position: MapPoint;
  direction: AbsoluteDirection;
  abilities?: string[];
  abilityConfig?: Record<string, Record<string, unknown>>;
}

export interface MapLayoutDefinition {
  floor: {
    width: number;
    height: number;
  };
  stairs: MapPoint;
  samurai: MapSamuraiDefinition;
  units: MapUnitDefinition[];
}

export interface SamuraiAbilitySet {
  skills: string[];
  stats: string[];
}
