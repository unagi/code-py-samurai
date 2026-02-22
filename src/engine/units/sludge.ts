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
  "backward",
] as const satisfies readonly RelativeDirection[];

export class Sludge extends BaseUnit {
  protected static readonly ATTACK_POWER: number = 3;
  protected static readonly MAX_HEALTH: number = 12;
  protected static readonly CHARACTER: string = "s";

  constructor(logger?: ILogger) {
    super(logger, createAbility);
    this.addAbilities("attack!", "feel");
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const space = turn.doSense("feel", direction) as Space;
      if (space.isPlayer()) {
        turn.doAction("attack!", direction);
        return;
      }
    }
  }
}
