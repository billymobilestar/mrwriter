import { jsPDF } from "jspdf";
import { classifyLines, type FountainElement } from "./fountain-decorations";

/*
  Industry-standard US screenplay PDF formatting:

  Page:      8.5" x 11"
  Font:      Courier 12pt (1 line = ~0.167")
  Margins:   1.5" left, 1" right, 1" top, 1" bottom
  Usable:    6" wide x 9" tall (~54 lines per page)

  Element widths (in inches from left margin):
    Scene Heading:  left-aligned, wraps at 6" width
    Action:         left-aligned, wraps at 6" width
    Character:      starts at 2.2" from left margin (3.7" from page edge)
    Dialogue:       starts at 1.0" from left margin, wraps at 3.5" width
    Parenthetical:  starts at 1.6" from left margin, wraps at 2" width
    Transition:     right-aligned to right margin
*/

const PAGE_WIDTH = 8.5;
const PAGE_HEIGHT = 11;
const MARGIN_LEFT = 1.5;
const MARGIN_RIGHT = 1.0;
const MARGIN_TOP = 1.0;
const MARGIN_BOTTOM = 1.0;

// Usable text area
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 6.0"
const CONTENT_HEIGHT = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM; // 9.0"

// Line height: Courier 12pt at 1.0 line spacing = 1/6 inch (12pt / 72pt per inch)
const LINE_HEIGHT = 12 / 72; // ≈ 0.167"
const LINES_PER_PAGE = Math.floor(CONTENT_HEIGHT / LINE_HEIGHT); // 54

// Element offsets (from left margin, in inches)
const CHARACTER_OFFSET = 2.2;
const DIALOGUE_OFFSET = 1.0;
const DIALOGUE_WIDTH = 3.5;
const PARENTHETICAL_OFFSET = 1.6;
const PARENTHETICAL_WIDTH = 2.0;

// Characters per inch at Courier 12pt: exactly 10
const CPI = 10;

interface TitlePage {
  title?: string;
  credit?: string;
  author?: string;
  source?: string;
  draftDate?: string;
  contact?: string;
}

interface RenderBlock {
  element: FountainElement;
  lines: string[]; // wrapped lines of text
  rawText: string; // original text before wrapping
  character?: string; // for dialogue/parenthetical blocks: the character speaking
}

/**
 * Wrap a string to a given width (in characters).
 */
function wrapText(text: string, widthInChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= widthInChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  if (lines.length === 0) lines.push("");
  return lines;
}

/**
 * Strip Fountain force markers from a line.
 */
function stripForceMarker(text: string, element: FountainElement): string {
  const trimmed = text.trim();
  if (element === "scene-heading" && trimmed.startsWith(".") && !trimmed.startsWith("..")) {
    return trimmed.slice(1);
  }
  if (element === "character" && trimmed.startsWith("@")) {
    return trimmed.slice(1);
  }
  if (element === "transition" && trimmed.startsWith(">") && !trimmed.endsWith("<")) {
    return trimmed.slice(1);
  }
  if (element === "action" && trimmed.startsWith("!")) {
    return trimmed.slice(1);
  }
  return trimmed;
}

/**
 * Extract title page fields from Fountain content.
 * Returns parsed title page and the rest of the content.
 */
function extractTitlePage(content: string): { titlePage: TitlePage; body: string } {
  const lines = content.split("\n");
  const titlePage: TitlePage = {};
  let pageBreakIdx = -1;

  // Find page break (=== or more)
  for (let i = 0; i < lines.length; i++) {
    if (/^={3,}\s*$/.test(lines[i])) {
      pageBreakIdx = i;
      break;
    }
    // If we hit a non-title line before a break, no title page
    const match = lines[i].match(/^(Title|Credit|Author|Source|Draft date|Date|Contact|Copyright|Notes|Revision):\s*(.*)$/i);
    if (!match && lines[i].trim().length > 0 && !/^\s+/.test(lines[i])) {
      return { titlePage: {}, body: content };
    }
  }

  if (pageBreakIdx === -1) return { titlePage: {}, body: content };

  // Parse title page lines
  for (let i = 0; i < pageBreakIdx; i++) {
    const line = lines[i];
    const match = line.match(/^(Title|Credit|Author|Source|Draft date|Date|Contact|Copyright):\s*(.*)$/i);
    if (match) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === "title") titlePage.title = value;
      else if (key === "credit") titlePage.credit = value;
      else if (key === "author") titlePage.author = value;
      else if (key === "source") titlePage.source = value;
      else if (key === "draft date" || key === "date") titlePage.draftDate = value;
      else if (key === "contact") titlePage.contact = value;
    }
  }

  const body = lines.slice(pageBreakIdx + 1).join("\n").replace(/^\n+/, "");
  return { titlePage, body };
}

