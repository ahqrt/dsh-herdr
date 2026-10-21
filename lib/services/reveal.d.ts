import type { TaskStore } from "../ports/store.js";
export interface RevealDeps {
    store: TaskStore;
    /** Override for tests. */
    opener?: (path: string) => Promise<void>;
    platform?: NodeJS.Platform;
}
export interface RevealResult {
    revealed: true;
    cwd: string;
    message: string;
}
export declare class RevealService {
    private readonly deps;
    constructor(deps: RevealDeps);
    reveal(target: string): Promise<RevealResult>;
}
/** Best-effort native opener; detached and ignored, never shell-interpolated. */
export declare function openInFileManager(path: string, platform?: NodeJS.Platform): Promise<void>;
//# sourceMappingURL=reveal.d.ts.map