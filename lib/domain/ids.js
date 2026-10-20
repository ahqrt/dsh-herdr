// Deterministic-friendly ids and Herdr's agent-name rules.
// Herdr accepts `[a-z][a-z0-9_-]{0,31}` and names must be unique among live
// agents; both rules live here so every caller agrees.
import { randomBytes } from "node:crypto";
export const systemClock = { now: () => Date.now() };
export const systemIds = {
    taskId: (now) => `t${now.toString(36)}${randomBytes(2).toString("hex")}`,
    suffix: () => randomBytes(2).toString("hex"),
};
export const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
/** Lowercase, strip anything Herdr rejects, keep a letter first. */
export function normalizeAgentName(raw, fallback = "agent") {
    const cleaned = raw
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-_]+|[-_]+$/g, "")
        .slice(0, 32)
        .replace(/^[^a-z]+/, "");
    return cleaned.slice(0, 32) || fallback;
}
/** Build a readable, collision-resistant name from role + model/kind. */
export function makeAgentName(input) {
    const role = normalizeAgentName(input.role || "worker", "worker");
    const flavor = normalizeAgentName(input.flavor || "agent", "agent");
    const prefix = `${role}-${flavor}`.slice(0, 27) || "worker-agent";
    const taken = input.taken ?? new Set();
    const candidate = `${prefix}-${input.suffix}`.slice(0, 32);
    if (!taken.has(candidate) && AGENT_NAME_RE.test(candidate))
        return candidate;
    // Extremely unlikely; keep the contract rather than looping forever.
    return normalizeAgentName(`${prefix}-${Date.now().toString(36)}`).slice(0, 32);
}
/** A short, filename-safe id for a caller-supplied idempotency key. */
export function shortHash(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
//# sourceMappingURL=ids.js.map