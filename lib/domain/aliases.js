// Model alias resolution.
//
// The user's ~/.pi/agent/model-aliases.md is the source of truth for short
// names, provider/model ids, and billing boundaries. We parse that table
// (never hardcode it) and resolve `grok4.7[high]` → {model, thinking}.
import { readFileSync } from "node:fs";
export const THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
/**
 * Parse the markdown alias table. A row is any line starting with `|` that
 * carries a backticked alias in its first cell and a backticked
 * `provider/model` in its second.
 */
export function parseAliasTable(text) {
    const out = new Map();
    for (const line of String(text ?? "").split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("|"))
            continue;
        const cells = trimmed
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim());
        if (cells.length < 2)
            continue;
        const alias = firstBacktick(cells[0] ?? "");
        const model = firstBacktick(cells[1] ?? "");
        if (!alias || !model)
            continue;
        if (!/^[a-z0-9][a-z0-9._-]*$/i.test(alias))
            continue;
        if (!model.includes("/"))
            continue;
        const thinking = (cells[3] ?? "")
            .split("/")
            .map((part) => part.trim().toLowerCase())
            .filter((part) => THINKING_LEVELS.has(part));
        out.set(alias, { alias, model, billing: cells[2] ?? "", thinking });
    }
    return out;
}
function firstBacktick(cell) {
    const match = /`([^`]+)`/.exec(cell);
    return match ? (match[1] ?? "").trim() : "";
}
/** Read the alias file; a missing or unreadable file is an empty table. */
export function loadAliases(path) {
    try {
        return parseAliasTable(readFileSync(path, "utf8"));
    }
    catch {
        return new Map();
    }
}
/** Split `grok4.7[high]` into alias + thinking; `/` means a raw model id. */
export function parseModelSpec(spec) {
    const value = String(spec ?? "").trim();
    if (!value)
        return {};
    if (value.includes("/")) {
        const match = /^([^\s[\]]+)(?:\[([a-z]+)\])?$/i.exec(value);
        if (!match)
            return { rawModel: value };
        const thinking = match[2]?.toLowerCase();
        return thinking ? { rawModel: match[1], thinking } : { rawModel: match[1] };
    }
    const match = /^([a-z0-9][a-z0-9._-]*)(?:\[([a-z]+)\])?$/i.exec(value);
    if (!match)
        return {};
    const thinking = match[2]?.toLowerCase();
    return thinking ? { alias: match[1], thinking } : { alias: match[1] };
}
/**
 * Resolve a model spec against the alias table. Returns `{error}` instead of
 * throwing so the caller can attach a remediation.
 */
export function resolveModelSpec(spec, aliases, fallbackAlias) {
    const input = String(spec ?? "").trim() || String(fallbackAlias ?? "").trim();
    if (!input)
        return {};
    const parsed = parseModelSpec(input);
    if (parsed.rawModel) {
        if (parsed.thinking && !THINKING_LEVELS.has(parsed.thinking)) {
            return {
                error: `unknown thinking level "${parsed.thinking}"; use one of ${[...THINKING_LEVELS].join(", ")}`,
            };
        }
        return parsed.thinking
            ? { model: parsed.rawModel, thinking: parsed.thinking }
            : { model: parsed.rawModel };
    }
    if (!parsed.alias)
        return { error: `cannot parse model spec "${input}"` };
    const entry = aliases.get(parsed.alias);
    if (!entry) {
        const known = [...aliases.keys()].join(", ");
        return {
            error: `unknown model alias "${parsed.alias}"${known ? `; known aliases: ${known}` : ""}. Pass a provider/model id or add the alias to model-aliases.md`,
        };
    }
    if (parsed.thinking && !THINKING_LEVELS.has(parsed.thinking)) {
        return {
            error: `unknown thinking level "${parsed.thinking}"; use one of ${[...THINKING_LEVELS].join(", ")}`,
        };
    }
    return parsed.thinking
        ? { model: entry.model, thinking: parsed.thinking, alias: entry.alias }
        : { model: entry.model, alias: entry.alias };
}
/** Serializable alias list for doctor output. */
export function describeAliases(aliases) {
    return [...aliases.values()].map(({ alias, model, billing, thinking }) => ({
        alias,
        model,
        billing,
        thinking,
    }));
}
//# sourceMappingURL=aliases.js.map