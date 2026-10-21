---
name: herdr-delegation
description: "Delegate a subtask to a Herdr-managed coding agent (pi/agy/claude/codex), with an explicit model, when the user asks for Herdr/pi/a pane/a model alias or an independent review. Covers model aliases, the review loop, blocked agents, and pane ownership. Requires the herdr_* tools from dsh-herdr."
---

# Herdr 委派

只在**用户明确要求**时使用：点名 Herdr / pi / pane / 模型别名（`grok4.7`、`gpt6sol`、`opus5`、`flash`…），或明确要一个独立 review。

不要因为「多一个模型更稳」就自己加戏。能在当前会话做的事，不要委派。

## 1. 选 kind 和模型

- 用户说 `agy` → `kind: "agy"`。**不要传 `model` / `thinking`**，agy 会拒绝；它自己的 flag 走 `agent_args`。
- 其它短名 → `model` 传别名即可，插件按 `~/.pi/agent/model-aliases.md` 解析；`grok4.7[high]` → `model: "grok4.7", thinking: "high"`。
- 短名不在别名表里 → 先跑 `pi --list-models <关键词>` 查真实 `provider/model`；查不到问用户，不要猜。
- 别名表是**计费边界**：标了 xAI 订阅的不要发到 commandcode。

如果配置了原生的 `herdr_subagent` 工具（`dsh-tool-subagent` + `provider: herdr`），简单的独立任务可以用它，DSH 会显示原生 subagent 卡片；需要 diff、session、artifact 或 blocked 问题时仍用 `herdr_spawn_agent`。

## 2. 派活

```text
herdr_spawn_agent({
  prompt: "<目标 + 约束 + 验收标准 + 要跑什么测试>",
  kind: "pi",
  model: "grok4.7",
  thinking: "high",
  cwd: "<当前项目绝对路径>",
  role: "worker" | "reviewer",
  client_task_id: "<可选，重试幂等>"
})
```

- 任务要自包含：子 agent 看不到本会话的上下文。
- review 任务用 `role: "reviewer"`，并在 prompt 里写清「只读、不改文件」。
- 默认 `wait: true`。返回 `running` 时，用 `herdr_get_agent_result({wait:true})` 继续等，**不要重投**。

## 3. 验收

- 看 `finalMessage`、`diff`、`tests`、`resultPath`、`warnings`。
- 结论要基于证据：文件、行号、测试输出。
- reviewer 的 findings 格式：`[severity] path:line — issue — why — evidence`；BLOCKER / MAJOR / MINOR / NIT；不确定标 UNSURE；不要凑数。

## 4. 回传和修复

把 findings 发回**同一个 worker**：

```text
herdr_message_agent({
  target: "<worker 名字>",
  kind: "REVIEW_FINDINGS",
  round: 1,
  message: "<findings>"
})
```

它改完后重新取结果、重新看 diff。最多 2 轮；还不过就交给用户裁决。

## 5. 收消息和翻记录

- `herdr_inbox({wait:true})` 可以等子 agent 的 `BLOCKED` / `REVIEW_REQUEST` / `COMPLETE` 消息；读过的不会重放。
- 最终答复不够时，用 `herdr_read_agent({target, from, limit})` 按 turn 翻 pi session，看它实际跑了什么命令。
- 长任务或并行改同一仓库时，spawn 加 `isolated:true`，它在独立 worktree 里跑，结果带 `worktree` 路径；确认后再合并，清理用 `herdr_close_agent({remove_worktree:true})`。

## 6. 远程机器

- 只有 `machines` 里配置过的 label 才能用；传 `machine` 给 spawn/list/get_result/message。
- 远程 **spawn** 需要文件访问：`machineTargets: ["label=user@host"]`（SSH，需 key auth）或 `sharedFilesystem`（本地挂载）。SSH 桥会直接读写远端 artifact/session，不需要挂载。
- 任务记录会记住 machine，后续 `get_result` / `close` 不用再传。

## 7. blocked

`status: "blocked"` 表示子 agent 在等审批或提问。

1. 用 `ask_user_question` 把问题原样问人。
2. 用 `herdr_message_agent` 把人的回答发回去。
3. **绝不自己批准。**

## 8. 中断和收尾

- 只想停当前 turn：`herdr_interrupt_agent`（发 Escape，pane 和 session 保留）。
- pane 默认留着，用户明确说关才 `herdr_close_agent`。
- 只关 `owned: true` 的 pane；用户自己开的 pane 不碰。
- 任务产物在 `~/.dsh/herdr/tasks/<taskId>/`（`result.md`、`diff.patch`、`prompt.md`）。

## 9. 独立 review 的独立性

跨家族才算独立：grok（xAI）× gpt（OpenAI）× claude（Anthropic）。同家族互审只是重复劳动。

两边都出结果之前，不要把一方的结论发给另一方，避免锚定。DSH 做最终裁决。
