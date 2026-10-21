// Read a pi session as a paged transcript.
//
// `herdr_get_agent_result` returns the final message; a long task often has a
// useful middle. This module maps the JSONL into user/assistant turns with
// their tool calls, so the tool can page through it without screen scraping.

import { existsSync, readFileSync } from "node:fs";
import { assistantText, parseSessionEntries } from "./session.js";

export interface TranscriptMessage {
  /** Zero-based turn index across the whole session. */
  index: number;
  role: "user" | "assistant" | "system" | "other";
  text: string;
  toolCalls: string[];
  timestamp?: string;
}

export interface TranscriptPage {
  messages: TranscriptMessage[];
  total: number;
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

function toolCallNames(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  const names: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const value = block as { type?: unknown; name?: unknown };
    if (value.type === "toolCall" && typeof value.name === "string") names.push(value.name);
  }
  return names;
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
      rawRole === "user" || rawRole === "assistant" || rawRole === "system" ? rawRole : "other";
    const body = role === "assistant" ? assistantText(message) : contentText(message.content);
    const calls = toolCallNames(message.content);
    if (!body.trim() && calls.length === 0) continue;
    const stamp =
      typeof entry.timestamp === "string"
        ? entry.timestamp
        : typeof message.timestamp === "string"
          ? message.timestamp
          : undefined;
    messages.push({
      index: messages.length,
      role,
      text: body.trim(),
      toolCalls: calls,
      timestamp: stamp,
    });
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
