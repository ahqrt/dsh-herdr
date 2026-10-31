# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.12.0] - 2026-10-25

### Added

- **运行流程（panel `flow` 标签页）。** 之前面板只有 `final` / `diff` / `result`，
  一个还在跑或中途失败的子 agent 只显示 `(no final message yet)`，看不到它做过什么。
  新标签页把 `herdr_read_agent` 读的那份 pi session 逐 turn 展开：prompt、assistant
  文本、每次工具调用（名称 + 参数预览，如 bash 命令）、每条工具结果（错误标记和耗时）。
  默认打开最新一页，`earlier` 往前翻，子 agent 处于 `starting/working/running/blocked`
  时每 4 秒跟随刷新，已翻到的旧页不会被丢弃；可以整份 `copy flow`。
- **`GET /herdr/api/transcript`**：`target` 必填，`from` / `limit`（上限 100）/ `tail=1`
  可选，返回 `total`、`nextFrom`、`prevFrom`。只读、同源，复用 `TranscriptService`，
  因此远程任务走同一条 SSH/mount 文件通道。
- **失败原因直接可见。** `GET /herdr/api/task` 现在带 `error`；点开 `failed` 的行默认
  落到 `flow`，`final` 标签页显示记录的失败原因（例如 Herdr server 没启动），而不是空白。

### Changed

- **面板 UI 重做。** 窄栏改为主从视图（列表 ⇄ 详情，≥680px 才左右并排），去掉 45/55
  分栏和未选中时的空详情列；头部收敛为 `AGENTS` + 计数 + 连接点 + 刷新 + 一行搜索，
  去掉 Owned / Grouped / Select 三个开关（列表全量平铺，批量选择与底部操作条一并下线）；
  列表行改为状态点 + 名称 + 状态词 + `kind · model · 路径 · 时长`；详情为下划线 tab +
  `⋯` 菜单。所有颜色改用宿主真 token `--dsw-alias-*`（原来的 `--dsh-*` 并不存在，
  一直落到硬编码回退）。
- **图标优先的视图工具条。** flow 只保留刷新和复制两个图标（`earlier` 移到列表顶部
  `Load earlier turns`，follow 改为始终跟随）；diff / result / final / 实时 tail 同样
  提供刷新与复制图标；diff 的空状态会说明没有 patch 的原因。
- `TranscriptMessage.toolCalls` 从 `string[]` 变为 `{ name, detail }[]`；`tool` 角色
  携带 `toolName` / `isError` / `durationMs`。`herdr_read_agent` 的文本渲染同步更新
  （工具调用单独一行，带参数预览）。
- `NO_TRANSCRIPT` 的报错现在区分「没有 session 文件」和「文件不可读」，并附上任务记录的
  `error`，方便判断是 spawn 失败还是 kind 不支持。

### Fixed

- **卡在 `working` 的任务永不结算。** spawn 调用中途被杀（会话中断、窗口关闭）时，
  记录停在 `working` 且没有 `sessionPath`，即使 pane 早已 `done`、`result.md` 也写了。
  fleet 列表现在对未结算记录做对账：已 prompt 过、live pane 报 `done` 时回写
  `completed` + `settledAt` + `sessionPath`，并记 `settle-recovered` 审计事件。
- **`NO_TRANSCRIPT` 误报 “no pi session file”。** 记录缺 `sessionPath` 时，现在会向
  当前 live pane 取 session 路径并回填后再读；`close` 在销毁 pane 前也会先保存该指针，
  force close 不再永久丢失转录入口。
- 面板状态语义修正：`working` 用 accent、`blocked` 用 warn、`failed` 用 err、
  `done` 用 ok、`idle` / `unknown` 用 muted（此前 `idle` 被当成成功色）。

### Verification

- 面板在 360 / 520 / 920px 三种宽度下渲染核对；空状态、详情、flow、diff、result、
  实时 tail 与 `⋯` 菜单均截图验证，无横向溢出。
- 对真实卡死记录做只读对账验证：`lemo-cinema` / `lemo-paper` 由 `working` 落为
  `completed` 并补齐 session；flow 可读 79 / 119 轮。
- `pnpm test`：127 个测试通过，新增覆盖 transcript 领域（工具调用预览、toolResult 字段）、
  `/herdr/api/transcript`（分页、tail、404/409）和面板 `mergeFlow` / `formatFlowText`；
  面板重做与对账修复后共 132 个用例（新增 `test/reconcile.test.mjs` 覆盖结算对账、
  close 保留 session、transcript 回填）。
- 用真实 session 回放 `sound-critic`（28 turn）：能看到一次 bash 20s 超时、`result.md`
  写入、以及最后的结论；`audio-review`（spawn 时 Herdr server 未启动）返回
  `NO_TRANSCRIPT` 并带出原始错误。
