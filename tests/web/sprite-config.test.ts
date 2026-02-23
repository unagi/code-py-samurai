import { describe, expect, it } from "vitest";

import {
  CHAR_SPRITES,
  SAMURAI_IDLE_FRAME_COUNT,
  SAMURAI_IDLE_FRAME_MS,
  SPRITE_CAPABLE_KINDS,
  SPRITE_FRAME_MS,
  getSamuraiIdleFramePath,
  resolveSpriteStateSrc,
} from "../../src/web/sprite-config";

describe("sprite config", () => {
  it("builds samurai idle frame paths with zero-padded wrapping indices", () => {
    expect(getSamuraiIdleFramePath(0)).toBe("/assets/sprites/samurai-cat/idle-east-frames/frame_01.png");
    expect(getSamuraiIdleFramePath(15)).toBe("/assets/sprites/samurai-cat/idle-east-frames/frame_16.png");
    expect(getSamuraiIdleFramePath(16)).toBe("/assets/sprites/samurai-cat/idle-east-frames/frame_01.png");
  });

  it("exposes sprite-capable kinds derived from sprite definitions", () => {
    expect(SPRITE_CAPABLE_KINDS.has("sludge")).toBe(true);
    expect(SPRITE_CAPABLE_KINDS.has("thick-sludge")).toBe(true);
    expect(SPRITE_CAPABLE_KINDS.has("captive")).toBe(true);
    expect(SPRITE_CAPABLE_KINDS.has("archer")).toBe(false);
    expect(CHAR_SPRITES.sludge.idle.frames).toBe(4);
    expect(CHAR_SPRITES.sludge.attack.frames).toBe(1);
    expect(CHAR_SPRITES["thick-sludge"].death.frames).toBe(4);
  });

  it("resolves sludge sprite paths to east/west assets while keeping left/right inputs", () => {
    expect(resolveSpriteStateSrc(CHAR_SPRITES.sludge.idle, "left"))
      .toBe("/assets/sprites/sludge/idle-west.png");
    expect(resolveSpriteStateSrc(CHAR_SPRITES.sludge.idle, "right"))
      .toBe("/assets/sprites/sludge/idle-east.png");
    expect(resolveSpriteStateSrc(CHAR_SPRITES.sludge.attack, "left"))
      .toBe("/assets/sprites/sludge/attack-west.png");
    expect(resolveSpriteStateSrc(CHAR_SPRITES.sludge.attack, "right"))
      .toBe("/assets/sprites/sludge/attack-east.png");
  });

  it("resolves thick-sludge sprite paths from generated manifest", () => {
    expect(resolveSpriteStateSrc(CHAR_SPRITES["thick-sludge"].idle, "left"))
      .toBe("/assets/sprites/thick-sludge/idle-left.png");
    expect(resolveSpriteStateSrc(CHAR_SPRITES["thick-sludge"].attack, "right"))
      .toBe("/assets/sprites/thick-sludge/attack-right.png");
  });

  it("resolves captive sprite paths from generated manifest", () => {
    expect(resolveSpriteStateSrc(CHAR_SPRITES.captive.idle, "left"))
      .toBe("/assets/sprites/captive/bound.png");
    expect(resolveSpriteStateSrc(CHAR_SPRITES.captive.death, "right"))
      .toBe("/assets/sprites/captive/bound.png");
    expect(CHAR_SPRITES.captive.idle.frames).toBe(3);
  });

  it("keeps animation timing constants stable", () => {
    expect(SAMURAI_IDLE_FRAME_COUNT).toBe(16);
    expect(SAMURAI_IDLE_FRAME_MS).toBe(140);
    expect(SPRITE_FRAME_MS).toBe(160);
  });
});
