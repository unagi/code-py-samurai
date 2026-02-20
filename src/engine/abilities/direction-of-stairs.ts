import type { RelativeDirection } from "../direction";
import { BaseAbility } from "./base";

export class DirectionOfStairs extends BaseAbility {
  perform(): RelativeDirection {
    const pos = this._unit.position!;
    const [sx, sy] = pos.floor.stairsLocation;
    return pos.relativeDirectionOf(sx, sy);
  }
}
