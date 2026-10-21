# ADR 0013 — Editor handoff is argv, not a shell string

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The panel can reveal a task cwd in Finder/Explorer. The next handoff is opening
it in an editor. A configuration such as `editorCommand: "code -n"` invites
shell parsing and injection; a per-user command is trusted, but the task cwd is
data and must never be interpreted.

## Decision

- Two config keys: `editorCommand` (a binary or absolute path) and `editorArgs`
  (fixed argv). Empty command hides the button.
- The action spawns `editorCommand` with `[...editorArgs, cwd]`, detached, no
  shell, no string interpolation. `cwd` still comes only from an owned task
  record and must pass the directory check.
- `RevealService.openEditor()` is separate from `reveal()`; both share the
  owned-directory gate.
- The API exposes `editorEnabled` on task detail so the client can hide the
  button instead of offering a failing action.
- Tests inject `editorOpener` and assert command/args/cwd; no editor launches in
  CI.

## Consequences

- **Good:** no shell parsing surface; spaces in paths and args work.
- **Good:** the same action works for VS Code, Cursor, Zed, or a wrapper script.
- **Bad:** users cannot express shell constructs (pipes, `&&`, env expansion) in
  the command; they need a wrapper script.
- **Bad:** a configured command runs with the user's permissions and can be
  changed only through plugin config, not the panel.
- **Bad:** the panel cannot know whether the editor is installed; a failed spawn
  surfaces as an error notice.

## Alternatives

- **One shell string:** rejected; the cwd would need quoting and the shell would
  parse user config, which is a larger injection surface.
- **Detect installed editors and hard-code:** rejected; too many editors and
  wrapper scripts.
- **Open the DSH editor tab:** deferred; the file sidebar has no path-targeted
  open API yet.
