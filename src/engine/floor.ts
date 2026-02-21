import type { AbsoluteDirection } from "./direction";
import { Position } from "./position";
import { Space } from "./space";
import type { IFloor, IUnit } from "./types";

export class Floor implements IFloor {
  readonly width: number;
  readonly height: number;
  private _stairsLocation: [number, number] = [-1, -1];
  private readonly _allUnits: IUnit[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  get stairsLocation(): [number, number] {
    return this._stairsLocation;
  }

  placeStairs(x: number, y: number): void {
    this._stairsLocation = [x, y];
  }

  get stairsSpace(): Space {
    return this.space(...this._stairsLocation);
  }

  add(
    unit: IUnit,
    x: number,
    y: number,
    direction: AbsoluteDirection = "north"
  ): void {
    unit.position = new Position(this, x, y, direction);
    this._allUnits.push(unit);
  }

  removeUnit(unit: IUnit): void {
    unit.position = null;
  }

  get units(): IUnit[] {
    return this._allUnits.filter((u) => u.position !== null);
  }

  get otherUnits(): IUnit[] {
    return this.units.filter((u) => !u.isWarrior() && !u.isGolem());
  }

  get(x: number, y: number): IUnit | undefined {
    return this.units.find((u) => u.position!.at(x, y));
  }

  getPosition(unit: IUnit): Position | null {
    return unit.position;
  }

  space(x: number, y: number): Space {
    return new Space(this, x, y);
  }

  outOfBounds(x: number, y: number): boolean {
    return x < 0 || y < 0 || x > this.width - 1 || y > this.height - 1;
  }

  character(): string {
    const rows: string[] = [];
    rows.push(" " + "-".repeat(this.width));
    for (let y = 0; y < this.height; y++) {
      let row = "|";
      for (let x = 0; x < this.width; x++) {
        row += this.space(x, y).character;
      }
      row += "|";
      rows.push(row);
    }
    rows.push(" " + "-".repeat(this.width));
    return rows.join("\n") + "\n";
  }
}
