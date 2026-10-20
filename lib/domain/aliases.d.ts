export declare const THINKING_LEVELS: Set<string>;
export interface AliasEntry {
    alias: string;
    model: string;
    billing: string;
    thinking: string[];
}
export type AliasTable = ReadonlyMap<string, AliasEntry>;
/**
 * Parse the markdown alias table. A row is any line starting with `|` that
 * carries a backticked alias in its first cell and a backticked
 * `provider/model` in its second.
 */
export declare function parseAliasTable(text: string): Map<string, AliasEntry>;
/** Read the alias file; a missing or unreadable file is an empty table. */
export declare function loadAliases(path: string): Map<string, AliasEntry>;
export interface ParsedModelSpec {
    alias?: string;
    rawModel?: string;
    thinking?: string;
}
/** Split `grok4.7[high]` into alias + thinking; `/` means a raw model id. */
export declare function parseModelSpec(spec: string): ParsedModelSpec;
export interface ResolvedModel {
    model?: string;
    thinking?: string;
    alias?: string;
    error?: string;
}
/**
 * Resolve a model spec against the alias table. Returns `{error}` instead of
 * throwing so the caller can attach a remediation.
 */
export declare function resolveModelSpec(spec: string, aliases: AliasTable, fallbackAlias?: string): ResolvedModel;
export interface AliasSummary {
    alias: string;
    model: string;
    billing: string;
    thinking: string[];
}
/** Serializable alias list for doctor output. */
export declare function describeAliases(aliases: AliasTable): AliasSummary[];
//# sourceMappingURL=aliases.d.ts.map