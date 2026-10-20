// The task envelope sent to a delegated agent.
//
// It is explicit about what "done" means: a final message plus a result.md
// artifact with frontmatter. The plugin reads the artifact for every kind and
// the pi session file for the exact final text.
export function artifactPaths(artifactDir) {
    return {
        dir: artifactDir,
        result: `${artifactDir}/result.md`,
        inbox: `${artifactDir}/inbox.ndjson`,
        prompt: `${artifactDir}/prompt.md`,
        diff: `${artifactDir}/diff.patch`,
    };
}
/** Compose the full task envelope. */
export function buildTaskPrompt(input) {
    const paths = artifactPaths(input.artifactDir);
    const deadline = new Date(Date.now() + input.timeoutMs).toISOString();
    return [
        `[DSH-HERDR TASK ${input.taskId}]`,
        `role: ${input.role}`,
        "from: dsh:orchestrator",
        `cwd: ${input.cwd}`,
        `deadline: ${deadline}`,
        "",
        "## Objective",
        input.prompt.trim(),
        "",
        "## Deliverable (required)",
        `1. Write ${paths.result} with this exact structure:`,
        "   ---",
        "   status: completed | blocked | failed",
        "   summary: <one line>",
        "   tests: <commands you ran and their result, or `none`>",
        "   files: <paths you changed, or `none`>",
        "   ---",
        "   <free-form detail: what changed, decisions, open questions>",
        `2. Your final chat message must be a short summary and the line: COMPLETE ${paths.result}`,
        "",
        "## Reporting back to DSH",
        `- If you need a decision, are blocked, or want a review, append ONE JSON line to ${paths.inbox}:`,
        '  {"ts":"<ISO>","type":"BLOCKED|REVIEW_REQUEST|NOTE","text":"<what you need>"}',
        "- Then still write result.md with status blocked and stop.",
        `- Do not edit files outside ${input.cwd}.`,
        "",
        "## Scope",
        input.role === "reviewer"
            ? "You are a REVIEWER: read-only. Do not modify files and do not run commands that write. Review the requirements and the diff, then report findings."
            : "Implement the objective. Run the relevant tests. Keep the change scoped.",
        "",
        "## Review format (when role=reviewer)",
        "One finding per line: `[severity] path:line — issue — why it is wrong — evidence`.",
        "severities: BLOCKER | MAJOR | MINOR | NIT. Mark uncertainty as UNSURE. Do not pad with praise.",
    ].join("\n");
}
/** Wrap a message headed for another Herdr agent. */
export function buildAgentMessage(input) {
    const head = input.kind ? `${input.kind}\n` : "";
    return `<agent-message from="${input.from}" to="${input.to}">\n${head}${input.text.trim()}\n</agent-message>`;
}
/** The message DSH sends back to a worker after a review round. */
export function buildReviewFindings(findings, round) {
    return [
        `REVIEW_FINDINGS round ${round}`,
        "The reviewer found the following. Fix every BLOCKER and MAJOR; address MINOR/NIT or explain why not.",
        "",
        findings.trim(),
        "",
        "Re-run the relevant tests, update result.md, and reply COMPLETE when done.",
    ].join("\n");
}
//# sourceMappingURL=prompt.js.map