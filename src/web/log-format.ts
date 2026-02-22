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
  const name = t(`tiles.${normalizeIdPrefix(base)}`, { defaultValue: entry.unitId });
  return `${name}${suffix} ${msg}`;
}
