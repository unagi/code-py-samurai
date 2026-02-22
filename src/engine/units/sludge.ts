import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { Space } from "../space";
import type { BaseAbility } from "../abilities/base";
import { createAbility } from "../abilities/index";
import { Turn } from "../turn";
import { BaseUnit } from "./base";

const SEARCH_DIRECTIONS: RelativeDirection[] = [
  "forward",
  "left",
  "right",
  "backward",
];

export class Sludge extends BaseUnit {
  protected static readonly ATTACK_POWER: number = 3;
  protected static readonly MAX_HEALTH: number = 12;
  protected static readonly CHARACTER: string = "s";

  constructor(logger?: ILogger) {
    super(logger);
    this.addAbilities("attack!", "feel");
  }

  get name(): string {
    return "Sludge";
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

  protected createAbility(name: string): BaseAbility | null {
    return createAbility(name, this);
  }
}
