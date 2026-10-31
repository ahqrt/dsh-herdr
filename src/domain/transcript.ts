// Read a pi session as a paged transcript.
//
// `herdr_get_agent_result` returns the final message; a long task often has a
// useful middle. This module maps the JSONL into user/assistant/tool turns with
// the tool calls each turn made, so the tool and the web panel can page through
// it without screen scraping.

import { existsSync, readFileSync } from "node:fs";
import { assistantText, parseSessionEntries } from "./session.js";

export interface TranscriptToolCall {
  name: string;
  /** One-line argument preview: the bash command, the edited path, ... */
  detail: string;
}

export interface TranscriptMessage {
  /** Zero-based turn index across the whole session. */
  index: number;
  role: "user" | "assistant" | "tool" | "system" | "other";
  text: string;
  toolCalls: TranscriptToolCall[];
  /** For role "tool": which tool produced this result. */
  toolName?: string;
  /** For role "tool": pi marked the call as failed. */
  isError?: boolean;
  /** For role "tool": wall time the call took. */
  durationMs?: number;
  timestamp?: string;
}

export interface TranscriptPage {
  messages: TranscriptMessage[];
  total: number;
}

/** Argument keys worth showing first, most specific to broadest. */
const PREVIEW_KEYS = [
  "command",
  "path",
  "file_path",
  "filePath",
  "pattern",
  "query",
  "url",
  "prompt",
  "subject",
  "action",
  "target",
];

const MAX_PREVIEW = 220;

function clip(text: string, max = MAX_PREVIEW): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const value = block as { type?: unknown; text?: unknown };
    if (value.type === "text" && typeof value.text === "string") parts.push(value.text);
  }
  return parts.join("\n");
}

/** A short, human-readable preview of one tool call's arguments. */
export function toolCallPreview(args: unknown): string {
  if (!args || typeof args !== "object") return "";
  const record = args as Record<string, unknown>;
  for (const key of PREVIEW_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return clip(value);
  }
  // Fall back to the first non-empty string argument, then to JSON.
  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.trim()) return clip(value);
  }
  if (Object.keys(record).length === 0) return "";
  try {
    return clip(JSON.stringify(record));
  } catch {
    return "";
  }
}

function toolCalls(content: unknown): TranscriptToolCall[] {
  if (!Array.isArray(content)) return [];
  const calls: TranscriptToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const value = block as { type?: unknown; name?: unknown; arguments?: unknown };
    if (value.type !== "toolCall") continue;
    calls.push({
      name: typeof value.name === "string" ? value.name : "tool",
      detail: toolCallPreview(value.arguments),
    });
  }
  return calls;
}

/** Normalize session JSONL text into transcript turns. */
export function readTranscriptFromText(text: string): TranscriptMessage[] {
  const { entries } = parseSessionEntries(text);
  const messages: TranscriptMessage[] = [];
  for (const entry of entries) {
    if (!entry || entry.type !== "message") continue;
    const message = (entry.message ?? {}) as Record<string, unknown>;
    const rawRole = typeof message.role === "string" ? message.role : "other";
    const role: TranscriptMessage["role"] =
      rawRole === "toolResult"
        ? "tool"
        : rawRole === "user" || rawRole === "assistant" || rawRole === "system"
          ? rawRole
          : "other";
    const body = role === "assistant" ? assistantText(message) : contentText(message.content);
    const calls = toolCalls(message.content);
    if (!body.trim() && calls.length === 0 && role !== "tool") continue;
    const stamp =
      typeof entry.timestamp === "string"
        ? entry.timestamp
        : typeof message.timestamp === "string"
          ? message.timestamp
          : undefined;
    const turn: TranscriptMessage = {
      index: messages.length,
      role,
      text: body.trim(),
      toolCalls: calls,
      timestamp: stamp,
    };
    if (role === "tool") {
      if (typeof message.toolName === "string") turn.toolName = message.toolName;
      if (message.isError === true) turn.isError = true;
      if (typeof message.durationMs === "number") turn.durationMs = message.durationMs;
    }
    messages.push(turn);
  }
  return messages;
}

/** Read a session file and normalize the whole transcript. */
export function readTranscript(sessionPath: string): TranscriptMessage[] {
  if (!sessionPath || !existsSync(sessionPath)) return [];
  let text: string;
  try {
    text = readFileSync(sessionPath, "utf8");
  } catch {
    return [];
  }
  return readTranscriptFromText(text);
}

/** One page, clamped to the available range. */
export function pageTranscript(
  sessionPath: string,
  options: { from?: number; limit?: number } = {},
): TranscriptPage {
  const all = readTranscript(sessionPath);
  const from = Math.max(0, Math.trunc(options.from ?? 0));
  const limit = Math.max(1, Math.min(100, Math.trunc(options.limit ?? 20)));
  return { messages: all.slice(from, from + limit), total: all.length };
}
