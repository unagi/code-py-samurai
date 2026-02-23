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
    expect(sludge.attack.east?.frames).toBe(2);
    expect(sludge.damaged.east?.frames).toBe(2);
    expect(sludge.death.east?.frames).toBe(3);
  });

  it("indexes thick-sludge east/west directional variants", () => {
    const thickSludge = spriteAssetManifest.units["thick-sludge"];

    expect(thickSludge.idle.west?.path).toBe("/assets/sprites/thick-sludge/idle-west.png");
    expect(thickSludge.idle.east?.frames).toBe(4);
    expect(thickSludge.attack.west?.frames).toBe(4);
  });

  it("indexes captive sprite assets under the unit-kind folder", () => {
    const captive = spriteAssetManifest.units.captive;

    expect(captive.idle.none).toMatchObject({
      path: "/assets/sprites/captive/bound.png",
      width: 1280,
      height: 320,
      frames: 4,
    });
    expect(captive.death.none).toMatchObject({
      path: "/assets/sprites/captive/rescued.png",
      width: 1280,
      height: 320,
      frames: 4,
    });
  });

  it("indexes wizard directional entries from the wizard folder", () => {
    const wizard = spriteAssetManifest.units.wizard;

    expect(wizard.idle.east).toMatchObject({
      path: "/assets/sprites/wizard/idle-east.png",
      width: 1280,
      height: 320,
      frames: 4,
    });
    expect(wizard.attack.west).toMatchObject({
      path: "/assets/sprites/wizard/attack-west.png",
      frames: 4,
    });
    expect(wizard.death.east?.frames).toBe(3);
  });
});
