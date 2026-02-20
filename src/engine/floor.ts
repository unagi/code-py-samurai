import type { AbsoluteDirection } from "./direction";
import { Position } from "./position";
import { Space } from "./space";
import type { IFloor, IUnit } from "./types";

export class Floor implements IFloor {
  readonly width: number;
  readonly height: number;
  private _stairsLocation: [number, number] = [-1, -1];
  private _allUnits: { unit: IUnit; position: Position | null }[] = [];

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
    direction: AbsoluteDirection = "north",
    onAdd?: (unit: IUnit, position: Position) => void
  ): void {
    const position = new Position(this, x, y, direction);
    this._allUnits.push({ unit, position });
    if (onAdd) {
      onAdd(unit, position);
    }
  }

  removeUnit(unit: IUnit): void {
    const entry = this._allUnits.find((e) => e.unit === unit);
    if (entry) {
      entry.position = null;
    }
  }

  get units(): IUnit[] {
    return this._allUnits
      .filter((e) => e.position !== null)
      .map((e) => e.unit);
  }

  get otherUnits(): IUnit[] {
    return this.units.filter((u) => !u.isWarrior());
  }

  get(x: number, y: number): IUnit | undefined {
    const entry = this._allUnits.find(
      (e) => e.position !== null && e.position.at(x, y)
    );
    return entry?.unit;
  }

  getPosition(unit: IUnit): Position | null {
    const entry = this._allUnits.find((e) => e.unit === unit);
    return entry?.position ?? null;
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