- **未做**：在桌面版 GUI 里点击验证 —— 新增的服务端路由要重启应用才注册，页面刷新只更新前端。

## [0.11.2] - 2026-10-25

### Fixed

- **DSH `0.2.1-rc.3` 上被宿主禁用。** 宿主自 `0.2.1-alpha.4` 起判定插件兼容性时只读
  `engines.dsh`，而声明是精确的 `0.2.1-rc.2`，于是 rc.3 下插件行被禁用、bundle 层被
  静默跳过（桌面版启动日志：`Plugin dsh-herdr@0.11.1 is incompatible with dsh
  0.2.1-rc.3: requirements {"engines.dsh":"0.2.1-rc.2"}`）。rc.3 相对 rc.2 对插件使用的
  接口没有改动（新增的是 side-right / header 等插槽，由官方插件注册）。
- 兼容声明从精确版本改为同通道区间 `>=0.2.1-rc.2 <0.2.2-0`：`engines.dsh`、
  `dsh.compatibility.dsh` 与 `@deepseek-ai/dsh-tools` peer 三处统一。上界必须是
  `<0.2.2-0`——按 semver 优先级 `0.2.2-rc.1 < 0.2.2`，写成 `<0.2.2` 会放行下一个
  minor 的预发布，`~0.2.1-rc.2`（等价 `>=0.2.1-rc.2 <0.3.0`）同样过宽。
- `dsh.compatibility.dshReleases` 增加 `0.2.1-rc.3` 一条实测记录（准入由区间负责，
  记录只列跑过预检的版本）。

### Verification

- 桌面版（dsh `0.2.1-rc.3`，pnpm `11.28.5`）执行插件安装后，兼容性预检不再对
  `dsh-herdr` 报警。
- **未做**：rc.3 上的 headless 九工具矩阵复跑；rc.3 的运行时行为按「rc.2 已验证 +
  rc.3 无相关接口变更」推断，未实测。

## [0.11.1] - 2026-10-22

### Fixed

- Desktop install instructions: the app's plugin manager takes an npm package
  name, GitHub URL, or local **directory**, not a local `.tgz` path. Documented
  the exact Plugins → Add plugin flow and the tarball limitation.

## [0.11.0] - 2026-10-21

### Added

- **Open editor**: an `editor` panel action spawns a configured command with
  argv and the task cwd (no shell). `editorCommand`/`editorArgs` config; the
  button is hidden while the command is empty.
- **Packet history**: the last three copied packets are selectable from a
  history dropdown.
- **Keyboard navigation**: fleet rows are focusable; ArrowUp/ArrowDown moves
  between rows and Enter/Space selects.

## [0.10.0] - 2026-10-21

### Added

- **Packet templates**: PR comment (full), issue (metadata + summary + final,
  diff omitted), and summary (compact).
- **Fleet grouping**: group by machine + status with one toggle.
- **Reveal cwd**: open an owned task's working directory in the OS file manager
  (`POST /herdr/api/action` action `reveal`); the path comes from the task record,
  never from the request body.

## [0.9.0] - 2026-10-21

### Added

- **Fleet search**: filter by name, cwd, kind, model, or task id.
- **Copy review packet**: one Markdown block with task metadata, summary,
  final message, diff, and `result.md`.
- **Copy cwd** from the task detail for opening the worktree elsewhere.
- Task detail now exposes the `result.md` summary separately.

## [0.8.0] - 2026-10-21

### Added

- **Read-only live tails**: selecting an agent this plugin did not spawn shows
  its pane tail (`GET /herdr/api/live`), with no action controls.
- **Bulk actions**: check owned tasks in the fleet and interrupt or close them
  with one confirmation; partial failures are reported per task.
- **Diff affordances**: hunk headers are highlighted, and the patch or a single
  file can be copied from the panel.

## [0.7.0] - 2026-10-21

### Added

- **Panel actions**: interrupt and close owned tasks from the fleet detail,
  with the same ownership gates as the tools; close asks for confirmation and
  force-closes the pane while retaining the session file.
- **Fleet filters**: owned/all toggle and a machine selector.
- **Diff navigation**: per-file sections with add/delete counts, collapsible
  bodies, and a raw/structured toggle.
- `POST /herdr/api/action` (JSON + `x-herdr-panel: 1`, same-origin) returning
  the lifecycle error code on refusal.

## [0.6.0] - 2026-10-21

### Added

- **Web panel**: a `Herdr` right-sidebar tab and guide entry showing the live
  fleet plus a selected task's final message, `result.md`, and diff. Read-only.
- `GET /herdr/api/health`, `/herdr/api/fleet`, `/herdr/api/task` (same-origin,
  no-store) behind the existing DSH web server.
