// Lifecycle predicates. One place decides what "active", "settled", and
// "what should the caller do next" mean, so the tools, the store, and the
// docs cannot drift apart.
/** A task that still occupies a concurrency slot and should not be closed silently. */
export function isActiveStatus(status) {
    return status === "starting" || status === "working" || status === "blocked" || status === "running";
}
/** A task whose turn is over (successfully or not). */
export function isSettledStatus(status) {
    return (status === "completed" ||
        status === "failed" ||
        status === "gone" ||
        status === "closed" ||
        status === "interrupted" ||
        status === "idle");
}
/** What the calling agent should do with a result. */
export function nextActionFor(status) {
    switch (status) {
        case "running":
        case "working":
        case "starting":
            return "wait";
        case "blocked":
            return "answer";
        case "completed":
            return "none";
        case "failed":
        case "gone":
        case "interrupted":
            return "inspect";
        case "closed":
        case "idle":
            return "none";
    }
}
//# sourceMappingURL=status.js.map