import { describe, expect, it } from "vitest";

import { apiReferenceDocument, pickText } from "../../src/web/reference/reference-data";

describe("python api reference data", () => {
  it("provides localized titles and conventions", () => {
    expect(apiReferenceDocument.title).toContain("Python API Reference");
    expect(pickText(apiReferenceDocument.conventionsTitle, "ja")).toBe("Conventions");
    expect(pickText(apiReferenceDocument.conventionsTitle, "en")).toBe("Conventions");
    expect(apiReferenceDocument.conventions.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps section and item ids unique", () => {
    const sectionIds = new Set<string>();
    const itemIds = new Set<string>();

    for (const section of apiReferenceDocument.sections) {
      expect(sectionIds.has(section.id)).toBe(false);
      sectionIds.add(section.id);
      expect(section.items.length).toBeGreaterThan(0);

      for (const item of section.items) {
        expect(itemIds.has(item.id)).toBe(false);
        itemIds.add(item.id);

        expect(item.name.length).toBeGreaterThan(0);
        expect(pickText(item.description, "ja").length).toBeGreaterThan(0);
        expect(pickText(item.description, "en").length).toBeGreaterThan(0);
      }
    }
  });

  it("contains core enum and class entries used by the reference page", () => {
    const sectionIds = apiReferenceDocument.sections.map((section) => section.id);
    expect(sectionIds).toEqual(
      expect.arrayContaining([
        "direction-enum",
        "terrain-enum",
        "unitkind-enum",
        "player-class",
        "samurai-class",
        "space-class",
        "occupant-class",
      ]),
    );

    const allItemIds = apiReferenceDocument.sections.flatMap((section) =>
      section.items.map((item) => item.id),
    );
    expect(allItemIds).toEqual(
      expect.arrayContaining([
        "samurai-walk",
        "samurai-attack",
        "samurai-rest",
        "samurai-feel",
        "samurai-look",
        "samurai-listen",
        "space-unit",
        "occupant-kind",
      ]),
    );
  });

  it("defines availability rows in ascending level order", () => {
    const levels = apiReferenceDocument.availabilityRows.map((row) => row.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(apiReferenceDocument.availabilityRows[0]?.apis).toContain("walk()");
  });
});
