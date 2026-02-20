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
  stairs: [number, number];
  warrior: {
    x: number;
    y: number;
    direction: AbsoluteDirection;
    abilities: string[];
  };
  units: Array<{
    type: string;
    x: number;
    y: number;
    direction: AbsoluteDirection;
  }>;
}
