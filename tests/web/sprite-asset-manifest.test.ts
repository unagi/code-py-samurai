import { describe, expect, it } from "vitest";

import spriteAssetManifest from "../../src/web/generated/sprite-assets.manifest.generated.json";

describe("sprite asset manifest (generated)", () => {
  it("contains sludge directional entries inferred from sprite PNGs", () => {
    expect(spriteAssetManifest.schemaVersion).toBe(1);

    const sludge = spriteAssetManifest.units.sludge;
    expect(sludge).toBeDefined();

    expect(sludge.idle.east).toMatchObject({
      path: "/assets/sprites/sludge/idle-east.png",
      width: 1280,
      height: 320,
      frames: 4,
    });
    expect(sludge.idle.west).toMatchObject({
      path: "/assets/sprites/sludge/idle-west.png",
      width: 1280,
      height: 320,
      frames: 4,
    });
    expect(sludge.attack.east?.frames).toBe(1);
    expect(sludge.damaged.east?.frames).toBe(2);
    expect(sludge.death.east?.frames).toBe(4);
  });

  it("normalizes left/right named sprites into directional variants", () => {
    const thickSludge = spriteAssetManifest.units["thick-sludge"];

    expect(thickSludge.idle.left?.path).toBe("/assets/sprites/thick-sludge/idle-left.png");
    expect(thickSludge.idle.right?.frames).toBe(3);
    expect(thickSludge.attack.left?.frames).toBe(4);
  });

  it("indexes captive sprite assets under the unit-kind folder", () => {
    const captive = spriteAssetManifest.units.captive;

    expect(captive.bound.none).toMatchObject({
      path: "/assets/sprites/captive/bound.png",
      width: 240,
      height: 80,
      frames: 3,
    });
    expect(captive.rescued.none).toMatchObject({
      path: "/assets/sprites/captive/rescued.png",
      width: 480,
      height: 80,
      frames: 6,
    });
  });
});
