import type { LogEntry } from "@engine/log-entry";

import { buildBoardGrid } from "./board-grid";
import { normalizeIdPrefix, stripTrailingDigits } from "./unit-id";

export interface DamagePopup {
  id: number;
  tileIndex: number;
  text: string;
  expiresAt: number;
  variant?: "heal";
}

export const DAMAGE_POPUP_MS = 820;

const UNIT_ID_PREFIX_TO_KIND: Record<string, string> = {
  samurai: "samurai",
  golem: "golem",
  sludge: "sludge",
  thicksludge: "thick-sludge",
  archer: "archer",
  wizard: "wizard",
  captive: "captive",
};

function resolveUnitKind(unitId: string): string | undefined {
  const prefixRaw = unitId.includes("#") ? unitId.split("#")[0] : stripTrailingDigits(unitId);
  return UNIT_ID_PREFIX_TO_KIND[normalizeIdPrefix(prefixRaw)];
}

interface TileIndexResolver {
  directLookup(unitId: string): number | undefined;
  kindLookup(unitId: string): number | undefined;
}

function buildTileIndexResolver(
  unitTileIndexByLabel: Map<string, number>,
  grid: ReturnType<typeof buildBoardGrid>,
): TileIndexResolver {
  const indicesByKind = new Map<string, number[]>();
  const useCountByKind = new Map<string, number>();
  const tiles = grid.tiles;
  const samuraiIndex = tiles.findIndex((tile) => tile.kind === "samurai");
  const cols = Math.max(grid.columns, 1);

  for (let i = 0; i < tiles.length; i++) {
    const kind = tiles[i].kind;
    const list = indicesByKind.get(kind);
    if (list) {
      list.push(i);
    } else {
      indicesByKind.set(kind, [i]);
    }
  }

  const distanceToSamurai = (index: number): number => {
    if (samuraiIndex < 0) return 0;
    const x1 = index % cols;
    const y1 = Math.floor(index / cols);
    const x2 = samuraiIndex % cols;
    const y2 = Math.floor(samuraiIndex / cols);
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  };

  return {
    directLookup(unitId: string) {
      return unitTileIndexByLabel.get(unitId);
    },
    kindLookup(unitId: string) {
      const kind = resolveUnitKind(unitId);
      if (!kind) return undefined;
      const indices = indicesByKind.get(kind);
      if (!indices || indices.length === 0) return undefined;
      const used = useCountByKind.get(kind) ?? 0;
      if (kind !== "samurai" && samuraiIndex >= 0) {
        indices.sort((a, b) => {
          const d = distanceToSamurai(a) - distanceToSamurai(b);
          return d === 0 ? a - b : d;
        });
      }
      const tileIndex = indices[used % indices.length];
      useCountByKind.set(kind, used + 1);
      return tileIndex;
    },
  };
}

export function createDamagePopupsFromEntries(
  entries: LogEntry[],
  board: string,
  idSeed: number,
  unitTileIndexByLabel: Map<string, number>,
): DamagePopup[] {
  if (entries.length === 0) return [];

  const resolver = buildTileIndexResolver(unitTileIndexByLabel, buildBoardGrid(board));
  const popups: DamagePopup[] = [];
  let nextId = idSeed;
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.unitId) continue;
    if (entry.key !== "engine.takeDamage" && entry.key !== "engine.restHeal") continue;
    const unitId = entry.unitId.toLowerCase();
    const amount = entry.params.amount as number;
    if (typeof amount !== "number" || amount <= 0) continue;
    const tileIndex = resolver.directLookup(unitId) ?? resolver.kindLookup(unitId);
    if (tileIndex === undefined) continue;
    if (entry.key === "engine.restHeal") {
      popups.push({ id: nextId++, tileIndex, text: `+${amount}`, expiresAt: now + DAMAGE_POPUP_MS, variant: "heal" });
      continue;
    }
    popups.push({ id: nextId++, tileIndex, text: `-${amount}`, expiresAt: now + DAMAGE_POPUP_MS });
  }

  return popups;
}

export type SpriteState = "attack" | "damaged" | "death";

export interface SpriteOverride {
  id: number;
  tileIndex: number;
  kind: string;
  state: SpriteState;
  startedAt: number;
  expiresAt: number;
}

export const SPRITE_OVERRIDE_MS = 700;

export function createSpriteOverridesFromEntries(
  entries: LogEntry[],
  board: string,
  idSeed: number,
  unitTileIndexByLabel: Map<string, number>,
  supportedSpriteKinds: ReadonlySet<string>,
): SpriteOverride[] {
  if (entries.length === 0) return [];

  const resolver = buildTileIndexResolver(unitTileIndexByLabel, buildBoardGrid(board));
  const overrides: SpriteOverride[] = [];
  let nextId = idSeed;
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.unitId) continue;
    const unitId = entry.unitId.toLowerCase();
    const kind = resolveUnitKind(unitId);
    if (!kind || !supportedSpriteKinds.has(kind)) continue;

    let state: SpriteState | null = null;
    if (entry.key === "engine.attackHit" || entry.key === "engine.attackMiss") {
      state = "attack";
    } else if (entry.key === "engine.takeDamage") {
      state = "damaged";
    } else if (entry.key === "engine.dies") {
      state = "death";
    }
    if (!state) continue;

    const tileIndex = resolver.directLookup(unitId) ?? resolver.kindLookup(unitId);
    if (tileIndex === undefined) continue;

    overrides.push({
      id: nextId++,
      tileIndex,
      kind,
      state,
      startedAt: now,
      expiresAt: now + SPRITE_OVERRIDE_MS,
    });
  }

  return overrides;
}
