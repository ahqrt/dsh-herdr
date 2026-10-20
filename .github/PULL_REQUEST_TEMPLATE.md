## What changed

<!-- One paragraph. Link the issue if there is one. -->

## Why

<!-- The workflow or bug this unblocks. -->

## How it was verified

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] Booted a profile with the plugin (`dsh --profile … --port 0 --no-open`)
- [ ] Manual delegation, if the change touches spawn/harvest/message

## Compatibility

- [ ] No public surface change (tool names, parameters, `AgentResult`, config keys, error codes)
- [ ] Additive change, documented in CHANGELOG
- [ ] Breaking change with a migration note

## Architecture checklist

- [ ] Dependency rule holds (`tools → services → ports ← adapters`; domain imports no DSH)
- [ ] No new runtime dependency (or a note explaining why)
- [ ] New behavior has a test that fails without the change
- [ ] Docs updated (`docs/tools.md`, `docs/result-contract.md`, `docs/troubleshooting.md` as applicable)
