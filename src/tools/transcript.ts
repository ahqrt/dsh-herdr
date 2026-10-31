// herdr_read_agent — page through a child's pi transcript.

import { text, wrapExecute } from "./shared.js";
import type { ToolFactoryOptions } from "../host.js";
import type { TranscriptReadResult } from "../services/transcript.js";

function turnLabel(message: TranscriptReadResult["messages"][number]): string {
  const role =
    message.role === "tool" && message.toolName ? `tool:${message.toolName}` : message.role;
  const flags = [
    message.isError ? "error" : "",
    typeof message.durationMs === "number" ? `${(message.durationMs / 1000).toFixed(1)}s` : "",
  ].filter(Boolean);
  return flags.length > 0 ? `${role} (${flags.join(" ")})` : role;
}

export function createTranscriptTool({ defineTool, deps }: ToolFactoryOptions) {
  return defineTool({
    name: "herdr_read_agent",
    description:
      "Page through a delegated pi agent's session transcript: user/assistant/tool turns with the tool calls each turn made. " +
      "Use it when the final message is not enough — to see what the child actually did, where a turn went wrong, or which tests it ran. " +
      "Only kind=pi has a transcript; for agy and others use herdr_get_agent_result (pane tail). Pagination is by turn index.",
    parameters: {
      target: {
        type: "string",
        required: true,
        description: "Task id, agent name, or pane id.",
      },
      from: {
        type: "number",
        description: "First turn index to return (default 0).",
      },
      limit: {
        type: "number",
        description: "Turns per page (default 20, max 100).",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          taskId: { type: "string" },
          total: { type: "number" },
          messages: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
      render: (_args: unknown, value: TranscriptReadResult) => {
        const first = value.messages[0]?.index ?? 0;
        const last = value.messages[value.messages.length - 1]?.index ?? first;
        const lines = [
          `[herdr] transcript ${value.taskId} (${value.name}) · ${value.total} turn(s) · showing ${first}–${last}`,
          `session: ${value.sessionPath}`,
        ];
        for (const message of value.messages) {
          lines.push("", `[${message.index}] ${turnLabel(message)}:`, message.text);
          for (const call of message.toolCalls) {
            lines.push(`  → ${call.name}${call.detail ? ` ${call.detail}` : ""}`);
          }
        }
        if (value.nextFrom !== undefined)
          lines.push("", `next: call again with from=${value.nextFrom}`);
        if (value.prevFrom !== undefined) lines.push(`earlier: from=${value.prevFrom}`);
        return text(lines.join("\n"));
      },
    },
    execute: wrapExecute(async (args: Record<string, unknown>, exec) =>
      deps.transcript.read({
        target: String(args.target ?? ""),
        from: typeof args.from === "number" ? args.from : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
        signal: exec.signal,
      }),
    ),
  });
}
