import archerGameplay from "@engine/unit-data/archer.gameplay.json";
import golemGameplay from "@engine/unit-data/golem.gameplay.json";
import samuraiGameplay from "@engine/unit-data/samurai.gameplay.json";
import sludgeGameplay from "@engine/unit-data/sludge.gameplay.json";
import thickSludgeGameplay from "@engine/unit-data/thick-sludge.gameplay.json";
import captiveGameplay from "@engine/unit-data/captive.gameplay.json";
import wizardGameplay from "@engine/unit-data/wizard.gameplay.json";

const TILE_BASE_STATS: Record<string, { hp: number | null; atk: number | null }> = {
  samurai: { hp: samuraiGameplay.stats.maxHealth, atk: samuraiGameplay.stats.attackPower },
  golem: { hp: golemGameplay.stats.maxHealth, atk: golemGameplay.stats.attackPower },
  sludge: { hp: sludgeGameplay.stats.maxHealth, atk: sludgeGameplay.stats.attackPower },
  "thick-sludge": { hp: thickSludgeGameplay.stats.maxHealth, atk: thickSludgeGameplay.stats.attackPower },
  archer: { hp: archerGameplay.stats.maxHealth, atk: archerGameplay.stats.attackPower },
  wizard: { hp: wizardGameplay.stats.maxHealth, atk: wizardGameplay.stats.attackPower },
  captive: { hp: captiveGameplay.stats.maxHealth, atk: captiveGameplay.stats.attackPower },
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
    return `${fmt.hp(samuraiHealth ?? "--", samuraiMaxHealth ?? "--")}  ${fmt.atk(samuraiGameplay.stats.attackPower)}`;
  }
  const stats = TILE_BASE_STATS[tileKind];
  if (!stats) return null;
  const hpText = stats.hp === null ? fmt.hp("--", "--") : fmt.hp(stats.hp, stats.hp);
  const atkText = stats.atk === null ? fmt.atk("--") : fmt.atk(stats.atk);
  return `${hpText}  ${atkText}`;
}
