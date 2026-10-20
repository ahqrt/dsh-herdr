// herdr_message_agent — review findings, follow-ups, and answers.
import { renderMessage, wrapExecute } from "./shared.js";
const KINDS = ["NOTE", "REVIEW_FINDINGS", "ACCEPT", "REJECT", "ANSWER"];
export function createMessageTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_message_agent",
        description: "Send a message to a live Herdr agent: follow-up work, review findings back to a worker, or an answer to a blocked agent. " +
            "The text is submitted as an agent prompt, so the target starts a new turn; use `wait` to block until that turn settles. " +
            "When the target is blocked, the message becomes its answer. Keep the protocol header (REVIEW_FINDINGS, ACCEPT, REJECT, NOTE) when continuing a review loop. " +
            "Only answer a blocked agent after the user has answered you.",
        parameters: {
            target: {
                type: "string",
                required: true,
                description: "Agent name, pane id, or task id.",
            },
            message: {
                type: "string",
                required: true,
                description: "The text to deliver.",
            },
            kind: {
                type: "string",
                enum: KINDS,
                description: "Optional protocol header prepended to the message.",
            },
            round: {
                type: "number",
                description: "Review round number used with kind=REVIEW_FINDINGS (default 1).",
            },
            wait: {
                type: "boolean",
                description: "Wait for the target to settle after delivery (default false).",
            },
            timeout_ms: {
                type: "number",
                description: "Wait budget in milliseconds (default 600000).",
            },
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    delivered: { type: "boolean" },
                    status: { type: "string" },
                },
            },
            render: (_args, value) => renderMessage(value),
        },
        execute: wrapExecute(async (args, exec) => deps.message.send({
            target: String(args.target ?? ""),
            message: String(args.message ?? ""),
            kind: KINDS.includes(args.kind) ? args.kind : undefined,
            round: typeof args.round === "number" ? args.round : undefined,
            wait: args.wait === true,
            timeoutMs: typeof args.timeout_ms === "number" ? args.timeout_ms : undefined,
            signal: exec.signal,
        })),
    });
}
//# sourceMappingURL=message.js.map