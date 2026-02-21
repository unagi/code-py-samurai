import type { AbsoluteDirection, RelativeDirection } from "./direction";
import type { Position } from "./position";
import type { Space } from "./space";

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
  isBound(): boolean;
  isWarrior(): boolean;
  isGolem(): boolean;
  hasAbility(name: string): boolean;
  toString(): string;
  takeDamage(amount: number): void;
  earnPoints(points: number): void;
  say(msg: string): void;
  unbind(): void;
  bind(): void;
}

/**
 * Log collector for game messages.
 */
export interface ILogger {
  log(msg: string): void;
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
  description: string;
  tip: string;
  clue?: string;
  timeBonus: number;
  aceScore: number;
  floor: {
    width: number;
    height: number;
  };
  stairs: MapPoint;
  warrior: {
    unitId?: string;
    x: number;
    y: number;
    direction: AbsoluteDirection;
    abilities?: WarriorAbilitySet;
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

export interface MapWarriorDefinition {
  unitId?: string;
  position: MapPoint;
  direction: AbsoluteDirection;
  abilities?: WarriorAbilitySet;
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
  warrior: MapWarriorDefinition;
  units: MapUnitDefinition[];
}

export interface WarriorAbilitySet {
  skills: string[];
  stats: string[];
}
