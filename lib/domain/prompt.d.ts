import type { TaskRole } from "./types.js";
export interface ArtifactPaths {
    dir: string;
    result: string;
    inbox: string;
    prompt: string;
    diff: string;
}
export declare function artifactPaths(artifactDir: string): ArtifactPaths;
export interface TaskPromptInput {
    taskId: string;
    role: TaskRole;
    prompt: string;
    cwd: string;
    artifactDir: string;
    timeoutMs: number;
    kind: string;
}
/** Compose the full task envelope. */
export declare function buildTaskPrompt(input: TaskPromptInput): string;
/** Wrap a message headed for another Herdr agent. */
export declare function buildAgentMessage(input: {
    from: string;
    to: string;
    text: string;
    kind?: string;
}): string;
/** The message DSH sends back to a worker after a review round. */
export declare function buildReviewFindings(findings: string, round: number): string;
//# sourceMappingURL=prompt.d.ts.map