import type { LevelDefinition } from "./types";

/**
 * Tower - manages a collection of levels.
 * Ported from RubyWarrior::Tower
 */
export class Tower {
  readonly name: string;
  private readonly _levels: LevelDefinition[];

  constructor(name: string, levels: LevelDefinition[]) {
    this.name = name;
    this._levels = levels;
  }

  get levelCount(): number {
    return this._levels.length;
  }

  /** Get level definition by 1-indexed number. */
  getLevel(number: number): LevelDefinition | null {
    if (number < 1 || number > this._levels.length) return null;
    return this._levels[number - 1];
  }

  hasLevel(number: number): boolean {
    return number >= 1 && number <= this._levels.length;
  }

  get levels(): readonly LevelDefinition[] {
    return this._levels;
  }

  toString(): string {
    return this.name;
  }
}
