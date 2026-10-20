import type { AgentResult } from "../domain/types.js";
import type { DoctorReport } from "../services/doctor.js";
import type { FleetRow } from "../services/lifecycle.js";
import type { MessageResult } from "../services/message.js";
import type { PluginContext, ToolExecution } from "../host.js";
export interface ContentBlock {
    type: "text";
    text: string;
}
export declare function text(value: string): ContentBlock[];
/** Resolve the working directory: explicit > session service > session header > host cwd. */
export declare function resolveCwd(input: {
    ctx: PluginContext;
    exec: ToolExecution;
    explicit?: string;
}): Promise<string>;
/** Wrap a tool execute body so every failure reaches DSH as a stable code + fix. */
export declare function wrapExecute<A, R>(fn: (args: A, exec: ToolExecution) => Promise<R>): (args: A, exec: ToolExecution) => Promise<R>;
/** The review packet, rendered for the model. */
export declare function renderAgentResult(value: AgentResult): ContentBlock[];
/** The fleet table. */
export declare function renderFleet(rows: FleetRow[]): ContentBlock[];
export declare function renderMessage(value: MessageResult): ContentBlock[];
export declare function renderDoctor(value: DoctorReport): ContentBlock[];
//# sourceMappingURL=shared.d.ts.map