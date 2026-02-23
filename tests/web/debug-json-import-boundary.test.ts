import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import ts from "typescript";

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
  const sourceFile = ts.createSourceFile(
    "debug-json-import-boundary.tsx",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text.endsWith(".debug.json")) {
        specs.push(node.moduleSpecifier.text);
      }
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteralLike(firstArg) && firstArg.text.endsWith(".debug.json")) {
        specs.push(firstArg.text);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
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
