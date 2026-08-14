#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
START = "<!-- SEMRUSH_KEYWORD_METRICS_UI_START -->"
END = "<!-- SEMRUSH_KEYWORD_METRICS_UI_END -->"

BLOCK = r'''<!-- SEMRUSH_KEYWORD_METRICS_UI_START -->
<style>
    .semrush-metric { white-space: nowrap; }
    .semrush-metric-value { font-weight: 600; }
    .semrush-intent { display: inline-flex; gap: 4px; flex-wrap: wrap; }
    .semrush-intent span { padding: 3px 6px; border-radius: 999px; background: var(--primary-light); color: var(--primary); font-size: 10px; font-weight: 700; }
    .semrush-trends { display: inline-flex; align-items: flex-end; gap: 2px; height: 24px; }
    .semrush-trend-bar { width: 4px; min-height: 3px; background: var(--primary); border-radius: 2px 2px 0 0; opacity: .75; }
    .semrush-metrics-note { margin: 0 20px 12px; color: var(--muted); font-size: 12px; }
    table { min-width: 1250px; }
</style>
<script>
(() => {
    const METRICS_URL = "data/keyword_metrics.json";
    const BODY_ID = "rankingsBody";
    let metricsByKeyword = new Map();
    let observerStarted = false;

    const esc = (value) => String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const number = (value) => {
        if (value === null || value === undefined || value === "" || value === "-") return null;
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    };

    const formatVolume = (value) => {
        const n = number(value);
        return n === null ? "—" : n.toLocaleString();
    };

    const formatCpc = (value) => {
        const n = number(value);
        return n === null ? "—" : `$${n.toFixed(2)}`;
    };

    function trendsHtml(values) {
        if (!Array.isArray(values) || !values.length) return "—";
        const nums = values.map(number).filter(v => v !== null);
        if (!nums.length) return "—";
        const max = Math.max(...nums, 1);
        return `<span class="semrush-trends" title="12-month trend: ${nums.join(", ")}">${nums.map(v => {
            const height = Math.max(3, Math.round((v / max) * 22));
            return `<span class="semrush-trend-bar" style="height:${height}px" aria-hidden="true"></span>`;
        }).join("")}</span>`;
    }

    function intentsHtml(intents) {
        if (!Array.isArray(intents) || !intents.length) return "—";
        return `<span class="semrush-intent">${intents.map(i => `<span>${esc(i)}</span>`).join("")}</span>`;
    }

    function addHeaders() {
        const row = document.querySelector("table thead tr");
        if (!row || row.querySelector(".semrush-volume-header")) return;
        const keywordHeader = row.children[0];
        [["Volume", "semrush-volume-header"], ["KD", "semrush-kd-header"], ["CPC", "semrush-cpc-header"], ["Intent", "semrush-intent-header"], ["Trends", "semrush-trends-header"]].forEach(([label, cls]) => {
            const th = document.createElement("th");
            th.className = cls;
            th.textContent = label;
            row.insertBefore(th, keywordHeader.nextSibling);
        });
        const tableCard = document.querySelector(".table-card");
        if (tableCard && !document.getElementById("semrushMetricsNote")) {
            const note = document.createElement("div");
            note.id = "semrushMetricsNote";
            note.className = "semrush-metrics-note";
            note.textContent = "Semrush India keyword metrics • v4 dataset";
            const wrapper = tableCard.querySelector(".table-wrapper");
            tableCard.insertBefore(note, wrapper);
        }
    }

    function decorateRows() {
        addHeaders();
        const body = document.getElementById(BODY_ID);
        if (!body) return;
        [...body.rows].forEach(row => {
            if (row.dataset.semrushMetrics === "1") return;
            const keywordCell = row.children[0];
            if (!keywordCell) return;
            const keyword = keywordCell.textContent.trim().toLowerCase();
            const values = metricsByKeyword.get(keyword) || {};
            const cells = [
                formatVolume(values.search_volume),
                values.keyword_difficulty == null ? "—" : esc(values.keyword_difficulty),
                formatCpc(values.cpc_usd),
                intentsHtml(values.intents),
                trendsHtml(values.trends)
            ];
            const anchor = keywordCell.nextSibling;
            cells.forEach((html, index) => {
                const td = document.createElement("td");
                td.className = "semrush-metric semrush-metric-" + index;
                td.innerHTML = `<span class="semrush-metric-value">${html}</span>`;
                row.insertBefore(td, anchor);
            });
            row.dataset.semrushMetrics = "1";
        });
    }

    async function loadSemrushMetrics() {
        try {
            const response = await fetch(METRICS_URL + "?t=" + Date.now(), { cache: "no-store" });
            if (!response.ok) throw new Error("Could not load keyword_metrics.json");
            const data = await response.json();
            const rows = Array.isArray(data.keywords) ? data.keywords : [];
            metricsByKeyword = new Map(rows.map(item => [String(item.keyword || "").trim().toLowerCase(), item]));
        } catch (error) {
            console.warn("Semrush keyword metrics unavailable:", error);
        }
        decorateRows();
        if (!observerStarted) {
            const body = document.getElementById(BODY_ID);
            if (body) {
                new MutationObserver(() => decorateRows()).observe(body, { childList: true });
                observerStarted = true;
            }
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadSemrushMetrics, { once: true });
    else loadSemrushMetrics();
})();
</script>
<!-- SEMRUSH_KEYWORD_METRICS_UI_END -->'''

html = INDEX.read_text(encoding="utf-8")
if START in html and END in html:
    html = html.split(START, 1)[0] + BLOCK + html.split(END, 1)[1]
else:
    if "</body>" not in html:
        raise SystemExit("ERROR: index.html has no </body> marker")
    html = html.replace("</body>", BLOCK + "\n</body>", 1)
INDEX.write_text(html, encoding="utf-8")
print("Injected Semrush keyword metrics UI into index.html")
