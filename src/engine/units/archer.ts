import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { BaseAbility } from "../abilities/base";
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
 * Archer - ranged enemy that shoots the player.
 * Ported from RubyWarrior::Units::Archer
 */
export class Archer extends BaseUnit {
  protected static readonly SHOOT_POWER: number = 3;
  protected static readonly MAX_HEALTH: number = 7;
  protected static readonly CHARACTER: string = "a";

  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("shoot!", "look");
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const spaces = turn.doSense("look", direction) as Space[];
      for (const space of spaces) {
        if (space.isPlayer()) {
          turn.doAction("shoot!", direction);
          return;
        } else if (!space.isEmpty()) {
          break;
        }
      }
    }
  }

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
