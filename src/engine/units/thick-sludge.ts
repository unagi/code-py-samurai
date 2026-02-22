import type { ILogger } from "../types";
import { Sludge } from "./sludge";

/**
 * ThickSludge - stronger variant of Sludge.
 * Ported from RubyWarrior::Units::ThickSludge
 */
export class ThickSludge extends Sludge {
  protected static readonly MAX_HEALTH: number = 24;
  protected static readonly CHARACTER: string = "S";

  constructor(logger?: ILogger) {
    super(logger);
  }

  get name(): string {
    return "Thick Sludge";
  }
}
