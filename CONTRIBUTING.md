# Contributing

Thanks for helping. This project has one non-negotiable design rule:

> `tools → services → ports ← adapters`, with `domain` usable by every layer. No adapter imports a service; no service imports an adapter; no domain module imports DSH.

If a change breaks that rule, it is the wrong change even if the tests pass.

## Setup

```bash
git clone https://github.com/ahqrt/dsh-herdr.git
cd dsh-herdr
pnpm install
pnpm build
pnpm test
```

Requirements: Node 22+, pnpm 11+, git (for the git tests). Herdr is **not** required for the test suite: the integration tests use a fake CLI.

## What to run before a PR

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # build + the full suite
```

If you touched the tool schemas, also boot a profile:

```bash
dsh --profile herdr-dev --from-default-profile web --dump-config
dsh plugin --profile herdr-dev add file:$PWD
dsh --profile herdr-dev --port 0 --no-open
```

A successful boot means the DSH schema compiler accepted every tool and parameter.

## Where changes belong

| Change | Touch |
|---|---|
| A new tool | `src/tools/*`, `src/tools/index.ts`, `src/tools/shared.ts` renderer, `test/tools.test.mjs` |
| A new service use case | `src/services/*`, a unit test with `MemoryTaskStore` + a fake transport |
| A new Herdr call/response shape | `src/ports/transport.ts` then `src/adapters/herdr/transport.ts` |
| A new kind with native flags | `src/domain/launch.ts` (`kindCaps`, `buildAgentArgs`) + tests |
| A new result field | `src/domain/types.ts`, harvest, renderer, `docs/result-contract.md`, `schema/agent-result.schema.json` |
| A new error | `src/domain/errors.ts`, `docs/troubleshooting.md`, a test |

## Tests

- Unit tests use `node:test` and live in `test/*.test.mjs`, importing the **built** `lib/` (run `pnpm build` first).
- The fake Herdr CLI is `test/fixtures/fake-herdr.mjs`; it keeps state in a temp directory. Do not make it depend on a live Herdr session.
- Integration tests skip on Windows because the fake CLI needs a POSIX shebang.
- Every behavior change needs a test that fails before it. A schema change needs the `additionalProperties` walker to stay green.

## Style

- TypeScript, `strict: true`, ESM, `.js` extensions in relative imports (NodeNext).
- No runtime dependencies. A new dependency needs a strong reason and a note in the PR.
- Prefer a named port over a reach-around. If a service needs a new capability, extend the port.
- Comments explain **why** a constraint exists, not what the next line does.
- Keep the tool descriptions model-facing: imperative, specific about when **not** to use the tool.

## Commits and PRs

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
- One logical change per PR; include the test and the doc update.
- PR body: what changed, why, how it was verified, and any compatibility impact.

## Adding a kind (checklist)

1. Add the kind to `kindCaps` with the flags it actually accepts.
2. Update `buildAgentArgs` only if the kind has a documented model/thinking flag.
3. Add a launch test and a fake-herdr path if the launch shape differs.
4. Update the kind table in `docs/compatibility.md`.
5. If the kind exposes a transcript path, extend `HarvestService` with a tested extractor; otherwise it uses pane tail and the docs say so.

## Releases

Maintainers: bump `version`, update `CHANGELOG.md`, tag `vX.Y.Z`. The release workflow builds, tests, publishes to npm with provenance, and creates a GitHub release. `schemaVersion` changes need a migration note.
