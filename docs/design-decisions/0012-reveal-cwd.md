# ADR 0012 — Reveal cwd, not open a file tab

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The roadmap wanted "open the task cwd in the file sidebar". The DSH file sidebar
opens **workspaces**, and its files tab takes no path parameter; a
`dsh-resource://file/<dir>` address lands in the document preview, which cannot
show a directory. Shipping a button that silently opens the wrong surface is
worse than not shipping it.

## Decision

- Add a `reveal` panel action instead: `POST /herdr/api/action` with
  `{ action: "reveal", target }`.
- The path always comes from the task record's `cwd`; the request body cannot
  supply one. The record must exist (owned), and `stat` must confirm a directory.
- `RevealService` launches the platform opener (`open`, `explorer.exe`,
  `xdg-open`) detached, with argv only and no shell. Tests inject the opener and
  never launch a file manager.
- The panel still offers **copy cwd** for users who want to paste it elsewhere.

## Consequences

- **Good:** the button does exactly what it says, with no path injection surface.
- **Good:** it works on all three desktop platforms without knowing the DSH
  workspace model.
- **Bad:** it is a side effect on the user's desktop; a malicious same-origin
  script could pop a Finder/Explorer window for an owned cwd.
- **Bad:** it does not select the file in a tree or open an editor.
- **Bad:** revealing a remote task's cwd opens a local path that may not exist;
  the `stat` gate refuses it.

## Alternatives

- **`openTab("files", { params: { path } })`:** rejected; the files type ignores
  path params, so it would open the workspace root.
- **`openResource("dsh-resource://file/<dir>")`:** rejected; the document
  preview cannot render a directory.
- **Open in editor:** deferred to 0.11 with an explicit configurable command.
