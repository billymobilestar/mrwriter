import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  EditorView,
  ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

export type FountainElement =
  | "scene-heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "centered"
  | "section"
  | "synopsis"
  | "note"
  | "page-break"
  | "lyric"
  | "title-key"
  | "title-value";

// ── Decoration classes ──

const decorationClasses: Record<FountainElement, string> = {
  "scene-heading": "cm-fountain-scene-heading",
  action: "cm-fountain-action",
  character: "cm-fountain-character",
  dialogue: "cm-fountain-dialogue",
  parenthetical: "cm-fountain-parenthetical",
  transition: "cm-fountain-transition",
  centered: "cm-fountain-centered",
  section: "cm-fountain-section",
  synopsis: "cm-fountain-synopsis",
  note: "cm-fountain-note",
  "page-break": "cm-fountain-page-break",
  lyric: "cm-fountain-lyric",
  "title-key": "cm-fountain-title-key",
  "title-value": "cm-fountain-title-value",
};

const decoCache: Record<string, Decoration> = {};
function getLineDeco(element: FountainElement): Decoration {
  if (!decoCache[element]) {
    decoCache[element] = Decoration.line({
      class: decorationClasses[element],
    });
  }
  return decoCache[element];
}

// ── Auto-detection regexes ──

const SCENE_HEADING_RE = /^(INT\.|EXT\.|EST\.|INT\.\/EXT\.|I\/E\.)[\s.]/i;
const FORCED_SCENE_RE = /^\.[^.]/;
const TRANSITION_RE = /^[A-Z\s]+TO:$/;
const FORCED_TRANSITION_RE = /^>/;
const CENTERED_RE = /^>.*<$/;
const CHARACTER_FORCED_RE = /^@/;
const FORCED_ACTION_RE = /^!/;
const SECTION_RE = /^#{1,6}\s/;
const SYNOPSIS_RE = /^=(?!=)/;
const PAGE_BREAK_RE = /^={3,}$/;
const LYRIC_RE = /^~/;
const NOTE_RE = /^\[\[/;
const TITLE_KEY_RE =
  /^(Title|Credit|Author|Source|Draft date|Date|Contact|Copyright|Notes|Revision):\s*/i;

function isUpperCase(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

interface LineInfo {
  text: string;
  from: number;
  isEmpty: boolean;
}

export function classifyLines(lines: LineInfo[]): FountainElement[] {
  const elements: FountainElement[] = new Array(lines.length);
  let inTitlePage = true;
  let inDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text;
    const trimmed = text.trim();
    const prevEmpty = i === 0 || lines[i - 1].isEmpty;

    if (line.isEmpty) {
      inDialogue = false;
      elements[i] = "action";
      continue;
    }

    // Title page
    if (inTitlePage) {
      if (PAGE_BREAK_RE.test(trimmed)) {
        inTitlePage = false;
        elements[i] = "page-break";
        continue;
      }
      if (TITLE_KEY_RE.test(text)) {
        elements[i] = "title-key";
        continue;
      }
      if (i > 0 && elements[i - 1] === "title-key" && /^\s+/.test(text)) {
        elements[i] = "title-value";
        continue;
      }
      inTitlePage = false;
    }

    // Forced action (! prefix) — check early, overrides everything
    if (FORCED_ACTION_RE.test(trimmed)) {
      elements[i] = "action";
      inDialogue = false;
      continue;
    }

    if (PAGE_BREAK_RE.test(trimmed)) {
      elements[i] = "page-break";
      inDialogue = false;
      continue;
    }

    if (SECTION_RE.test(text)) {
      elements[i] = "section";
      inDialogue = false;
      continue;
    }

    if (SYNOPSIS_RE.test(text)) {
      elements[i] = "synopsis";
      inDialogue = false;
      continue;
    }

    if (NOTE_RE.test(text)) {
      elements[i] = "note";
      continue;
    }

    if (LYRIC_RE.test(text)) {
      elements[i] = "lyric";
      continue;
    }

    if (CENTERED_RE.test(trimmed)) {
      elements[i] = "centered";
      inDialogue = false;
      continue;
    }

    // Forced scene heading (. prefix)
    if (FORCED_SCENE_RE.test(trimmed)) {
      elements[i] = "scene-heading";
      inDialogue = false;
      continue;
    }

    // Natural scene heading
    if (SCENE_HEADING_RE.test(trimmed)) {
      elements[i] = "scene-heading";
      inDialogue = false;
      continue;
    }

    // Forced transition (> prefix, not centered)
    if (FORCED_TRANSITION_RE.test(trimmed) && !CENTERED_RE.test(trimmed)) {
      elements[i] = "transition";
      inDialogue = false;
      continue;
    }

    // Natural transition
    if (prevEmpty && TRANSITION_RE.test(trimmed)) {
      elements[i] = "transition";
      inDialogue = false;
      continue;
    }

    // Parenthetical within dialogue
    if (inDialogue && /^\(.*\)$/.test(trimmed)) {
      elements[i] = "parenthetical";
      continue;
    }

    // Dialogue continuation
    if (inDialogue) {
      elements[i] = "dialogue";
      continue;
    }

    // Forced character (@ prefix)
    if (CHARACTER_FORCED_RE.test(trimmed)) {
      elements[i] = "character";
      inDialogue = true;
      continue;
    }

    // Natural character detection
    if (
      prevEmpty &&
      isUpperCase(trimmed) &&
      trimmed.length > 0 &&
      !trimmed.endsWith(".")
    ) {
      if (!TRANSITION_RE.test(trimmed) && !SCENE_HEADING_RE.test(trimmed)) {
        elements[i] = "character";
        inDialogue = true;
        continue;
      }
    }

    elements[i] = "action";
    inDialogue = false;
  }

  return elements;
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  const lines: LineInfo[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    lines.push({
      text: line.text,
      from: line.from,
      isEmpty: line.text.trim().length === 0,
    });
  }

  const elements = classifyLines(lines);

  for (let i = 0; i < lines.length; i++) {
    const element = elements[i];
    if (element && element !== "action" && !lines[i].isEmpty) {
      builder.add(lines[i].from, lines[i].from, getLineDeco(element));
    }
  }

  return builder.finish();
}

export const fountainDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Get the current element type for a given line number.
 */
export function getLineElement(view: EditorView, lineNum: number): FountainElement {
  const doc = view.state.doc;

  const lines: LineInfo[] = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    lines.push({
      text: line.text,
      from: line.from,
      isEmpty: line.text.trim().length === 0,
    });
  }

  const elements = classifyLines(lines);
  return elements[lineNum - 1] || "action";
}

/**
 * Force a line to be a specific element type by modifying the text
 * with Fountain force markers. This persists with the document.
 *
 * Force markers in Fountain:
 *   @ = force character
 *   . = force scene heading
 *   > = force transition
 *   ! = force action
 *
 * For dialogue/parenthetical, we ensure the line is preceded by a
 * character element (forced with @ if needed).
 */
export function forceElement(
  view: EditorView,
  lineNum: number,
  element: FountainElement
): void {
  const doc = view.state.doc;
  if (lineNum < 1 || lineNum > doc.lines) return;

  const line = doc.line(lineNum);
  const text = line.text;

  // Strip any existing force marker from the line
  const stripped = text.replace(/^[.@!>]/, "");
  const trimmedStripped = stripped.trimStart();

  let newText: string;
  const changes: { from: number; to: number; insert: string }[] = [];

  switch (element) {
    case "scene-heading":
      // Add . prefix if not already a natural scene heading
      if (SCENE_HEADING_RE.test(trimmedStripped)) {
        newText = trimmedStripped;
      } else {
        newText = "." + trimmedStripped;
      }
      break;

    case "character":
      // Add @ prefix
      newText = "@" + trimmedStripped;
      break;

    case "transition":
      // Add > prefix
      newText = ">" + trimmedStripped;
      break;

    case "action":
      // Add ! prefix to force action
      newText = "!" + trimmedStripped;
      break;

    case "dialogue":
      // For dialogue, we need a character line above.
      // If the previous non-empty line isn't a character, force it.
      // Then remove any force marker from this line so it falls through as dialogue.
      newText = stripped;
      // Ensure previous line context makes this dialogue
      if (lineNum > 1) {
        const prevLine = doc.line(lineNum - 1);
        const prevTrimmed = prevLine.text.trim();
        // If prev line is empty, we need to make the line before that a character
        // Actually, simplest: just ensure this line has a character above it
        if (prevTrimmed.length > 0) {
          const prevElement = getLineElement(view, lineNum - 1);
          if (prevElement !== "character" && prevElement !== "dialogue" && prevElement !== "parenthetical") {
            // Force previous line to be character
            const prevStripped = prevLine.text.replace(/^[.@!>]/, "");
            changes.push({
              from: prevLine.from,
              to: prevLine.to,
              insert: "@" + prevStripped.trimStart(),
            });
          }
        }
      }
      break;

    case "parenthetical":
      // Wrap in parens if not already
      newText = stripped;
      if (!trimmedStripped.startsWith("(")) {
        newText = "(" + trimmedStripped;
      }
      if (!trimmedStripped.endsWith(")")) {
        newText = newText + ")";
      }
      // Ensure we're in dialogue context (same logic as dialogue)
      if (lineNum > 1) {
        const prevLine = doc.line(lineNum - 1);
        const prevTrimmed = prevLine.text.trim();
        if (prevTrimmed.length > 0) {
          const prevElement = getLineElement(view, lineNum - 1);
          if (prevElement !== "character" && prevElement !== "dialogue" && prevElement !== "parenthetical") {
            const prevStripped = prevLine.text.replace(/^[.@!>]/, "");
            changes.push({
              from: prevLine.from,
              to: prevLine.to,
              insert: "@" + prevStripped.trimStart(),
            });
          }
        }
      }
      break;

    default:
      // For other types, just strip force markers
      newText = stripped;
      break;
  }

  // Replace the current line
  changes.push({ from: line.from, to: line.to, insert: newText });

  // Sort changes by position (descending) to apply safely
  changes.sort((a, b) => b.from - a.from);

  view.dispatch({ changes });
}
