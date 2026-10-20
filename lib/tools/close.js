// herdr_close_agent and herdr_interrupt_agent.
//
// close   destroys the pane (the session file survives);
// interrupt cancels the current provider turn and keeps the pane.
import { text, wrapExecute } from "./shared.js";
export function createCloseTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_close_agent",
        description: "Close the pane of an agent this plugin spawned (task id, agent name, or pane id). " +
            "Refuses panes the plugin did not create, and refuses to close a working agent unless force:true. " +
            "The pi session file is retained, so the transcript is not lost. Prefer herdr_interrupt_agent to stop a turn without closing.",
        parameters: {
            target: { type: "string", required: true, description: "Task id, agent name, or pane id." },
            force: {
                type: "boolean",
                description: "Close even while the agent is working, and force-remove a dirty worktree (default false).",
            },
            remove_worktree: {
                type: "boolean",
                description: "Also remove the isolated worktree created for this task (default false).",
            },
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    closed: { type: "boolean" },
                    paneId: { type: "string" },
                },
            },
            render: (_args, value) => text(value.message),
        },
        execute: wrapExecute(async (args, exec) => deps.lifecycle.close({
            target: String(args.target ?? ""),
            force: args.force === true,
            removeWorktree: args.remove_worktree === true,
            signal: exec.signal,
        })),
    });
}
export function createInterruptTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_interrupt_agent",
        description: "Cancel an agent's current turn by sending Escape to its pane. The pane, session file, and delegation record stay intact, so you can follow up with herdr_message_agent. " +
            "Not a terminate: use herdr_close_agent for that. Refuses panes this plugin did not spawn.",
        parameters: {
            target: { type: "string", required: true, description: "Task id, agent name, or pane id." },
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    interrupted: { type: "boolean" },
                },
            },
            render: (_args, value) => text(value.message),
        },
        execute: wrapExecute(async (args, exec) => deps.lifecycle.interrupt(String(args.target ?? ""), exec.signal)),
    });
}
//# sourceMappingURL=close.js.map