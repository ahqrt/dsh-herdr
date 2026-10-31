# AGENTS.md

## Herdr 委派生命周期

本插件把子 agent 开成真实的 Herdr pane。Herdr 是常驻 server，布局落盘并在每次启动时恢复；
插件没有 reaper，历史 task 记录也没有对账机制。**所以关闭动作必须由发起委派的 agent 自己负责。**

约定：

- 每批委派结束（完成 / 失败 / 超时 / 被中断）立即 `herdr_close_agent`；仍处于 `working` 的用 `force: true`。
- 不要把 pane 留作“下次复用”。需要追问时用 `herdr_message_agent` 在原 pane 里问，**问完仍然关掉**。
- 一个 repo 收工后关闭对应的 `DSH · <repo>` workspace：`herdr workspace close <workspace_id>`。
- 只关插件自己创建的 pane（`herdr_close_agent` 会拒绝其他来源）；用户手动打开的 workspace/pane 不要动。
- 失败路径同样要收尾：`spawn-failed` 可能已经建出了 workspace，确认后关掉。

## 为什么是这样

- `topology: "auto"` 在 GUI 里（没有 `HERDR_ENV`）落到 `workspace` 模式：**一个 repo 一个 workspace，一个任务一个 tab**（见 `src/services/topology.ts`）。这是有意设计，不是 bug。
- `subagent-provider` 的 `dispose()` 会 interrupt + force close pane，但只覆盖 native subagent 路径；工具路径（`herdr_spawn_agent`）故意保留 pane 以便后续读取。
- 没有 reconcile / prune：pane 已经消失的 task 记录仍会留在 `state.json` 里。

## 收尾核对

- `herdr workspace list` —— 看是否还有 `DSH · <repo>` 的残留 tab。
- `~/.dsh/herdr/state.json` —— `tasks` / `workspaces` 不清会持续增长；清理前先备份，产物目录 `tasks/` 建议归档而不是删除。
