// herdr_inbox — consume child → DSH messages.
import { text, wrapExecute } from "./shared.js";
export function createInboxTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_inbox",
        description: "Read messages a delegated agent appended to its task inbox (BLOCKED, REVIEW_REQUEST, COMPLETE, NOTE). " +
            "Omit target to read every open task; pass a task id/name/pane to read one. Messages are consumed by default, so a second call does not replay them. " +
            "Use wait:true as a long-poll when you are waiting for a child to report. This is the inbound channel; the synchronous tool result remains the primary one.",
        parameters: {
            target: {
                type: "string",
                description: "Task id, agent name, or pane id. Omit to read all open tasks.",
            },
            wait: {
                type: "boolean",
                description: "Long-poll until a message arrives or the timeout expires (default false).",
            },
            timeout_ms: {
                type: "number",
                description: "Wait budget in milliseconds (default 30000).",
            },
            consume: {
                type: "boolean",
                description: "Advance the read offset (default true). Set false to peek.",
            },
            limit: {
                type: "number",
                description: "Maximum messages to return (default 50, max 200).",
            },
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    messages: {
                        type: "array",
                        items: { type: "object", additionalProperties: true },
                    },
                    remaining: { type: "number" },
                    waitedMs: { type: "number" },
                },
            },
            render: (_args, value) => {
                if (value.messages.length === 0) {
                    return text(`no new inbox messages${value.remaining > 0 ? ` (${value.remaining} remaining)` : ""} after ${value.waitedMs}ms`);
                }
                const lines = [
                    `${value.messages.length} message(s)${value.remaining > 0 ? `, ${value.remaining} remaining` : ""}:`,
                ];
                for (const message of value.messages) {
                    lines.push(`\n[${message.type}] ${message.taskId} (${message.name})${message.ts ? ` · ${message.ts}` : ""}`);
                    lines.push(message.text);
                }
                if (value.malformed > 0)
                    lines.push(`\n(${value.malformed} malformed inbox line(s) skipped)`);
                return text(lines.join("\n"));
            },
        },
        execute: wrapExecute(async (args, exec) => deps.inbox.read({
            target: typeof args.target === "string" ? args.target : undefined,
            wait: args.wait === true,
            timeoutMs: typeof args.timeout_ms === "number" ? args.timeout_ms : undefined,
            consume: args.consume !== false,
            limit: typeof args.limit === "number" ? args.limit : undefined,
            signal: exec.signal,
        })),
    });
}
//# sourceMappingURL=inbox.js.map