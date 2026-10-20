#!/usr/bin/env node
// A deterministic stand-in for the herdr CLI, used by the integration test.
// It keeps a tiny state file (FAKE_HERDR_STATE) and a pi session file
// (FAKE_HERDR_SESSION) so the real spawn/harvest code paths run unchanged.

import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { dirname } from "node:path";

const argv = process.argv.slice(2);
const statePath = process.env.FAKE_HERDR_STATE;
const sessionPath = process.env.FAKE_HERDR_SESSION;
const touchFile = process.env.FAKE_HERDR_TOUCH;

function load() {
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return { agents: {}, panes: {}, nextPane: 1, nextTab: 1 };
  }
}
function save(state) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}
function out(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function fail(code, message) {
  process.stdout.write(JSON.stringify({ error: { code, message } }) + "\n");
  process.exit(1);
}
function agentView(a) {
  return {
    agent: a.kind,
    agent_status: a.status,
    cwd: a.cwd,
    focused: false,
    name: a.name,
    pane_id: a.paneId,
    tab_id: a.tabId,
    workspace_id: "w1",
    terminal_title: `${a.kind} - ${a.cwd}`,
    agent_session:
      a.kind === "pi" && a.sessionPath
        ? { source: "herdr:pi", agent: "pi", kind: "path", value: a.sessionPath }
        : undefined,
  };
}

if (argv[0] === "--version") {
  process.stdout.write("herdr 0.9.4\n");
  process.exit(0);
}

if (argv[0] === "status") {
  process.stdout.write("server:\n  status: running\n  version: 0.9.4\n  protocol: 22\n");
  process.exit(0);
}

if (argv[0] === "agent" && argv.length === 1) {
  process.stderr.write("herdr agent commands:\n  herdr agent list\nkinds: pi|agy|claude\n");
  process.exit(2);
}

const state = load();

if (argv[0] === "agent" && argv[1] === "list") {
  out({ result: { agents: Object.values(state.agents).map(agentView) } });
  process.exit(0);
}

if (argv[0] === "agent" && argv[1] === "get") {
  const target = argv[2];
  const agent = Object.values(state.agents).find((a) => a.name === target || a.paneId === target);
  if (!agent) fail("not_found", `no agent ${target}`);
  out({ result: { agent: agentView(agent) } });
  process.exit(0);
}

if (argv[0] === "agent" && argv[1] === "start") {
  const name = argv[2];
  const kind = argv[argv.indexOf("--kind") + 1] || "pi";
  const paneId = argv[argv.indexOf("--pane") + 1];
  const agent = {
    name,
    kind,
    paneId,
    tabId: "w1:t2",
    cwd: process.env.FAKE_HERDR_CWD || process.cwd(),
    status: "idle",
    sessionPath: kind === "pi" ? sessionPath : undefined,
  };
  state.agents[name] = agent;
  save(state);
  out({ result: { agent: agentView(agent) } });
  process.exit(0);
}

if (argv[0] === "agent" && argv[1] === "prompt") {
  const target = argv[2];
  const text = argv[3] || "";
  const agent = Object.values(state.agents).find((a) => a.name === target || a.paneId === target);
  if (!agent) fail("not_found", `no agent ${target}`);

  agent.status = "working";
  save(state);

  // Simulate the child doing the work: one file edit + a result.md + a pi
  // session with the exact final message.
  if (touchFile) appendFileSync(touchFile, "agent change\n");
  const resultPath = /Write (\S+\/result\.md)/.exec(text)?.[1];
  if (resultPath) {
    mkdirSync(dirname(resultPath), { recursive: true });
    writeFileSync(
      resultPath,
      [
        "---",
        "status: completed",
        "summary: fake agent finished the task",
        "tests: none",
        "files: work.txt",
        "---",
        "Fake detail body.",
      ].join("\n"),
    );
  }
  if (sessionPath) {
    mkdirSync(dirname(sessionPath), { recursive: true });
    const lines = [
      { type: "session", version: 3, id: "fake", cwd: agent.cwd },
      { type: "message", message: { role: "user", content: text } },
      {
        type: "message",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "COMPLETE: fake agent finished the task" }],
          usage: { output: 11 },
        },
      },
    ];
    writeFileSync(sessionPath, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  }

  agent.status = "idle";
  save(state);
  out({ result: { agent: agentView(agent) } });
  process.exit(0);
}

if (argv[0] === "agent" && argv[1] === "read") {
  process.stdout.write("fake pane tail\nall good\n");
  process.exit(0);
}

if (argv[0] === "workspace" && argv[1] === "list") {
  out({ result: { workspaces: [] } });
  process.exit(0);
}

if (argv[0] === "workspace" && argv[1] === "create") {
  state.workspace = { workspace_id: "w1", label: argv[argv.indexOf("--label") + 1] };
  save(state);
  out({
    result: {
      workspace: { workspace_id: "w1", label: state.workspace.label },
      tab: { tab_id: "w1:t1" },
      root_pane: { pane_id: "w1:p1" },
    },
  });
  process.exit(0);
}

if (argv[0] === "tab" && argv[1] === "create") {
  state.nextTab = (state.nextTab || 1) + 1;
  const tabId = `w1:t${state.nextTab}`;
  const paneId = `w1:p${state.nextTab + 10}`;
  state.panes[paneId] = { pane_id: paneId, tab_id: tabId };
  save(state);
  out({ result: { tab: { tab_id: tabId }, root_pane: { pane_id: paneId } } });
  process.exit(0);
}

if (argv[0] === "pane" && argv[1] === "split") {
  state.nextPane = (state.nextPane || 1) + 1;
  const paneId = `w1:p${state.nextPane}`;
  out({ result: { pane: { pane_id: paneId, tab_id: "w1:t1", workspace_id: "w1" } } });
  process.exit(0);
}

if (argv[0] === "pane" && argv[1] === "close") {
  const paneId = argv[2];
  for (const [name, agent] of Object.entries(state.agents)) {
    if (agent.paneId === paneId) delete state.agents[name];
  }
  save(state);
  out({ result: {} });
  process.exit(0);
}

if (argv[0] === "pane" && argv[1] === "list") {
  out({ result: { panes: Object.values(state.panes) } });
  process.exit(0);
}

if (argv[0] === "agent" && argv[1] === "send-keys") {
  out({ result: {} });
  process.exit(0);
}

fail("validation_error", `fake-herdr: unsupported command ${argv.join(" ")}`);
