import { ABSOLUTE_DIRECTIONS } from "@engine/direction";
import type { AbsoluteDirection } from "@engine/direction";
import type { LevelDefinition } from "@engine/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`${path} must be a number`);
  }
  return value;
}

function asInt(value: unknown, path: string): number {
  const n = asNumber(value, path);
  if (!Number.isInteger(n)) {
    throw new TypeError(`${path} must be an integer`);
  }
  return n;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${path} must be a string`);
  }
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${path} must be string[]`);
  }
  return value;
}

function asSamuraiAbilities(value: unknown, path: string): { skills: string[]; stats: string[] } {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return {
    skills: asStringArray(value.skills, `${path}.skills`),
    stats: asStringArray(value.stats, `${path}.stats`),
  };
}

function asDirection(value: unknown, path: string): AbsoluteDirection {
  const direction = asString(value, path);
  if (!ABSOLUTE_DIRECTIONS.includes(direction as AbsoluteDirection)) {
    throw new TypeError(`${path} must be one of: ${ABSOLUTE_DIRECTIONS.join(", ")}`);
  }
  return direction as AbsoluteDirection;
}

function asPoint(value: unknown, path: string): { x: number; y: number } {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return {
    x: asNumber(value.x, `${path}.x`),
    y: asNumber(value.y, `${path}.y`),
  };
}

export function parseLevelDefinitionJson(value: unknown): LevelDefinition {
  if (!isRecord(value)) {
    throw new TypeError("level json must be an object");
  }

  const floor = isRecord(value.floor) ? value.floor : (() => {
    throw new TypeError("floor must be an object");
  })();
  const stairs = asPoint(value.stairs, "stairs");

  const samuraiRaw = isRecord(value.samurai) ? value.samurai : (() => {
    throw new TypeError("samurai must be an object");
  })();

  const unitsRaw = value.units;
  if (!Array.isArray(unitsRaw)) {
    throw new TypeError("units must be an array");
  }

  return {
    timeBonus: asNumber(value.timeBonus, "timeBonus"),
    aceScore: asNumber(value.aceScore, "aceScore"),
    floor: {
      width: asInt(floor.width, "floor.width"),
      height: asInt(floor.height, "floor.height"),
    },
    stairs,
    samurai: {
      unitId: asString(samuraiRaw.unitId, "samurai.unitId"),
      x: asInt(samuraiRaw.x, "samurai.x"),
      y: asInt(samuraiRaw.y, "samurai.y"),
      direction: asDirection(samuraiRaw.direction, "samurai.direction"),
      abilities:
        samuraiRaw.abilities === undefined
          ? undefined
          : asSamuraiAbilities(samuraiRaw.abilities, "samurai.abilities"),
    },
    units: unitsRaw.map((unit, index) => {
      if (!isRecord(unit)) {
        throw new TypeError(`units[${index}] must be an object`);
      }
      return {
        unitId: asString(unit.unitId, `units[${index}].unitId`),
        type: asString(unit.type, `units[${index}].type`),
        x: asInt(unit.x, `units[${index}].x`),
        y: asInt(unit.y, `units[${index}].y`),
        direction: asDirection(unit.direction, `units[${index}].direction`),
        abilities:
          unit.abilities === undefined
            ? undefined
            : asStringArray(unit.abilities, `units[${index}].abilities`),
        abilityConfig:
          unit.abilityConfig === undefined
            ? undefined
            : (unit.abilityConfig as Record<string, Record<string, unknown>>),
      };
    }),
  };
}
