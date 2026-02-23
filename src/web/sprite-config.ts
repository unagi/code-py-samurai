import spriteAssetManifestJson from "./generated/sprite-assets.manifest.generated.json";
import { resolveSpriteDir, type SpriteDir } from "./sprite-utils";

// Transitional fallback until the samurai spritesheet is recreated.
export const SAMURAI_IDLE_FRAME_COUNT = 1;
export const SAMURAI_IDLE_FRAME_MS = 140;
/** スプライトフレームあたりの表示時間 (ms) */
export const SPRITE_FRAME_MS = 160;

export interface SpriteStateConfig {
  /** パステンプレート — "{dir}" が "left" / "right" に置換される */
  pathTemplate?: string;
  /** 方向ごとの明示パス（left/right 入力を east/west ファイルにマップする用途） */
  pathByDir?: Readonly<Record<SpriteDir, string>>;
  frames: number;
}

export interface CharSpriteConfig {
  idle: SpriteStateConfig;
  attack: SpriteStateConfig;
  damaged: SpriteStateConfig;
  death: SpriteStateConfig;
}

type CharSpriteState = keyof CharSpriteConfig;
type SpriteAssetDirectionKey = "east" | "west" | "left" | "right" | "none";

interface SpriteAssetManifestFrameDef {
  path: string;
  width: number;
  height: number;
  frames: number;
}

interface SpriteAssetManifest {
  schemaVersion: number;
  units: Record<string, Record<string, Partial<Record<SpriteAssetDirectionKey, SpriteAssetManifestFrameDef>>>>;
}

const SPRITE_ASSET_MANIFEST = spriteAssetManifestJson as SpriteAssetManifest;

function resolveManifestDirectionalFrameDef(
  variants: Partial<Record<SpriteAssetDirectionKey, SpriteAssetManifestFrameDef>>,
  dir: SpriteDir,
): SpriteAssetManifestFrameDef {
  const preferredKeys: readonly SpriteAssetDirectionKey[] = dir === "left"
    ? ["left", "west"]
    : ["right", "east"];
  for (const key of preferredKeys) {
    const def = variants[key];
    if (def) return def;
  }
  throw new Error(`Missing sprite asset variant for direction=${dir}`);
}

function buildDirectionalSpriteStateConfigFromManifest(
  unitKind: string,
  state: CharSpriteState,
): SpriteStateConfig {
  const stateVariants = SPRITE_ASSET_MANIFEST.units[unitKind]?.[state];
  if (!stateVariants) {
    throw new Error(`Missing sprite asset manifest entry: ${unitKind}.${state}`);
  }

  const left = resolveManifestDirectionalFrameDef(stateVariants, "left");
  const right = resolveManifestDirectionalFrameDef(stateVariants, "right");
  if (left.frames !== right.frames) {
    throw new Error(`Frame mismatch in sprite manifest: ${unitKind}.${state} (${left.frames} vs ${right.frames})`);
  }

  return {
    pathByDir: {
      left: left.path,
      right: right.path,
    },
    frames: left.frames,
  };
}

function buildSingleVariantSpriteStateConfigFromManifest(
  unitKind: string,
  state: string,
  variant: SpriteAssetDirectionKey = "none",
): SpriteStateConfig {
  const stateVariants = SPRITE_ASSET_MANIFEST.units[unitKind]?.[state];
  if (!stateVariants) {
    throw new Error(`Missing sprite asset manifest entry: ${unitKind}.${state}`);
  }
  const def = stateVariants[variant];
  if (!def) {
    throw new Error(`Missing sprite asset manifest variant: ${unitKind}.${state}.${variant}`);
  }
  return {
    pathTemplate: def.path,
    frames: def.frames,
  };
}

function buildCharSpriteConfigFromManifest(unitKind: string): CharSpriteConfig {
  return {
    idle: buildDirectionalSpriteStateConfigFromManifest(unitKind, "idle"),
    attack: buildDirectionalSpriteStateConfigFromManifest(unitKind, "attack"),
    damaged: buildDirectionalSpriteStateConfigFromManifest(unitKind, "damaged"),
    death: buildDirectionalSpriteStateConfigFromManifest(unitKind, "death"),
  };
}

function buildCaptiveSpriteConfigFromManifest(): CharSpriteConfig {
  const idle = buildSingleVariantSpriteStateConfigFromManifest("captive", "idle");
  const death = buildSingleVariantSpriteStateConfigFromManifest("captive", "death");
  return {
    idle: { ...idle },
    attack: { ...idle },
    damaged: { ...idle },
    death: { ...death },
  };
}

/** キャラ種別 → スプライトシート定義 */
export const CHAR_SPRITES: Readonly<Record<string, CharSpriteConfig>> = {
  sludge: buildCharSpriteConfigFromManifest("sludge"),
  "thick-sludge": buildCharSpriteConfigFromManifest("thick-sludge"),
  wizard: buildCharSpriteConfigFromManifest("wizard"),
  captive: buildCaptiveSpriteConfigFromManifest(),
};

export const SPRITE_CAPABLE_KINDS: ReadonlySet<string> = new Set(Object.keys(CHAR_SPRITES));

export function resolveSpriteStateSrc(stateConfig: SpriteStateConfig, dir: SpriteDir): string {
  if (stateConfig.pathByDir) {
    return stateConfig.pathByDir[dir];
  }
  if (stateConfig.pathTemplate) {
    return resolveSpriteDir(stateConfig.pathTemplate, dir);
  }
  throw new Error("SpriteStateConfig must define pathTemplate or pathByDir");
}

export function getSamuraiIdleFramePath(frameIndex: number): string {
  const frame = String((frameIndex % SAMURAI_IDLE_FRAME_COUNT) + 1).padStart(2, "0");
  return `/assets/sprites/samurai-cat/idle-east-frames/frame_${frame}.png`;
}
