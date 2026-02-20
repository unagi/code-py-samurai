import type { Space } from "../space";
import { BaseAbility } from "./base";

export class DistanceOf extends BaseAbility {
  perform(space: Space): number {
    const [x, y] = space.location;
    return this._unit.position!.distanceOf(x, y);
  }
}
