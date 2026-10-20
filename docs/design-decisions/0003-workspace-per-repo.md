# ADR 0003 — One workspace per repo, one tab per task

- **Status:** accepted
- **Date:** 2026-10-20

## Context

DSH runs either inside a Herdr pane (when launched from a terminal) or as the desktop app, which has no `HERDR_ENV` and no caller pane. A delegation needs a pane for every task, without rearranging the user's workspace or producing unusably narrow columns.

## Decision

- Inside Herdr (`HERDR_ENV=1`): split the caller's pane, `--no-focus`, in the caller's cwd.
- Otherwise: create/reuse one workspace per repository labeled `DSH · <repo>`, then one **tab** per task inside it. The workspace id is persisted in `state.json`.

## Consequences

- **Good:** each agent gets a full-width pane; tabs are obvious to close and label with `herdr: <agent>`.
- **Good:** the user's existing workspaces are untouched; the dedicated workspace is the delegation surface.
- **Good:** if the user closed the workspace, the next spawn recreates it once instead of failing.
- **Bad:** many tasks mean many tabs. This is deliberate; a pane-tiling layout was rejected for the narrow-column problem.
- **Bad:** a workspace per repo can accumulate; it is one per project, not per task.

## Alternatives

- **Reuse the focused pane:** rejected — it would type into whatever the user is doing.
- **Split the root pane for every task:** rejected — three columns on a laptop are unusable.
- **New workspace per task:** rejected — too much UI churn and harder to find a running agent.
- **Worktree per task:** deferred. It is the right isolation tool, but merging/cleanup is a separate workflow; see [ROADMAP](../../ROADMAP.md).
