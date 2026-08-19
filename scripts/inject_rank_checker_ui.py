#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
START = "<!-- RANK_CHECKER_UI_START -->"
END = "<!-- RANK_CHECKER_UI_END -->"

BLOCK = r'''<!-- RANK_CHECKER_UI_START -->
<style>
    .rank-checker-card { margin: 0 0 24px; padding: 24px; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
    .rank-checker-heading { margin: 0 0 6px; font-size: 18px; }
    .rank-checker-copy { margin: 0 0 18px; color: var(--muted); font-size: 13px; }
    .rank-checker-form { display: grid; grid-template-columns: minmax(220px, 1.3fr) minmax(220px, 1.5fr) minmax(170px, .8fr) minmax(140px, .65fr) auto; gap: 12px; align-items: end; }
    .rank-checker-field { display: flex; flex-direction: column; gap: 7px; }
    .rank-checker-field label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .rank-checker-field input, .rank-checker-field select { width: 100%; height: 44px; padding: 0 13px; border: 1px solid var(--border); border-radius: 9px; background: #fff; color: var(--text); font: inherit; outline: none; }
    .rank-checker-field input:focus, .rank-checker-field select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(37, 99, 235, .1); }
    .rank-checker-button { min-height: 44px; padding: 0 18px; border: 0; border-radius: 9px; background: var(--primary); color: #fff; font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .rank-checker-button:hover:not(:disabled) { filter: brightness(.95); }
    .rank-checker-button:disabled { opacity: .65; cursor: wait; }
    .rank-checker-status { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: var(--gray-bg); color: var(--muted); font-size: 13px; }
    .rank-checker-status.loading { background: var(--primary-light); color: var(--primary); }
    .rank-checker-status.success { background: var(--green-bg); color: var(--green); }
    .rank-checker-status.error { background: var(--red-bg); color: var(--red); }
    .rank-checker-result { margin-top: 16px; padding: 18px; border: 1px solid var(--border); border-radius: 10px; background: #fbfcff; }
    .rank-result-grid { display: grid; grid-template-columns: 1fr 1.6fr 1.2fr; gap: 14px; }
    .rank-result-item { display: flex; flex-direction: column; gap: 5px; }
    .rank-result-item span, .rank-result-page span { color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .35px; }
    .rank-result-item strong { font-size: 15px; overflow-wrap: anywhere; }
    .rank-result-position strong { color: var(--primary); font-size: 28px; }
    .rank-result-page { display: flex; flex-direction: column; gap: 5px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); }
    .rank-result-page a { color: var(--primary); font-size: 13px; overflow-wrap: anywhere; text-decoration: none; }
    .rank-result-page a:hover { text-decoration: underline; }
    .rank-result-checked, .rank-result-empty small { display: block; margin-top: 14px; color: var(--muted); font-size: 12px; }
    .rank-result-empty { display: flex; flex-direction: column; gap: 7px; }
    .rank-result-empty .rank-result-label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .rank-result-empty strong { font-size: 19px; }
    .rank-result-empty span { color: var(--muted); font-size: 13px; }
    @media (max-width: 1000px) { .rank-checker-form { grid-template-columns: repeat(2, 1fr); } .rank-checker-button { width: 100%; } }
    @media (max-width: 600px) { .rank-checker-card { padding: 18px; } .rank-checker-form, .rank-result-grid { grid-template-columns: 1fr; } }
</style>
<section class="rank-checker-card" aria-labelledby="rankCheckerHeading">
    <h2 class="rank-checker-heading" id="rankCheckerHeading">Check Google Keyword Ranking</h2>
    <p class="rank-checker-copy">Check where your website appears in the first 100 organic Google results.</p>
    <form class="rank-checker-form" id="rankCheckerForm" novalidate>
        <div class="rank-checker-field">
            <label for="rankDomain">Website Domain</label>
            <input id="rankDomain" name="domain" type="text" placeholder="example.com" autocomplete="url" required maxlength="253">
        </div>
        <div class="rank-checker-field">
            <label for="rankKeyword">Keyword</label>
            <input id="rankKeyword" name="keyword" type="text" placeholder="best running shoes" autocomplete="off" required maxlength="200">
        </div>
        <div class="rank-checker-field">
            <label for="rankCountry">Country</label>
            <select id="rankCountry" name="country">
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Canada</option>
                <option>Australia</option>
                <option>India</option>
                <option>United Arab Emirates</option>
            </select>
        </div>
        <div class="rank-checker-field">
            <label for="rankDevice">Device</label>
            <select id="rankDevice" name="device">
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
            </select>
        </div>
        <button class="rank-checker-button" id="rankCheckButton" type="submit">
            <span id="rankCheckButtonText">Check Ranking</span>
        </button>
    </form>
    <div class="rank-checker-status" id="rankCheckerStatus" role="status" aria-live="polite" hidden></div>
    <div class="rank-checker-result" id="rankCheckerResult" aria-live="polite" hidden></div>
</section>
<script src="scripts/rank-checker.js"></script>
<!-- RANK_CHECKER_UI_END -->'''

html = INDEX.read_text(encoding="utf-8")
if START in html and END in html:
    html = html.split(START, 1)[0] + BLOCK + html.split(END, 1)[1]
else:
    marker = "<main class=\"container\">"
    if marker not in html:
        raise SystemExit("ERROR: index.html container marker not found")
    html = html.replace(marker, marker + "\n\n        " + BLOCK, 1)

INDEX.write_text(html, encoding="utf-8")
print("Injected keyword rank checker UI into index.html")
