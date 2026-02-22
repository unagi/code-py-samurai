import { towers } from "../levels";
import type { SpriteState } from "./board-effects";
import { apiReferenceDocument, type ReferenceItem, type ReferenceTag } from "./reference/reference-data";
import { SPRITE_CAPABLE_KINDS } from "./sprite-config";
import { absoluteDirToSpriteDir, type SpriteDir } from "./sprite-utils";

export type DebugSpriteButtonState = "idle" | SpriteState;
export type DebugSpritePreviewDir = SpriteDir | "none";

export interface SpriteDebugCardSpec {
  id: string;
  kind: string;
  dir: DebugSpritePreviewDir;
  /** BoardGridView に渡す実方向（none の場合は right を使う） */
  spriteDir: SpriteDir;
  supportedStates: DebugSpriteButtonState[];
  unsupportedStates: DebugSpriteButtonState[];
  note?: string;
}

export interface SpriteDebugUnsupportedUnitSpec {
  kind: string;
  renderMode: "emoji";
  reason: "sprite logic not implemented";
}

export interface SpriteDebugDirectionCoverageSpec {
  kind: string;
  requiredDirs: DebugSpritePreviewDir[];
  previewDirs: DebugSpritePreviewDir[];
  missingDirs: DebugSpritePreviewDir[];
}

export type SamuraiApiMethodCategory = "action" | "sense" | "unknown";

export interface SamuraiSkillCoverageSpec {
  skillSignature: string;
  skillName: string;
  category: SamuraiApiMethodCategory;
  acceptsDirection: boolean;
  acceptedDirections: string[];
  derivedMotionSequence: string[];
  motionDefinitionStatus: "derived-from-api-no-explicit-motion-definition";
  implementedSpriteModes: string[];
  missingSpriteModes: string[];
  note: string;
}

export const DEBUG_SPRITE_TRIGGER_STATES = ["attack", "damaged", "death"] as const satisfies readonly SpriteState[];
export const DEBUG_SPRITE_BUTTON_STATES = ["idle", ...DEBUG_SPRITE_TRIGGER_STATES] as const;

const PREVIEW_KIND_ORDER = ["samurai", "sludge", "thick-sludge", "captive"] as const;
const EMOJI_RENDERED_UNITS = ["archer", "golem", "wizard"] as const;
const DEBUG_DIR_SORT_ORDER: Readonly<Record<DebugSpritePreviewDir, number>> = {
  left: 0,
  right: 1,
  none: 2,
};
const DIRECTION_ENUM_VALUES = ["FORWARD", "RIGHT", "BACKWARD", "LEFT"] as const;
const SAMURAI_IMPLEMENTED_SPRITE_MODES: readonly string[] = ["idle"];

function getSamuraiReferenceMethodItems(): ReferenceItem[] {
  const samuraiSection = apiReferenceDocument.sections.find((section) => section.id === "samurai-class");
  if (!samuraiSection) return [];
  return samuraiSection.items.filter((item) => item.kind === "method" && item.owner === "Samurai");
}

function getSamuraiReferenceMethodSignatures(): string[] {
  return getSamuraiReferenceMethodItems()
    .map((item) => item.signature)
    .filter((signature): signature is string => typeof signature === "string" && signature.length > 0);
}

function parseSamuraiSkillName(skillSignature: string): string {
  const trimmed = skillSignature.trim();
  const parenIndex = trimmed.indexOf("(");
  return parenIndex >= 0 ? trimmed.slice(0, parenIndex).trim() : trimmed;
}

function findTagEnValue(tags: ReferenceTag[] | undefined, name: string): string | undefined {
  if (!tags) return undefined;
  const tag = tags.find((item) => item.name === name);
  return tag?.value.en;
}

function resolveSamuraiMethodCategory(item: ReferenceItem): SamuraiApiMethodCategory {
  const category = findTagEnValue(item.tags, "@category");
  if (category === "action" || category === "sense") return category;
  return "unknown";
}

function signatureAcceptsDirection(signature: string): boolean {
  return signature.includes("direction: Direction");
}

function deriveMotionSequence(skillName: string, category: SamuraiApiMethodCategory): string[] {
  if (category === "sense") {
    return ["idle"];
  }
  if (category === "action") {
    return [skillName, "idle"];
  }
  return ["idle"];
}

function deriveSamuraiSkillCoverage(item: ReferenceItem): SamuraiSkillCoverageSpec {
  const skillSignature = item.signature ?? item.name;
  const skillName = item.name;
  const category = resolveSamuraiMethodCategory(item);
  const acceptsDirection = signatureAcceptsDirection(skillSignature);
  const acceptedDirections = acceptsDirection ? [...DIRECTION_ENUM_VALUES] : [];
  const derivedMotionSequence = deriveMotionSequence(skillName, category);
  const implementedSpriteModes = [...SAMURAI_IMPLEMENTED_SPRITE_MODES];
  const missingSpriteModes = derivedMotionSequence.filter((mode) => !implementedSpriteModes.includes(mode));

  let note = "API signatureはReference準拠。必要モーションはAPIからの派生（専用定義データ未整備）";
  if (category === "sense") {
    note = "API signatureはReference準拠。Sense APIは専用モーション不要として idle 維持を想定";
  } else if (missingSpriteModes.length > 0) {
    note = "API signatureはReference準拠。必要モーション派生に対し samurai は現在 idle sprite のみ";
  }

  return {
    skillSignature,
    skillName,
    category,
    acceptsDirection,
    acceptedDirections,
    derivedMotionSequence,
    motionDefinitionStatus: "derived-from-api-no-explicit-motion-definition",
    implementedSpriteModes,
    missingSpriteModes,
    note,
  };
}

