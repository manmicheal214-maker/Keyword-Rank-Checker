#!/usr/bin/env python3
"""Fetch Position Tracking rankings from Semrush and write dashboard JSON."""
from __future__ import annotations
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "semrush.json"
OUTPUT_PATH = ROOT / "data" / "rankings.json"
API_BASE = "https://api.semrush.com/reports/v1/projects/{campaign_id}/tracking/"

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)

def as_number(value):
    if value in (None, "", "-", "—"):
        return None
    try:
        number = float(str(value).replace(",", ""))
        return int(number) if number.is_integer() else number
    except (TypeError, ValueError):
        return None

def fetch_campaign(campaign_id: str, domain: str, api_key: str):
    params = {"type":"tracking_position_organic","key":api_key,"action":"report","url":f"*.{domain}/*","display_limit":"1000"}
    url = API_BASE.format(campaign_id=urllib.parse.quote(campaign_id, safe="")) + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"User-Agent":"Keyword-Rank-Checker/1.0"}, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Semrush request failed for {domain}: {exc}") from exc
    if isinstance(payload, dict) and payload.get("code"):
        raise RuntimeError(f"Semrush error for {domain}: {payload.get('code')} - {payload.get('message','unknown error')}")
    rows = payload.get("data", []) if isinstance(payload, dict) else []
    if not isinstance(rows, list):
        raise RuntimeError(f"Unexpected Semrush response for {domain}: data is not a list")
    return rows

def normalize_row(row: dict, domain: str):
    keyword = row.get("Ph") or row.get("keyword") or row.get("Keyword")
    if not keyword:
        return None
    current = as_number(row.get("Fi") if "Fi" in row else row.get("position"))
    diff1 = as_number(row.get("Diff1"))
    previous = None
    change = None
    if current is not None and diff1 is not None:
        previous = current + diff1
        if previous <= 0:
            previous = None
        else:
            change = previous - current
    landing_url = row.get("Lu") or row.get("url") or row.get("Url") or None
    return {"domain":domain,"keyword":str(keyword),"position":current,"previous_position":previous,"change":change,"country":"India","url":landing_url}

def main() -> None:
    api_key = os.environ.get("SEMRUSH_API_KEY", "").strip()
    if not api_key:
        fail("SEMRUSH_API_KEY environment variable is missing")
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    campaigns = config.get("campaigns", [])
    keywords = [str(k).strip() for k in config.get("keywords", []) if str(k).strip()]
    if not campaigns: fail("No Semrush campaigns configured")
    if not keywords: fail("No keywords configured")
    keyword_set = {k.casefold() for k in keywords}
    all_rows = []
    campaign_errors = []
    for campaign in campaigns:
        domain = campaign["domain"]
        try:
            raw_rows = fetch_campaign(campaign["campaign_id"], domain, api_key)
            normalized = []
            for raw in raw_rows:
                item = normalize_row(raw, domain)
                if item and item["keyword"].casefold() in keyword_set:
                    normalized.append(item)
            found = {item["keyword"].casefold() for item in normalized}
            for keyword in keywords:
                if keyword.casefold() not in found:
                    normalized.append({"domain":domain,"keyword":keyword,"position":None,"previous_position":None,"change":None,"country":"India","url":None})
            order = {keyword.casefold(): i for i, keyword in enumerate(keywords)}
            normalized.sort(key=lambda x: order.get(x["keyword"].casefold(), 999999))
            all_rows.extend(normalized)
            print(f"{domain}: {len(normalized)} keywords")
        except Exception as exc:
            campaign_errors.append(str(exc))
    if campaign_errors:
        fail("; ".join(campaign_errors))
    output = {"domain":"5 domains","country":"India","search_engine":"Google","device":"Desktop","updated_at":datetime.now(timezone.utc).isoformat(),"source":"Semrush Position Tracking","keywords":all_rows}
    OUTPUT_PATH.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(all_rows)} ranking rows to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
