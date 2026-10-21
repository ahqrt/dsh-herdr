import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { LocalMachineIo } from "../lib/adapters/machine/local-io.js";
import { SshMachineIo, shellQuote } from "../lib/adapters/machine/ssh-io.js";
import { RemoteGit } from "../lib/adapters/machine/remote-git.js";
import { MachineRuntimePool, parseMachineTargets } from "../lib/adapters/machine/runtime-pool.js";
import { LocalGit } from "../lib/adapters/git/local.js";
import { resolveConfig } from "../lib/defaults.js";
import { resolvePaths } from "../lib/domain/paths.js";

const windows = process.platform === "win32";
const skip = windows && "the SSH bridge uses a POSIX shell";

function fakeSsh(dir) {
  const path = join(dir, "fake-ssh");
  writeFileSync(path, '#!/bin/sh\nshift 7\nexec /bin/sh -lc "$1"\n', "utf8");
  chmodSync(path, 0o755);
  return path;
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-rgit-"));
  const run = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  run("init", "-q");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");
  writeFileSync(join(dir, "a.txt"), "one\n", "utf8");
  run("add", "a.txt");
  run("commit", "-qm", "init");
  return dir;
}

test("LocalMachineIo reads, writes, stats, and creates directories", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-localio-"));
  try {
    const io = new LocalMachineIo();
    assert.equal(await io.readText(join(dir, "missing")), undefined);
    await io.mkdirp(join(dir, "nested"));
    await io.writeText(join(dir, "nested", "a.txt"), "hi");
    assert.equal(await io.readText(join(dir, "nested", "a.txt")), "hi");
    assert.ok((await io.mtime(join(dir, "nested", "a.txt"))) > 0);
    assert.equal(await io.home(), homedir());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("shellQuote survives single quotes", () => {
  assert.equal(shellQuote("plain"), "'plain'");
  assert.equal(shellQuote("a'b"), "'a'\\''b'");
});

test("SshMachineIo runs file operations through ssh", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-sshio-"));
  try {
    const io = new SshMachineIo({ target: "fake", sshBin: fakeSsh(dir), env: process.env });
    assert.equal(await io.home(), homedir());
    await io.mkdirp(join(dir, "nested"));
    await io.writeText(join(dir, "nested", "a.txt"), "remote text");
    assert.equal(await io.readText(join(dir, "nested", "a.txt")), "remote text");
    assert.equal(await io.readText(join(dir, "nested", "missing")), undefined);
    assert.ok((await io.mtime(join(dir, "nested", "a.txt"))) > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("RemoteGit produces the same evidence as LocalGit", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-sshgit-"));
  const work = repo();
  try {
    const ssh = new SshMachineIo({ target: "fake", sshBin: fakeSsh(dir), env: process.env });
    const git = new RemoteGit(ssh);
    const baseline = await git.baseline(work);
    assert.match(baseline.head, /^[0-9a-f]{40}$/);
    assert.deepEqual(baseline.dirty, []);

    writeFileSync(join(work, "a.txt"), "two\n", "utf8");
    writeFileSync(join(work, "b.txt"), "new\n", "utf8");
    const patchPath = join(dir, "diff.patch");
    const diff = await git.diff({ cwd: work, baseline, patchPath, maxBytes: 1_000_000 });
    assert.match(diff.stat, /a\.txt/);
    assert.ok(diff.files.includes("a.txt"));
    assert.ok(diff.untracked.includes("b.txt"));
    assert.match(readFileSync(patchPath, "utf8"), /\+two/);

    const wtPath = join(dir, "wt");
    await git.createWorktree({ repoCwd: work, path: wtPath, branch: "dsh/test" });
    assert.ok(existsSync(join(wtPath, "a.txt")));
    await git.removeWorktree({ repoCwd: work, path: wtPath, force: true });
    assert.equal(existsSync(wtPath), false);
  } finally {
    rmSync(work, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runtime pool resolves SSH, shared, and invalid machines", { skip }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-pool-"));
  try {
    const config = resolveConfig({
      homeDir: join(dir, "home"),
      machines: ["m1", "m3", "m4"],
      machineTargets: ["m1=fake"],
      sharedFilesystem: ["m3"],
      remoteHomeDir: join(dir, "remote"),
    });
    const paths = resolvePaths(config);
    const pool = new MachineRuntimePool({
      config,
      paths,
      localGit: new LocalGit(),
      localIo: new LocalMachineIo(),
      sshBin: fakeSsh(dir),
    });

    const remote = await pool.resolve("m1");
    assert.equal(remote.remote, true);
    assert.equal(remote.machine, "m1");
    assert.equal(remote.artifactsRoot, join(dir, "remote", "tasks"));
    assert.equal(remote.worktreesRoot, join(dir, "remote", "worktrees"));

    const shared = await pool.resolve("m3");
    assert.equal(shared.remote, false);
    assert.equal(shared.artifactsRoot, paths.artifactsRoot);

    await assert.rejects(pool.resolve("m4"), /no file access configured/);
    assert.equal(pool.hasRemoteTarget("m1"), true);
    assert.equal(pool.sharesFilesystem("m3"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("machineTargets rejects malformed entries", () => {
  assert.throws(() => parseMachineTargets(["no-equals"]), /expected label=ssh-target/);
  assert.throws(() => parseMachineTargets(["a=b c"]), /single destination/);
  assert.deepEqual([...parseMachineTargets(["m1=user@host"]).entries()], [["m1", "user@host"]]);
});