function normalizeLevelUnitTypeToPreviewKind(levelUnitType: string): string {
  if (levelUnitType === "thick_sludge") return "thick-sludge";
  return levelUnitType;
}

function addDirToMap(
  map: Map<string, Set<DebugSpritePreviewDir>>,
  kind: string,
  dir: DebugSpritePreviewDir,
): void {
  const set = map.get(kind);
  if (set) {
    set.add(dir);
    return;
  }
  map.set(kind, new Set([dir]));
}

function sortDebugDirs(dirs: Iterable<DebugSpritePreviewDir>): DebugSpritePreviewDir[] {
  return Array.from(dirs).sort((a, b) => DEBUG_DIR_SORT_ORDER[a] - DEBUG_DIR_SORT_ORDER[b]);
}

function collectPreviewDirsByKind(cards: SpriteDebugCardSpec[]): Map<string, Set<DebugSpritePreviewDir>> {
  const previewDirsByKind = new Map<string, Set<DebugSpritePreviewDir>>();
  for (const card of cards) {
    addDirToMap(previewDirsByKind, card.kind, card.dir);
  }
  return previewDirsByKind;
}

function collectRequiredDirsByKind(
  previewDirsByKind: ReadonlyMap<string, Set<DebugSpritePreviewDir>>,
): Map<string, Set<DebugSpritePreviewDir>> {
  const requiredDirsByKind = new Map<string, Set<DebugSpritePreviewDir>>();
  const samuraiSkillNames = new Set(getSamuraiReferenceMethodSignatures().map(parseSamuraiSkillName));

  if (samuraiSkillNames.has("walk") || samuraiSkillNames.has("pivot")) {
    addDirToMap(requiredDirsByKind, "samurai", "left");
    addDirToMap(requiredDirsByKind, "samurai", "right");
  }

  for (const tower of towers) {
    for (const level of tower.levels) {
      for (const unit of level.units) {
        const kind = normalizeLevelUnitTypeToPreviewKind(unit.type);
        const previewDirs = previewDirsByKind.get(kind);
        if (!previewDirs) continue;
        if (previewDirs.has("none")) {
          addDirToMap(requiredDirsByKind, kind, "none");
          continue;
        }
        addDirToMap(requiredDirsByKind, kind, absoluteDirToSpriteDir(unit.direction));
      }
    }
  }
  return requiredDirsByKind;
}

function supportedStatesForKind(kind: string): DebugSpriteButtonState[] {
  if (kind === "samurai") {
    return ["idle"];
  }
  if (SPRITE_CAPABLE_KINDS.has(kind)) {
    return [...DEBUG_SPRITE_BUTTON_STATES];
  }
  return ["idle"];
}

function directionsForKind(kind: string): DebugSpritePreviewDir[] {
  if (kind === "captive") return ["none"];
  return ["left", "right"];
}

function buildCardNote(kind: string): string | undefined {
  if (kind !== "samurai") return undefined;
  return "idle のみ（現行ゲーム実装）";
}

export function buildSpriteDebugCardSpecs(): SpriteDebugCardSpec[] {
  const cards: SpriteDebugCardSpec[] = [];

  for (const kind of PREVIEW_KIND_ORDER) {
    const supportedStates = supportedStatesForKind(kind);
    const unsupportedStates = DEBUG_SPRITE_BUTTON_STATES.filter((state) => !supportedStates.includes(state));

    for (const dir of directionsForKind(kind)) {
      cards.push({
        id: `${kind}-${dir}`,
        kind,
        dir,
        spriteDir: dir === "none" ? "right" : dir,
        supportedStates,
        unsupportedStates,
        note: buildCardNote(kind),
      });
    }
  }

  return cards;
}

export function buildSpriteDebugUnsupportedUnitSpecs(): SpriteDebugUnsupportedUnitSpec[] {
  return EMOJI_RENDERED_UNITS.map((kind) => ({
    kind,
    renderMode: "emoji",
    reason: "sprite logic not implemented" as const,
  }));
}

export function buildSpriteDebugDirectionCoverageSpecs(): SpriteDebugDirectionCoverageSpec[] {
  const previewCards = buildSpriteDebugCardSpecs();
  const previewDirsByKind = collectPreviewDirsByKind(previewCards);
  const requiredDirsByKind = collectRequiredDirsByKind(previewDirsByKind);

  return PREVIEW_KIND_ORDER.map((kind) => {
    const previewDirs = sortDebugDirs(previewDirsByKind.get(kind) ?? []);
    const requiredDirs = sortDebugDirs(requiredDirsByKind.get(kind) ?? []);
    const previewSet = new Set(previewDirs);
    const missingDirs = requiredDirs.filter((dir) => !previewSet.has(dir));
    return { kind, requiredDirs, previewDirs, missingDirs };
  });
}

export function buildSamuraiSkillCoverageSpecs(): SamuraiSkillCoverageSpec[] {
  return getSamuraiReferenceMethodItems().map((item) => deriveSamuraiSkillCoverage(item));
}
