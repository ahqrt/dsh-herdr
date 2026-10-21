import type { TaskStore } from "../ports/store.js";
export interface RevealDeps {
    store: TaskStore;
    /** Empty disables the panel's "open editor" action. */
    editor?: {
        command: string;
        args: string[];
    };
    /** Overrides for tests. */
    opener?: (path: string) => Promise<void>;
    editorOpener?: (command: string, args: string[], cwd: string) => Promise<void>;
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
    editorEnabled(): boolean;
    reveal(target: string): Promise<RevealResult>;
    openEditor(target: string): Promise<RevealResult>;
    private ownedDirectory;
}
/** Best-effort native opener; detached and ignored, never shell-interpolated. */
export declare function openInFileManager(path: string, platform?: NodeJS.Platform): Promise<void>;
/** Launch a configured editor with argv; no shell, detached, ignored. */
export declare function openInEditor(command: string, args: string[], cwd: string): Promise<void>;
//# sourceMappingURL=reveal.d.ts.map