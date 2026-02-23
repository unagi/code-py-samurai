import path from "node:path";
import stylelint from "stylelint";

const cwd = process.cwd();
const defaultPatterns = ["src/web/**/*.css"];
const copyPasteMinDeclarations = 4;
const copyPasteSimilarityThreshold = 0.8;
const args = process.argv.slice(2);
const failOnFindings = args.includes("--fail-on-findings");
const patterns = args.filter((arg) => arg !== "--fail-on-findings");
const targetPatterns = patterns.length > 0 ? patterns : defaultPatterns;
const configFile = path.resolve(cwd, "stylelint.audit.config.mjs");

function rel(source) {
  if (!source) return "<unknown>";
  if (source.startsWith("<")) return source;
  return path.relative(cwd, source);
}

function formatFinding(finding) {
  return `${finding.source}:${finding.line}:${finding.column} [${finding.rule}] ${finding.text}`;
}

function printGroupedCounts(title, entries, limit = 10) {
  console.log(`\n${title}`);
  if (entries.length === 0) {
    console.log("  (なし)");
    return;
  }

  for (const [index, [key, count]] of entries.slice(0, limit).entries()) {
    console.log(`  ${index + 1}. ${String(count).padStart(3, " ")}  ${key}`);
  }
}

function normalizeDeclProperty(prop) {
  const trimmed = prop.trim();
  return trimmed.startsWith("--") ? trimmed : trimmed.toLowerCase();
}

function normalizeDeclValue(value) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeDeclaration(decl) {
  const prop = normalizeDeclProperty(decl.prop);
  const value = normalizeDeclValue(decl.value);
  const important = decl.important ? " !important" : "";
  return `${prop}: ${value}${important}`;
}

function formatRuleBlockRef(block) {
  return `${block.source}:${block.line}:${block.column} ${block.selector}`;
}

function collectRuleBlocks(fileResults) {
  const blocks = [];

  for (const result of fileResults) {
    // Stylelint result exposes the parsed PostCSS result internally.
    // We use it only for audit reporting to avoid re-parsing files.
    const root = result._postcssResult?.root;
    if (!root) continue;

    root.walkRules((rule) => {
      const declarations = (rule.nodes ?? [])
        .filter((node) => node.type === "decl")
        .map((decl) => normalizeDeclaration(decl));

      if (declarations.length < copyPasteMinDeclarations) {
        return;
      }

      const uniqueDeclarations = [...new Set(declarations)];

      blocks.push({
        source: rel(result.source),
        selector: rule.selector ?? "<unknown>",
        line: rule.source?.start?.line ?? 0,
        column: rule.source?.start?.column ?? 0,
        declarationCount: declarations.length,
        declarationSet: new Set(uniqueDeclarations),
        exactSignature: declarations.join("\n"),
      });
    });
  }

  return blocks;
}

function intersectSetCount(left, right) {
  const [small, large] =
    left.size <= right.size ? [left, right] : [right, left];

  let count = 0;
  for (const value of small) {
    if (large.has(value)) {
      count += 1;
    }
  }
  return count;
}

function detectCopyPasteCandidates(fileResults) {
  const blocks = collectRuleBlocks(fileResults);
  const exactGroupMap = new Map();

  for (const block of blocks) {
    if (!exactGroupMap.has(block.exactSignature)) {
      exactGroupMap.set(block.exactSignature, []);
    }
    exactGroupMap.get(block.exactSignature).push(block);
  }

  const exactGroups = [...exactGroupMap.values()]
    .filter((group) => group.length >= 2)
    .sort((a, b) => {
      const aScore = (a.length - 1) * a[0].declarationCount;
      const bScore = (b.length - 1) * b[0].declarationCount;
      return (
        bScore - aScore ||
        b.length - a.length ||
        a[0].source.localeCompare(b[0].source) ||
        a[0].line - b[0].line
      );
    });

  const nearPairs = [];
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const left = blocks[i];
      const right = blocks[j];

      if (left.exactSignature === right.exactSignature) {
        continue;
      }

      const minDeclarations = Math.min(
        left.declarationSet.size,
        right.declarationSet.size
      );
      if (minDeclarations < copyPasteMinDeclarations) {
        continue;
      }

      const overlapCount = intersectSetCount(
        left.declarationSet,
        right.declarationSet
      );
      if (overlapCount < copyPasteMinDeclarations) {
        continue;
      }

      const overlapRatio = overlapCount / minDeclarations;
      if (overlapRatio < copyPasteSimilarityThreshold) {
        continue;
      }

      const unionCount =
        left.declarationSet.size + right.declarationSet.size - overlapCount;
      const jaccard = unionCount === 0 ? 1 : overlapCount / unionCount;

      nearPairs.push({
        left,
        right,
        overlapCount,
        overlapRatio,
        jaccard,
      });
    }
  }

  nearPairs.sort(
    (a, b) =>
      b.overlapRatio - a.overlapRatio ||
      b.overlapCount - a.overlapCount ||
      b.jaccard - a.jaccard ||
      a.left.source.localeCompare(b.left.source) ||
      a.left.line - b.left.line
  );

  return {
    analyzedRuleBlocks: blocks.length,
    exactGroups,
    nearPairs,
  };
}

