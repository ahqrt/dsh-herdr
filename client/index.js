// Herdr fleet panel — right-sidebar tab + guide entry.
//
// Plain ESM inside DSH's client module wrapper. Reads come from /herdr/api;
// actions POST to /herdr/api/action with the panel header, and the host
// re-checks ownership through the lifecycle service before touching a pane.

window.__ModuleLoader__.load({
  id: "dsh-herdr",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useRef, useState } = React;

    // DSH theme tokens (--dsw-alias-*). Every value keeps a dark fallback so a
    // missing host token never turns the panel into hardcoded grey.
    const T = {
      layer: "var(--dsw-alias-bg-layer-2, #232326)",
      line: "var(--dsw-alias-border-l3, #303034)",
      lineStrong: "var(--dsw-alias-border-l2, #3c3c41)",
      text: "var(--dsw-alias-label-primary, #e9e9ec)",
      mid: "var(--dsw-alias-label-secondary, #b2b2b8)",
      mut: "var(--dsw-alias-label-tertiary, #85858c)",
      accent: "var(--dsw-alias-link, #7ea6f0)",
      hover: "var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,.055))",
      active: "var(--dsw-alias-interactive-bg-active, rgba(255,255,255,.09))",
      ok: "var(--dsw-alias-state-success-primary, #62c07f)",
      warn: "var(--dsw-alias-state-warn-primary, #d9a557)",
      err: "var(--dsw-alias-state-error-primary, #e2707a)",
      mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
    };

    const styles = {
      root: { display: "flex", flexDirection: "column", height: "100%", minWidth: 0, font: "12px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif", color: T.text },
      head: { display: "flex", flexDirection: "column", gap: 8, padding: "10px 12px 8px", borderBottom: `1px solid ${T.line}` },
      headRow: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
      kicker: { fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: T.mut },
      count: { fontSize: 11, color: T.mut, fontVariantNumeric: "tabular-nums" },
      muted: { color: T.mut },
      search: { display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, height: 28, padding: "0 8px", border: `1px solid ${T.line}`, borderRadius: 7, color: T.mut },
      input: { flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", color: T.text, font: "inherit", fontSize: 12 },
      chip: { display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 8px", border: `1px solid ${T.line}`, borderRadius: 6, background: "transparent", color: T.mid, font: "inherit", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" },
      button: { display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 8px", border: `1px solid ${T.line}`, borderRadius: 6, background: "transparent", color: T.mid, font: "inherit", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" },
      buttonOn: { borderColor: T.accent, color: T.text, background: T.active },
      danger: { color: T.err },
      iconBtn: { display: "grid", placeItems: "center", width: 24, height: 24, padding: 0, border: "none", borderRadius: 6, background: "transparent", color: T.mut, cursor: "pointer", flex: "none" },
      select: { height: 24, maxWidth: 120, padding: "0 4px", border: `1px solid ${T.line}`, borderRadius: 6, background: "transparent", color: T.mid, font: "inherit", fontSize: 11.5 },
      notice: { padding: "6px 12px", fontSize: 11, borderBottom: `1px solid ${T.line}` },
      body: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      bodyWide: { flex: 1, minHeight: 0, display: "flex", flexDirection: "row" },
      list: { flex: 1, minHeight: 0, overflow: "auto" },
      listWide: { width: 260, flex: "none", minHeight: 0, overflow: "auto", borderRight: `1px solid ${T.line}` },
      detail: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" },
      row: { display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 12px", cursor: "pointer", borderBottom: `1px solid ${T.line}`, minWidth: 0 },
      rowActive: { background: T.active, boxShadow: `inset 2px 0 0 ${T.accent}` },
      dot: { width: 7, height: 7, borderRadius: 999, flex: "none", marginTop: 5 },
      rowMain: { flex: 1, minWidth: 0 },
      rowTop: { display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 },
      rowName: { flex: "1 1 auto", minWidth: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
      rowMeta: { marginTop: 2, fontSize: 11, color: T.mut, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
      rowState: { marginLeft: "auto", flex: "none", fontSize: 10.5, fontWeight: 550, whiteSpace: "nowrap" },
      badge: { display: "inline-block", marginLeft: 6, padding: "0 5px", borderRadius: 999, border: "1px solid currentColor", fontSize: 10, opacity: 0.85 },
      emptyWrap: { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "24px 28px", textAlign: "center" },
      emptyIcon: { color: T.mut, opacity: 0.6 },
      emptyTitle: { fontSize: 12.5, fontWeight: 600, color: T.mid },
      emptyBody: { fontSize: 11.5, lineHeight: 1.7, color: T.mut, maxWidth: 260 },
      empty: { padding: 16, color: T.mut },
      detailHead: { padding: "8px 8px 0 12px", display: "flex", flexDirection: "column", gap: 4 },
      detailTop: { display: "flex", alignItems: "center", gap: 4, minWidth: 0 },
      detailName: { fontSize: 12.5, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 },
      detailMeta: { fontSize: 11, color: T.mut, paddingLeft: 28, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
      tabs: { display: "flex", alignItems: "center", gap: 14, padding: "10px 12px 0", borderBottom: `1px solid ${T.line}`, minWidth: 0 },
      tab: { background: "transparent", border: "none", padding: "0 0 8px", color: T.mut, font: "inherit", fontSize: 12, cursor: "pointer" },
      tabActive: { color: T.text, boxShadow: `inset 0 -2px 0 ${T.accent}` },
      pre: { margin: 0, padding: 12, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", font: `11.5px/1.6 ${T.mono}`, flex: 1, minHeight: 0 },
      file: { borderBottom: `1px solid ${T.line}` },
      fileHead: { padding: "4px 8px", cursor: "pointer", font: `11px/1.5 ${T.mono}` },
      diffLine: { display: "block", whiteSpace: "pre-wrap", wordBreak: "break-word" },
      paneBar: { display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 12px", borderBottom: `1px solid ${T.line}`, minWidth: 0 },
      paneLabel: { fontSize: 11, color: T.mut, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
      link: { background: "transparent", border: "none", padding: 0, color: T.accent, font: "inherit", fontSize: 11.5, cursor: "pointer" },
      flowList: { flex: 1, minHeight: 0, overflow: "auto" },
      flowItem: { padding: "6px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 2 },
      flowHead: { display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
      flowText: { margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", font: `11px/1.55 ${T.mono}` },
      flowCall: { display: "flex", gap: 5, font: `11px/1.5 ${T.mono}`, color: T.accent },
      menuWrap: { position: "relative", marginLeft: "auto", flex: "none" },
      menu: { position: "absolute", right: 0, top: 28, zIndex: 30, minWidth: 196, padding: 4, border: `1px solid ${T.lineStrong}`, borderRadius: 8, background: T.layer, boxShadow: "0 8px 24px rgba(0,0,0,.35)" },
      menuHead: { padding: "4px 8px 2px", fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: T.mut },
      menuItem: { display: "block", width: "100%", padding: "5px 8px", border: "none", borderRadius: 5, background: "transparent", color: T.text, font: "inherit", fontSize: 11.5, textAlign: "left", cursor: "pointer" },
      divider: { height: 1, margin: "4px 2px", background: T.line },
    };

    async function getJson(url) {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
      return body;
    }

    async function postAction(action, payload) {
      const res = await fetch("/herdr/api/action", {
        method: "POST",
        headers: { "content-type": "application/json", "x-herdr-panel": "1" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
      return body.result;
    }

    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }

    /** Turns per transcript request; the server clamps to 100. */
    const FLOW_PAGE = 100;

    function shortClock(value) {
      if (!value) return "";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function roleColor(role) {
      if (role === "user") return T.warn;
      if (role === "tool") return T.ok;
      if (role === "system") return T.mut;
      return T.accent;
    }

    function callLabel(call) {
      return call?.detail ? `${call.name} ${call.detail}` : String(call?.name ?? "tool");
    }

    /**
     * Merge a transcript page into the turns the panel already shows.
     *
     * `earlier` prepends a page the user asked for; `tail` refreshes the last
     * page and keeps everything already loaded above it so paging backwards
     * does not get thrown away by the follow timer.
     */
    function mergeFlow(previous, page, mode) {
      const incoming = page?.messages ?? [];
      if (mode === "replace" || !previous) return { ...page, messages: incoming };
      if (mode === "earlier") {
        const seen = new Set(incoming.map((message) => message.index));
        const merged = [
          ...incoming,
          ...previous.messages.filter((message) => !seen.has(message.index)),
        ];
        return {
          ...previous,
          prevFrom: page.prevFrom,
          total: page.total,
          messages: merged.sort((left, right) => left.index - right.index),
        };
      }
      const start = incoming[0]?.index ?? previous.total;
      const earlier = previous.messages.filter((message) => message.index < start);
      const merged = [...earlier, ...incoming];
      return {
        ...page,
        prevFrom: earlier.length > 0 ? previous.prevFrom : page.prevFrom,
        messages: merged.sort((left, right) => left.index - right.index),
      };
    }

    /** Plain-text transcript, for pasting into a review. */
    function formatFlowText(flow) {
      const lines = [`# Transcript · ${flow.taskId || "task"} · ${flow.total ?? 0} turn(s)`];
      if (flow.sessionPath) lines.push(`session: ${flow.sessionPath}`);
      for (const message of flow.messages ?? []) {
        const flags = [
          message.isError ? "error" : "",
          typeof message.durationMs === "number" ? `${(message.durationMs / 1000).toFixed(1)}s` : "",
        ].filter(Boolean);
        const label = message.role === "tool" && message.toolName
          ? `tool:${message.toolName}`
          : message.role;
        const head = `## [${message.index}] ${label}${flags.length > 0 ? ` (${flags.join(" ")})` : ""}`;
        lines.push("", head, message.text || "");
        for (const call of message.toolCalls ?? []) lines.push(`- → ${callLabel(call)}`);
      }
      return lines.join("\n");
    }

    /** Build a review packet; `template` picks the destination shape. */
    function buildPacket(task, template = "pr") {
      const title = task.name || task.taskId;
      const meta = [
        `- task: ${task.taskId}`,
        `- status: ${task.status}`,
        `- kind/model: ${[task.kind, task.model].filter(Boolean).join(" / ") || "-"}`,
        `- role: ${task.role || "-"}`,
        `- machine: ${task.machine || "local"}`,
        `- cwd: ${task.cwd || "-"}`,
        `- artifact: ${task.artifactDir || "-"}`,
        `- session: ${task.sessionPath || "-"}`,
      ];
      const final = task.finalMessage?.text || "(none)";

      if (template === "summary") {
        return [
          `**${title}** — ${task.status}`,
          "",
          task.summary || final,
          "",
          `cwd: ${task.cwd || "-"}`,
        ].join("\n");
      }

      if (template === "issue") {
        return [
          `## ${title}`,
          "",
          ...meta,
          "",
          "### Summary",
          "",
          task.summary || "(none)",
          "",
          "### Final message",
          "",
          final,
          "",
          "### Evidence",
          "",
          `- artifact: ${task.artifactDir || "-"}`,
          `- session: ${task.sessionPath || "-"}`,
          task.diff?.text ? `- diff: ${task.diff.text.length} bytes (omitted from this template)` : "- diff: none",
        ].join("\n");
      }

      const lines = [
        `# Herdr task: ${title}`,
        "",
        ...meta,
        "",
        "## Summary",
        "",
        task.summary || "(none)",
        "",
        "## Final message",
        "",
        final,
      ];
      if (task.diff?.text) {
        lines.push("", "## Diff", "", "~~~diff", task.diff.text.trim(), "~~~");
      }
      if (task.result?.text) {
        lines.push("", "## result.md", "", task.result.text.trim());
      }
      return lines.join("\n");
    }

    function statusColor(status) {
      if (status === "starting" || status === "working" || status === "running") return T.accent;
      if (status === "blocked") return T.warn;
      if (status === "failed" || status === "gone") return T.err;
      if (status === "completed" || status === "done") return T.ok;
      return T.mut;
    }

    function relativeAge(ms) {
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "";
      if (ms < 60_000) return "just now";
      const minutes = Math.round(ms / 60_000);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours}h`;
      return `${Math.round(hours / 24)}d`;
    }

    /** Keep the two trailing path segments; enough to tell repos apart. */
    function shortCwd(value) {
      if (!value) return "";
      const parts = String(value).split("/").filter(Boolean);
      return parts.slice(-2).join("/");
    }

    function IconSearch() {
      return h("svg", { width: 13, height: 13, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
        h("circle", { cx: 7, cy: 7, r: 4.3, stroke: "currentColor", strokeWidth: 1.4 }),
        h("path", { d: "M10.2 10.2 13.4 13.4", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" }),
      );
    }

    function IconRefresh() {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
        h("path", { d: "M13 8a5 5 0 1 1-1.6-3.7M13 2.8V5.4h-2.6", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    function IconCopy() {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
        h("rect", { x: 5.5, y: 5.5, width: 8, height: 8, rx: 2, stroke: "currentColor", strokeWidth: 1.3 }),
        h("path", { d: "M10.5 5.5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4.5a2 2 0 0 0 2 2h1.5", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" }),
      );
    }

    function IconBack() {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
        h("path", { d: "M9.8 3.6 5.4 8l4.4 4.4", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    function IconDots() {
      return h("svg", { width: 14, height: 14, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true },
        h("circle", { cx: 3.4, cy: 8, r: 1.15 }),
        h("circle", { cx: 8, cy: 8, r: 1.15 }),
        h("circle", { cx: 12.6, cy: 8, r: 1.15 }),
      );
    }

    function IconFleet() {
      return h("svg", { width: 30, height: 30, viewBox: "0 0 32 32", fill: "none", "aria-hidden": true },
        h("rect", { x: 3.5, y: 5.5, width: 25, height: 21, rx: 4.5, stroke: "currentColor", strokeWidth: 1.6 }),
        h("path", { d: "M9 12.5 12.6 16 9 19.5M15.5 19.5h7", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    /** Split a unified diff into per-file sections. */
    function parseDiff(text) {
      const files = [];
      let current = null;
      for (const line of String(text || "").split("\n")) {
        const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
        if (match) {
          current = { path: match[2], lines: [], adds: 0, dels: 0 };
          files.push(current);
          continue;
        }
        if (!current) {
          current = { path: "(patch)", lines: [], adds: 0, dels: 0 };
          files.push(current);
        }
        current.lines.push(line);
        if (line.startsWith("+") && !line.startsWith("+++")) current.adds += 1;
        if (line.startsWith("-") && !line.startsWith("---")) current.dels += 1;
      }
      return files.filter((file) => file.lines.some((line) => line.length > 0));
    }

    function DiffView({ text, onNotice }) {
      const [raw, setRaw] = useState(false);
      const files = useMemo(() => parseDiff(text), [text]);
      const copy = (value, what) => {
        void copyText(value).then((ok) => onNotice(ok ? `copied ${what}` : "copy failed"));
      };
      if (!text) {
        return h("div", { style: styles.emptyWrap },
          h("span", { style: styles.emptyIcon }, h(IconFleet)),
          h("div", { style: styles.emptyTitle }, "No diff captured"),
          h("div", { style: styles.emptyBody },
            "The task ran outside a git repo, changed no tracked files, or never settled — "
            + "the plugin writes the patch when a task settles."),
        );
      }
      return h("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } },
        h("div", { style: styles.paneBar },
          h("span", { style: styles.paneLabel }, `${files.length} file(s)`),
          h("span", { style: { flex: 1 } }),
          h("button", {
            style: styles.iconBtn,
            onClick: () => copy(text, "patch"),
            title: "Copy patch",
            "aria-label": "Copy patch",
          }, h(IconCopy)),
          h("button", {
            style: { ...styles.chip, ...(raw ? { borderColor: T.accent, color: T.text } : {}) },
            onClick: () => setRaw(!raw),
          }, raw ? "Structured" : "Raw"),
        ),
        raw
          ? h("pre", { style: styles.pre }, text)
          : h("div", { style: { overflow: "auto", flex: 1 } },
              files.map((file, index) =>
                h("details", { key: `${file.path}-${index}`, style: styles.file, open: index < 3 },
                  h("summary", { style: styles.fileHead },
                    file.path,
                    h("span", { style: { color: T.ok, marginLeft: 6 } }, `+${file.adds}`),
                    h("span", { style: { color: T.err, marginLeft: 4 } }, `-${file.dels}`),
                    h("span", {
                      style: { marginLeft: 8, opacity: 0.65, cursor: "pointer" },
                      onClick: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        copy(file.lines.join("\n"), file.path);
                      },
                    }, "copy"),
                  ),
                  h("pre", { style: { ...styles.pre, padding: "4px 8px" } },
                    file.lines.map((line, lineIndex) =>
                      h("span", {
                        key: lineIndex,
                        style: {
                          ...styles.diffLine,
                          color: line.startsWith("@@")
                            ? T.accent
                            : line.startsWith("+") && !line.startsWith("+++")
                              ? T.ok
                              : line.startsWith("-") && !line.startsWith("---")
                                ? T.err
                                : line.startsWith("---") || line.startsWith("+++")
                                  ? T.mut
                                  : undefined,
                        },
                      }, line || " "),
                    ),
                  ),
                ),
              ),
            ),
      );
    }

    /** One transcript turn: role, text, and the tool calls it made. */
    function FlowMessage({ message }) {
      const isTool = message.role === "tool";
      const [open, setOpen] = useState(!isTool);
      const body = message.text || "";
      const limit = isTool ? 400 : 1200;
      const long = body.length > limit;
      const shown = open || !long ? body : `${body.slice(0, limit)}\n…`;
      return h("div", { style: { ...styles.flowItem, borderLeft: `2px solid ${roleColor(message.role)}` } },
        h("div", { style: styles.flowHead },
          h("span", { style: { ...styles.badge, color: roleColor(message.role) } },
            isTool && message.toolName ? message.toolName : message.role),
          message.isError ? h("span", { style: { ...styles.badge, color: T.err } }, "error") : null,
          typeof message.durationMs === "number"
            ? h("span", { style: styles.muted }, `${(message.durationMs / 1000).toFixed(1)}s`)
            : null,
          h("span", { style: { flex: 1 } }),
          message.timestamp ? h("span", { style: styles.muted }, shortClock(message.timestamp)) : null,
          h("span", { style: styles.muted }, `#${message.index}`),
        ),
        body
          ? h("pre", { style: styles.flowText }, shown)
          : h("div", { style: styles.muted }, "(no output)"),
        long
          ? h("button", {
              style: { ...styles.button, padding: "0 6px", alignSelf: "flex-start", fontSize: 10 },
              onClick: () => setOpen(!open),
            }, open ? "collapse" : `show all ${body.length} chars`)
          : null,
        (message.toolCalls ?? []).length > 0
          ? h("div", { style: { display: "flex", flexDirection: "column", gap: 1, marginTop: 2 } },
              message.toolCalls.map((call, index) =>
                h("div", { key: index, style: styles.flowCall },
                  h("span", { style: { flex: "0 0 auto" } }, `→ ${call.name}`),
                  call.detail ? h("span", { style: { opacity: 0.72, wordBreak: "break-word" } }, call.detail) : null,
                ),
              ),
            )
          : null,
      );
    }

    /**
     * The run flow: the pi session's turns, newest-page-first loading and a
     * follow timer while the child is still working.
     */
    function FlowView({ flow, loading, error, onRefresh, onEarlier, onCopy }) {
      const scroll = useRef(null);
      const lastIndex = flow?.messages?.[flow.messages.length - 1]?.index ?? -1;
      const previousLast = useRef(-1);

      useEffect(() => {
        const node = scroll.current;
        if (!node) return;
        if (lastIndex > previousLast.current && previousLast.current >= 0) {
          node.scrollTop = node.scrollHeight;
        }
        previousLast.current = lastIndex;
      }, [lastIndex]);

      if (error) return h("div", { style: { ...styles.empty, color: T.err } }, error);
      if (!flow) return h("div", { style: styles.empty }, loading ? "reading transcript…" : "no transcript loaded");

      const first = flow.messages[0]?.index ?? 0;
      const last = flow.messages[flow.messages.length - 1]?.index ?? first;
      const empty = flow.messages.length === 0;
      return h("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } },
        h("div", { style: styles.paneBar },
          h("span", { style: styles.paneLabel },
            empty ? `${flow.total} turns` : `${flow.total} turns · #${first}–#${last}`),
          h("span", { style: { flex: 1 } }),
          h("button", {
            style: styles.iconBtn,
            onClick: () => onRefresh(),
            disabled: loading,
            title: "Reload transcript",
            "aria-label": "Reload transcript",
          }, h(IconRefresh)),
          h("button", {
            style: styles.iconBtn,
            onClick: () => onCopy(),
            title: "Copy transcript",
            "aria-label": "Copy transcript",
          }, h(IconCopy)),
        ),
        empty
          ? h("div", { style: styles.empty }, "This session has no readable turns yet.")
          : h("div", { style: styles.flowList, ref: scroll },
              flow.prevFrom !== undefined
                ? h("div", { style: { padding: "6px 12px" } },
                    h("button", { style: styles.link, onClick: () => onEarlier(), disabled: loading }, "Load earlier turns"),
                  )
                : null,
              flow.messages.map((message) => h(FlowMessage, { key: message.index, message })),
            ),
      );
    }

    function Panel() {
      const [fleet, setFleet] = useState([]);
      const [error, setError] = useState("");
      const [notice, setNotice] = useState("");
      const [selected, setSelected] = useState(null);
      const [detail, setDetail] = useState(null);
      const [live, setLive] = useState(null);
      const [loadingSelected, setLoadingSelected] = useState(false);
      const [tab, setTab] = useState("final");
      const [loading, setLoading] = useState(false);
      const [machine, setMachine] = useState("all");
      const [query, setQuery] = useState("");
      const [template, setTemplate] = useState("pr");
      const [history, setHistory] = useState([]);
      const [flow, setFlow] = useState(null);
      const [flowLoading, setFlowLoading] = useState(false);
      const [flowError, setFlowError] = useState("");
      const flowRef = useRef(null);
      const rootRef = useRef(null);
      const menuRef = useRef(null);
      const [wide, setWide] = useState(false);
      const [menuOpen, setMenuOpen] = useState(false);

      useEffect(() => { flowRef.current = flow; }, [flow]);

      // Narrow sidebar: one pane at a time (fleet ⇄ detail). Wide panel: split.
      useEffect(() => {
        const node = rootRef.current;
        if (!node || typeof ResizeObserver === "undefined") return undefined;
        const observer = new ResizeObserver((entries) => {
          setWide((entries[0]?.contentRect?.width ?? 0) >= 680);
        });
        observer.observe(node);
        return () => observer.disconnect();
      }, []);

      useEffect(() => { setMenuOpen(false); }, [selected]);

      useEffect(() => {
        if (!menuOpen) return undefined;
        const close = (event) => {
          if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
        };
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
      }, [menuOpen]);

      const refresh = useCallback(async () => {
        setLoading(true);
        try {
          const body = await getJson("/herdr/api/fleet");
          setFleet(body.agents || []);
          setError("");
        } catch (e) {
          setError(String(e.message || e));
        } finally {
          setLoading(false);
        }
      }, []);

      useEffect(() => {
        void refresh();
        const timer = setInterval(() => void refresh(), 10000);
        return () => clearInterval(timer);
      }, [refresh]);

      const loadSelected = useCallback(async (row) => {
        if (!row) { setDetail(null); setLive(null); return; }
        setLoadingSelected(true);
        setDetail(null);
        setLive(null);
        try {
          if (row.taskId) {
            const body = await getJson(`/herdr/api/task?target=${encodeURIComponent(row.taskId)}`);
            setDetail(body.task);
          } else {
            const handle = row.name || row.paneId;
            const query = `target=${encodeURIComponent(handle)}${row.machine ? `&machine=${encodeURIComponent(row.machine)}` : ""}`;
            const body = await getJson(`/herdr/api/live?${query}`);
            setLive(body.live);
          }
        } catch (e) {
          setError(String(e.message || e));
        } finally {
          setLoadingSelected(false);
        }
      }, []);

      useEffect(() => { void loadSelected(selected); }, [selected, loadSelected]);

      // The flow belongs to one task; switching rows drops the old transcript.
      useEffect(() => { setFlow(null); setFlowError(""); }, [detail?.taskId]);

      const loadFlow = useCallback(async (target, mode = "tail") => {
        if (!target) return;
        const current = flowRef.current;
        if (mode === "earlier" && current?.prevFrom === undefined) return;
        const params = new URLSearchParams({ target, limit: String(FLOW_PAGE) });
        if (mode === "earlier") params.set("from", String(current.prevFrom));
        else params.set("tail", "1");
        setFlowLoading(true);
        setFlowError("");
        try {
          const body = await getJson(`/herdr/api/transcript?${params.toString()}`);
          setFlow((previous) => mergeFlow(
            previous,
            body.transcript,
            mode === "earlier" ? "earlier" : previous ? "tail" : "replace",
          ));
        } catch (e) {
          setFlowError(String(e.message || e));
        } finally {
          setFlowLoading(false);
        }
      }, []);

      useEffect(() => {
        if (tab !== "flow" || !detail?.taskId) return;
        if (flowRef.current?.taskId === detail.taskId) return;
        void loadFlow(detail.taskId, "tail");
      }, [tab, detail?.taskId, loadFlow]);

      const detailStatus = useMemo(() => {
        const row = fleet.find((entry) => entry.taskId && entry.taskId === detail?.taskId);
        return row?.status || detail?.status;
      }, [fleet, detail?.taskId, detail?.status]);

      // Follow a running child: refresh the last page, keep earlier pages.
      useEffect(() => {
        if (tab !== "flow" || !detail?.taskId) return;
        if (!["starting", "working", "running", "blocked"].includes(detailStatus)) return;
        const timer = setInterval(() => void loadFlow(detail.taskId, "tail"), 4000);
        return () => clearInterval(timer);
      }, [tab, detail?.taskId, detailStatus, loadFlow]);

      const copyPane = useCallback(async (label, text) => {
        if (!text) { setNotice("nothing to copy"); return; }
        const ok = await copyText(text);
        setNotice(ok ? `copied ${label}` : "copy failed");
      }, []);

      const copyFlow = useCallback(async () => {
        const current = flowRef.current;
        if (!current) { setNotice("nothing to copy"); return; }
        const ok = await copyText(formatFlowText(current));
        setNotice(ok ? "copied flow" : "copy failed");
      }, []);

      const machines = useMemo(() => [...new Set(fleet.map((row) => row.machine).filter(Boolean))], [fleet]);
      const rows = useMemo(() => fleet
        .filter((row) => machine === "all" || row.machine === machine)
        .filter((row) => {
          const needle = query.trim().toLowerCase();
          if (!needle) return true;
          return [row.name, row.cwd, row.kind, row.model, row.taskId]
            .some((value) => String(value ?? "").toLowerCase().includes(needle));
        }), [fleet, machine, query]);

      const copyDetail = useCallback(async (what) => {
        if (!detail) return;
        const value = what === "packet" ? buildPacket(detail, template) : detail.cwd;
        if (!value) { setNotice("nothing to copy"); return; }
        const ok = await copyText(value);
        if (ok && what === "packet") {
          setHistory((current) => [
            { template, text: value, at: new Date().toLocaleTimeString() },
            ...current,
          ].slice(0, 3));
        }
        setNotice(ok ? `copied ${what}` : "copy failed");
      }, [detail, template]);

      const copyPacket = useCallback(async (nextTemplate) => {
        if (!detail) return;
        const value = buildPacket(detail, nextTemplate);
        const ok = await copyText(value);
        if (ok) {
          setTemplate(nextTemplate);
          setHistory((current) => [
            { template: nextTemplate, text: value, at: new Date().toLocaleTimeString() },
            ...current,
          ].slice(0, 4));
        }
        setNotice(ok ? `copied ${nextTemplate} packet` : "copy failed");
        setMenuOpen(false);
      }, [detail]);

      const act = useCallback(async (action, payload) => {
        setNotice("");
        setError("");
        try {
          const result = await postAction(action, payload);
          setNotice(result?.message || `${action} ok`);
          await refresh();
          if (action === "close") { setSelected(null); setDetail(null); }
        } catch (e) {
          setError(String(e.message || e));
        }
      }, [refresh]);

      const renderRow = (row) => {
        const active = selected && (selected.taskId || selected.paneId) === (row.taskId || row.paneId);
        const meta = [row.kind, row.model, shortCwd(row.cwd), relativeAge(row.ageMs)].filter(Boolean).join(" · ");
        return h("div", {
          key: `${row.taskId || row.paneId || row.name}-${row.kind}`,
          "data-herdr-row": "1",
          tabIndex: 0,
          style: { ...styles.row, ...(active ? styles.rowActive : {}) },
          onClick: () => { setMenuOpen(false); setSelected(row); setTab(row.status === "failed" ? "flow" : "final"); },
          onMouseEnter: (event) => { if (!active) event.currentTarget.style.background = T.hover; },
          onMouseLeave: (event) => { if (!active) event.currentTarget.style.background = "transparent"; },
          onKeyDown: (event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const rowEls = [...document.querySelectorAll("[data-herdr-row]")];
              const index = rowEls.indexOf(event.currentTarget);
              rowEls[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.currentTarget.click();
            }
          },
          onFocus: (event) => { event.currentTarget.style.outline = `1px solid ${T.accent}`; },
          onBlur: (event) => { event.currentTarget.style.outline = "none"; },
        },
          h("span", { style: { ...styles.dot, background: statusColor(row.status) } }),
          h("div", { style: styles.rowMain },
            h("div", { style: styles.rowTop },
              h("span", { style: styles.rowName }, row.name || row.paneId || "?"),
              h("span", { style: { ...styles.rowState, color: statusColor(row.status) } }, row.status || "?"),
            ),
            meta ? h("div", { style: styles.rowMeta }, meta) : null,
          ),
        );
      };

      const listContent = rows.map(renderRow);

      const searching = query.trim().length > 0;
      const emptyList = h("div", { style: styles.emptyWrap },
        h("span", { style: styles.emptyIcon }, h(IconFleet)),
        h("div", { style: styles.emptyTitle }, searching ? "No matches" : "No agents yet"),
        h("div", { style: styles.emptyBody },
          searching
            ? "Clear the search to see every agent."
            : "Tasks you start from chat show up here, and stay until you close them."),
        h("button", {
          style: styles.chip,
          onClick: searching ? () => setQuery("") : () => void refresh(),
          disabled: loading && !searching,
        }, searching ? "Clear search" : loading ? "Refreshing…" : "Refresh"),
      );

      const menuBody = detail
        ? h(React.Fragment, null,
            h("div", { style: styles.menuHead }, "Copy packet"),
            ["pr", "issue", "summary"].map((name) =>
              h("button", {
                key: name,
                style: styles.menuItem,
                onClick: () => void copyPacket(name),
              }, `${name.toUpperCase()} · markdown`),
            ),
            history.length > 0 ? h("div", { style: styles.divider }) : null,
            history.map((item, index) =>
              h("button", {
                key: `h${index}`,
                style: styles.menuItem,
                onClick: async () => {
                  const ok = await copyText(item.text);
                  setNotice(ok ? `copied ${item.template}` : "copy failed");
                  setMenuOpen(false);
                },
              }, `History · ${item.template} · ${item.at}`),
            ),
            h("div", { style: styles.divider }),
            h("button", {
              style: styles.menuItem,
              onClick: async () => {
                const ok = await copyText(detail.cwd || "");
                setNotice(ok ? "copied cwd" : "copy failed");
                setMenuOpen(false);
              },
            }, "Copy cwd"),
            h("button", {
              style: styles.menuItem,
              onClick: () => { setMenuOpen(false); void act("reveal", { target: detail.taskId }); },
            }, "Reveal cwd"),
            detail.editorEnabled
              ? h("button", {
                  style: styles.menuItem,
                  onClick: () => { setMenuOpen(false); void act("editor", { target: detail.taskId }); },
                }, "Open editor")
              : null,
            h("div", { style: styles.divider }),
            h("button", {
              style: styles.menuItem,
              onClick: () => { setMenuOpen(false); void act("interrupt", { target: detail.taskId }); },
            }, "Interrupt"),
            h("button", {
              style: { ...styles.menuItem, ...styles.danger },
              onClick: () => {
                setMenuOpen(false);
                if (window.confirm(`Close ${detail.name || detail.taskId}? The session file is retained.`)) {
                  void act("close", { target: detail.taskId, force: true });
                }
              },
            }, "Close"),
          )
        : h(React.Fragment, null,
            h("button", {
              style: styles.menuItem,
              onClick: () => { setMenuOpen(false); void loadSelected(selected); },
            }, "Refresh tail"),
            h("button", {
              style: styles.menuItem,
              onClick: async () => {
                const ok = await copyText(live?.tail?.text || "");
                setNotice(ok ? "copied tail" : "copy failed");
                setMenuOpen(false);
              },
            }, "Copy tail"),
          );

      const detailHead = h("div", { style: styles.detailHead },
        h("div", { style: styles.detailTop },
          wide
            ? null
            : h("button", {
                style: styles.iconBtn,
                title: "Back to fleet",
                "aria-label": "Back to fleet",
                onClick: () => { setSelected(null); setDetail(null); setLive(null); setMenuOpen(false); },
              }, h(IconBack)),
          h("span", { style: styles.detailName }, detail?.name || live?.name || selected?.name || selected?.paneId || "?"),
          h("span", {
            style: { ...styles.rowState, marginLeft: 4, color: statusColor(detailStatus || live?.status || selected?.status) },
          }, detailStatus || live?.status || selected?.status || "?"),
          h("div", { ref: menuRef, style: styles.menuWrap },
            h("button", {
              style: styles.iconBtn,
              onClick: () => setMenuOpen((open) => !open),
              onMouseEnter: (event) => { event.currentTarget.style.color = T.text; },
              onMouseLeave: (event) => { event.currentTarget.style.color = T.mut; },
              title: "Actions",
              "aria-label": "Actions",
              "aria-expanded": menuOpen,
            }, h(IconDots)),
            menuOpen
              ? h("div", {
                  style: styles.menu,
                  role: "menu",
                  onMouseOver: (event) => {
                    const button = event.target.closest("button");
                    if (button) button.style.background = T.hover;
                  },
                  onMouseOut: (event) => {
                    const button = event.target.closest("button");
                    if (button) button.style.background = "transparent";
                  },
                }, menuBody)
              : null,
          ),
        ),
        h("div", { style: wide ? styles.detailMeta : { ...styles.detailMeta, paddingLeft: 28 } },
          [detail?.kind || live?.kind || selected?.kind,
            detail?.model || selected?.model,
            detail?.machine || selected?.machine,
            shortCwd(detail?.cwd || selected?.cwd)].filter(Boolean).join(" · ")),
      );

      const detailBody = loadingSelected && !detail && !live
        ? h("div", { style: styles.emptyWrap }, h("div", { style: styles.emptyBody }, "Reading…"))
        : detail
          ? h(React.Fragment, null,
              h("div", { style: styles.tabs },
                ["final", "flow", "diff", "result"].map((name) =>
                  h("button", {
                    key: name,
                    style: { ...styles.tab, ...(tab === name ? styles.tabActive : {}) },
                    onClick: () => setTab(name),
                  }, name),
                ),
              ),
              tab === "final"
                ? h(React.Fragment, null,
                    h("div", { style: styles.paneBar },
                      h("span", { style: styles.paneLabel }, "final message"),
                      h("span", { style: { flex: 1 } }),
                      h("button", {
                        style: styles.iconBtn,
                        onClick: () => void copyPane("final message", detail.finalMessage?.text || ""),
                        title: "Copy final message",
                        "aria-label": "Copy final message",
                      }, h(IconCopy)),
                    ),
                    detail.error
                      ? h("div", { style: { ...styles.notice, color: T.err } }, `error: ${detail.error}`)
                      : null,
                    h("pre", { style: styles.pre }, detail.finalMessage?.text
                      || (detail.status === "failed"
                        ? "(no final message — open Flow to see what the child ran)"
                        : "(no final message yet)")),
                  )
                : tab === "flow"
                  ? h(FlowView, {
                      flow,
                      loading: flowLoading,
                      error: flowError,
                      onRefresh: () => void loadFlow(detail.taskId, "tail"),
                      onEarlier: () => void loadFlow(detail.taskId, "earlier"),
                      onCopy: () => void copyFlow(),
                    })
                  : tab === "diff"
                    ? h(DiffView, { text: detail.diff?.text || "", onNotice: setNotice })
                    : h(React.Fragment, null,
                        h("div", { style: styles.paneBar },
                          h("span", { style: styles.paneLabel }, "result.md"),
                          h("span", { style: { flex: 1 } }),
                          h("button", {
                            style: styles.iconBtn,
                            onClick: () => void copyPane("result.md", detail.result?.text || ""),
                            title: "Copy result.md",
                            "aria-label": "Copy result.md",
                          }, h(IconCopy)),
                        ),
                        h("pre", { style: styles.pre }, detail.result?.text || "(no result.md)"),
                      ),
            )
          : live
            ? h(React.Fragment, null,
                h("div", { style: styles.paneBar },
                  h("span", { style: styles.paneLabel }, "pane tail · read-only"),
                  h("span", { style: { flex: 1 } }),
                  h("button", {
                    style: styles.iconBtn,
                    onClick: () => void loadSelected(selected),
                    title: "Refresh tail",
                    "aria-label": "Refresh tail",
                  }, h(IconRefresh)),
                  h("button", {
                    style: styles.iconBtn,
                    onClick: () => void copyPane("pane tail", live.tail?.text || ""),
                    title: "Copy pane tail",
                    "aria-label": "Copy pane tail",
                  }, h(IconCopy)),
                ),
                h("pre", { style: styles.pre }, live.tail?.text || "(no output)"),
              )
            : h("div", { style: styles.emptyWrap },
                h("span", { style: styles.emptyIcon }, h(IconFleet)),
                h("div", { style: styles.emptyTitle }, selected ? "Nothing to read" : "Pick an agent"),
                h("div", { style: styles.emptyBody },
                  selected
                    ? "This row has no readable task and no live pane tail."
                    : "Choose a row to read its result, transcript, diff and review packet."),
              );

      const detailPane = h("div", { style: styles.detail }, detailHead, detailBody);

      const splitting = wide && Boolean(selected);
      const listPane = rows.length === 0
        ? h("div", {
            style: splitting
              ? { ...styles.listWide, display: "flex", flexDirection: "column" }
              : { ...styles.list, display: "flex", flexDirection: "column" },
          }, emptyList)
        : h("div", { style: splitting ? styles.listWide : styles.list }, listContent);

      return h("div", { style: styles.root, ref: rootRef },
        h("div", { style: styles.head },
          h("div", { style: styles.headRow },
            h("span", { style: styles.kicker }, "Agents"),
            h("span", { style: styles.count },
              query.trim() || machine !== "all"
                ? `${rows.length}/${fleet.length}`
                : String(rows.length)),
            h("span", { style: { flex: 1 } }),
            machines.length > 0
              ? h("select", {
                  style: styles.select,
                  value: machine,
                  "aria-label": "Machine",
                  onChange: (event) => setMachine(event.target.value),
                },
                  h("option", { value: "all" }, "All machines"),
                  machines.map((name) => h("option", { key: name, value: name }, name)),
                )
              : null,
            h("span", {
              title: error ? `offline · ${error}` : loading ? "refreshing" : "connected",
              style: { ...styles.dot, width: 6, height: 6, marginTop: 0, background: error ? T.err : loading ? T.warn : T.ok },
            }),
            h("button", {
              style: styles.iconBtn,
              onClick: () => void refresh(),
              disabled: loading,
              title: "Refresh fleet",
              "aria-label": "Refresh fleet",
            }, h(IconRefresh)),
          ),
          wide || !selected
            ? h("label", { style: styles.search },
              h(IconSearch),
              h("input", {
                style: styles.input,
                value: query,
                placeholder: "Search name, cwd, model",
                "aria-label": "Search agents",
                onChange: (event) => setQuery(event.target.value),
              }),
            )
            : null,
        ),
        error ? h("div", { style: { ...styles.notice, color: T.err } }, error) : null,
        notice ? h("div", { style: { ...styles.notice, color: T.ok } }, notice) : null,
        h("div", { style: splitting ? styles.bodyWide : styles.body },
          wide
            ? (selected ? h(React.Fragment, null, listPane, detailPane) : listPane)
            : selected ? detailPane : listPane,
        ),
      );
    }

    function HerdrGuideIcon() {
      return h("svg", { width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true },
        h("rect", { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, stroke: "currentColor", strokeWidth: 1.3 }),
        h("path", { d: "M4.5 6.5 6.8 8.5 4.5 10.5M8.5 10.5h3", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }),
      );
    }

    const inject = ["slots", "sidebarRightTabs"];

    function apply(ctx) {
      try {
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: "dsh-herdr",
          kind: "herdr",
          title: () => "Herdr",
          guide: [{
            id: "fleet",
            order: 30,
            title: () => "Herdr fleet",
            description: () => "Fleet, run flow, diffs and results",
            icon: HerdrGuideIcon,
          }],
        }), "dsh-herdr: sidebar tab type");
      } catch (error) {
        console.error("[dsh-herdr] tab registration failed:", error);
      }
      try {
        ctx.effect(
          () => ctx.slots.register({ name: "sidebar.right.pane.tab", key: "dsh-herdr" }, Panel),
          "dsh-herdr: panel slot",
        );
      } catch (error) {
        console.error("[dsh-herdr] panel slot registration failed:", error);
      }
    }

    return { apply, inject };
  },
});
