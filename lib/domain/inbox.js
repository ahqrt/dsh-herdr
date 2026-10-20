// The child → DSH mailbox.
//
// Every task directory carries an append-only `inbox.ndjson`. The task
// envelope asks the child to append one JSON object per message:
//   {"ts":"2026-…","type":"BLOCKED|REVIEW_REQUEST|NOTE|COMPLETE","text":"…"}
//
// Reading is line-offset based: a task record stores how many lines DSH has
// already consumed, so a re-read never replays old messages.
const TYPES = new Set([
    "BLOCKED",
    "REVIEW_REQUEST",
    "COMPLETE",
    "NOTE",
    "ACCEPT",
    "REJECT",
]);
/** Parse an inbox file, tolerating a torn final line and unknown types. */
export function parseInbox(text) {
    const messages = [];
    let malformed = 0;
    const lines = String(text ?? "").split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index]?.trim() ?? "";
        if (!line)
            continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            malformed++;
            continue;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            malformed++;
            continue;
        }
        const value = parsed;
        const textValue = typeof value.text === "string" ? value.text.trim() : "";
        if (!textValue) {
            malformed++;
            continue;
        }
        const rawType = typeof value.type === "string" ? value.type.toUpperCase() : "";
        const type = TYPES.has(rawType) ? rawType : "NOTE";
        const ts = typeof value.ts === "string" ? value.ts : undefined;
        messages.push({ index, type, text: textValue, ts });
    }
    return { messages, malformed };
}
/** How many lines were produced by a given text (the next offset). */
export function lineCount(text) {
    const value = String(text ?? "");
    if (!value)
        return 0;
    return value.split(/\r?\n/).length - (value.endsWith("\n") ? 1 : 0);
}
//# sourceMappingURL=inbox.js.map