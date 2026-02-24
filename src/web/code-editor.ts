import { basicSetup, EditorView } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export function createCodeEditor(
  parent: HTMLElement,
  initialCode: string,
  onChange: (code: string) => void,
): EditorView {
  const readableHighlight = HighlightStyle.define([
    { tag: [tags.keyword, tags.controlKeyword], color: "var(--syntax-keyword)", fontWeight: "700" },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--syntax-function)" },
    { tag: [tags.variableName, tags.propertyName], color: "var(--syntax-variable)" },
    { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
    { tag: [tags.string], color: "var(--syntax-string)" },
    { tag: [tags.comment], color: "var(--syntax-comment)", fontStyle: "italic" },
    { tag: [tags.operator, tags.punctuation], color: "var(--syntax-punctuation)" },
  ]);

  return new EditorView({
    doc: initialCode,
    parent,
    extensions: [
      basicSetup,
      keymap.of([indentWithTab]),
      EditorState.tabSize.of(4),
      indentUnit.of("    "),
      python(),
      syntaxHighlighting(readableHighlight),
      EditorView.theme({
        "&": {
          minHeight: "220px",
          fontSize: "14px",
          color: "var(--cm-editor-fg)",
          backgroundColor: "var(--cm-editor-bg)",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "\"UDEV Gothic 35\", \"SFMono-Regular\", Consolas, monospace",
        },
        ".cm-content": {
          caretColor: "var(--cm-caret)",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "var(--cm-caret)",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: "var(--cm-selection-bg)",
        },
        ".cm-activeLine": {
          backgroundColor: "var(--cm-active-line-bg)",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "var(--cm-active-line-bg)",
          color: "var(--cm-gutter-active-fg)",
        },
        ".cm-gutters": {
          backgroundColor: "var(--cm-gutter-bg)",
          color: "var(--cm-gutter-fg)",
          border: "none",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          color: "var(--cm-gutter-fg)",
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString());
        }
      }),
    ],
  });
}
