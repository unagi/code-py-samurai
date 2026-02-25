import type { RelativeDirection } from "../direction";
import type { ILogger } from "../types";
import type { Space } from "../space";
import sludgeGameplay from "../unit-data/sludge.gameplay.json";
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
  protected static readonly ATTACK_POWER: number = sludgeGameplay.stats.attackPower;
  protected static readonly MAX_HEALTH: number = sludgeGameplay.stats.maxHealth;
  protected static readonly CHARACTER: string = sludgeGameplay.symbol;
  protected static readonly NAME_KEY: string = sludgeGameplay.nameKey;

  constructor(logger?: ILogger) {
    super(logger, createAbility);
    this.addAbilities("attack!", "feel");
  }

  playTurn(turn: Turn): void {
    for (const direction of SEARCH_DIRECTIONS) {
      const space = turn.doSense("feel", direction) as Space;
      const u = space.unit;
      if (u && (u.isSamurai() || u.isGolem())) {
        turn.doAction("attack!", direction);
        return;
      }
    }
  }
}
