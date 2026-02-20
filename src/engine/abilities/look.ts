import type { RelativeDirection } from "../direction";
import type { Space } from "../space";
import { BaseAbility } from "./base";

/**
 * Returns an array of up to 3 Spaces in the given direction.
 * Ported from RubyWarrior::Abilities::Look
 */
export class Look extends BaseAbility {
  perform(direction: RelativeDirection = "forward"): Space[] {
    this.verifyDirection(direction);
    return [1, 2, 3].map((amount) => this.space(direction, amount));
  }
}
