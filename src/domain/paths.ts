// Filesystem locations and path predicates. Everything the plugin writes
// lives under the user's DSH home, never in the project checkout.

import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { DEFAULT_CONFIG, type PluginConfig } from "../defaults.js";

export interface Paths {
  root: string;
  stateFile: string;
  artifactsRoot: string;
  worktreesRoot: string;
  auditFile: string;
  aliasesFile: string;
}

/** Expand a leading `~` and resolve to an absolute path. */
export function expandHome(value: string, home = homedir()): string {
  if (!value) return value;
  if (value === "~") return home;
  if (value.startsWith("~/") || value.startsWith("~\\")) return join(home, value.slice(2));
  return isAbsolute(value) ? value : resolve(value);
}

export function resolvePaths(config: Partial<PluginConfig>): Paths {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const root = expandHome(merged.homeDir);
  return {
    root,
    stateFile: resolveUnder(root, merged.stateFile),
    artifactsRoot: resolveUnder(root, merged.artifactsRoot),
    worktreesRoot: resolveUnder(root, merged.worktreesRoot),
    auditFile: resolveUnder(root, merged.auditFile),
    aliasesFile: expandHome(merged.aliasesFile),
  };
}

/** Resolve a config path: `~` absolute, absolute stays, relative joins root. */
function resolveUnder(root: string, value: string): string {
  if (!value) return root;
  if (value.startsWith("~")) return expandHome(value);
  return isAbsolute(value) ? value : join(root, value);
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Stable key for a working directory (used to reuse the DSH workspace). */
export function repoKey(cwd: string): string {
  return resolve(cwd);
}

/** The workspace label DSH uses for a repository. */
export function workspaceLabel(template: string, cwd: string): string {
  const repo = basename(resolve(cwd)) || "workspace";
  return String(template || "DSH · {repo}").replaceAll("{repo}", repo);
}

/** True when `child` is `root` or below it (no `..` escape). */
export function isWithin(child: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(child));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
