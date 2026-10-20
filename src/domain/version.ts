// The herdr version floor — pure classification, no I/O.
//
// We refuse to run tools against herdr < 0.9.0: that is the release whose
// `agent start --kind` contract the spawn path depends on. One explicit
// HERDR_TOO_OLD error beats a half-working fleet.

import { err, type Result } from "./result.js";

export interface HerdrVersion {
  major: number;
  minor: number;
  patch: number;
}

export type HerdrProbe =
  | { state: "ok"; version: HerdrVersion }
  | { state: "missing" }
  | { state: "unknown" };

export const MIN_HERDR_VERSION: HerdrVersion = { major: 0, minor: 9, patch: 0 };
export const HERDR_UPGRADE_POINTER = "https://herdr.dev";

/** Parse the first MAJOR.MINOR.PATCH out of a `herdr --version` string. */
export function parseVersion(text: string): HerdrVersion | null {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(text ?? "");
  return match
    ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
    : null;
}

export function formatVersion(version: HerdrVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/** True when the version is at or above MAJOR.MINOR (patch ignored). */
export function isAtLeast(version: HerdrVersion | null, major: number, minor: number): boolean {
  if (!version) return false;
  return version.major > major || (version.major === major && version.minor >= minor);
}

/**
 * The floor verdict: null means "run it". `missing` also returns null so the
 * natural HERDR_UNAVAILABLE error is the single failure, not two.
 */
export function floorError(probe: HerdrProbe): Result<never> | null {
  if (probe.state === "missing") return null;
  const need = `dsh-herdr requires herdr >= ${formatVersion(MIN_HERDR_VERSION)} — upgrade from ${HERDR_UPGRADE_POINTER}, then reopen the pane.`;
  if (probe.state === "unknown") {
    return err(
      "HERDR_TOO_OLD",
      `herdr is installed but its version could not be determined, and ${need}`,
      { remediation: `run \`herdr --version\` and upgrade if it is below ${formatVersion(MIN_HERDR_VERSION)}` },
    );
  }
  if (!isAtLeast(probe.version, MIN_HERDR_VERSION.major, MIN_HERDR_VERSION.minor)) {
    return err("HERDR_TOO_OLD", `herdr ${formatVersion(probe.version)} is too old: ${need}`, {
      remediation: `upgrade herdr (${HERDR_UPGRADE_POINTER})`,
      details: probe,
    });
  }
  return null;
}

/** Narrow a raw agent status string onto the herdr state machine. */
export function normalizeStatus(value: unknown): import("./types.js").HerdrAgentStatus | undefined {
  switch (value) {
    case "idle":
    case "working":
    case "blocked":
    case "done":
    case "unknown":
      return value;
    default:
      return undefined;
  }
}
