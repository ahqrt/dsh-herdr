// Registration wiring for the native subagent provider, kept out of index.ts
// so it can be unit-tested without importing DSH host packages.
/**
 * Register `provider` with the `subagents` service.
 *
 * `ctx.inject` waits for the service when the profile loads it later; when the
 * context has no dynamic inject, a present service is used directly. The
 * status object is mutated so `herdr_doctor` can report the outcome.
 */
export function registerSubagentProvider(ctx, provider, status) {
    const register = (subContext) => {
        try {
            if (!subContext.subagents) {
                status.error = "subagents service resolved without a provider registry";
                return;
            }
            subContext.subagents.registerProvider(provider);
            status.registered = true;
            status.error = undefined;
        }
        catch (error) {
            status.registered = false;
            status.error = error instanceof Error ? error.message : String(error);
        }
    };
    if (typeof ctx.inject === "function") {
        try {
            ctx.inject(["subagents"], register);
        }
        catch (error) {
            status.error = error instanceof Error ? error.message : String(error);
        }
        return;
    }
    const subagents = ctx.get?.("subagents");
    if (subagents)
        register({ subagents });
    else
        status.error = "subagents service is not loaded in this profile";
}
//# sourceMappingURL=subagent-registration.js.map