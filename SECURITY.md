# Security policy

## Supported versions

| Version | Supported |
|---|---|
| `0.1.x` | yes |

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on
[ahqrt/dsh-herdr](https://github.com/ahqrt/dsh-herdr/security/advisories/new).
Do not open a public issue for a security problem.

Include:

- affected version, DSH version, Herdr version, OS;
- a minimal reproduction (task id, tool call, relevant `audit.ndjson` lines);
- impact: what the plugin allows that it should not.

## Response

- Acknowledgment within 5 business days.
- A fix or a mitigation plan within 30 days for confirmed issues.
- Credit in the advisory unless you ask otherwise.

## Scope

In scope:

- pane ownership bypass (mutating a pane the plugin did not create);
- command/config injection through tool arguments or config;
- escaping `allowCwd`;
- auto-answering a `blocked` agent;
- secret leakage through results, audit, or logs.

Out of scope:

- a child agent doing what its model was told (that is the feature);
- prompt injection through reviewed content (documented as residual risk);
- vulnerabilities in DSH, Herdr, pi, or the provider APIs;
- running the desktop app as root.
