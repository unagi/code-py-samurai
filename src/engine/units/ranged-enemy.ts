import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { Space } from "../space";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

const SEARCH_DIRECTIONS = [
  "forward",
  "left",
  "right",
] as const satisfies readonly RelativeDirection[];

/**
 * Shared ranged enemy behavior for units that shoot the player on sight.
 */
export abstract class RangedEnemy extends BaseUnit {
  constructor(logger?: ILogger) {
    super(logger, createAbility);
    this.addAbilities("shoot!", "look");
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const spaces = turn.doSense("look", direction) as Space[];
      for (const space of spaces) {
        if (space.isPlayer()) {
          turn.doAction("shoot!", direction);
          return;
        }
        if (!space.isEmpty()) {
          break;
        }
      }
    }
  }
}
