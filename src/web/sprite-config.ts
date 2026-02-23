import { resolveSpriteDir, type SpriteDir } from "./sprite-utils";

export const SAMURAI_IDLE_FRAME_COUNT = 16;
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

/** キャラ種別 → スプライトシート定義 */
export const CHAR_SPRITES: Readonly<Record<string, CharSpriteConfig>> = {
  sludge: {
    idle:    {
      pathByDir: {
        left: "/assets/sprites/gama/idle-west.png",
        right: "/assets/sprites/gama/idle-east.png",
      },
      frames: 4,
    },
    attack:  {
      pathByDir: {
        left: "/assets/sprites/gama/attack-west.png",
        right: "/assets/sprites/gama/attack-east.png",
      },
      frames: 1,
    },
    damaged: {
      pathByDir: {
        left: "/assets/sprites/gama/damaged-west.png",
        right: "/assets/sprites/gama/damaged-east.png",
      },
      frames: 2,
    },
    death:   {
      pathByDir: {
        left: "/assets/sprites/gama/death-west.png",
        right: "/assets/sprites/gama/death-east.png",
      },
      frames: 4,
    },
  },
  "thick-sludge": {
    idle:    { pathTemplate: "/assets/sprites/orochi/idle-{dir}.png",    frames: 3 },
    attack:  { pathTemplate: "/assets/sprites/orochi/attack-{dir}.png",  frames: 4 },
    damaged: { pathTemplate: "/assets/sprites/orochi/damaged-{dir}.png", frames: 2 },
    death:   { pathTemplate: "/assets/sprites/orochi/death-{dir}.png",   frames: 4 },
  },
  captive: {
    idle:    { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    attack:  { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    damaged: { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
    death:   { pathTemplate: "/assets/sprites/tsuru/bound.png",    frames: 3 },
  },
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
