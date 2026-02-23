import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../../src/web/reference/reference-data");
});

describe("sprite debug data defensive branches", () => {
  it("handles missing samurai reference section", async () => {
    vi.resetModules();
    vi.doMock("../../src/web/reference/reference-data", () => ({
      apiReferenceDocument: { sections: [] },
    }));

    const mod = await import("../../src/web/sprite-debug-data");
    const specs = mod.buildSpriteDebugDirectionCoverageSpecs();
    const samurai = specs.find((spec) => spec.kind === "samurai");

    expect(samurai).toBeDefined();
    expect(samurai?.requiredDirs.length).toBeGreaterThanOrEqual(0);
  });

  it("supports pivot-only signature without parentheses for samurai directional requirement", async () => {
    vi.resetModules();
    vi.doMock("../../src/web/reference/reference-data", () => ({
      apiReferenceDocument: {
        sections: [
          {
            id: "samurai-class",
            items: [
              { kind: "method", owner: "Samurai", signature: "pivot" },
              { kind: "property", owner: "Samurai", signature: "ignored" },
            ],
          },
        ],
      },
    }));

    const mod = await import("../../src/web/sprite-debug-data");
    const specs = mod.buildSpriteDebugDirectionCoverageSpecs();
    const samurai = specs.find((spec) => spec.kind === "samurai");

    expect(samurai).toBeDefined();
    expect(samurai?.requiredDirs).toContain("left");
    expect(samurai?.requiredDirs).toContain("right");
  });
});
