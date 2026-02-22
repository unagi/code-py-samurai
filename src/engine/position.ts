import {
  ABSOLUTE_DIRECTIONS,
  absoluteToRelative,
} from "./direction";
import type { AbsoluteDirection, RelativeDirection } from "./direction";
import type { Space } from "./space";
import type { IFloor } from "./types";

export class Position {
  readonly floor: IFloor;
  private _x: number;
  private _y: number;
  private _directionIndex: number;

  constructor(
    floor: IFloor,
    x: number,
    y: number,
    direction: AbsoluteDirection = "north"
  ) {
    this.floor = floor;
    this._x = x;
    this._y = y;
    this._directionIndex = ABSOLUTE_DIRECTIONS.indexOf(direction);
  }

  get x(): number {
    return this._x;
  }

  get y(): number {
    return this._y;
  }

  get direction(): AbsoluteDirection {
    return ABSOLUTE_DIRECTIONS[this._directionIndex];
  }

  at(x: number, y: number): boolean {
    return this._x === x && this._y === y;
  }

  rotate(amount: number): void {
    this._directionIndex += amount;
    this._directionIndex = ((this._directionIndex % 4) + 4) % 4;
  }

  move(forward: number, right: number = 0): void {
    const [newX, newY] = this.translateOffset(forward, right);
    this._x = newX;
    this._y = newY;
  }

  translateOffset(forward: number, right: number = 0): [number, number] {
    switch (this.direction) {
      case "north":
        return [this._x + right, this._y - forward];
      case "east":
        return [this._x + forward, this._y + right];
      case "south":
        return [this._x - right, this._y + forward];
      case "west":
        return [this._x - forward, this._y - right];
    }
  }

  distanceOf(x: number, y: number): number {
    return Math.abs(this._x - x) + Math.abs(this._y - y);
  }

  directionOf(x: number, y: number): AbsoluteDirection {
    const dx = Math.abs(this._x - x);
    const dy = Math.abs(this._y - y);
    if (dx > dy) {
      return x > this._x ? "east" : "west";
    } else {
      return y > this._y ? "south" : "north";
    }
  }

  relativeDirectionOf(x: number, y: number): RelativeDirection {
    return absoluteToRelative(this.direction, this.directionOf(x, y));
  }

  /**
   * Get the Space at a relative offset from this position.
   * Matches Ruby's relative_space(forward, right).
   */
  relativeSpace(forward: number, right: number = 0): Space {
    const [x, y] = this.translateOffset(forward, right);
    return this.floor.space(x, y);
  }

  /**
   * Get the Space at this position.
   */
  space(): Space {
    return this.floor.space(this._x, this._y);
  }
}
