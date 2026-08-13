#!/usr/bin/env python3
"""Checks the Department's published Disability Inclusion Profile pages for changes.

This script never modifies data/content.json (the actual Department Knowledge Base used
by the app). It only tracks a hash of each page's text in data/source-tracking.json, and
reports which pages changed so the workflow can open a GitHub Issue for human review.
"""
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

TRACKING_FILE = Path(__file__).resolve().parent.parent / "data" / "source-tracking.json"


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (DIP-Prep-Assistant source monitor)"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", errors="ignore")
    # Strip tags/scripts/styles roughly and collapse whitespace so cosmetic HTML changes
    # (e.g. tracking scripts) don't trigger false positives.
    html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main():
    data = json.loads(TRACKING_FILE.read_text())
    changed = []
    errors = []

    for page in data["pages"]:
        try:
            text = fetch_text(page["url"])
            new_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        except Exception as exc:  # network hiccups shouldn't fail the whole run
            errors.append(f"{page['id']} ({page['url']}): {exc}")
            continue

        old_hash = page.get("lastHash") or ""
        if old_hash and old_hash != new_hash:
            changed.append(page)
        page["lastHash"] = new_hash

    TRACKING_FILE.write_text(json.dumps(data, indent=2) + "\n")

    if errors:
        print("Errors while checking pages:\n" + "\n".join(errors), file=sys.stderr)

    if changed:
        lines = [f"- **{p['id']}**: {p['url']}" for p in changed]
        summary = (
            "The following Department Disability Inclusion Profile pages appear to have changed:\n\n"
            + "\n".join(lines)
            + "\n\nPlease review the page(s) above and, if the domains, activities, adjustment levels "
            + "or supporting-information rules have changed, update `data/content.json` accordingly. "
            + "This tracking file has already been updated with the new hash so this won't be reported again."
        )
        print("CHANGED=true")
        print(summary)
        Path("change-summary.md").write_text(summary)
    else:
        print("CHANGED=false")


if __name__ == "__main__":
    main()
