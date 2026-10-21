import type { PluginContext } from "../host.js";
export interface SubagentRegistrationStatus {
    name: string;
    registered: boolean;
    error?: string;
}
/**
 * Register `provider` with the `subagents` service.
 *
 * `ctx.inject` waits for the service when the profile loads it later; when the
 * context has no dynamic inject, a present service is used directly. The
 * status object is mutated so `herdr_doctor` can report the outcome.
 */
export declare function registerSubagentProvider(ctx: Pick<PluginContext, "inject" | "get">, provider: {
    name: string;
}, status: SubagentRegistrationStatus): void;
//# sourceMappingURL=subagent-registration.d.ts.map