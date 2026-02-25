/**
 * Parse-only Python syntax checker using Skulpt's Sk.parse().
 * Does NOT execute the code — only validates syntax.
 */

export interface PythonSyntaxDiagnostic {
  /** 0-based character offset in the source string. */
  from: number;
  /** 0-based end character offset (end of the offending line if column is unknown). */
  to: number;
  /** Human-readable error description. */
  message: string;
  /** 1-based line number (from Skulpt). */
  line: number;
}

/**
 * Convert a 1-based line (and optional 0-based column) to a 0-based
 * character offset within `source`.
 */
function lineColToOffset(source: string, line: number, col?: number): number {
  let offset = 0;
  let currentLine = 1;
  while (currentLine < line && offset < source.length) {
    if (source[offset] === "\n") currentLine++;
    offset++;
  }
  if (col !== undefined && col > 0) {
    offset += col;
  }
  return Math.min(offset, source.length);
}

/** Return the 0-based offset of the end of the given 1-based line. */
function lineEndOffset(source: string, line: number): number {
  let offset = 0;
  let currentLine = 1;
  while (currentLine < line && offset < source.length) {
    if (source[offset] === "\n") currentLine++;
    offset++;
  }
  // Now `offset` points to the start of `line`. Find its end.
  while (offset < source.length && source[offset] !== "\n") {
    offset++;
  }
  return offset;
}

let parseReady = false;

/** @internal Reset configuration state. For testing only. */
export function _resetParseReady(): void {
  parseReady = false;
}

/** Ensure Skulpt has the minimal config required for Sk.parse(). */
function ensureParseReady(): boolean {
  if (parseReady) return true;
  try {
    // Sk.configure merges settings, so this is safe even if
    // compilePythonPlayer has already fully configured Skulpt.
    globalThis.Sk.configure({ __future__: globalThis.Sk.python3 });
    parseReady = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Check Python source for syntax errors using `Sk.parse()`.
 *
 * Returns `null` when the source is syntactically valid (or when Skulpt
 * is not yet loaded / not yet ready — graceful degradation).
 */
export function checkPythonSyntax(source: string): PythonSyntaxDiagnostic | null {
  if (source.trim().length === 0) return null;
  if (typeof globalThis.Sk === "undefined") return null;
  if (!ensureParseReady()) return null;

  try {
    globalThis.Sk.parse("<lint>", source);
    return null;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      args?: { v?: Array<{ v?: string }> };
      traceback?: Array<{ lineno?: number; colno?: number }>;
    };

    const message =
      err?.args?.v?.[0]?.v ?? err?.message ?? String(error);
    const tb = err?.traceback?.[0];
    const line = tb?.lineno ?? 1;
    const col = tb?.colno;

    const rawFrom = lineColToOffset(source, line, col);
    const rawTo = col !== undefined ? rawFrom + 1 : lineEndOffset(source, line);

    const clampedFrom = Math.min(rawFrom, source.length);
    // Ensure at least 1-char range so CodeMirror renders an underline (not a widget).
    const clampedTo = Math.min(Math.max(rawTo, clampedFrom + 1), source.length);

    return {
      from: clampedFrom,
      to: Math.max(clampedTo, clampedFrom),
      message,
      line,
    };
  }
}
