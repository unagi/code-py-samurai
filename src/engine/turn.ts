import type { RelativeDirection } from "./direction";
import type { ITurn } from "./types";
import type { BaseAbility } from "./abilities/base";

/**
 * Turn object passed to player's playTurn method.
 * Actions (ending with !) can only be performed once per turn.
 * Senses can be called multiple times.
 */
export class Turn implements ITurn {
  private _action: [string, ...unknown[]] | null = null;
  private _senses: Map<string, BaseAbility> = new Map();
  private _actions: Set<string> = new Set();

  constructor(abilities: Map<string, BaseAbility>) {
    for (const [name, ability] of abilities) {
      if (name.endsWith("!")) {
        this._actions.add(name);
      } else {
        this._senses.set(name, ability);
      }
    }
  }

  get action(): [string, ...unknown[]] | null {
    return this._action;
  }

  /**
   * Execute an action. Only one action per turn.
   */
  doAction(name: string, ...args: unknown[]): void {
    if (this._action) {
      throw new Error("Only one action can be performed per turn.");
    }
    if (!this._actions.has(name)) {
      throw new Error(`Unknown action: ${name}`);
    }
    this._action = [name, ...args];
  }

  /**
   * Execute a sense and return the result.
   */
  doSense(name: string, ...args: unknown[]): unknown {
    const sense = this._senses.get(name);
    if (!sense) {
      throw new Error(`Unknown sense: ${name}`);
    }
    return sense.perform(...args);
  }

  /** Check if an action is available */
  hasAction(name: string): boolean {
    return this._actions.has(name);
  }

  /** Check if a sense is available */
  hasSense(name: string): boolean {
    return this._senses.has(name);
  }
}
