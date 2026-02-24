import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type DebugSpriteDir = "left" | "right" | null;
type UnitAnimationType = "Idle" | "Disappear" | "Offence" | "Damaged";
type SpriteState = "idle" | "attack" | "damaged" | "death";
type UnitAnimationArtLayout = "single" | "pair-grid" | "quad-grid";

interface DebugPreviewSlotJson {
  label: string;
  spriteDir: DebugSpriteDir;
}

interface DebugAnimationEntryJson {
  animationType: UnitAnimationType;
  spriteState: SpriteState;
  trigger: string;
  expectedFrames: number;
  overlay: boolean;
}

interface SpriteConfigDebugAnimationEntryJson extends DebugAnimationEntryJson {}

interface StaticDebugAnimationEntryJson {
  animationType: UnitAnimationType;
  trigger: string;
  spriteFiles: string[];
  frameCountText: string;
  motionSpec: string;
  implementation: string;
  status: "ok" | "ng";
  previewImageSrcs: string[];
  artLayout: UnitAnimationArtLayout;
}

interface SpriteConfigDebugUnitAnimationJson {
  kind: string;
  mode: "sprite-config";
  previewSlots: DebugPreviewSlotJson[];
  entries: SpriteConfigDebugAnimationEntryJson[];
}

interface StaticDebugUnitAnimationJson {
  kind: string;
  mode: "static";
  previewSlots: DebugPreviewSlotJson[];
  entries: StaticDebugAnimationEntryJson[];
}

type DebugUnitAnimationJson = SpriteConfigDebugUnitAnimationJson | StaticDebugUnitAnimationJson;

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

function asBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function asPositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function asEnum<T extends string>(value: unknown, label: string, candidates: readonly T[]): T {
  if (typeof value !== "string" || !candidates.includes(value as T)) {
    throw new Error(`${label} must be one of: ${candidates.join(", ")}`);
  }
  return value as T;
}

function asSpriteDir(value: unknown, label: string): DebugSpriteDir {
  if (value === null) return null;
  return asEnum(value, label, ["left", "right"] as const);
}

function toDebugPreviewSlotJson(value: unknown, label: string): DebugPreviewSlotJson {
  const rec = asRecord(value, label);
  return {
    label: asNonEmptyString(rec.label, `${label}.label`),
    spriteDir: asSpriteDir(rec.spriteDir, `${label}.spriteDir`),
  };
}

function toDebugAnimationEntryJson(value: unknown, label: string): DebugAnimationEntryJson {
  const rec = asRecord(value, label);
  return {
    animationType: asEnum(rec.animationType, `${label}.animationType`, ["Idle", "Disappear", "Offence", "Damaged"] as const),
    spriteState: asEnum(rec.spriteState, `${label}.spriteState`, ["idle", "attack", "damaged", "death"] as const),
    trigger: asNonEmptyString(rec.trigger, `${label}.trigger`),
    expectedFrames: asPositiveInteger(rec.expectedFrames, `${label}.expectedFrames`),
    overlay: asBoolean(rec.overlay, `${label}.overlay`),
  };
}

function toStaticDebugAnimationEntryJson(value: unknown, label: string): StaticDebugAnimationEntryJson {
  const rec = asRecord(value, label);
  const spriteFilesRaw = rec.spriteFiles;
  const previewImageSrcsRaw = rec.previewImageSrcs;
  if (!Array.isArray(spriteFilesRaw)) {
    throw new Error(`${label}.spriteFiles must be an array`);
  }
  if (!Array.isArray(previewImageSrcsRaw)) {
    throw new Error(`${label}.previewImageSrcs must be an array`);
  }
  return {
    animationType: asEnum(rec.animationType, `${label}.animationType`, ["Idle", "Disappear", "Offence", "Damaged"] as const),
    trigger: asNonEmptyString(rec.trigger, `${label}.trigger`),
    spriteFiles: spriteFilesRaw.map((item, index) => asNonEmptyString(item, `${label}.spriteFiles[${index}]`)),
    frameCountText: asNonEmptyString(rec.frameCountText, `${label}.frameCountText`),
    motionSpec: asNonEmptyString(rec.motionSpec, `${label}.motionSpec`),
    implementation: asNonEmptyString(rec.implementation, `${label}.implementation`),
    status: asEnum(rec.status, `${label}.status`, ["ok", "ng"] as const),
    previewImageSrcs: previewImageSrcsRaw.map((item, index) => asNonEmptyString(item, `${label}.previewImageSrcs[${index}]`)),
    artLayout: asEnum(rec.artLayout, `${label}.artLayout`, ["single", "pair-grid", "quad-grid"] as const),
  };
}

function toDebugUnitAnimationJson(value: unknown): DebugUnitAnimationJson {
  const root = asRecord(value, "root");
  const previewSlotsRaw = root.previewSlots;
  const entriesRaw = root.entries;
  if (!Array.isArray(previewSlotsRaw)) {
    throw new Error("previewSlots must be an array");
  }
  if (!Array.isArray(entriesRaw)) {
    throw new Error("entries must be an array");
  }

  const mode = asEnum(root.mode, "mode", ["sprite-config", "static"] as const);
  const previewSlots = previewSlotsRaw.map((slot, index) => toDebugPreviewSlotJson(slot, `previewSlots[${index}]`));

  const kind = asNonEmptyString(root.kind, "kind");
  const parsed: DebugUnitAnimationJson = mode === "sprite-config"
    ? { kind, mode, previewSlots, entries: entriesRaw.map((entry, index) => toDebugAnimationEntryJson(entry, `entries[${index}]`)) }
    : { kind, mode, previewSlots, entries: entriesRaw.map((entry, index) => toStaticDebugAnimationEntryJson(entry, `entries[${index}]`)) };

  if (parsed.previewSlots.length === 0) {
    throw new Error("previewSlots must not be empty");
  }
  if (parsed.entries.length === 0) {
    throw new Error("entries must not be empty");
  }

  return parsed;
}

function listDebugJsonFiles(): string[] {
  const root = "src/web/debug/unit-animation";
  return fs.readdirSync(root)
    .filter((name) => name.endsWith(".debug.json"))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(root, name));
}

describe("web debug unit animation json schema", () => {
  const files = listDebugJsonFiles();

  it("all debug JSON files match the expected shape and filename", () => {
    const seenKinds = new Set<string>();

    for (const file of files) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
      const parsed = toDebugUnitAnimationJson(raw);

      const baseName = path.basename(file, ".debug.json");
      expect(parsed.kind, `${file}: kind should match filename`).toBe(baseName);
      expect(seenKinds.has(parsed.kind), `${file}: duplicate kind '${parsed.kind}'`).toBe(false);
      seenKinds.add(parsed.kind);

      const types = parsed.entries.map((entry) => entry.animationType);
      expect(new Set(types).size, `${file}: duplicate animationType entries`).toBe(types.length);
    }
  });
});
