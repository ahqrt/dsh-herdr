# Example: review a diff with another model family

**Goal:** DSH reviews the current working-tree diff using `grok4.7[high]`, read-only, while the DSH agent keeps the final say.

## What you say

```text
Use grok4.7[high] to review the current diff in /Users/me/code/api.
Read-only. Findings by severity with file:line and evidence.
```

## What DSH calls

```json
{
  "tool": "herdr_spawn_agent",
  "args": {
    "kind": "pi",
    "model": "grok4.7",
    "thinking": "high",
    "role": "reviewer",
    "cwd": "/Users/me/code/api",
    "prompt": "Review the working-tree diff against HEAD. Requirements: <paste the task>. Read-only: do not modify files. Report one finding per line as `[severity] path:line — issue — why it is wrong — evidence`; severities BLOCKER/MAJOR/MINOR/NIT; mark uncertainty UNSURE; do not pad."
  }
}
```

The plugin:

1. runs `git rev-parse HEAD` and `git status --porcelain` (baseline);
2. creates a tab `herdr: review-grok4-7-…` in the `DSH · api` workspace;
3. starts `pi --model xai/grok-4.7 --thinking high` in the pane;
4. sends the reviewer envelope (artifact contract + read-only scope);
5. waits for settle, then harvests.

## What comes back

```text
[herdr] reviewer pi (xai/grok-4.7 · high) → completed
agent: review-grok4-7-a1b2 · pane wV:p12 · tab wV:t6
summary: 2 majors, 1 minor
diff: 4 file(s) · 4 files changed, 120 insertions(+), 18 deletions(-)
patch: ~/.dsh/herdr/tasks/t…/diff.patch
session: ~/.pi/agent/sessions/.../x.jsonl

--- final message ---
[MAJOR] src/auth.ts:42 — token compared with `==` — timing-safe compare is required — src/auth.test.ts:88 covers the happy path only
...
```

## What DSH should do

1. Read the `diff` rather than trusting the summary.
2. Verify each finding against the patch; drop findings that do not hold.
3. Present the verified list to you, not the raw message.
4. If a finding is wrong, say why — the reviewer is a model, not an oracle.

## Pitfalls

- **Do not send the worker's rationale to the reviewer before it finishes.** It anchors the review. Give it requirements + diff only.
- **Do not use the same family for "independent" review.** grok × grok is duplicate work; the alias table's billing column is the hint.
- **Do not auto-accept.** A reviewer that modified files is flagged in `warnings`; read the diff.
