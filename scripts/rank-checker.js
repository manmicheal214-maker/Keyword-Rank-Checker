(() => {
  "use strict";

  const API_BASE_URL =
    window.RANK_CHECKER_API_URL ||
    "YOUR_BACKEND_URL";

  const form = document.getElementById("rankCheckerForm");
  if (!form) return;

  const domainInput = document.getElementById("rankDomain");
  const keywordInput = document.getElementById("rankKeyword");
  const countryInput = document.getElementById("rankCountry");
  const deviceInput = document.getElementById("rankDevice");
  const button = document.getElementById("rankCheckButton");
  const buttonText = document.getElementById("rankCheckButtonText");
  const status = document.getElementById("rankCheckerStatus");
  const result = document.getElementById("rankCheckerResult");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const normalizeDomain = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    try {
      const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (!hostname || hostname.includes("..")) return null;
      return hostname;
    } catch {
      return null;
    }
  };

  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = `rank-checker-status${type ? ` ${type}` : ""}`;
    status.hidden = !message;
  };

  const showResult = (data) => {
    const checkedAt = new Date(data.checkedAt);
    const checkedText = Number.isNaN(checkedAt.getTime())
      ? "Just now"
      : checkedAt.toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        });

    if (data.position === null) {
      result.innerHTML = `
        <div class="rank-result-empty">
          <span class="rank-result-label">${escapeHtml(data.keyword)}</span>
          <strong>Not ranked in the top 100</strong>
          <span>We checked the organic Google results for ${escapeHtml(data.domain)}.</span>
          <small>Checked ${escapeHtml(checkedText)}</small>
        </div>
      `;
    } else {
      result.innerHTML = `
        <div class="rank-result-grid">
          <div class="rank-result-item rank-result-position">
            <span>Position</span>
            <strong>#${escapeHtml(data.position)}</strong>
          </div>
          <div class="rank-result-item">
            <span>Keyword</span>
            <strong>${escapeHtml(data.keyword)}</strong>
          </div>
          <div class="rank-result-item">
            <span>Domain</span>
            <strong>${escapeHtml(data.domain)}</strong>
          </div>
        </div>
        <div class="rank-result-page">
          <span>Ranking page</span>
          <strong>${escapeHtml(data.title || "Untitled page")}</strong>
          <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(data.url)}</a>
        </div>
        <small class="rank-result-checked">Checked ${escapeHtml(checkedText)}</small>
      `;
    }

    result.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const domain = normalizeDomain(domainInput.value);
    const keyword = keywordInput.value.trim();

    result.hidden = true;
    result.innerHTML = "";
    setStatus("");

    if (!domain) {
      setStatus("Enter a valid domain, such as example.com.", "error");
      domainInput.focus();
      return;
    }

    if (!keyword || keyword.length > 200) {
      setStatus("Enter a keyword between 1 and 200 characters.", "error");
      keywordInput.focus();
      return;
    }

    if (!API_BASE_URL || API_BASE_URL === "YOUR_BACKEND_URL") {
      setStatus("The rank checker backend URL has not been configured yet.", "error");
      return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    buttonText.textContent = "Checking Google rankings...";
    setStatus("Checking Google rankings...", "loading");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/api/rank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          keyword,
          country: countryInput.value,
          device: deviceInput.value
        }),
        signal: controller.signal
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The ranking service returned an invalid response.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to check Google rankings.");
      }

      showResult(data);
      setStatus(data.position === null ? "No top-100 result found" : "Ranking found", "success");
    } catch (error) {
      const message = error.name === "AbortError"
        ? "The ranking request timed out. Please try again."
        : error.message || "Unable to check Google rankings.";
      setStatus(message, "error");
    } finally {
      window.clearTimeout(timeout);
      button.disabled = false;
      button.removeAttribute("aria-busy");
      buttonText.textContent = "Check Ranking";
    }
  });
})();
