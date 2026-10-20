// The tiny YAML frontmatter subset result.md uses. We deliberately do not
// take a YAML dependency for four scalar keys.

import type { ResultMeta } from "./types.js";

export interface ParsedResultMarkdown {
  meta: ResultMeta;
  body: string;
}

/** Parse `--- status/summary/tests/files ---` frontmatter and the body. */
export function parseResultMarkdown(text: string): ParsedResultMarkdown {
  const source = String(text ?? "");
  if (!source.startsWith("---")) return { meta: {}, body: source.trim() };

  const end = source.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: source.trim() };

  const head = source.slice(3, end);
  const body = source.slice(end + 4).trim();
  const meta: ResultMeta = {};
  for (const line of head.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line.trim());
    if (!match) continue;
    const key = match[1] as keyof ResultMeta;
    if (key === "status" || key === "summary" || key === "tests" || key === "files") {
      meta[key] = (match[2] ?? "").replace(/^["']|["']$/g, "").trim();
    }
  }
  return { meta, body };
}

/** A one-line summary from arbitrary result text. */
export function firstLine(text: string | undefined, max = 160): string {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.length > 0 && !value.startsWith("---"));
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
