import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HerdrCli, mapHerdrCode, parseLastJson } from "../lib/adapters/herdr/cli.js";
import { HerdrCliTransport, normalizeAgent } from "../lib/adapters/herdr/transport.js";

const here = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
const fake = join(here, "fixtures", "fake-herdr.mjs");

function withFake(fn) {
  const root = mkdtempSync(join(tmpdir(), "herdr-cli-"));
  chmodSync(fake, 0o755);
  const env = {
    ...process.env,
    HERDR_BIN: fake,
    FAKE_HERDR_STATE: join(root, "state.json"),
    FAKE_HERDR_SESSION: join(root, "session.jsonl"),
    HERDR_ENV: "0",
  };
  return Promise.resolve(fn({ root, env })).finally(() =>
    rmSync(root, { recursive: true, force: true }),
  );
}

test("parseLastJson takes the last JSON object in mixed output", () => {
  assert.deepEqual(parseLastJson('starting\n{"id":"cli:a","result":{"ok":1}}\n'), {
    id: "cli:a",
    result: { ok: 1 },
  });
  assert.equal(parseLastJson("plain text"), null);
  assert.equal(parseLastJson(""), null);
});

test("mapHerdrCode maps the codes the CLI actually emits", () => {
  assert.equal(mapHerdrCode("agent_blocked"), "AGENT_BLOCKED");
  assert.equal(mapHerdrCode("agent_prompt_stalled"), "AGENT_STALLED");
  assert.equal(mapHerdrCode("no_such_pane"), "AGENT_NOT_FOUND");
  assert.equal(mapHerdrCode("pane_gone"), "PANE_GONE");
  assert.equal(mapHerdrCode("timeout"), "TIMEOUT");
  assert.equal(mapHerdrCode("whatever"), "VALIDATION_ERROR");
});

test("normalizeAgent maps the live snake_case shape", () => {
  const agent = normalizeAgent({
    agent: "pi",
    agent_status: "idle",
    cwd: "/repo",
    focused: true,
    pane_id: "wV:p2",
    tab_id: "wV:t1",
    workspace_id: "wV",
    agent_session: {
      source: "herdr:pi",
      agent: "pi",
      kind: "path",
      value: "/Users/apple/.pi/agent/sessions/x.jsonl",
    },
  });
  assert.equal(agent.paneId, "wV:p2");
  assert.equal(agent.kind, "pi");
  assert.equal(agent.status, "idle");
  assert.equal(agent.sessionPath, "/Users/apple/.pi/agent/sessions/x.jsonl");
  assert.equal(agent.sessionKind, "path");
  assert.deepEqual(normalizeAgent(null), {});
});

test("HerdrCli probes the version and parses agent list JSON", { skip: windows && "fake herdr needs a POSIX shebang" }, async () => {
  await withFake(async ({ env }) => {
    const cli = new HerdrCli(fake, env);
    const probe = await cli.probe();
    assert.equal(probe.state, "ok");
    assert.equal(probe.version.minor, 9);

    const list = await cli.exec(["agent", "list"]);
    assert.equal(list.ok, true);
    assert.deepEqual(list.data.agents, []);
  });
});

test("HerdrCli reads the kind list from the non-zero `herdr agent` help", { skip: windows && "fake herdr needs a POSIX shebang" }, async () => {
  await withFake(async ({ env }) => {
    const transport = new HerdrCliTransport(new HerdrCli(fake, env));
    assert.deepEqual(await transport.kinds(), ["pi", "agy", "claude"]);
  });
});

test("HerdrCli returns a typed unavailable error for a missing binary", async () => {
  const cli = new HerdrCli("/nonexistent/herdr", { ...process.env });
  const result = await cli.exec(["agent", "list"]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "HERDR_UNAVAILABLE");
  assert.match(result.error.remediation, /herdrBin/);
});
