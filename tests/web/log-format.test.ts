import { describe, expect, it } from "vitest";

import type { LogEntry } from "@engine/log-entry";

import { formatLogEntry } from "../../src/web/log-format";

function createTranslator() {
  return (key: string, opts?: Record<string, unknown>): string => {
    switch (key) {
      case "directions.forward":
        return "FORWARD";
      case "tiles.sludge":
        return "SLUDGE";
      case "tiles.archer":
        return "ARCHER";
      case "engine.walk":
        return `walk:${String(opts?.direction ?? "")}`;
      case "engine.attackHit":
        return `hit:${String(opts?.target ?? "")}:${String(opts?.amount ?? "")}`;
      default:
        return String(opts?.defaultValue ?? key);
    }
  };
}

describe("formatLogEntry", () => {
  it("translates direction and prefixes translated unit name with numeric suffix", () => {
    const entry: LogEntry = {
      key: "engine.walk",
      params: { direction: "forward" },
      unitId: "sludge2",
    };

    expect(formatLogEntry(entry, createTranslator())).toBe("SLUDGE2 walk:FORWARD");
  });

  it("translates target and preserves # suffix in unitId", () => {
    const entry: LogEntry = {
      key: "engine.attackHit",
      params: { target: "sludge", amount: 3 },
      unitId: "archer#1",
    };

    expect(formatLogEntry(entry, createTranslator())).toBe("ARCHER#1 hit:SLUDGE:3");
  });

  it("returns translated message as-is when unitId is missing", () => {
    const entry: LogEntry = {
      key: "engine.walk",
      params: { direction: "forward" },
    };

    expect(formatLogEntry(entry, createTranslator())).toBe("walk:FORWARD");
  });
});
