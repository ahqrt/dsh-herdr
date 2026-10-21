import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HerdrSocketClient } from "../lib/adapters/herdr/socket-client.js";
import { HerdrSocketTransport } from "../lib/adapters/herdr/socket-transport.js";

function startServer(handler) {
  const dir = mkdtempSync(join(tmpdir(), "herdr-socket-"));
  const path = join(dir, "herdr.sock");
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      let index = buffer.indexOf("\n");
      while (index >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (line) {
          try {
            handler(JSON.parse(line), socket);
          } catch {
            /* ignore bad test input */
          }
        }
        index = buffer.indexOf("\n");
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(path, () => resolve({ dir, path, server, sockets }));
  });
}

function stop({ server, sockets, dir }) {
  for (const socket of sockets) socket.destroy();
  return new Promise((resolve) => {
    server.close(() => {
      rmSync(dir, { recursive: true, force: true });
      resolve();
    });
  });
}

test("socket client multiplexes requests and parses results", async () => {
  const holder = await startServer((request, socket) => {
    if (request.method === "agent.list") {
      socket.write(
        JSON.stringify({
          id: request.id,
          result: {
            type: "agent_list",
            agents: [{ agent: "pi", agent_status: "idle", pane_id: "w1:p1" }],
          },
        }) + "\n",
      );
    } else if (request.method === "agent.get") {
      socket.write(
        JSON.stringify({
          id: request.id,
          result: { agent: { agent: "pi", agent_status: "working", pane_id: "w1:p1" } },
        }) + "\n",
      );
    }
  });
  const client = new HerdrSocketClient(holder.path);
  try {
    const [list, get] = await Promise.all([
      client.request("agent.list", {}),
      client.request("agent.get", { target: "w1:p1" }),
    ]);
    assert.equal(list.agents.length, 1);
    assert.equal(list.agents[0].pane_id, "w1:p1");
    assert.equal(get.agent.agent_status, "working");
  } finally {
    client.close();
    await stop(holder);
  }
});

test("socket errors map onto the plugin code set", async () => {
  const holder = await startServer((request, socket) => {
    socket.write(
      JSON.stringify({
        id: request.id,
        error: { code: "agent_blocked", message: "needs approval" },
      }) + "\n",
    );
  });
  const client = new HerdrSocketClient(holder.path);
  try {
    await assert.rejects(client.request("agent.prompt", {}), (error) => {
      assert.equal(error.code, "AGENT_BLOCKED");
      assert.match(error.message, /needs approval/);
      return true;
    });
  } finally {
    client.close();
    await stop(holder);
  }
});

test("socket requests time out with a typed error", async () => {
  const holder = await startServer(() => {
    /* never answer */
  });
  const client = new HerdrSocketClient(holder.path);
  try {
    await assert.rejects(client.request("agent.list", {}, { timeoutMs: 150 }), (error) => {
      assert.equal(error.code, "TIMEOUT");
      return true;
    });
  } finally {
    client.close();
    await stop(holder);
  }
});

test("socket transport maps domain calls and events", async () => {
  const seen = [];
  const holder = await startServer((request, socket) => {
    seen.push(request);
    const replies = {
      "agent.list": { agents: [{ agent: "pi", agent_status: "idle", pane_id: "w1:p1" }] },
      "agent.get": { agent: { agent: "pi", agent_status: "blocked", pane_id: "w1:p1" } },
      "agent.read": { read: { text: "pane text" } },
      "agent.wait": {},
      "agent.prompt": {},
      "pane.split": { pane: { pane_id: "w1:p9", tab_id: "w1:t1", workspace_id: "w1" } },
      "workspace.list": { workspaces: [{ workspace_id: "w1", label: "DSH · repo" }] },
      "workspace.create": {
        workspace: { workspace_id: "w2" },
        tab: { tab_id: "w2:t1" },
        root_pane: { pane_id: "w2:p1" },
      },
      "tab.create": { tab: { tab_id: "w2:t2" }, root_pane: { pane_id: "w2:p2" } },
      "pane.close": {},
      "agent.send_keys": {},
    };
    socket.write(JSON.stringify({ id: request.id, result: replies[request.method] ?? {} }) + "\n");
  });

  const fallback = {
    probe: async () => ({ state: "ok", version: { major: 0, minor: 9, patch: 4 } }),
    serverStatus: async () => "running",
    kinds: async () => ["pi"],
    listAgents: async () => [{ name: "fallback" }],
  };
  const client = new HerdrSocketClient(holder.path);
  const transport = new HerdrSocketTransport(client, fallback, "auto");
  try {
    assert.deepEqual(
      (await transport.listAgents()).map((agent) => agent.paneId),
      ["w1:p1"],
    );
    assert.equal((await transport.getAgent("w1:p1")).status, "blocked");
    assert.equal(await transport.readAgent("w1:p1", { lines: 2 }), "pane text");
    await transport.waitForAgent("w1:p1", { until: ["idle"], timeoutMs: 1000 });
    assert.equal(
      await transport.promptAgent("w1:p1", "hi", { wait: true, timeoutMs: 1000 }),
      "submitted",
    );
    assert.equal(
      (await transport.splitPane("w1:p1", { direction: "right", cwd: "/repo" })).paneId,
      "w1:p9",
    );
    assert.equal((await transport.listWorkspaces())[0].workspaceId, "w1");
    assert.equal((await transport.createWorkspace({ cwd: "/repo", label: "x" })).workspaceId, "w2");
    assert.equal(
      (await transport.createTab({ workspaceId: "w2", cwd: "/repo", label: "x" })).paneId,
      "w2:p2",
    );
    await transport.closePane("w1:p9");
    await transport.sendKeys("w1:p1", ["esc"]);

    const read = seen.find((request) => request.method === "agent.read");
    assert.equal(read.params.source, "recent_unwrapped");
    const split = seen.find((request) => request.method === "pane.split");
    assert.equal(split.params.target_pane_id, "w1:p1");
  } finally {
    client.close();
    await stop(holder);
  }
});

test("auto mode degrades to CLI when the socket cannot connect", async () => {
  const fallback = {
    listAgents: async () => [{ name: "fallback-agent" }],
    getAgent: async () => ({ name: "fallback-agent" }),
  };
  const transport = new HerdrSocketTransport(
    new HerdrSocketClient(join(tmpdir(), "definitely-missing-herdr.sock")),
    fallback,
    "auto",
  );
  const agents = await transport.listAgents();
  assert.equal(agents[0].name, "fallback-agent");
});
