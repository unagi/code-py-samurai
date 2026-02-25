import { linter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";

import { checkPythonSyntax } from "../runtime/python-syntax-checker";

/**
 * CodeMirror extension that runs Skulpt's `Sk.parse()` on every
 * document change (debounced) and surfaces syntax errors as inline
 * diagnostics with red underlines and gutter markers.
 */
export function pythonLintExtension(delay = 500): Extension {
  return linter(
    (view) => {
      const source = view.state.doc.toString();
      const result = checkPythonSyntax(source);
      if (!result) return [];

      const diagnostic: Diagnostic = {
        from: result.from,
        to: result.to,
        severity: "error",
        message: result.message,
      };
      return [diagnostic];
    },
    { delay },
  );
}
