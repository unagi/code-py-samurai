import type { ILogger } from "../types";
import { Sludge } from "./sludge";

/**
 * ThickSludge - stronger variant of Sludge.
 * Ported from RubyWarrior::Units::ThickSludge
 */
export class ThickSludge extends Sludge {
  constructor(logger?: ILogger) {
    super(logger);
  }

  get maxHealth(): number {
    return 24;
  }

  get character(): string {
    return "S";
  }

  get name(): string {
    return "Thick Sludge";
  }
}
