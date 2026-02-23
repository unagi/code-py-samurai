import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function listSourceTsFiles(root: string): string[] {
  const files: string[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        continue;
      }
      if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        files.push(absPath);
      }
    }
  };

  walk(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function toPosixPath(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}

function isAllowedDebugJsonImporter(relPath: string): boolean {
  return relPath === "src/web/SpriteDebugPage.tsx"
    || relPath.startsWith("src/web/sprite-debug")
    || relPath.startsWith("src/web/debug/");
}

function findDebugJsonImportSpecifiers(sourceText: string): string[] {
  const specs: string[] = [];
  const staticImportRe = /\bimport\s+(?:[^"'()]+?\s+from\s+)?["']([^"']+\.debug\.json)["']/g;
  const dynamicImportRe = /\bimport\(\s*["']([^"']+\.debug\.json)["']\s*\)/g;

  for (const re of [staticImportRe, dynamicImportRe]) {
    let match: RegExpExecArray | null = re.exec(sourceText);
    while (match) {
      specs.push(match[1]);
      match = re.exec(sourceText);
    }
  }
  return specs;
}

describe("debug JSON import boundary", () => {
  it("allows .debug.json imports only from debug-focused web modules", () => {
    const srcFiles = listSourceTsFiles("src");
    const importingFiles: string[] = [];

    for (const file of srcFiles) {
      const relPath = toPosixPath(file);
      const source = fs.readFileSync(file, "utf8");
      const imports = findDebugJsonImportSpecifiers(source);
      if (imports.length === 0) continue;

      importingFiles.push(relPath);
      expect(
        isAllowedDebugJsonImporter(relPath),
        `${relPath} imports .debug.json but is outside the debug boundary`,
      ).toBe(true);
    }

    expect(importingFiles.length).toBeGreaterThan(0);
    expect(importingFiles).toEqual([
      "src/web/sprite-debug-unit-animation-specs.ts",
    ]);
  });
});
