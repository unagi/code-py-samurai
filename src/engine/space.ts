import { Terrain, type IFloor, type IUnit } from "./types";

export class Space {
  private readonly _floor: IFloor;
  private readonly _x: number;
  private readonly _y: number;

  constructor(floor: IFloor, x: number, y: number) {
    this._floor = floor;
    this._x = x;
    this._y = y;
  }

  get unit(): IUnit | undefined {
    return this._floor.get(this._x, this._y);
  }

  get terrain(): Terrain {
    if (this._floor.outOfBounds(this._x, this._y)) return Terrain.Wall;
    const [sx, sy] = this._floor.stairsLocation;
    if (this._x === sx && this._y === sy) return Terrain.Stairs;
    return Terrain.Floor;
  }

  get location(): [number, number] {
    return [this._x, this._y];
  }

  get character(): string {
    const u = this.unit;
    if (u) return u.character;
    if (this.terrain === Terrain.Stairs) return ">";
    return " ";
  }

  get nameKey(): string {
    const u = this.unit;
    if (u) return u.nameKey;
    if (this.terrain === Terrain.Wall) return "wall";
    return "nothing";
  }

  toString(): string {
    const u = this.unit;
    if (u) return u.toString();
    if (this.terrain === Terrain.Wall) return "wall";
    return "nothing";
  }
}