/**
 * Convert classified Fountain lines into renderable blocks.
 * Groups consecutive dialogue/parenthetical under their character.
 */
function buildBlocks(content: string): RenderBlock[] {
  const rawLines = content.split("\n");
  const lineInfos = rawLines.map((text) => ({
    text,
    from: 0,
    isEmpty: text.trim().length === 0,
  }));
  const elements = classifyLines(lineInfos);

  const blocks: RenderBlock[] = [];
  let currentCharacter = "";

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i];
    const element = elements[i];

    if (lineInfos[i].isEmpty) {
      // Empty line = block separator
      if (blocks.length > 0 && blocks[blocks.length - 1].element !== "action") {
        // Add blank action to create spacing
        blocks.push({ element: "action", lines: [""], rawText: "" });
      } else if (blocks.length > 0 && blocks[blocks.length - 1].lines[blocks[blocks.length - 1].lines.length - 1] !== "") {
        blocks.push({ element: "action", lines: [""], rawText: "" });
      }
      continue;
    }

    const clean = stripForceMarker(text, element);

    if (element === "character") {
      // Remove any "(CONT'D)" suffix if present — we'll add it ourselves on page breaks
      const cleanChar = clean.replace(/\s*\(CONT['']D\)\s*$/i, "").trim();
      currentCharacter = cleanChar;
      blocks.push({
        element,
        lines: [cleanChar.toUpperCase()],
        rawText: cleanChar,
      });
    } else if (element === "dialogue") {
      blocks.push({
        element,
        lines: wrapText(clean, DIALOGUE_WIDTH * CPI),
        rawText: clean,
        character: currentCharacter,
      });
    } else if (element === "parenthetical") {
      blocks.push({
        element,
        lines: wrapText(clean, PARENTHETICAL_WIDTH * CPI),
        rawText: clean,
        character: currentCharacter,
      });
    } else if (element === "scene-heading") {
      currentCharacter = "";
      blocks.push({
        element,
        lines: wrapText(clean.toUpperCase(), CONTENT_WIDTH * CPI),
        rawText: clean,
      });
    } else if (element === "transition") {
      currentCharacter = "";
      blocks.push({
        element,
        lines: [clean.toUpperCase()],
        rawText: clean,
      });
    } else if (element === "centered") {
      currentCharacter = "";
      const centerText = clean.replace(/^>/, "").replace(/<$/, "").trim();
      blocks.push({
        element,
        lines: wrapText(centerText, CONTENT_WIDTH * CPI),
        rawText: centerText,
      });
    } else if (element === "action") {
      currentCharacter = "";
      blocks.push({
        element,
        lines: wrapText(clean, CONTENT_WIDTH * CPI),
        rawText: clean,
      });
    } else if (element === "section" || element === "synopsis" || element === "note") {
      // Skip these — they're for author notes, not the final PDF
    }
  }

  return blocks;
}

/**
 * Height of a block in number of lines (including extra spacing).
 */
function blockHeight(block: RenderBlock, prevElement?: FountainElement): number {
  const topSpacing =
    block.element === "scene-heading" && prevElement !== undefined
      ? 1 // blank line before scene heading
      : block.element === "character" && prevElement !== "action" && prevElement !== undefined
      ? 0
      : 0;
  return block.lines.length + topSpacing;
}

/**
 * Render the Fountain content to a PDF Blob.
 */
