import type { SamuraiAbilitySet } from "../engine/types";
import { apiReferenceDocument, type ReferenceItem } from "./reference/reference-data";

export interface SamuraiApiStructureViewModel {
  className: "Samurai";
  methodSignatures: string[];
  propertySignatures: string[];
  enums: { name: string; members: string[] }[];
  otherClasses: { name: string; properties: string[] }[];
}

interface ParsedMethodSignature {
  name: string;
  params: string[];
}

function splitArgsList(raw: string): string[] {
  const text = raw.trim();
  if (text.length === 0) return [];
  // Handle commas inside type hints like list[Space]
  const parts: string[] = [];
  let bracketLevel = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "[" || char === "(") bracketLevel++;
    if (char === "]" || char === ")") bracketLevel--;
    if (char === "," && bracketLevel === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts.filter((part) => part.length > 0);
}

function parseUnlockedSkillCall(skill: string): { name: string; argCount: number } {
  const trimmed = skill.trim();
  const match = /^([A-Za-z_]\w*)\s*\((.*)\)\s*$/.exec(trimmed);
  if (!match) return { name: trimmed, argCount: 0 };
  return {
    name: match[1],
    argCount: splitArgsList(match[2]).length,
  };
}

function parseParamDisplay(param: string): string {
  const text = param.trim();
  // Keep type hint if present, e.g., "direction: Direction = Direction.FORWARD" -> "direction: Direction"
  const eqIndex = text.indexOf("=");
  const base = eqIndex >= 0 ? text.slice(0, eqIndex).trim() : text;
  return base;
}

function parseReferenceMethodSignature(signature: string): ParsedMethodSignature | null {
  const text = signature.trim();
  const openParen = text.indexOf("(");
  const closeParen = text.lastIndexOf(")");
  // Arrow might be missing for some simplified methods
  if (openParen <= 0 || closeParen < openParen) return null;
  const name = text.slice(0, openParen).trim();
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;
  const rawParams = text.slice(openParen + 1, closeParen);
  return {
    name,
    params: splitArgsList(rawParams).map(parseParamDisplay),
  };
}

function findItemsByKind(kind: ReferenceItem["kind"]): ReferenceItem[] {
  return apiReferenceDocument.sections
    .flatMap((section) => section.items)
    .filter((item) => item.kind === kind);
}

function buildMethodSignatureLookup(): Map<string, ParsedMethodSignature> {
  const lookup = new Map<string, ParsedMethodSignature>();
  for (const item of findItemsByKind("method")) {
    if (!item.signature || item.owner !== "Samurai") continue;
    const parsed = parseReferenceMethodSignature(item.signature);
    if (!parsed) continue;
    lookup.set(item.name, parsed);
  }
  return lookup;
}

function buildPropertySignatureLookup(owner: string): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const item of findItemsByKind("property")) {
    if (item.owner !== owner) continue;
    lookup.set(item.name, item.signature?.trim() || item.name);
  }
  return lookup;
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function renderSamuraiMethodSignature(skill: string, methodLookup: Map<string, ParsedMethodSignature>): string {
  const { name } = parseUnlockedSkillCall(skill);
  const parsed = methodLookup.get(name);
  if (!parsed) return skill.trim();

  // Omit 'self' from display
  const otherParams = parsed.params.filter(p => p !== "self");

  return `${parsed.name}(${otherParams.join(", ")})`;
}

function renderSamuraiPropertySignature(stat: string, propertyLookup: Map<string, string>): string {
  return propertyLookup.get(stat.trim()) ?? stat.trim();
}

export function buildSamuraiApiStructureViewModel(
  abilities: SamuraiAbilitySet,
): SamuraiApiStructureViewModel {
  const methodLookup = buildMethodSignatureLookup();
  const propertyLookup = buildPropertySignatureLookup("Samurai");

  const enums = findItemsByKind("enum")
    .map(item => {
      const signature = item.signature || "";
      const match = /^enum\s+(\w+)\s*{(.*)}\s*$/.exec(signature);
      if (match) {
        return {
          name: match[1],
          members: match[2].split(",").map(v => v.trim()).filter(Boolean),
        };
      }
      return {
        name: item.name,
        members: [],
      };
    });

  const otherClasses = findItemsByKind("class")
    .filter(item => item.name !== "Samurai")
    .map(item => {
      const classProps = findItemsByKind("property")
        .filter(p => p.owner === item.name)
        .map(p => p.signature || p.name);
      return {
        name: item.name,
        properties: classProps,
      };
    });

  return {
    className: "Samurai",
    methodSignatures: uniqueOrdered(
      abilities.skills.map((skill) => renderSamuraiMethodSignature(skill, methodLookup)),
    ),
    propertySignatures: uniqueOrdered(
      abilities.stats.map((stat) => renderSamuraiPropertySignature(stat, propertyLookup)),
    ),
    enums,
    otherClasses,
  };
}
