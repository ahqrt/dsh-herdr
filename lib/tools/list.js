// herdr_list_agents — one fleet view over Herdr + this plugin's registry.
import { renderFleet, wrapExecute } from "./shared.js";
export function createListTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_list_agents",
        description: "List delegated agents and live Herdr agents with their status, model, cwd, pane, and task id. " +
            "Use it to see what is still running before spawning more, to find a handle for herdr_get_agent_result, or to check whether a pane is yours to close.",
        parameters: {
            owned_only: {
                type: "boolean",
                description: "Only agents this plugin spawned (default false).",
            },
        },
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    agents: {
                        type: "array",
                        items: { type: "object", additionalProperties: true },
                    },
                },
            },
            render: (_args, value) => renderFleet(value.agents),
        },
        execute: wrapExecute(async (args, exec) => {
            const agents = await deps.lifecycle.list({
                ownedOnly: args.owned_only === true,
                signal: exec.signal,
            });
            return { agents };
        }),
    });
}
//# sourceMappingURL=list.js.map