import type { ResultMeta } from "./types.js";
export interface ParsedResultMarkdown {
    meta: ResultMeta;
    body: string;
}
/** Parse `--- status/summary/tests/files ---` frontmatter and the body. */
export declare function parseResultMarkdown(text: string): ParsedResultMarkdown;
/** A one-line summary from arbitrary result text. */
export declare function firstLine(text: string | undefined, max?: number): string;
//# sourceMappingURL=result-md.d.ts.map