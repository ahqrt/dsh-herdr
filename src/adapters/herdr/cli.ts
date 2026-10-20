// The herdr CLI transport primitives: spawn the native binary, enforce the
// version floor, parse the JSON envelope, map errors onto our vocabulary.
//
// This is the only module in the plugin that knows the CLI's output shapes.
// The CLI is the public contract; the private socket protocol is deliberately
// not used (see docs/adr/0001-cli-over-socket.md).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { HerdrError, type ErrorCode } from "../../domain/errors.js";
import { err, ok, type Result } from "../../domain/result.js";
import { floorError, parseVersion, type HerdrProbe } from "../../domain/version.js";

const IS_WIN = process.platform === "win32";

export interface CliOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** The command prints plain text on success (agent read, status, --version). */
  text?: boolean;
  /** The command prints its answer on stderr and exits non-zero (agent help). */
  allowNonZeroText?: boolean;
  /** Internal: the version probe must run below the floor. */
  skipFloorGate?: boolean;
}

/** Resolve the binary: explicit config, $HERDR_BIN, PATH walk, then bare name. */
export function resolveHerdrBin(configured?: string, env: NodeJS.ProcessEnv = process.env): string {
  if (configured && configured !== "herdr") return configured;
  if (env.HERDR_BIN) return env.HERDR_BIN;

  const name = "herdr";
  const extensions = IS_WIN ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  const path = (env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const dir of path) {
    for (const extension of extensions) {
      const candidate = join(dir, extension ? name + extension : name);
      try {
        if (existsSync(candidate)) return candidate;
      } catch {
        /* ignore unreadable directories */
      }
    }
  }
  return name;
}

/** Map a raw herdr error code onto the plugin's stable codes. */
export function mapHerdrCode(raw: unknown): ErrorCode {
  const code = String(raw ?? "").toLowerCase();
  if (code === "agent_blocked") return "AGENT_BLOCKED";
  if (code === "agent_prompt_stalled") return "AGENT_STALLED";
  if (code === "agent_start_failed") return "SPAWN_REFUSED";
  if (code.includes("not_found") || code === "no_such_agent" || code === "no_such_pane") {
    return "AGENT_NOT_FOUND";
  }
  if (code.includes("gone")) return "PANE_GONE";
  if (code.includes("timeout") || code.includes("timed_out")) return "TIMEOUT";
  return "VALIDATION_ERROR";
}

/** Parse the last JSON object in a possibly-mixed output buffer. */
export function parseLastJson(text: string): unknown {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* scan line by line */
  }
  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i] ?? "");
    } catch {
      /* keep scanning */
    }
  }
  return null;
}

interface Envelope {
  error?: { code?: string; message?: string };
  result?: unknown;
}

export class HerdrCli {
  private probeCache: Promise<HerdrProbe> | undefined;

  constructor(
    private readonly bin: string,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** Cached `herdr --version`; `refresh` re-runs it (doctor, session start). */
  probe(refresh = false): Promise<HerdrProbe> {
    if (!refresh && this.probeCache) return this.probeCache;
    this.probeCache = this.run(["--version"], {
      text: true,
      timeoutMs: 3_000,
      skipFloorGate: true,
    }).then((result): HerdrProbe => {
      if (!result.ok) return { state: "missing" };
      const version = parseVersion(typeof result.data === "string" ? result.data : "");
      return version ? { state: "ok", version } : { state: "unknown" };
    });
    return this.probeCache;
  }

  /** Gated exec: refuses below the floor, then runs. */
  async exec<T = unknown>(args: string[], options: CliOptions = {}): Promise<Result<T>> {
    if (!options.skipFloorGate) {
      const gate = floorError(await this.probe());
      if (gate) return gate;
    }
    return this.run<T>(args, options);
  }

  /** Sensible default timeouts per command family. */
  async execWithDefaultTimeout<T = unknown>(
    args: string[],
    options: CliOptions = {},
  ): Promise<Result<T>> {
    return this.exec<T>(args, { timeoutMs: defaultTimeoutFor(args), ...options });
  }

  private run<T>(args: string[], options: CliOptions): Promise<Result<T>> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    return new Promise<Result<T>>((resolve) => {
      let child;
      try {
        child = spawn(this.bin, args, {
          shell: false,
          windowsHide: true,
          env: this.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (error) {
        resolve(
          err("HERDR_UNAVAILABLE", `failed to spawn herdr: ${messageOf(error)}`, {
            remediation: "check herdrBin / HERDR_BIN",
          }),
        );
        return;
      }

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finish = (result: Result<T>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };

      const kill = () => {
        try {
          child.kill("SIGTERM");
        } catch {
          /* already gone */
        }
      };

      const timer = setTimeout(() => {
        kill();
        finish(
          err("TIMEOUT", `herdr ${args.join(" ")} timed out after ${timeoutMs}ms`, {
            remediation: "retry with a larger timeout, or inspect the pane with herdr_list_agents",
          }),
        );
      }, timeoutMs);

      const onAbort = () => {
        kill();
        finish(err("ABORTED", `herdr ${args.join(" ")} aborted`));
      };

      if (options.signal) {
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener("abort", onAbort, { once: true });
      }

      child.stdout?.on("data", (chunk: Buffer | string) => {
        stdout += String(chunk);
      });
      child.stderr?.on("data", (chunk: Buffer | string) => {
        stderr += String(chunk);
      });

      child.on("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        finish(
          code === "ENOENT"
            ? err("HERDR_UNAVAILABLE", "herdr binary not found on PATH", {
                remediation: "install herdr, or set herdrBin / HERDR_BIN to its absolute path",
              })
            : err("HERDR_UNAVAILABLE", `failed to run herdr: ${messageOf(error)}`),
        );
      });

      child.on("close", (exitCode) => {
        let parsed = parseLastJson(stdout) as Envelope | null;
        if (parsed === null && exitCode !== 0) {
          const alternative = parseLastJson(stderr) as Envelope | null;
          if (alternative && typeof alternative === "object" && "error" in alternative) {
            parsed = alternative;
          }
        }

        if (parsed === null) {
          if (exitCode === 0 && !stdout.trim() && !stderr.trim()) {
            finish(ok({} as T));
            return;
          }
          if (options.text && exitCode === 0 && stdout.trim()) {
            finish(ok(stdout as unknown as T));
            return;
          }
          if (options.allowNonZeroText && (stdout.trim() || stderr.trim())) {
            finish(ok((stdout.trim() || stderr) as unknown as T));
            return;
          }
          const firstError = stderr.split(/\r?\n/).find((line) => line.trim());
          finish(
            err(
              "HERDR_PROTOCOL",
              firstError
                ? `herdr error: ${firstError.trim()}`
                : "herdr returned unparseable output",
              { details: { exitCode, stderr, stdout } },
            ),
          );
          return;
        }

        if (parsed.error) {
          finish(
            err(mapHerdrCode(parsed.error.code), String(parsed.error.message ?? "herdr error"), {
              details: parsed.error,
            }),
          );
          return;
        }
        finish(ok((parsed.result ?? parsed) as T));
      });
    });
  }
}

function defaultTimeoutFor(args: string[]): number {
  const [group, command] = args;
  if (group === "agent" && (command === "list" || command === "get")) return 10_000;
  if (group === "agent" && command === "read") return 10_000;
  if (group === "workspace" || group === "tab" || group === "pane") return 20_000;
  return 60_000;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
