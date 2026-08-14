#!/usr/bin/env python3
"""Fetch Semrush v4 keyword metrics for the configured India keyword set."""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "semrush.json"
OUTPUT_PATH = ROOT / "data" / "keyword_metrics.json"
API_URL = "https://api.semrush.com/apis/v4/keywords/v1/metrics"


def request_metrics(keyword: str, api_key: str, month: str) -> dict:
    params = {"keyword": keyword, "country": "IN", "month": month, "format": "json"}
    url = API_URL + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(
        url,
        headers={"Authorization": f"Apikey {api_key}", "User-Agent": "Keyword-Rank-Checker/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict) or not payload.get("meta", {}).get("success"):
        meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
        raise RuntimeError(
            f"Semrush v4 error for {keyword}: {meta.get('status_code')} "
            f"{meta.get('request_id', '')}"
        )
    return payload.get("data", {})


def main() -> None:
    api_key = os.environ.get("SEMRUSH_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("ERROR: SEMRUSH_API_KEY environment variable is missing")

    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    keywords = [str(k).strip() for k in config.get("keywords", []) if str(k).strip()]
    if not keywords:
        raise SystemExit("ERROR: No keywords configured")

    month = datetime.now(timezone.utc).strftime("%Y-%m")
    rows = []
    errors = []

    for index, keyword in enumerate(keywords, start=1):
        try:
            data = request_metrics(keyword, api_key, month)
            cpc_cents = data.get("cpc")
            cpc_usd = None
            if cpc_cents not in (None, "", "-"):
                try:
                    cpc_usd = float(cpc_cents) / 100
                except (TypeError, ValueError):
                    pass
            rows.append({
                "keyword": keyword,
                "country": "India",
                "country_code": "IN",
                "month": month,
                "search_volume": data.get("search_volume"),
                "keyword_difficulty": data.get("keyword_difficulty"),
                "cpc_usd": cpc_usd,
                "competitive_density": data.get("competitive_density"),
                "intents": data.get("intents", []),
                "number_of_results": data.get("number_of_results"),
                "serp_features": data.get("serp_features", []),
                "trends": data.get("trends", []),
            })
            print(f"[{index}/{len(keywords)}] {keyword}: ok")
        except Exception as exc:
            errors.append(str(exc))
            print(f"[{index}/{len(keywords)}] {keyword}: ERROR: {exc}")
        # Keep requests gentle on account/rate limits.
        if index < len(keywords):
            time.sleep(0.15)

    if errors:
        raise SystemExit("ERROR: " + "; ".join(errors))

    output = {
        "country": "India",
        "country_code": "IN",
        "month": month,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Semrush API v4 - Get Keyword Metrics",
        "keyword_count": len(rows),
        "api_units_per_keyword": 20,
        "estimated_api_units": len(rows) * 20,
        "keywords": rows,
    }
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(rows)} India keyword metrics to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
