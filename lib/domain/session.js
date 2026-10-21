// Exact result extraction from a pi session JSONL.
//
// The session file is the source of truth for a pi child's final answer:
// the last `type: "message"` entry whose message role is assistant, with its
// text blocks joined. No screen scraping, no ANSI, no scrollback ambiguity.
import { existsSync, readFileSync, statSync } from "node:fs";
/** Parse a session file's text, tolerating a torn final line. */
export function parseSessionEntries(text) {
    const entries = [];
    let malformed = 0;
    for (const line of String(text ?? "").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                entries.push(parsed);
            }
            else {
                malformed++;
            }
        }
        catch {
            malformed++;
        }
    }
    return { entries, malformed };
}
/** The exact text content of an assistant message (text blocks joined). */
export function assistantText(message) {
    if (!message || typeof message !== "object")
        return "";
    const content = message.content;
    if (typeof content === "string")
        return content;
    if (!Array.isArray(content))
        return "";
    const parts = [];
    for (const block of content) {
        if (block && typeof block === "object") {
            const candidate = block;
            if (candidate.type === "text" && typeof candidate.text === "string")
                parts.push(candidate.text);
        }
    }
    return parts.join("\n");
}
/** The last assistant message in parsed entries, or null. */
export function extractLastAssistant(entries) {
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry || entry.type !== "message")
            continue;
        const message = entry.message;
        if (!message || typeof message !== "object")
            continue;
        if (message.role !== "assistant")
            continue;
        return { message: message, text: assistantText(message) };
    }
    return null;
}
/** Extract the last assistant message from session JSONL text. */
export function extractSessionResultFromText(text) {
    return extractLastAssistant(parseSessionEntries(text).entries);
}
/** Read a session file and extract its last assistant message. */
export function extractSessionResult(sessionPath) {
    if (!sessionPath || !existsSync(sessionPath))
        return null;
    let text;
    try {
        text = readFileSync(sessionPath, "utf8");
    }
    catch {
        return null;
    }
    return extractSessionResultFromText(text);
}
/** Mine typed failure info: pi marks an exhausted turn with stopReason=error. */
export function minedAssistantError(message) {
    if (!message || typeof message !== "object")
        return null;
    const value = message;
    if (value.stopReason !== "error")
        return null;
    const raw = typeof value.errorMessage === "string" ? value.errorMessage.trim() : "";
    return {
        stopReason: "error",
        errorMessage: raw || "agent loop ended with stopReason=error (no errorMessage field on the message)",
    };
}
/** mtime in ms, or 0 when the file is missing. */
export function sessionMtime(sessionPath) {
    if (!sessionPath)
        return 0;
    try {
        return statSync(sessionPath).mtimeMs;
    }
    catch {
        return 0;
    }
}
/** Count assistant messages / tool calls / output tokens from session text. */
export function sessionStatsFromText(text) {
    const { entries } = parseSessionEntries(text);
    let assistant = 0;
    let toolCalls = 0;
    let outputTokens = 0;
    for (const entry of entries) {
        if (!entry || entry.type !== "message")
            continue;
        const message = (entry.message ?? {});
        if (message.role !== "assistant")
            continue;
        assistant++;
        const usage = (message.usage ?? {});
        const output = Number(usage.output ?? usage.outputTokens ?? 0);
        if (Number.isFinite(output))
            outputTokens += output;
        const content = message.content;
        if (Array.isArray(content)) {
            for (const block of content) {
                if (block &&
                    typeof block === "object" &&
                    block.type === "toolCall") {
                    toolCalls++;
                }
            }
        }
    }
    return { assistant, toolCalls, outputTokens };
}
/** Read a session file and count its usage. */
export function sessionStats(sessionPath) {
    if (!sessionPath || !existsSync(sessionPath))
        return undefined;
    let text;
    try {
        text = readFileSync(sessionPath, "utf8");
    }
    catch {
        return undefined;
    }
    return sessionStatsFromText(text);
}
//# sourceMappingURL=session.js.map