function printCopyPasteAudit(copyPasteReport) {
  console.log("\nコピペ候補監査 (宣言ブロック類似)");
  console.log(
    `解析対象ルールブロック数 (>=${copyPasteMinDeclarations}宣言): ${copyPasteReport.analyzedRuleBlocks}`
  );
  console.log(
    `完全一致ブロック群: ${copyPasteReport.exactGroups.length} / 類似ペア(>=${Math.round(copyPasteSimilarityThreshold * 100)}%): ${copyPasteReport.nearPairs.length}`
  );

  console.log("\n完全一致の宣言ブロック (Top 10)");
  if (copyPasteReport.exactGroups.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [index, group] of copyPasteReport.exactGroups.slice(0, 10).entries()) {
      const duplicateWeight = (group.length - 1) * group[0].declarationCount;
      console.log(
        `  ${index + 1}. ${group.length}件 / ${group[0].declarationCount}宣言 / 重複度 ${duplicateWeight}`
      );
      for (const block of group.slice(0, 3)) {
        console.log(`     - ${formatRuleBlockRef(block)}`);
      }
      if (group.length > 3) {
        console.log(`     - ... and ${group.length - 3} more`);
      }
    }
  }

  console.log("\n高類似の宣言ブロックペア (Top 10)");
  if (copyPasteReport.nearPairs.length === 0) {
    console.log("  (なし)");
  } else {
    for (const [index, pair] of copyPasteReport.nearPairs.slice(0, 10).entries()) {
      const similarityPercent = Math.round(pair.overlapRatio * 100);
      const jaccardPercent = Math.round(pair.jaccard * 100);
      console.log(
        `  ${index + 1}. 類似度 ${similarityPercent}% (共通 ${pair.overlapCount}宣言, Jaccard ${jaccardPercent}%)`
      );
      console.log(`     - ${formatRuleBlockRef(pair.left)}`);
      console.log(`     - ${formatRuleBlockRef(pair.right)}`);
    }
  }
}

try {
  const lintResult = await stylelint.lint({
    cwd,
    files: targetPatterns,
    configFile
  });

  const fileResults = lintResult.results.filter((result) => !result.ignored);
  const findings = fileResults
    .flatMap((result) =>
      result.warnings.map((warning) => ({
        source: rel(result.source),
        line: warning.line ?? 0,
        column: warning.column ?? 0,
        rule: warning.rule ?? "unknown",
        severity: warning.severity ?? "error",
        text: warning.text
      }))
    )
    .sort(
      (a, b) =>
        a.source.localeCompare(b.source) ||
        a.line - b.line ||
        a.column - b.column ||
        a.rule.localeCompare(b.rule)
    );

  const byRule = new Map();
  const byFile = new Map();
  for (const finding of findings) {
    byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1);
    byFile.set(finding.source, (byFile.get(finding.source) ?? 0) + 1);
  }

  const sortedRuleCounts = [...byRule.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  const sortedFileCounts = [...byFile.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );

  const invalidOptions = fileResults.flatMap(
    (result) => result.invalidOptionWarnings ?? []
  );
  const deprecations = fileResults.flatMap((result) => result.deprecations ?? []);
  const copyPasteReport = detectCopyPasteCandidates(fileResults);

  console.log("CSS負債監査 (Stylelint smell audit)");
  console.log(`対象パターン: ${targetPatterns.join(", ")}`);
  console.log(`対象ファイル数: ${fileResults.length}`);
  console.log(`指摘件数: ${findings.length}`);

  if (invalidOptions.length > 0) {
    console.log(`設定警告: ${invalidOptions.length} 件`);
    for (const warning of invalidOptions.slice(0, 5)) {
      console.log(`  - ${warning.text}`);
    }
  }

  if (deprecations.length > 0) {
    console.log(`非推奨警告: ${deprecations.length} 件`);
    for (const warning of deprecations.slice(0, 5)) {
      console.log(`  - ${warning.text}`);
    }
  }

  printGroupedCounts("ルール別件数 (多い順)", sortedRuleCounts, 20);
  printGroupedCounts("ファイル別件数 (多い順)", sortedFileCounts, 20);
  printCopyPasteAudit(copyPasteReport);

  console.log("\n代表的な指摘 (先頭20件)");
  if (findings.length === 0) {
    console.log("  (指摘なし)");
  } else {
    for (const finding of findings.slice(0, 20)) {
      console.log(`  - ${formatFinding(finding)}`);
    }
  }

  if (findings.length > 0) {
    console.log(
      "\n注記: audit用途のため、既定では指摘があっても終了コードは 0 です。"
    );
    if (failOnFindings) {
      process.exitCode = 1;
      console.log("strict mode: --fail-on-findings により終了コード 1 を返します。");
    }
  }
} catch (error) {
  console.error("CSS監査の実行に失敗しました。");
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exitCode = 1;
}
