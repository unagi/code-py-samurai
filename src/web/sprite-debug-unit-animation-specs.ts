import type { SpriteState } from "./board-effects";
import type { SpriteDebugCardSpec } from "./sprite-debug-data";
import { CHAR_SPRITES, resolveSpriteStateSrc } from "./sprite-config";
import type { SpriteDir } from "./sprite-utils";

import captiveDefJson from "./sprite-debug-unit-animation/captive.json";
import thickSludgeDefJson from "./debug/unit-animation/thick-sludge.debug.json";
import emojiFallbackDefJson from "./sprite-debug-unit-animation/emoji-fallback.json";
import samuraiDefJson from "./sprite-debug-unit-animation/samurai.json";
import sludgeDefJson from "./debug/unit-animation/sludge.debug.json";

export type UnitAnimationType = "Idle" | "Disappear" | "Offence" | "Damaged";
export type UnitAnimationArtLayout = "single" | "pair-grid" | "quad-grid";
export interface UnitPreviewSlotSpec {
  label: string;
  spriteDir: SpriteDir | null;
}

export interface UnitAnimationTypeSpec {
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

export interface UnitAnimationTypeSpecSource {
  kind: string;
  renderMode?: "sprite" | "emoji";
  cards?: readonly SpriteDebugCardSpec[];
}

type StaticUnitAnimationEntryJson = UnitAnimationTypeSpec;

interface StaticUnitAnimationDefinitionJson {
  kind: string;
  mode: "static";
  previewSlots: UnitPreviewSlotSpec[];
  entries: StaticUnitAnimationEntryJson[];
}

interface SpriteConfigUnitAnimationEntryJson {
  animationType: UnitAnimationType;
  spriteState: "idle" | SpriteState;
  trigger: string;
  expectedFrames: number;
  overlay: boolean;
}

interface SpriteConfigUnitAnimationDefinitionJson {
  kind: string;
  mode: "sprite-config";
  previewSlots: UnitPreviewSlotSpec[];
  entries: SpriteConfigUnitAnimationEntryJson[];
}

type UnitAnimationDefinitionJson = StaticUnitAnimationDefinitionJson | SpriteConfigUnitAnimationDefinitionJson;

const SPRITE_DIR_LABEL_BY_DIR: Readonly<Record<SpriteDir, string>> = {
  left: "WEST",
  right: "EAST",
};

const EMOJI_FALLBACK_DEF = emojiFallbackDefJson as StaticUnitAnimationDefinitionJson;
const UNIT_ANIMATION_DEFS_BY_KIND = new Map<string, UnitAnimationDefinitionJson>([
  ["samurai", samuraiDefJson as StaticUnitAnimationDefinitionJson],
  ["captive", captiveDefJson as StaticUnitAnimationDefinitionJson],
  ["sludge", sludgeDefJson as SpriteConfigUnitAnimationDefinitionJson],
  ["thick-sludge", thickSludgeDefJson as SpriteConfigUnitAnimationDefinitionJson],
]);

function stripSpriteAssetPrefix(src: string): string {
  return src.replace(/^\/assets\/sprites\//, "");
}

function buildFrameCountText(actualFrames: number, expectedFrames: number): string {
  const actualText = `${actualFrames} frame${actualFrames === 1 ? "" : "s"}`;
  const expectedText = `${expectedFrames} frame${expectedFrames === 1 ? "" : "s"}`;
  return `${actualText}（expected: ${expectedText}）`;
}

function hasAnimatedMotionRequirement(expectedFrames: number): boolean {
  return expectedFrames > 1;
}

function buildSpriteConfigImplementationText(
  stateName: "idle" | SpriteState,
  actualFrames: number,
  expectedFrames: number,
  overlay: boolean,
): string {
  const base = overlay
    ? `${stateName} にマッピングされ、sprite override の overlay として表示される。`
    : `${stateName} にマッピングされて表示される。`;

  if (actualFrames === expectedFrames) {
    return base;
  }

  return `${base.slice(0, -1)} 要求 ${expectedFrames} frames に対して実装は ${actualFrames} frames で不一致。`;
}

function materializeSpriteConfigUnitAnimationTypeSpecs(
  def: SpriteConfigUnitAnimationDefinitionJson,
  cards: readonly SpriteDebugCardSpec[],
): UnitAnimationTypeSpec[] {
  // sprite-config mode definitions are internal and must correspond to CHAR_SPRITES.
  const config = CHAR_SPRITES[def.kind]!;

  const spriteDirs = cards.map((card) => card.spriteDir);
  const uniqueSpriteDirs = Array.from(new Set(spriteDirs));
  const spriteDirLabelText = uniqueSpriteDirs.map((dir) => SPRITE_DIR_LABEL_BY_DIR[dir]).join(" / ");

  return def.entries.map((entry) => {
    const stateConfig = config[entry.spriteState];
    const actualFrames = stateConfig.frames;
    const expectedFrames = entry.expectedFrames;
    const animatedRequirement = hasAnimatedMotionRequirement(expectedFrames);
    const spriteFiles = uniqueSpriteDirs.map((dir) => stripSpriteAssetPrefix(resolveSpriteStateSrc(stateConfig, dir)));
    const previewImageSrcs = uniqueSpriteDirs.map((dir) => resolveSpriteStateSrc(stateConfig, dir));

    let motionSpec: string;
    if (entry.overlay) {
      motionSpec = animatedRequirement
        ? `等間隔フレーム遷移（overlay / ${spriteDirLabelText}）`
        : "単フレームoverlay表示";
    } else {
      motionSpec = animatedRequirement
        ? `等間隔フレーム遷移（${spriteDirLabelText}）`
        : "単フレーム表示";
    }

    const status: "ok" | "ng" = actualFrames !== expectedFrames ? "ng" : "ok";

    return {
      animationType: entry.animationType,
      trigger: entry.trigger,
      spriteFiles,
      frameCountText: buildFrameCountText(actualFrames, expectedFrames),
      motionSpec,
      implementation: buildSpriteConfigImplementationText(entry.spriteState, actualFrames, expectedFrames, entry.overlay),
      status,
      previewImageSrcs,
      artLayout: "pair-grid",
    };
  });
}

export function unitAnimationTypeSpecs(source: UnitAnimationTypeSpecSource): UnitAnimationTypeSpec[] {
  if (source.renderMode === "emoji") {
    return [...EMOJI_FALLBACK_DEF.entries];
  }

  const def = UNIT_ANIMATION_DEFS_BY_KIND.get(source.kind);
  if (!def) return [];

  if (def.mode === "static") {
    return [...def.entries];
  }

  return materializeSpriteConfigUnitAnimationTypeSpecs(def, source.cards ?? []);
}

export function unitPreviewSlotSpecs(source: Pick<UnitAnimationTypeSpecSource, "kind" | "renderMode">): UnitPreviewSlotSpec[] {
  if (source.renderMode === "emoji") {
    return [...EMOJI_FALLBACK_DEF.previewSlots];
  }

  const def = UNIT_ANIMATION_DEFS_BY_KIND.get(source.kind);
  if (!def) return [];
  return [...def.previewSlots];
}
