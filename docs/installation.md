# Installation

## Requirements

| | |
|---|---|
| DSH | `0.2.1-rc.2` (desktop runtime or a CLI profile with the same base) |
| Herdr | `>= 0.9.0`; `herdr` on `PATH` |
| pi | only for `kind=pi`; `pi --version` should work in the same shell |
| Node | 22+ (the host provides it; the plugin has no native deps) |

`herdr --version` and `herdr agent list` should succeed before installing. If `herdr` lives outside `PATH`, set `herdrBin` in the config or `HERDR_BIN` in the host environment.

## Desktop app (the `desktop` profile)

The Electron app owns its profile; `dsh plugin --profile desktop …` is rejected by design.

1. Build or fetch the package:
   - tarball: `pnpm pack` → `dsh-herdr-0.5.0.tgz` (or the release asset)
   - link: the absolute checkout path
   - npm: `dsh-herdr@0.5.0` (published)
2. Open **Plugins** in the app sidebar → install.
3. Verify `package.json` in `~/.dsh/profiles/desktop/` lists `dsh-herdr` under `dependencies` **and** `dsh.profile.bundles`.
4. The patch row appears in the composed profile:

   ```text
   - id: tool-herdr
     name: dsh-herdr
   ```

5. Start a new session. `herdr_doctor` should be callable.

HMR usually applies a new profile layer live. If the tools do not appear, restart the app; a stale module graph is the common cause.

### Uninstall

Remove the plugin from the Plugins page. This removes the bundle layer and the dependency. It does **not** delete `~/.dsh/herdr/` (state, audit, artifacts); delete that directory manually if you want a clean slate.

## CLI profile (development / headless)

```bash
# 1. create a profile from the web template
dsh --profile herdr-dev --from-default-profile web --dump-config

# 2. install from npm, or a checkout
dsh plugin --profile herdr-dev add dsh-herdr

# 3. run on a throwaway port
dsh --profile herdr-dev --port 0 --no-open
```

The `add` command reconciles `dsh.profile.bundles` automatically because the package declares `dsh.bundle.patch`.

## From a checkout

```bash
git clone https://github.com/ahqrt/dsh-herdr.git
cd dsh-herdr
pnpm install
pnpm build
pnpm test
pnpm pack
```

The tarball contains `lib/`, `cordis.patch.yml`, `skill/`, `schema/`, and the docs needed at install time. `lib/` is generated; commit it only if you publish from git tags without a build step (the release workflow builds).

## Transport

`transport: cli` (default) uses the documented CLI only. `auto` tries the local
Herdr socket for each call and degrades to CLI when it cannot connect; `socket`
is strict. The socket is local-only; remote machines always use `--machine`.

Remote spawn needs file access: either `machineTargets: ["label=user@host"]`
(SSH, key auth, `BatchMode=yes`) or a mounted filesystem (`sharedFilesystem`).
The SSH bridge reads artifacts, the pi session, and the diff without a mount.

## Optional: install the delegation skill

The package ships a DSH skill that teaches the review loop and the alias rules. The tools already encode the policy in their descriptions; the skill reinforces it across sessions.

```bash
# adjust the profile name if you installed elsewhere
ln -s ~/.dsh/profiles/desktop/node_modules/dsh-herdr/skill ~/.agents/skills/herdr-delegation
```

The skill appears in a new session's skill list as `herdr-delegation`.

## Verifying the install

```text
herdr_doctor
```

Expected shape:

```text
herdr doctor: OK
[ok  ] enabled: true
[ok  ] herdr: client 0.9.4 (floor 0.9.0)
[ok  ] server: running · 0.9.1 · protocol 22
[ok  ] agent kinds: 24: pi, claude, codex, …
[ok  ] default kind: pi
[ok  ] aliases: 10 alias(es) from ~/.pi/agent/model-aliases.md
[ok  ] default model: flash → commandcode/deepseek/deepseek-v4.1-flash
[ok  ] state dirs: ~/.dsh/herdr writable
[ok  ] topology: workspace (DSH not inside a Herdr pane)
[ok  ] pi: 1.3.0
```

A `warn` is acceptable; a `fail` names the fix in the `next` block.

## First delegation

```text
Ask DSH: "Use herdr_doctor, then delegate to pi/flash a task that prints the
current date and writes it to /tmp/herdr-smoke.txt. Show me the result."
```

You should see: a new tab in the `DSH · <repo>` workspace, a pi pane, the task running, and a tool result with the exact final message and a diff (if the cwd is a git repo).

## Environment variables

| Variable | Effect |
|---|---|
| `HERDR_BIN` | Override the herdr binary. Config `herdrBin` wins when set to a non-default path. |
| `HERDR_ENV` / `HERDR_PANE_ID` | Injected by Herdr. Presence switches `topology=auto` to `split` mode. |
| `PI_HERDR_*` | Not used by this plugin; they belong to the pi extension. |

## Upgrading

1. Read [CHANGELOG.md](../CHANGELOG.md).
2. Update the package from the Plugins page (or `dsh plugin --profile <name> update dsh-herdr`).
3. Run `herdr_doctor`.
4. The state file is forward-compatible within `schemaVersion: 1`; a bump ships a migration.

## Rolling back

Pin the previous version in the Plugins page. The state file is not migrated in place destructively; a newer version may add fields, which older versions ignore.
