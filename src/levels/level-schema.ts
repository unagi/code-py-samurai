import type { AbsoluteDirection } from "@engine/direction";
import type { LevelDefinition } from "@engine/types";

const VALID_DIRECTIONS: AbsoluteDirection[] = ["north", "east", "south", "west"];

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

function asWarriorAbilities(value: unknown, path: string): { skills: string[]; stats: string[] } {
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
  if (!VALID_DIRECTIONS.includes(direction as AbsoluteDirection)) {
    throw new TypeError(`${path} must be one of: ${VALID_DIRECTIONS.join(", ")}`);
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

  const warriorRaw = isRecord(value.warrior) ? value.warrior : (() => {
    throw new TypeError("warrior must be an object");
  })();

  const unitsRaw = value.units;
  if (!Array.isArray(unitsRaw)) {
    throw new TypeError("units must be an array");
  }

  return {
    description: asString(value.description, "description"),
    tip: asString(value.tip, "tip"),
    clue: value.clue === undefined ? undefined : asString(value.clue, "clue"),
    timeBonus: asNumber(value.timeBonus, "timeBonus"),
    aceScore: asNumber(value.aceScore, "aceScore"),
    floor: {
      width: asInt(floor.width, "floor.width"),
      height: asInt(floor.height, "floor.height"),
    },
    stairs,
    warrior: {
      unitId: asString(warriorRaw.unitId, "warrior.unitId"),
      x: asInt(warriorRaw.x, "warrior.x"),
      y: asInt(warriorRaw.y, "warrior.y"),
      direction: asDirection(warriorRaw.direction, "warrior.direction"),
      abilities:
        warriorRaw.abilities === undefined
          ? undefined
          : asWarriorAbilities(warriorRaw.abilities, "warrior.abilities"),
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
