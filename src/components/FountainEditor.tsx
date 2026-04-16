"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import {
  fountainDecorationPlugin,
  getLineElement,
  forceElement,
  type FountainElement,
} from "@/lib/fountain-decorations";

export interface FountainEditorHandle {
  setContent: (content: string) => void;
  getContent: () => string;
  getSelectedText: () => string;
  hasSelection: () => boolean;
  replaceSelection: (text: string) => void;
}

interface FountainEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  onSelectionChange?: (hasSelection: boolean, selectedText: string) => void;
}

const TOOLBAR_ELEMENTS: { key: FountainElement; label: string }[] = [
  { key: "scene-heading", label: "Scene" },
  { key: "action", label: "Action" },
  { key: "character", label: "Character" },
  { key: "dialogue", label: "Dialogue" },
  { key: "parenthetical", label: "Paren" },
  { key: "transition", label: "Transition" },
];

const FountainEditor = forwardRef<FountainEditorHandle, FountainEditorProps>(
  function FountainEditor({ initialContent = "", onChange, onSelectionChange }, ref) {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const onSelectionChangeRef = useRef(onSelectionChange);
    onChangeRef.current = onChange;
    onSelectionChangeRef.current = onSelectionChange;

    const [currentElement, setCurrentElement] = useState<FountainElement>("action");
    const [currentLine, setCurrentLine] = useState(1);

    useImperativeHandle(ref, () => ({
      setContent(content: string) {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } });
      },
      getContent() { return viewRef.current?.state.doc.toString() || ""; },
      getSelectedText() {
        const view = viewRef.current;
        if (!view) return "";
        const { from, to } = view.state.selection.main;
        return from === to ? "" : view.state.sliceDoc(from, to);
      },
      hasSelection() {
        const view = viewRef.current;
        if (!view) return false;
        const { from, to } = view.state.selection.main;
        return from !== to;
      },
      replaceSelection(text: string) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: from === to
            ? { from: 0, to: view.state.doc.length, insert: text }
            : { from, to, insert: text },
        });
      },
    }));

    const handleSetElement = useCallback(
      (element: FountainElement) => {
        const view = viewRef.current;
        if (!view) return;
        forceElement(view, currentLine, element);
        setCurrentElement(element);
        view.focus();
      },
      [currentLine]
    );

    useEffect(() => {
      if (!editorRef.current) return;
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current)
          onChangeRef.current(update.state.doc.toString());
        if (update.selectionSet || update.docChanged) {
          const sel = update.state.selection.main;
          const line = update.state.doc.lineAt(sel.head);
          setCurrentLine(line.number);
          setCurrentElement(getLineElement(update.view, line.number));
          if (onSelectionChangeRef.current) {
            const has = sel.from !== sel.to;
            onSelectionChangeRef.current(has, has ? update.state.sliceDoc(sel.from, sel.to) : "");
          }
        }
      });

      const state = EditorState.create({
        doc: initialContent,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          fountainDecorationPlugin,
          updateListener,
          placeholder("Start writing your screenplay...\n\nINT. LOCATION - DAY\n\nAction description here.\n\nCHARACTER NAME\nDialogue goes here."),
          EditorView.lineWrapping,
          EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto" } }),
        ],
      });

      const view = new EditorView({ state, parent: editorRef.current });
      viewRef.current = view;
      return () => { view.destroy(); viewRef.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="screenplay-page flex flex-col overflow-hidden">
        {/* Element toolbar — sits on the off-white page */}
        <div
          className="shrink-0 flex items-center gap-1 px-5 py-2.5"
          style={{ borderBottom: "1px solid #e0d8c8", background: "#ece6d8" }}
        >
          <span
            className="text-xs font-mono tabular-nums mr-2 px-2 py-1 rounded-md"
            style={{ color: "#8a7e6c", background: "#e0d8c6" }}
          >
            {currentLine}
          </span>
          <div className="w-px h-5 mr-1" style={{ background: "#d5ccba" }} />
          {TOOLBAR_ELEMENTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSetElement(key)}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg transition-all"
              style={
                currentElement === key
                  ? { background: "#3a3428", color: "#f5f0e6", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }
                  : { background: "transparent", color: "#7a6e58" }
              }
              onMouseEnter={(e) => {
                if (currentElement !== key) {
                  e.currentTarget.style.background = "#e0d8c6";
                  e.currentTarget.style.color = "#3a3428";
                }
              }}
              onMouseLeave={(e) => {
                if (currentElement !== key) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#7a6e58";
                }
              }}
            >
              {label}
            </button>
          ))}
          {currentElement !== "action" &&
            !TOOLBAR_ELEMENTS.some((e) => e.key === currentElement) && (
              <span
                className="px-3 py-1.5 text-[13px] rounded-lg"
                style={{ color: "#8a7e6c", background: "#e0d8c6" }}
              >
                {currentElement}
              </span>
            )}
        </div>

        <div ref={editorRef} className="flex-1 overflow-auto" />
      </div>
    );
  }
);

export default FountainEditor;
