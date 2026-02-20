import type { RelativeDirection } from "../direction";
import type { Space } from "../space";
import { BaseAbility } from "./base";

export class DirectionOf extends BaseAbility {
  perform(space: Space): RelativeDirection {
    const [x, y] = space.location;
    return this._unit.position!.relativeDirectionOf(x, y);
  }
}
