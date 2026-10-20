// herdr_doctor — "why isn't delegation working?" in one call.
import { renderDoctor, wrapExecute } from "./shared.js";
export function createDoctorTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_doctor",
        description: "Diagnose the Herdr bridge: binary/version, server reachability, agent kinds, model alias file, state/artifact directories, topology, and the configured default model. " +
            "Call it before the first delegation in a session, or whenever a spawn fails with an environment-shaped error.",
        parameters: {},
        output: {
            schema: {
                type: "object",
                additionalProperties: true,
                properties: {
                    ok: { type: "boolean" },
                    checks: {
                        type: "array",
                        items: { type: "object", additionalProperties: true },
                    },
                },
            },
            render: (_args, value) => renderDoctor(value),
        },
        execute: wrapExecute(async () => deps.doctor.run()),
    });
}
//# sourceMappingURL=doctor.js.map