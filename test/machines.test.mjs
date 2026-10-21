import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HerdrCli } from "../lib/adapters/herdr/cli.js";
import { HerdrCliTransport } from "../lib/adapters/herdr/transport.js";
import { MachineTransportPool } from "../lib/adapters/transport-pool.js";
import { resolveConfig } from "../lib/defaults.js";

function fakeBinary(dir) {
  const path = join(dir, "fake-herdr.mjs");
  writeFileSync(
    path,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.ARGV_FILE, process.argv.slice(2).join(" "));
process.stdout.write('{"result":{}}\\n');
`,
    "utf8",
  );
  chmodSync(path, 0o755);
  return path;
}

test("HerdrCli prefixes --machine except for the local version probe", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-machine-"));
  try {
    const bin = fakeBinary(dir);
    const argvFile = join(dir, "argv.txt");
    const env = { ...process.env, ARGV_FILE: argvFile };

    const cli = new HerdrCli(bin, env, "m1");
    const result = await cli.exec(["agent", "list"], { skipFloorGate: true });
    assert.equal(result.ok, true);
    assert.equal(readFileSync(argvFile, "utf8"), "--machine m1 agent list");

    await cli.probe(true);
    assert.equal(readFileSync(argvFile, "utf8"), "--version");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("transport pool resolves configured machines and rejects unknown ones", () => {
  const config = resolveConfig({ machines: ["m1"], sharedFilesystem: ["m1"] });
  const local = { name: "local" };
  const remote = { name: "remote" };
  const pool = new MachineTransportPool(local, config, (machine) => ({ ...remote, machine }));
  assert.equal(pool.local().name, "local");
  assert.equal(pool.resolve().name, "local");
  assert.equal(pool.resolve("local").name, "local");
  assert.equal(pool.resolve("m1").machine, "m1");
  assert.equal(pool.sharesFilesystem("m1"), true);
  assert.equal(pool.sharesFilesystem("m2"), false);
  assert.throws(() => pool.resolve("m2"), /not enabled/);
});
