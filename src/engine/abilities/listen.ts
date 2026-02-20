import type { Space } from "../space";
import { BaseAbility } from "./base";

export class Listen extends BaseAbility {
  perform(): Space[] {
    const floor = this._unit.position!.floor;
    return floor.units
      .filter((u) => u !== this._unit)
      .map((u) => u.position!.space());
  }
}
