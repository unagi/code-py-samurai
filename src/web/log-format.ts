import type { LogEntry } from "@engine/log-entry";

import { normalizeIdPrefix, stripTrailingDigits } from "./unit-id";

export type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

/** Direction values that need i18n translation in log messages. */
const DIRECTION_KEYS: Record<string, string> = {
  forward: "directions.forward",
  backward: "directions.backward",
  left: "directions.left",
  right: "directions.right",
};

/**
 * unitId prefix (normalized) -> i18n tiles key
 * unitId is lowercased/symbol-stripped (e.g. "thicksludge#1"), while i18n uses camelCase keys.
 */
const UNIT_ID_PREFIX_TO_TILE_KEY: Record<string, string> = {
  samurai: "samurai",
  golem: "golem",
  sludge: "sludge",
  thicksludge: "thickSludge",
  archer: "archer",
  wizard: "wizard",
  captive: "captive",
};

/**
 * Format a structured LogEntry into a translated display string.
 */
export function formatLogEntry(entry: LogEntry, t: TranslateFn): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(entry.params)) {
    if (k === "direction" && typeof v === "string" && DIRECTION_KEYS[v]) {
      params[k] = t(DIRECTION_KEYS[v]);
    } else if (k === "target" && typeof v === "string") {
      params[k] = t(`tiles.${v}`, { defaultValue: v });
    } else {
      params[k] = v;
    }
  }

  const msg = t(entry.key, params as Record<string, unknown>);
  if (!entry.unitId) return msg;

  const base = entry.unitId.includes("#")
    ? entry.unitId.split("#")[0]
    : stripTrailingDigits(entry.unitId);
  const suffix = entry.unitId.slice(base.length);
  const normalizedBase = normalizeIdPrefix(base);
  const tileKey = UNIT_ID_PREFIX_TO_TILE_KEY[normalizedBase] ?? normalizedBase;
  const name = t(`tiles.${tileKey}`, { defaultValue: base });
  return `${name}${suffix} ${msg}`;
}
