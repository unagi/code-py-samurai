export const SAMURAI_IDLE_FRAME_COUNT = 16;
export const SAMURAI_IDLE_FRAME_MS = 140;
/** スプライトフレームあたりの表示時間 (ms) */
export const SPRITE_FRAME_MS = 160;

export interface SpriteStateConfig {
  /** パステンプレート — "{dir}" が "left" / "right" に置換される */
  pathTemplate: string;
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
    idle:    { pathTemplate: "/assets/sprites/gama/idle-{dir}.png",    frames: 1 },
    attack:  { pathTemplate: "/assets/sprites/gama/attack-{dir}.png",  frames: 1 },
    damaged: { pathTemplate: "/assets/sprites/gama/damaged-{dir}.png", frames: 2 },
    death:   { pathTemplate: "/assets/sprites/gama/death-{dir}.png",   frames: 4 },
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

export function getSamuraiIdleFramePath(frameIndex: number): string {
  const frame = String((frameIndex % SAMURAI_IDLE_FRAME_COUNT) + 1).padStart(2, "0");
  return `/assets/sprites/samurai-cat/idle-east-frames/frame_${frame}.png`;
}
