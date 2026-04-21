import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  AlignmentType,
} from "docx";
import type { RedditLink } from "./db";

/**
 * Export reddit links as an Excel (.xlsx) file.
 * Each row: Title, Subreddit, Author, Score, Comments, URL, Notes, Saved Date.
 */
export function exportLinksToExcel(links: RedditLink[], filename: string = "reddit_links.xlsx") {
  const rows = links.map((link) => ({
    Title: link.title,
    Subreddit: link.subreddit || "",
    Author: link.author || "",
    Score: link.score,
    Comments: link.num_comments,
    URL: link.url,
    Notes: link.notes || "",
    "Saved Date": new Date(link.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 50 }, // Title
    { wch: 18 }, // Subreddit
    { wch: 18 }, // Author
    { wch: 8 }, // Score
    { wch: 10 }, // Comments
    { wch: 60 }, // URL
    { wch: 30 }, // Notes
    { wch: 14 }, // Date
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reddit Links");

  XLSX.writeFile(workbook, filename);
}

/**
 * Export reddit links as a Word (.docx) file.
 * Each link becomes a titled entry with clickable URL and metadata.
 */
export async function exportLinksToWord(
  links: RedditLink[],
  filename: string = "reddit_links.docx"
) {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: "Reddit Links Library",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${links.length} saved link${links.length !== 1 ? "s" : ""} — exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          italics: true,
          size: 20,
          color: "888888",
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: "" })); // spacer

  links.forEach((link, idx) => {
    // Title as heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: `${idx + 1}. ${link.title}`,
            bold: true,
            size: 26,
          }),
        ],
      })
    );

    // Metadata line
    const metaParts: string[] = [];
    if (link.subreddit) metaParts.push(`r/${link.subreddit}`);
    if (link.author) metaParts.push(`by u/${link.author}`);
    metaParts.push(`${link.score} pts`);
    metaParts.push(`${link.num_comments} comments`);

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: metaParts.join(" · "),
            italics: true,
            color: "666666",
            size: 20,
          }),
        ],
      })
    );

    // Notes (if present)
    if (link.notes && link.notes.trim()) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: link.notes,
              size: 22,
            }),
          ],
        })
      );
    }

    // Clickable link
    children.push(
      new Paragraph({
        children: [
          new ExternalHyperlink({
            link: link.url,
            children: [
              new TextRun({
                text: link.url,
                style: "Hyperlink",
                color: "2563eb",
                underline: {},
                size: 20,
              }),
            ],
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Saved ${new Date(link.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}`,
            color: "999999",
            italics: true,
            size: 18,
          }),
        ],
      })
    );

    children.push(new Paragraph({ text: "" })); // spacer between entries
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export reddit links as a plain CSV file.
 */
export function exportLinksToCsv(links: RedditLink[], filename: string = "reddit_links.csv") {
  const headers = ["Title", "Subreddit", "Author", "Score", "Comments", "URL", "Notes", "Saved Date"];
  const escape = (s: string | number | null) => {
    if (s === null || s === undefined) return "";
    const str = String(s);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const rows = [
    headers.join(","),
    ...links.map((link) =>
      [
        escape(link.title),
        escape(link.subreddit),
        escape(link.author),
        escape(link.score),
        escape(link.num_comments),
        escape(link.url),
        escape(link.notes),
        escape(new Date(link.created_at).toLocaleDateString("en-US")),
      ].join(",")
    ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
