import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalGit } from "../lib/adapters/git/local.js";

const git = new LocalGit();

function run(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-git-"));
  run(dir, "init", "-q");
  run(dir, "config", "user.email", "test@example.com");
  run(dir, "config", "user.name", "Test");
  writeFileSync(join(dir, "a.txt"), "one\n", "utf8");
  run(dir, "add", "a.txt");
  run(dir, "commit", "-qm", "init");
  return dir;
}

test("non-repos are reported honestly", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-nogit-"));
  try {
    assert.equal(await git.isRepo(dir), false);
    assert.equal(await git.baseline(dir), undefined);
    assert.equal(
      await git.diff({ cwd: dir, patchPath: join(dir, "diff.patch"), maxBytes: 1024 }),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("baseline records head, then diff captures tracked and untracked work", async () => {
  const dir = repo();
  try {
    const baseline = await git.baseline(dir);
    assert.match(baseline.head, /^[0-9a-f]{40}$/);
    assert.deepEqual(baseline.dirty, []);

    writeFileSync(join(dir, "a.txt"), "two\n", "utf8");
    writeFileSync(join(dir, "b.txt"), "new\n", "utf8");
    const outDir = mkdtempSync(join(tmpdir(), "herdr-patch-"));
    const patchPath = join(outDir, "diff.patch");
    const diff = await git.diff({ cwd: dir, baseline, patchPath, maxBytes: 1_000_000 });

    assert.match(diff.stat, /a\.txt/);
    assert.ok(diff.files.includes("a.txt"));
    assert.ok(diff.files.includes("b.txt"));
    assert.ok(diff.untracked.includes("b.txt"));
    const patch = readFileSync(patchPath, "utf8");
    assert.match(patch, /-one/);
    assert.match(patch, /\+two/);
    assert.match(patch, /untracked files not included/);
    assert.equal((await git.status(dir)).length, 2);
    rmSync(outDir, { recursive: true, force: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a committed agent change still shows against the baseline", async () => {
  const dir = repo();
  try {
    const baseline = await git.baseline(dir);
    writeFileSync(join(dir, "a.txt"), "committed\n", "utf8");
    run(dir, "commit", "-qam", "agent change");
    const diff = await git.diff({
      cwd: dir,
      baseline,
      patchPath: join(dir, "d.patch"),
      maxBytes: 1_000_000,
    });
    assert.match(diff.stat, /a\.txt/);
    assert.match(diff.stat, /1 file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("huge patches are truncated", async () => {
  const dir = repo();
  try {
    const baseline = await git.baseline(dir);
    writeFileSync(join(dir, "big.txt"), "x".repeat(5000) + "\n", "utf8");
    run(dir, "add", "big.txt");
    writeFileSync(join(dir, "big.txt"), "y".repeat(5000) + "\n", "utf8");
    const diff = await git.diff({
      cwd: dir,
      baseline,
      patchPath: join(dir, "d.patch"),
      maxBytes: 100,
    });
    assert.equal(diff.truncated, true);
    assert.match(readFileSync(join(dir, "d.patch"), "utf8"), /patch truncated/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
