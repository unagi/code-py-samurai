import { RELATIVE_DIRECTIONS } from "../direction";
import type { RelativeDirection } from "../direction";
import type { Space } from "../space";
import type { IUnit } from "../types";

/**
 * Base class for all abilities.
 * Ported from RubyWarrior::Abilities::Base
 */
export abstract class BaseAbility {
  protected readonly _unit: IUnit;

  constructor(unit: IUnit) {
    this._unit = unit;
  }

  /**
   * Convert relative direction to forward/right offset pair.
   * Used internally by space() and unit() helpers.
   */
  offset(
    direction: RelativeDirection,
    forward: number = 1,
    right: number = 0
  ): [number, number] {
    switch (direction) {
      case "forward":
        return [forward, -right];
      case "backward":
        return [-forward, right];
      case "right":
        return [right, forward];
      case "left":
        return [-right, -forward];
    }
  }

  /**
   * Get the Space in a relative direction from the unit.
   */
  space(
    direction: RelativeDirection = "forward",
    forward: number = 1,
    right: number = 0
  ): Space {
    const [fwd, rt] = this.offset(direction, forward, right);
    return this._unit.position!.relativeSpace(fwd, rt);
  }

  /**
   * Get the unit in a relative direction.
   */
  unitAt(
    direction: RelativeDirection = "forward",
    forward: number = 1,
    right: number = 0
  ): IUnit | undefined {
    return this.space(direction, forward, right).unit;
  }

  /**
   * Deal damage to a receiver and earn points if killed.
   */
  damage(receiver: IUnit, amount: number): void {
    receiver.takeDamage(amount);
    if (receiver.position === null) {
      // receiver died
      this._unit.earnPoints(receiver.maxHealth);
    }
  }

  /**
   * Validate that a direction is valid.
   */
  verifyDirection(direction: RelativeDirection): void {
    if (!RELATIVE_DIRECTIONS.includes(direction)) {
      const expectedDirections = RELATIVE_DIRECTIONS.map((d) => `"${d}"`).join(" or ");
      throw new TypeError(
        `Unknown direction "${direction}". Should be ${expectedDirections}.`
      );
    }
  }

  /**
   * Called every turn after actions are performed.
   */
  passTurn(): void {
    // Override in subclass if needed
  }

  /**
   * Perform the ability. Override in subclass.
   */
  abstract perform(...args: unknown[]): unknown;
}
