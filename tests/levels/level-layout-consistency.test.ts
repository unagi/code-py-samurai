import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function listLevelJsonFiles(): string[] {
  const roots = ["src/levels/beginner", "src/levels/intermediate"];
  const files: string[] = [];
  for (const root of roots) {
    for (const name of fs.readdirSync(root).sort((a, b) => a.localeCompare(b))) {
      if (name.endsWith(".json")) {
        files.push(path.join(root, name));
      }
    }
  }
  return files;
}

type Point = { x: number; y: number };
type Unit = Point & { unitId?: string };
type RawLevelLayout = {
  floor: { width: number; height: number };
  stairs: Point;
  samurai: Point;
  units: Unit[];
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

function asPoint(value: unknown, label: string): Point {
  const rec = asRecord(value, label);
  return {
    x: asInt(rec.x, `${label}.x`),
    y: asInt(rec.y, `${label}.y`),
  };
}

function toRawLayout(value: unknown): RawLevelLayout {
  const root = asRecord(value, "level");
  const floor = asRecord(root.floor, "floor");
  const unitsRaw = root.units;
  if (!Array.isArray(unitsRaw)) {
    throw new Error("units must be an array");
  }
  return {
    floor: {
      width: asInt(floor.width, "floor.width"),
      height: asInt(floor.height, "floor.height"),
    },
    stairs: asPoint(root.stairs, "stairs"),
    samurai: asPoint(root.samurai, "samurai"),
    units: unitsRaw.map((unit, index) => {
      const rec = asRecord(unit, `units[${index}]`);
      return {
        x: asInt(rec.x, `units[${index}].x`),
        y: asInt(rec.y, `units[${index}].y`),
      };
    }),
  };
}

describe("level layout consistency", () => {
  const jsonFiles = listLevelJsonFiles();

  it("all level json files are in bounds", () => {
    for (const file of jsonFiles) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
      const level = toRawLayout(raw);
      const inBounds = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < level.floor.width && y < level.floor.height;

      expect(inBounds(level.stairs.x, level.stairs.y), `${file}: stairs out of bounds`).toBe(true);
      expect(inBounds(level.samurai.x, level.samurai.y), `${file}: samurai out of bounds`).toBe(true);
      for (let i = 0; i < level.units.length; i++) {
        const unit = level.units[i];
        expect(inBounds(unit.x, unit.y), `${file}: units[${i}] out of bounds`).toBe(true);
      }
    }
  });

  it("all level json files have no coordinate overlap", () => {
    for (const file of jsonFiles) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
      const level = toRawLayout(raw);
      const used = new Map<string, string>();

      const put = (label: string, x: number, y: number): void => {
        const key = `${x},${y}`;
        const prev = used.get(key);
        expect(prev, `${file}: ${label} overlaps ${prev ?? "unknown"} at ${key}`).toBeUndefined();
        used.set(key, label);
      };

      put("samurai", level.samurai.x, level.samurai.y);
      for (let i = 0; i < level.units.length; i++) {
        const unit = level.units[i];
        put(`units[${i}]`, unit.x, unit.y);
      }
    }
  });
});
