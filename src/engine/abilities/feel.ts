import type { RelativeDirection } from "../direction";
import type { Space } from "../space";
import { BaseAbility } from "./base";

export class Feel extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): Space {
    this.verifyDirection(direction);
    return this.space(direction);
  }
}
