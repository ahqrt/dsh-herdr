import type { AgentResult, TaskStatus } from "./types.js";
/** A task that still occupies a concurrency slot and should not be closed silently. */
export declare function isActiveStatus(status: TaskStatus): boolean;
/** A task whose turn is over (successfully or not). */
export declare function isSettledStatus(status: TaskStatus): boolean;
/** What the calling agent should do with a result. */
export declare function nextActionFor(status: TaskStatus): AgentResult["nextAction"];
//# sourceMappingURL=status.d.ts.map