# Example: implement, review, fix, accept

**Goal:** a worker implements, an independent reviewer checks, DSH adjudicates, the worker fixes, DSH accepts.

## 1. Delegate the implementation

```json
{
  "tool": "herdr_spawn_agent",
  "args": {
    "kind": "pi",
    "model": "flash",
    "cwd": "/Users/me/code/api",
    "prompt": "Add exponential backoff with jitter to the HTTP client. Keep the public API. Run `pnpm test`. Write result.md and reply COMPLETE.",
    "client_task_id": "api-backoff-1"
  }
}
```

Result: `status=completed`, `finalMessage`, `diff.files`, `diff.patch`, `result.md`.

## 2. Review the evidence in DSH

- Read `diff.stat` and `diff.files`; open `diff.patch` if the change is small.
- Check `tests` and the test output in `finalMessage`.
- Look for `warnings` (empty harvest, reviewer edits, stale session).

## 3. Optional independent review

```json
{
  "tool": "herdr_spawn_agent",
  "args": {
    "kind": "pi",
    "model": "gpt6sol",
    "role": "reviewer",
    "cwd": "/Users/me/code/api",
    "prompt": "Review the diff against HEAD for correctness, race conditions, and test gaps. Read-only. Format: [severity] path:line — issue — why — evidence."
  }
}
```

Use a different family from the worker (flash/DeepSeek → gpt or claude). Do not pass the worker's summary to the reviewer.

## 4. Adjudicate

DSH merges the reviewer's findings with its own reading, drops the ones that do not hold, and decides: accept, or send findings back.

## 5. Fix round

```json
{
  "tool": "herdr_message_agent",
  "args": {
    "target": "worker-flash-a1b2",
    "kind": "REVIEW_FINDINGS",
    "round": 1,
    "message": "[MAJOR] src/http.ts:88 — jitter can exceed the cap — clamp after jitter, not before — reviewer evidence\n[MINOR] src/http.test.ts:12 — no test for the cap"
  }
}
```

Then:

```json
{ "tool": "herdr_get_agent_result", "args": { "target": "worker-flash-a1b2", "wait": true } }
```

The harvest re-runs the diff against the **original** baseline, so you see the fix plus the first change together.

## 6. Accept or escalate

- All BLOCKER/MAJOR resolved and tests pass → accept in DSH; close the panes when you are done.
- Two rounds without resolution → stop and ask the user; do not loop a model against itself.

## Loop budget

Two review rounds is the default in the skill. More rounds usually mean the objective or the acceptance criteria were underspecified — fix the prompt, not the loop.
