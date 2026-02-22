import type { IFloor, IUnit } from "./types";

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

  get location(): [number, number] {
    return [this._x, this._y];
  }

  get character(): string {
    const u = this.unit;
    if (u) return u.character;
    if (this.isStairs()) return ">";
    return " ";
  }

  isWall(): boolean {
    return this._floor.outOfBounds(this._x, this._y);
  }

  isEmpty(): boolean {
    return this.unit === undefined && !this.isWall();
  }

  isStairs(): boolean {
    const [sx, sy] = this._floor.stairsLocation;
    return this._x === sx && this._y === sy;
  }

  isPlayer(): boolean {
    return this.unitMatches((u) => u.isSamurai() || u.isGolem());
  }

  isEnemy(): boolean {
    return this.unitMatches((u) => !u.isSamurai() && !u.isGolem() && !u.isBound());
  }

  isCaptive(): boolean {
    return this.unitMatches((u) => u.isBound());
  }

  isTicking(): boolean {
    return this.unitMatches((u) => u.hasAbility("explode!"));
  }

  isGolem(): boolean {
    return this.unitMatches((u) => u.isGolem());
  }

  get nameKey(): string {
    const u = this.unit;
    if (u) return u.nameKey;
    if (this.isWall()) return "wall";
    return "nothing";
  }

  toString(): string {
    const u = this.unit;
    if (u) return u.toString();
    if (this.isWall()) return "wall";
    return "nothing";
  }

  private unitMatches(predicate: (unit: IUnit) => boolean): boolean {
    const unit = this.unit;
    return unit ? predicate(unit) : false;
  }
}
