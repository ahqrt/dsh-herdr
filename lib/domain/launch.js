// Compose the argv handed to `herdr agent start --kind <kind> -- <argv>`.
//
// `pi` is the only kind whose model/thinking flags are a stable contract here.
// `agy` explicitly refuses them. Every other kind gets the raw `agent_args`
// escape hatch instead of a guess — a wrong flag is worse than no flag.
import { THINKING_LEVELS } from "./aliases.js";
import { err, ok } from "./result.js";
export function kindCaps(kind) {
    switch (String(kind ?? "").toLowerCase()) {
        case "pi":
            return { model: true, thinking: true, session: true };
        case "agy":
            return { model: false, thinking: false, session: false, refusesModel: true };
        default:
            return { model: false, thinking: false, session: false };
    }
}
/** Build the argv after `--`; returns a typed failure for unsupported flags. */
export function buildAgentArgs(input) {
    const kind = String(input.kind ?? "").toLowerCase();
    const caps = kindCaps(kind);
    const args = [];
    if (input.thinking && !THINKING_LEVELS.has(input.thinking.toLowerCase())) {
        return err("VALIDATION_ERROR", `unknown thinking level "${input.thinking}"; use one of ${[...THINKING_LEVELS].join(", ")}`, { remediation: "pass one of the documented thinking levels or omit it" });
    }
    if (input.model && !caps.model) {
        return err("VALIDATION_ERROR", caps.refusesModel
            ? `kind "${kind}" refuses --model; omit model/thinking, or pass the kind's own flags through agent_args`
            : `kind "${kind}" has no model flag in this plugin; use kind "pi" or pass the kind's own flags through agent_args`, { remediation: "use kind=pi for model routing; otherwise use agent_args" });
    }
    if (input.thinking && !caps.thinking) {
        return err("VALIDATION_ERROR", `kind "${kind}" has no thinking flag in this plugin; use kind "pi" or pass the kind's own flags through agent_args`, { remediation: "use kind=pi for thinking control" });
    }
    if (kind === "pi") {
        if (input.model)
            args.push("--model", input.model);
        if (input.thinking)
            args.push("--thinking", input.thinking.toLowerCase());
    }
    for (const arg of input.agentArgs ?? []) {
        if (typeof arg === "string" && arg.length > 0)
            args.push(arg);
    }
    return ok(args);
}
//# sourceMappingURL=launch.js.map