export async function fountainToPdf(
  content: string,
  title: string = "Untitled"
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: "letter",
  });

  doc.setFont("courier", "normal");
  doc.setFontSize(12);

  const { titlePage, body } = extractTitlePage(content);
  const blocks = buildBlocks(body);

  let pageNumber = 1;
  let currentY = MARGIN_TOP;

  // ── Title Page ──
  const hasTitlePage =
    titlePage.title || titlePage.credit || titlePage.author || titlePage.source;

  if (hasTitlePage) {
    const centerX = PAGE_WIDTH / 2;

    // Title — roughly 1/3 down, larger font
    if (titlePage.title) {
      const titleY = 4.0;
      doc.setFontSize(14);
      const titleLines = doc.splitTextToSize(titlePage.title.toUpperCase(), 5);
      let y = titleY;
      for (const line of titleLines) {
        doc.text(line, centerX, y, { align: "center" });
        y += 0.25;
      }
      doc.setFontSize(12);
    }

    // Credit
    if (titlePage.credit) {
      doc.text(titlePage.credit, centerX, 4.9, { align: "center" });
    }

    // Author
    if (titlePage.author) {
      doc.text(titlePage.author, centerX, 5.2, { align: "center" });
    }

    // Source
    if (titlePage.source) {
      doc.text(titlePage.source, centerX, 5.6, { align: "center" });
    }

    // Draft date and contact — bottom
    if (titlePage.draftDate) {
      doc.text(titlePage.draftDate, MARGIN_LEFT, 10);
    }
    if (titlePage.contact) {
      const contactLines = titlePage.contact.split(/[,;]/).map((s) => s.trim());
      let y = 10;
      for (const line of contactLines) {
        doc.text(line, PAGE_WIDTH - MARGIN_RIGHT, y, { align: "right" });
        y += 0.2;
      }
    }

    doc.addPage();
    pageNumber = 2;
    currentY = MARGIN_TOP;
  }

  // Helper: check if we need a new page
  function checkPageBreak(linesNeeded: number): boolean {
    const remainingLines = Math.floor((PAGE_HEIGHT - MARGIN_BOTTOM - currentY) / LINE_HEIGHT);
    return linesNeeded > remainingLines;
  }

  function addPageIfNeeded(linesNeeded: number): boolean {
    if (checkPageBreak(linesNeeded)) {
      addPageHeader();
      return true;
    }
    return false;
  }

  function addPageHeader() {
    doc.addPage();
    pageNumber++;
    currentY = MARGIN_TOP;
    // Page number in top-right corner
    doc.text(`${pageNumber}.`, PAGE_WIDTH - MARGIN_RIGHT, 0.5, { align: "right" });
    currentY = MARGIN_TOP;
  }

  // Add page number to first body page (if no title page, page 1 has no number shown typically)
  if (hasTitlePage) {
    doc.text(`${pageNumber}.`, PAGE_WIDTH - MARGIN_RIGHT, 0.5, { align: "right" });
  }

  // ── Render blocks ──
  let prevElement: FountainElement | undefined = undefined;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Skip blank action blocks at the very start
    if (block.lines.length === 1 && block.lines[0] === "" && prevElement === undefined) {
      continue;
    }

    // Top spacing — blank line before scene heading (unless top of page)
    if (block.element === "scene-heading" && prevElement !== undefined) {
      if (currentY + LINE_HEIGHT <= PAGE_HEIGHT - MARGIN_BOTTOM) {
        currentY += LINE_HEIGHT;
      }
    }

    const totalLines = block.lines.length;

    // Keep scene heading with at least 2 following lines of content
    if (block.element === "scene-heading") {
      const nextBlock = blocks[i + 1];
      const followLines = nextBlock ? Math.min(2, nextBlock.lines.length) : 0;
      if (checkPageBreak(totalLines + followLines)) {
        addPageHeader();
      }
    }
    // Keep character with at least 1 dialogue line
    else if (block.element === "character") {
      const nextBlock = blocks[i + 1];
      const followLines = nextBlock && (nextBlock.element === "dialogue" || nextBlock.element === "parenthetical") ? 1 : 0;
      if (checkPageBreak(totalLines + followLines)) {
        addPageHeader();
      }
    }
    // Dialogue — handle split with (MORE) / (CONT'D)
    else if (block.element === "dialogue" && block.character) {
      const remainingLines = Math.floor((PAGE_HEIGHT - MARGIN_BOTTOM - currentY) / LINE_HEIGHT);

      if (totalLines > remainingLines && remainingLines >= 2) {
        // Split dialogue — fit some on this page, then (MORE), then continue on next page
        const linesToFitHere = Math.max(1, remainingLines - 1); // leave room for (MORE)
        const firstChunk = block.lines.slice(0, linesToFitHere);
        const secondChunk = block.lines.slice(linesToFitHere);

        // Render first chunk
        for (const line of firstChunk) {
          doc.text(line, MARGIN_LEFT + DIALOGUE_OFFSET, currentY + LINE_HEIGHT);
          currentY += LINE_HEIGHT;
        }
        // (MORE) — at the same position as character name
        doc.text("(MORE)", MARGIN_LEFT + CHARACTER_OFFSET, currentY + LINE_HEIGHT);
        currentY += LINE_HEIGHT;

        // New page, new CHARACTER (CONT'D)
        addPageHeader();
        doc.text(`${block.character.toUpperCase()} (CONT'D)`, MARGIN_LEFT + CHARACTER_OFFSET, currentY + LINE_HEIGHT);
        currentY += LINE_HEIGHT;

        // Render rest
        for (const line of secondChunk) {
          doc.text(line, MARGIN_LEFT + DIALOGUE_OFFSET, currentY + LINE_HEIGHT);
          currentY += LINE_HEIGHT;
        }
        prevElement = block.element;
        continue;
      } else {
        addPageIfNeeded(totalLines);
      }
    } else {
      // Action, transition, etc. — split at page boundary if needed
      if (checkPageBreak(totalLines)) {
        const remainingLines = Math.floor((PAGE_HEIGHT - MARGIN_BOTTOM - currentY) / LINE_HEIGHT);
        if (remainingLines >= 2 && block.element === "action") {
          // Split action paragraph
          const firstChunk = block.lines.slice(0, remainingLines);
          const secondChunk = block.lines.slice(remainingLines);
          for (const line of firstChunk) {
            doc.text(line, MARGIN_LEFT, currentY + LINE_HEIGHT);
            currentY += LINE_HEIGHT;
          }
          addPageHeader();
          for (const line of secondChunk) {
            doc.text(line, MARGIN_LEFT, currentY + LINE_HEIGHT);
            currentY += LINE_HEIGHT;
          }
          prevElement = block.element;
          continue;
        } else {
          addPageHeader();
        }
      }
    }

    // Render lines at appropriate position
    for (const line of block.lines) {
      currentY += LINE_HEIGHT;
      switch (block.element) {
        case "scene-heading":
          doc.text(line, MARGIN_LEFT, currentY);
          break;
        case "action":
          doc.text(line, MARGIN_LEFT, currentY);
          break;
        case "character":
          doc.text(line, MARGIN_LEFT + CHARACTER_OFFSET, currentY);
          break;
        case "dialogue":
          doc.text(line, MARGIN_LEFT + DIALOGUE_OFFSET, currentY);
          break;
        case "parenthetical": {
          let text = line;
          if (!text.startsWith("(")) text = "(" + text;
          if (!text.endsWith(")")) text = text + ")";
          doc.text(text, MARGIN_LEFT + PARENTHETICAL_OFFSET, currentY);
          break;
        }
        case "transition":
          doc.text(line, PAGE_WIDTH - MARGIN_RIGHT, currentY, { align: "right" });
          break;
        case "centered":
          doc.text(line, PAGE_WIDTH / 2, currentY, { align: "center" });
          break;
        default:
          doc.text(line, MARGIN_LEFT, currentY);
      }
    }

    prevElement = block.element;
  }

  return doc.output("blob");
}

/**
 * Download the PDF directly from a Fountain string.
 */
export async function downloadFountainAsPdf(
  content: string,
  title: string = "Screenplay"
): Promise<void> {
  const blob = await fountainToPdf(content, title);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
