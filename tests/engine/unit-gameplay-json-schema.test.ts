import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface GameplayUnitJson {
  kind: string;
  symbol: string;
  nameKey: string;
  displayName?: string;
  stats: {
    maxHealth: number;
    attackPower: number;
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function asInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

function toGameplayUnitJson(value: unknown): GameplayUnitJson {
  const root = asRecord(value, "root");
  const stats = asRecord(root.stats, "stats");

  const kind = asNonEmptyString(root.kind, "kind");
  const symbol = asNonEmptyString(root.symbol, "symbol");
  const nameKey = asNonEmptyString(root.nameKey, "nameKey");
  const displayNameRaw = root.displayName;

  const maxHealth = asInteger(stats.maxHealth, "stats.maxHealth");
  const attackPower = asInteger(stats.attackPower, "stats.attackPower");

  if (symbol.length !== 1) {
    throw new Error("symbol must be a single character");
  }
  if (maxHealth < 1) {
    throw new Error("stats.maxHealth must be >= 1");
  }
  if (attackPower < 0) {
    throw new Error("stats.attackPower must be >= 0");
  }

  let displayName: string | undefined;
  if (displayNameRaw !== undefined) {
    displayName = asNonEmptyString(displayNameRaw, "displayName");
  }

  return {
    kind,
    symbol,
    nameKey,
    displayName,
    stats: { maxHealth, attackPower },
  };
}

function listGameplayJsonFiles(): string[] {
  const root = "src/engine/unit-data";
  return fs.readdirSync(root)
    .filter((name) => name.endsWith(".gameplay.json"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(root, name));
}

describe("engine gameplay unit json schema", () => {
  const files = listGameplayJsonFiles();

  it("all gameplay JSON files match the expected shape", () => {
    const seenKinds = new Set<string>();
    const seenSymbols = new Set<string>();

    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
      const parsed = toGameplayUnitJson(raw);

      const baseName = path.basename(file, ".gameplay.json");
      expect(parsed.kind, `${file}: kind should match filename`).toBe(baseName);
      expect(seenKinds.has(parsed.kind), `${file}: duplicate kind '${parsed.kind}'`).toBe(false);
      expect(seenSymbols.has(parsed.symbol), `${file}: duplicate symbol '${parsed.symbol}'`).toBe(false);

      seenKinds.add(parsed.kind);
      seenSymbols.add(parsed.symbol);
    }
  });
});
