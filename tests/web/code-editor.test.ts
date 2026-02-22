import { describe, expect, it, vi } from "vitest";

const cmMock = vi.hoisted(() => ({
  lastConfig: null as { doc: string; parent: unknown; extensions: unknown[] } | null,
}));

vi.mock("codemirror", () => {
  class FakeEditorView {
    static theme(theme: unknown): unknown {
      return { kind: "theme", theme };
    }

    static updateListener = {
      of(fn: (update: { docChanged: boolean; state: { doc: { toString(): string } } }) => void): unknown {
        return { kind: "updateListener", fn };
      },
    };

    config: { doc: string; parent: unknown; extensions: unknown[] };

    constructor(config: { doc: string; parent: unknown; extensions: unknown[] }) {
      this.config = config;
      cmMock.lastConfig = config;
    }
  }

  return {
    basicSetup: { kind: "basicSetup" },
    EditorView: FakeEditorView,
  };
});

vi.mock("@codemirror/commands", () => ({
  indentWithTab: { kind: "indentWithTab" },
}));

vi.mock("@codemirror/lang-python", () => ({
  python: () => ({ kind: "python" }),
}));

vi.mock("@codemirror/state", () => ({
  EditorState: {
    tabSize: {
      of: (value: number) => ({ kind: "tabSize", value }),
    },
  },
}));

vi.mock("@codemirror/language", () => ({
  HighlightStyle: {
    define: (rules: unknown[]) => ({ kind: "highlightStyle", rules }),
  },
  indentUnit: {
    of: (value: string) => ({ kind: "indentUnit", value }),
  },
  syntaxHighlighting: (style: unknown) => ({ kind: "syntaxHighlighting", style }),
}));

vi.mock("@codemirror/view", () => ({
  keymap: {
    of: (items: unknown[]) => ({ kind: "keymap", items }),
  },
}));

vi.mock("@lezer/highlight", () => ({
  tags: {
    keyword: "keyword",
    controlKeyword: "controlKeyword",
    function: (tag: string) => `function(${tag})`,
    variableName: "variableName",
    propertyName: "propertyName",
    number: "number",
    bool: "bool",
    null: "null",
    string: "string",
    comment: "comment",
    operator: "operator",
    punctuation: "punctuation",
  },
}));

import { createCodeEditor } from "../../src/web/code-editor";

describe("createCodeEditor", () => {
  it("creates an EditorView and wires the update listener to onChange", () => {
    const onChange = vi.fn();
    const parent = {} as HTMLElement;

    const view = createCodeEditor(parent, "print('hi')", onChange) as unknown as {
      config?: { doc: string; parent: unknown; extensions: unknown[] };
    };

    expect(view).toBeTruthy();
    expect(cmMock.lastConfig?.doc).toBe("print('hi')");
    expect(cmMock.lastConfig?.parent).toBe(parent);
    expect(cmMock.lastConfig?.extensions.length).toBeGreaterThan(0);

    const updateExt = cmMock.lastConfig?.extensions.find((ext) => {
      return typeof ext === "object" && ext !== null && "kind" in (ext as Record<string, unknown>)
        && (ext as { kind?: string }).kind === "updateListener";
    }) as { fn: (update: { docChanged: boolean; state: { doc: { toString(): string } } }) => void } | undefined;

    expect(updateExt).toBeDefined();

    updateExt?.fn({
      docChanged: false,
      state: { doc: { toString: () => "ignored" } },
    });
    expect(onChange).not.toHaveBeenCalled();

    updateExt?.fn({
      docChanged: true,
      state: { doc: { toString: () => "print('changed')" } },
    });
    expect(onChange).toHaveBeenCalledWith("print('changed')");
  });
});
