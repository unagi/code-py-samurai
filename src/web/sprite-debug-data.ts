import { towers } from "../levels";
import type { SpriteState } from "./board-effects";
import { apiReferenceDocument, type ReferenceItem } from "./reference/reference-data";
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

export const DEBUG_SPRITE_TRIGGER_STATES = ["attack", "damaged", "death"] as const satisfies readonly SpriteState[];
export const DEBUG_SPRITE_BUTTON_STATES = ["idle", ...DEBUG_SPRITE_TRIGGER_STATES] as const;

const PREVIEW_KIND_ORDER = ["samurai", "sludge", "thick-sludge", "wizard", "captive"] as const;
const EMOJI_RENDERED_UNITS = ["archer", "golem"] as const;
type PreviewKind = (typeof PREVIEW_KIND_ORDER)[number];
const DEBUG_DIR_SORT_ORDER: Readonly<Record<DebugSpritePreviewDir, number>> = {
  left: 0,
  right: 1,
  north: 2,
  south: 3,
  none: 4,
};

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

function buildSeededDirMap(
  previewDirsByKind: ReadonlyMap<string, Set<DebugSpritePreviewDir>>,
): Map<string, Set<DebugSpritePreviewDir>> {
  const dirMap = new Map<string, Set<DebugSpritePreviewDir>>();
  for (const kind of previewDirsByKind.keys()) {
    dirMap.set(kind, new Set());
  }
  return dirMap;
}

function hasSamuraiDirectionalSkill(samuraiSkillNames: ReadonlySet<string>): boolean {
  return samuraiSkillNames.has("walk") || samuraiSkillNames.has("pivot");
}

function collectRequiredDirsByKind(
  previewDirsByKind: ReadonlyMap<string, Set<DebugSpritePreviewDir>>,
): Map<string, Set<DebugSpritePreviewDir>> {
  const requiredDirsByKind = buildSeededDirMap(previewDirsByKind);
  const samuraiSkillNames = new Set(getSamuraiReferenceMethodSignatures().map(parseSamuraiSkillName));

  if (hasSamuraiDirectionalSkill(samuraiSkillNames)) {
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
        let dir = absoluteDirToSpriteDir(unit.direction);
        // 4方向スプライト非対応のユニットは north/south を left/right にフォールバック
        if ((dir === "north" || dir === "south") && !previewDirs.has(dir)) {
          dir = dir === "north" ? "right" : "left";
        }
        addDirToMap(requiredDirsByKind, kind, dir);
      }
    }
  }
  return requiredDirsByKind;
}

function supportedStatesForKind(kind: PreviewKind): DebugSpriteButtonState[] {
  if (kind === "samurai") return ["idle", "attack", "damaged"];
  // PREVIEW_KIND_ORDER contains only samurai and sprite-capable units.
  return [...DEBUG_SPRITE_BUTTON_STATES];
}

function directionsForKind(kind: PreviewKind): DebugSpritePreviewDir[] {
  if (kind === "captive") return ["none"];
  return ["left", "right"];
}

function buildCardNote(kind: PreviewKind): string | undefined {
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
    const previewDirs = sortDebugDirs(previewDirsByKind.get(kind)!);
    const requiredDirs = sortDebugDirs(requiredDirsByKind.get(kind)!);
    const previewSet = new Set(previewDirs);
    const missingDirs = requiredDirs.filter((dir) => !previewSet.has(dir));
    return { kind, requiredDirs, previewDirs, missingDirs };
  });
}
