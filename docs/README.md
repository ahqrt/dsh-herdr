# Documentation

| Doc | What it answers |
|---|---|
| [Architecture](architecture.md) | Layers, lifecycle, persistence, invariants, extension points. |
| [Installation](installation.md) | Desktop, CLI profile, checkout, verification, upgrade, rollback. |
| [Configuration](configuration.md) | Every key, defaults, aliases, topology, concurrency. |
| [Tools](tools.md) | Parameters, returns, protocol headers, truncation. |
| [Result contract](result-contract.md) | `AgentResult` fields, derivation, versioning. |
| [Security](security.md) | Trust boundaries, threats, residual risk, reporting. |
| [Troubleshooting](troubleshooting.md) | Error codes, symptoms, logs. |
| [Compatibility](compatibility.md) | Support policy, tested matrix, deprecation. |
| [FAQ](faq.md) | Design questions users actually ask. |
| [Design decisions](design-decisions/) | ADRs for the choices that constrain the code. |
| [Roadmap](../ROADMAP.md) | What is deliberately not here yet. |
| [Changelog](../CHANGELOG.md) | What changed, and how to migrate. |

## Reading order

- **User**: README → Installation → Configuration → Tools.
- **Reviewer of a delegation**: Result contract → Security.
- **Contributor**: Architecture → ADRs → CONTRIBUTING → the module map.
- **Operator**: Troubleshooting → Compatibility → audit/state layout.
