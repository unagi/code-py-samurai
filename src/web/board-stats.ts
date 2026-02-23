import sludgeGameplay from "@engine/unit-data/sludge.gameplay.json";
import thickSludgeGameplay from "@engine/unit-data/thick-sludge.gameplay.json";

const TILE_BASE_STATS: Record<string, { hp: number | null; atk: number | null }> = {
  samurai: { hp: 20, atk: 5 },
  golem: { hp: null, atk: 3 },
  sludge: { hp: sludgeGameplay.stats.maxHealth, atk: sludgeGameplay.stats.attackPower },
  "thick-sludge": { hp: thickSludgeGameplay.stats.maxHealth, atk: thickSludgeGameplay.stats.attackPower },
  archer: { hp: 7, atk: 3 },
  wizard: { hp: 3, atk: 11 },
  captive: { hp: 1, atk: 0 },
};

export interface StatsFormatter {
  hp(current: number | string, max: number | string): string;
  atk(value: number | string): string;
}

export function buildTileStatsText(
  tileKind: string,
  samuraiHealth: number | null,
  samuraiMaxHealth: number | null,
  fmt: StatsFormatter,
): string | null {
  if (tileKind === "samurai") {
    return `${fmt.hp(samuraiHealth ?? "--", samuraiMaxHealth ?? "--")}  ${fmt.atk(5)}`;
  }
  const stats = TILE_BASE_STATS[tileKind];
  if (!stats) return null;
  const hpText = stats.hp === null ? fmt.hp("--", "--") : fmt.hp(stats.hp, stats.hp);
  const atkText = stats.atk === null ? fmt.atk("--") : fmt.atk(stats.atk);
  return `${hpText}  ${atkText}`;
}
