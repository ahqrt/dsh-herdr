// A minimal client for Herdr's private socket API (protocol 22).
//
// One connection per request, matching Herdr's own agent integration: the
// server is free to close after a response, and a stale multiplexed socket
// would fail mid-fleet. The CLI remains the default transport; this client is
// opt-in and every failure is a typed error the transport can classify.
import net from "node:net";
import { randomUUID } from "node:crypto";
import { HerdrError } from "../../domain/errors.js";
import { mapHerdrCode } from "./cli.js";
export class HerdrSocketClient {
    socketPath;
    constructor(socketPath) {
        this.socketPath = socketPath;
    }
    /** One request; resolves with the command's `result` object. */
    request(method, params = {}, options = {}) {
        const timeoutMs = options.timeoutMs ?? 60_000;
        return new Promise((resolve, reject) => {
            let settled = false;
            let buffer = "";
            let connected = false;
            const id = randomUUID();
            const socket = net.createConnection(this.socketPath);
            const cleanup = () => {
                clearTimeout(timer);
                options.signal?.removeEventListener("abort", onAbort);
                socket.destroy();
            };
            const finish = (action) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                action();
            };
            const timer = setTimeout(() => {
                finish(() => reject(new HerdrError("TIMEOUT", `socket ${method} timed out after ${timeoutMs}ms`, {
                    remediation: "retry with a larger timeout, or use transport=cli",
                })));
            }, timeoutMs);
            const onAbort = () => {
                finish(() => reject(new HerdrError("ABORTED", `socket ${method} aborted`)));
            };
            if (options.signal) {
                if (options.signal.aborted) {
                    onAbort();
                    return;
                }
                options.signal.addEventListener("abort", onAbort, { once: true });
            }
            socket.on("connect", () => {
                connected = true;
                socket.write(`${JSON.stringify({ id, method, params })}\n`);
            });
            socket.on("data", (chunk) => {
                buffer += String(chunk);
                let index = buffer.indexOf("\n");
                while (index >= 0) {
                    const line = buffer.slice(0, index).trim();
                    buffer = buffer.slice(index + 1);
                    if (line) {
                        let parsed = null;
                        try {
                            parsed = JSON.parse(line);
                        }
                        catch {
                            parsed = null;
                        }
                        if (parsed?.id === id) {
                            if (parsed.error) {
                                finish(() => reject(new HerdrError(mapHerdrCode(parsed.error?.code), String(parsed.error?.message ?? "Herdr socket error"), { details: parsed.error })));
                            }
                            else {
                                finish(() => resolve(parsed?.result));
                            }
                            return;
                        }
                    }
                    index = buffer.indexOf("\n");
                }
            });
            socket.on("error", (error) => {
                finish(() => reject(new HerdrError("HERDR_UNAVAILABLE", connected
                    ? `socket write/read failed: ${error.message}`
                    : `cannot connect to ${this.socketPath}: ${error.message}`, {
                    remediation: "open Herdr once so its server is running, or use transport=cli",
                    details: { phase: connected ? "io" : "connect" },
                })));
            });
            socket.on("close", () => {
                finish(() => reject(new HerdrError("HERDR_UNAVAILABLE", "Herdr socket closed before a response", {
                    details: { phase: connected ? "io" : "connect" },
                })));
            });
        });
    }
    close() {
        /* one connection per request; nothing to close */
    }
}
//# sourceMappingURL=socket-client.js.map