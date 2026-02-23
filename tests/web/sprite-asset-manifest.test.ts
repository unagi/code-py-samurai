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
    const orochi = spriteAssetManifest.units.orochi;

    expect(orochi.idle.left?.path).toBe("/assets/sprites/orochi/idle-left.png");
    expect(orochi.idle.right?.frames).toBe(3);
    expect(orochi.attack.left?.frames).toBe(4);
  });
});
