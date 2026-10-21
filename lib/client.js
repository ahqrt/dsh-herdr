// Herdr fleet panel — right-sidebar tab + settings section.
//
// Plain ESM inside DSH's client module wrapper: no build of React, no CSS
// pipeline. Reads come from /herdr/api; actions POST to /herdr/api/action with
// the panel header, and the host re-checks ownership through the lifecycle
// service before touching a pane.

window.__ModuleLoader__.load({
  id: "dsh-herdr",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useState } = React;

    const styles = {
      root: { display: "flex", flexDirection: "column", height: "100%", font: "12px/1.45 ui-sans-serif, system-ui, sans-serif", color: "var(--dsh-text, #d6d6d6)" },
      bar: { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderBottom: "1px solid var(--dsh-border, #333)", flexWrap: "wrap" },
      title: { fontWeight: 600, fontSize: 12, letterSpacing: ".02em" },
      muted: { opacity: 0.65 },
      button: { background: "transparent", color: "inherit", border: "1px solid var(--dsh-border, #3a3a3a)", borderRadius: 4, padding: "2px 8px", cursor: "pointer", font: "inherit" },
      buttonOn: { borderColor: "var(--dsh-accent, #6f8fd9)", background: "var(--dsh-surface-2, #262626)" },
      danger: { color: "#d96a6a" },
      select: { background: "transparent", color: "inherit", border: "1px solid var(--dsh-border, #3a3a3a)", borderRadius: 4, padding: "2px 4px", font: "inherit", maxWidth: 120 },
      notice: { padding: "4px 10px", fontSize: 11, borderBottom: "1px solid var(--dsh-border, #333)" },
      body: { display: "flex", flex: 1, minHeight: 0 },
      list: { width: "45%", minWidth: 180, overflow: "auto", borderRight: "1px solid var(--dsh-border, #333)" },
      detail: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
      row: { padding: "6px 10px", borderBottom: "1px solid var(--dsh-border, #2a2a2a)", cursor: "pointer" },
      rowActive: { background: "var(--dsh-surface-2, #262626)" },
      badge: { display: "inline-block", marginLeft: 6, padding: "0 5px", borderRadius: 3, border: "1px solid currentColor", fontSize: 10, opacity: 0.8 },
      pre: { margin: 0, padding: 10, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace", flex: 1 },
      tabs: { display: "flex", gap: 4, padding: "6px 8px", borderBottom: "1px solid var(--dsh-border, #333)", alignItems: "center" },
      tab: { background: "transparent", color: "inherit", border: "1px solid transparent", borderRadius: 4, padding: "2px 8px", cursor: "pointer", font: "inherit", opacity: 0.75 },
      tabActive: { borderColor: "var(--dsh-border, #3a3a3a)", background: "var(--dsh-surface-2, #262626)", opacity: 1 },
      empty: { padding: 16, opacity: 0.6 },
      file: { borderBottom: "1px solid var(--dsh-border, #2a2a2a)" },
      fileHead: { padding: "4px 8px", cursor: "pointer", font: "11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace" },
      diffLine: { display: "block", whiteSpace: "pre-wrap", wordBreak: "break-word" },
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

    function statusColor(status) {
      if (status === "completed" || status === "idle") return "#6fbf73";
      if (status === "blocked") return "#d9a441";
      if (status === "failed" || status === "gone") return "#d96a6a";
      return "#7aa7d9";
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

    function DiffView({ text }) {
      const [raw, setRaw] = useState(false);
      const files = useMemo(() => parseDiff(text), [text]);
      if (!text) return h("div", { style: styles.empty }, "(no diff)");
      return h("div", { style: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } },
        h("div", { style: { ...styles.tabs, padding: "4px 8px" } },
          h("span", { style: styles.muted }, `${files.length} file(s)`),
          h("span", { style: { flex: 1 } }),
          h("button", { style: { ...styles.button, ...(raw ? styles.buttonOn : {}) }, onClick: () => setRaw(!raw) }, raw ? "structured" : "raw"),
        ),
        raw
          ? h("pre", { style: styles.pre }, text)
          : h("div", { style: { overflow: "auto", flex: 1 } },
              files.map((file, index) =>
                h("details", { key: `${file.path}-${index}`, style: styles.file, open: index < 3 },
                  h("summary", { style: styles.fileHead },
                    file.path,
                    h("span", { style: { color: "#6fbf73", marginLeft: 6 } }, `+${file.adds}`),
                    h("span", { style: { color: "#d96a6a", marginLeft: 4 } }, `-${file.dels}`),
                  ),
                  h("pre", { style: { ...styles.pre, padding: "4px 8px" } },
                    file.lines.map((line, lineIndex) =>
                      h("span", {
                        key: lineIndex,
                        style: {
                          ...styles.diffLine,
                          color: line.startsWith("+") && !line.startsWith("+++")
                            ? "#8fcf95"
                            : line.startsWith("-") && !line.startsWith("---")
                              ? "#e09a9a"
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

    function Panel() {
      const [fleet, setFleet] = useState([]);
      const [error, setError] = useState("");
      const [notice, setNotice] = useState("");
      const [selected, setSelected] = useState(null);
      const [detail, setDetail] = useState(null);
      const [tab, setTab] = useState("final");
      const [loading, setLoading] = useState(false);
      const [ownedOnly, setOwnedOnly] = useState(false);
      const [machine, setMachine] = useState("all");

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

      useEffect(() => {
        if (!selected) { setDetail(null); return; }
        let cancelled = false;
        const handle = selected.taskId || selected.paneId || selected.name;
        getJson(`/herdr/api/task?target=${encodeURIComponent(handle)}`)
          .then((body) => { if (!cancelled) setDetail(body.task); })
          .catch(() => { if (!cancelled) setDetail(null); });
        return () => { cancelled = true; };
      }, [selected]);

      const machines = useMemo(() => [...new Set(fleet.map((row) => row.machine).filter(Boolean))], [fleet]);
      const rows = useMemo(() => fleet
        .filter((row) => !ownedOnly || row.owned)
        .filter((row) => machine === "all" || row.machine === machine), [fleet, ownedOnly, machine]);

      const act = useCallback(async (action, payload) => {
        setNotice("");
        try {
          const result = await postAction(action, payload);
          setNotice(result?.message || `${action} ok`);
          await refresh();
          if (action === "close") { setSelected(null); setDetail(null); }
        } catch (e) {
          setError(String(e.message || e));
        }
      }, [refresh]);

      return h("div", { style: styles.root },
        h("div", { style: styles.bar },
          h("span", { style: styles.title }, "Herdr"),
          h("span", { style: styles.muted }, `${rows.length}/${fleet.length}`),
          h("span", { style: { flex: 1 } }),
          h("button", { style: { ...styles.button, ...(ownedOnly ? styles.buttonOn : {}) }, onClick: () => setOwnedOnly(!ownedOnly) }, "owned"),
          machines.length > 0
            ? h("select", { style: styles.select, value: machine, onChange: (e) => setMachine(e.target.value) },
                h("option", { value: "all" }, "all machines"),
                machines.map((name) => h("option", { key: name, value: name }, name)),
              )
            : null,
          h("button", { style: styles.button, onClick: () => void refresh(), disabled: loading }, loading ? "…" : "refresh"),
        ),
        error ? h("div", { style: { ...styles.notice, color: "#d96a6a" } }, error) : null,
        notice ? h("div", { style: { ...styles.notice, color: "#8fcf95" } }, notice) : null,
        h("div", { style: styles.body },
          h("div", { style: styles.list },
            rows.length === 0
              ? h("div", { style: styles.empty }, ownedOnly ? "No owned agents." : "No agents. Spawn one with herdr_spawn_agent.")
              : rows.map((row) => {
                  const active = selected && (selected.taskId || selected.paneId) === (row.taskId || row.paneId);
                  return h("div", {
                    key: `${row.taskId || row.paneId || row.name}-${row.kind}`,
                    style: { ...styles.row, ...(active ? styles.rowActive : {}) },
                    onClick: () => { setSelected(row); setTab("final"); },
                  },
                    h("div", null,
                      h("span", { style: styles.muted }, row.owned ? "* " : "  "),
                      h("strong", null, row.name || row.paneId || "?"),
                      h("span", { style: { ...styles.badge, color: statusColor(row.status) } }, row.status || "?"),
                    ),
                    h("div", { style: { ...styles.muted, marginTop: 2 } },
                      [row.kind, row.model, row.machine].filter(Boolean).join(" · "),
                    ),
                  );
                }),
          ),
          h("div", { style: styles.detail },
            selected && !detail
              ? h("div", { style: styles.empty },
                  `${selected.name || selected.paneId || "agent"} is not an owned task; no review packet to show.`)
              : detail
                ? h(React.Fragment, null,
                    h("div", { style: styles.tabs },
                      ["final", "diff", "result"].map((name) =>
                        h("button", {
                          key: name,
                          style: { ...styles.tab, ...(tab === name ? styles.tabActive : {}) },
                          onClick: () => setTab(name),
                        }, name),
                      ),
                      h("span", { style: { flex: 1 } }),
                      h("button", { style: styles.button, onClick: () => void act("interrupt", { target: detail.taskId }) }, "interrupt"),
                      h("button", {
                        style: { ...styles.button, ...styles.danger },
                        onClick: () => {
                          if (window.confirm(`Close ${detail.name || detail.taskId}? The session file is retained.`)) {
                            void act("close", { target: detail.taskId, force: true });
                          }
                        },
                      }, "close"),
                    ),
                    tab === "final"
                      ? h("pre", { style: styles.pre }, detail.finalMessage?.text || "(no final message yet)")
                      : tab === "diff"
                        ? h(DiffView, { text: detail.diff?.text || "" })
                        : h("pre", { style: styles.pre }, detail.result?.text || "(no result.md)"),
                  )
                : h("div", { style: styles.empty }, "Select an owned task to see its final message, diff, and result.md."),
          ),
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
            description: () => "Tasks, diffs and results",
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