- Client bundle (`lib/client.js`) and `dsh.client` metadata.

## [0.5.1] - 2026-10-21

### Changed

- Release-infrastructure verification for OIDC trusted publishing; no runtime
  code changes.

## [0.5.0] - 2026-10-21

### Added

- **Native subagent provider** `herdr`: register with `ctx.subagents` so a
  `@deepseek-ai/dsh-tool-subagent` row with `provider: herdr` routes through
  Herdr and gets the native catalog, cards, and cancellation.
- `nativeSubagent` and `subagentName` config keys; the provider is disabled by
  default only when `nativeSubagent: false`.
- Provider startup maps `start` to a non-blocking spawn; the result promise
  resolves from the Herdr settle + harvest (`stop`, `error`, `aborted`), and
  `dispose()` interrupts then closes the owned pane.

## [0.4.0] - 2026-10-21

### Added

- **SSH file bridge** for remote machines: `machineTargets: ["label=user@host"]`
  gives `spawn`/`harvest`/`inbox`/`transcript`/worktree access to the remote
  filesystem without a local mount. Artifacts and pi sessions are read over
  SSH; the diff patch is written locally for review.
- `remoteHomeDir` (default `~/.dsh/herdr`) for remote task/worktree roots.
- Doctor reports each machine's file access (`ssh`, `mounted`, or missing).

### Changed

- Remote spawn no longer requires `sharedFilesystem`; a mount is now the
  fallback when no SSH target is configured.
- SSH runs with `BatchMode=yes`; password prompts fail fast instead of hanging.

## [0.3.1] - 2026-10-21

### Fixed

- Correct the install version references in the README and docs shipped in the
  0.3.0 tarball. No code changes.

## [0.3.0] - 2026-10-21

### Added

- Opt-in **socket transport** (`transport: auto | cli | socket`): one connection
  per request over Herdr's Unix socket, with a CLI fallback when the socket
  cannot be reached. `agent.wait` is now server-side instead of polled.
- **Remote machines**: `machine` on spawn/list/result/message, `machines` and
  `sharedFilesystem` config, `--machine` forwarding, per-machine registry
  namespaces, and doctor checks. Remote spawn requires the remote filesystem to
  be mounted locally; remote observation and messaging work without it.

### Changed

- `herdr_get_agent_result(wait:true)` and `waitForSettle` use the server-side
  `agent wait` / socket `agent.wait` instead of a 700ms poll.
- Doctor reports configured machines and their reachability.

## [0.2.0] - 2026-10-20

### Added

- `herdr_inbox`: consume child → DSH messages from `inbox.ndjson`, with a
  long-poll `wait` and per-task read offsets (no replay).
- `herdr_read_agent`: page through a pi session transcript, turn by turn, with
  the tool calls each turn made.
- Spawn queue: over the concurrency cap, a spawn waits up to `queueTimeoutMs`
  for a slot instead of failing immediately; `queuedMs` is reported.
- `isolated: true`: run a task in a fresh git worktree (`dsh/<taskId>`), return
  its path, and optionally remove it on close (`remove_worktree: true`).
- `timing.queuedMs` and `worktree` in the result contract.

### Changed

- `herdr_spawn_agent` no longer rejects at the cap; it queues. The error now
  names the wait and the running agents.
- `herdr_close_agent` accepts `remove_worktree`.

## [0.1.0] - 2026-10-20

### Added

- Seven tools: `herdr_spawn_agent`, `herdr_get_agent_result`,
  `herdr_message_agent`, `herdr_list_agents`, `herdr_interrupt_agent`,
  `herdr_close_agent`, `herdr_doctor`.
- Exact pi result extraction from the session JSONL, with a freshness check
  against the prompt timestamp.
- `result.md` artifact contract for every kind; pane tail as the honest fallback.
- Git baseline at spawn and a bounded patch at harvest.
- Dedicated `DSH · <repo>` workspace with one tab per task; sibling split when
  DSH runs inside Herdr.
- Cross-process task registry with atomic writes, a stale-aware lock, and a
  corrupt-file quarantine.
- Model alias resolution from `~/.pi/agent/model-aliases.md`, with explicit
  kind capability rules (`pi` accepts model/thinking, `agy` refuses both).
- Idempotent spawns via `client_task_id`; concurrency cap; cwd allowlist.
- Typed error codes with remediation, structured audit log, and `herdr_doctor`.
- TypeScript source with a dependency-rule architecture, 66 tests including an
  end-to-end suite against a fake Herdr CLI, CI matrix, and release workflow.

### Known limitations

- No inbound push from child to DSH; the synchronous result is the channel.
- No queue above `maxParallelAgents`; over-cap spawns are refused.
- No per-task git worktree; no remote `--machine` forwarding.
- Non-pi kinds return pane text, not a structured transcript.
