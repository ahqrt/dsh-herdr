import { type Result } from "./result.js";
export interface KindCaps {
    model: boolean;
    thinking: boolean;
    session: boolean;
    refusesModel?: boolean;
}
export declare function kindCaps(kind: string): KindCaps;
export interface LaunchArgsInput {
    kind: string;
    model?: string;
    thinking?: string;
    agentArgs?: string[];
}
/** Build the argv after `--`; returns a typed failure for unsupported flags. */
export declare function buildAgentArgs(input: LaunchArgsInput): Result<string[]>;
//# sourceMappingURL=launch.d.ts.map