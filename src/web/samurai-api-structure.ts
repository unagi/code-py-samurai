import type { SamuraiAbilitySet } from "../engine/types";
import { apiReferenceDocument, type ReferenceItem } from "./reference/reference-data";

export interface SamuraiApiStructureViewModel {
  className: "Samurai";
  methodSignatures: string[];
  propertySignatures: string[];
}

interface ParsedMethodSignature {
  name: string;
  params: string[];
}

function splitArgsList(raw: string): string[] {
  const text = raw.trim();
  if (text.length === 0) return [];
  return text.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
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

function parseParamDisplayType(param: string): string {
  const text = param.trim();
  if (text === "self") return "self";
  const colonIndex = text.indexOf(":");
  if (colonIndex < 0) {
    const eqIndex = text.indexOf("=");
    return (eqIndex >= 0 ? text.slice(0, eqIndex) : text).trim();
  }
  const rhs = text.slice(colonIndex + 1);
  const eqIndex = rhs.indexOf("=");
  return (eqIndex >= 0 ? rhs.slice(0, eqIndex) : rhs).trim();
}

function parseReferenceMethodSignature(signature: string): ParsedMethodSignature | null {
  const text = signature.trim();
  const openParen = text.indexOf("(");
  const closeParen = text.lastIndexOf(")");
  const arrowIndex = text.indexOf("->", closeParen);
  if (openParen <= 0 || closeParen < openParen || arrowIndex < 0) return null;
  const name = text.slice(0, openParen).trim();
  if (!/^[A-Za-z_]\w*$/.test(name)) return null;
  const rawParams = text.slice(openParen + 1, closeParen);
  return {
    name,
    params: splitArgsList(rawParams).map(parseParamDisplayType),
  };
}

function findSamuraiItems(kind: ReferenceItem["kind"]): ReferenceItem[] {
  return apiReferenceDocument.sections
    .flatMap((section) => section.items)
    .filter((item) => item.owner === "Samurai" && item.kind === kind);
}

function buildMethodSignatureLookup(): Map<string, ParsedMethodSignature> {
  const lookup = new Map<string, ParsedMethodSignature>();
  for (const item of findSamuraiItems("method")) {
    if (!item.signature) continue;
    const parsed = parseReferenceMethodSignature(item.signature);
    if (!parsed) continue;
    lookup.set(item.name, parsed);
  }
  return lookup;
}

function buildPropertySignatureLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const item of findSamuraiItems("property")) {
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

  const [, ...otherParams] = parsed.params;
  const displayParams = ["self", ...otherParams];

  return `${parsed.name}(${displayParams.join(", ")})`;
}

function renderSamuraiPropertySignature(stat: string, propertyLookup: Map<string, string>): string {
  return propertyLookup.get(stat.trim()) ?? stat.trim();
}

export function buildSamuraiApiStructureViewModel(
  abilities: SamuraiAbilitySet,
): SamuraiApiStructureViewModel {
  const methodLookup = buildMethodSignatureLookup();
  const propertyLookup = buildPropertySignatureLookup();

  return {
    className: "Samurai",
    methodSignatures: uniqueOrdered(
      abilities.skills.map((skill) => renderSamuraiMethodSignature(skill, methodLookup)),
    ),
    propertySignatures: uniqueOrdered(
      abilities.stats.map((stat) => renderSamuraiPropertySignature(stat, propertyLookup)),
    ),
  };
}
