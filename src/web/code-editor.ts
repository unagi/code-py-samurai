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
    { tag: [tags.keyword, tags.controlKeyword], color: "#7ec7ff", fontWeight: "700" },
    { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#ffd58e" },
    { tag: [tags.variableName, tags.propertyName], color: "#d9e8f5" },
    { tag: [tags.number, tags.bool, tags.null], color: "#ffb88c" },
    { tag: [tags.string], color: "#b6f29a" },
    { tag: [tags.comment], color: "#7f96ac", fontStyle: "italic" },
    { tag: [tags.operator, tags.punctuation], color: "#b6c8d8" },
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
          color: "#dce8f3",
          backgroundColor: "#15191f",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "\"UDEV Gothic 35\", \"SFMono-Regular\", Consolas, monospace",
        },
        ".cm-content": {
          caretColor: "#9dd7ff",
        },
        "&.cm-focused .cm-cursor": {
          borderLeftColor: "#9dd7ff",
        },
        "&.cm-focused .cm-selectionBackground, ::selection": {
          backgroundColor: "#2b4561",
        },
        ".cm-activeLine": {
          backgroundColor: "#1b222b",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#1b222b",
          color: "#9bb2c8",
        },
        ".cm-gutters": {
          backgroundColor: "#15191f",
          color: "#7f93a8",
          border: "none",
        },
        ".cm-lineNumbers .cm-gutterElement": {
          color: "#7f93a8",
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
