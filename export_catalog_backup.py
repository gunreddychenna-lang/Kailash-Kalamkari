
"""
Kailash Kalamkari - Safe Supabase Catalogue Exporter

Source: Supabase public products API only.

- No old Apps Script or CSV fallback
- Complete pagination required
- Reject duplicates and incomplete responses
- Preserve existing backup on failure
- Preserve raw MRP (website applies discount)
"""

import json
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parent

BACKUP_FILE = ROOT / "catalog-backup.json"

PAGE_SIZE = 1000
MAX_PAGES = 100

# Current baseline: 1,185 active products.
# Temporary safeguard, not a permanent stock target.
MIN_ACTIVE_PRODUCTS = 1000


def setting(name):
    source = (
        ROOT / "script.js"
    ).read_text(encoding="utf-8-sig")

    pattern = (
        r"\bconst\s+"
        + re.escape(name)
        + r"\s*=\s*'([^']*)'"
    )

    match = re.search(pattern, source)

    if not match:
        raise ValueError(
            f"Missing public setting: {name}"
        )

    return match.group(1)


def request_json(url, headers):
    req = urllib.request.Request(
        url,
        headers=headers,
    )

    with urllib.request.urlopen(
        req,
        timeout=15,
    ) as response:
        data = response.read().decode(
            "utf-8-sig"
        )

    result = json.loads(data)

    if not isinstance(result, list):
        raise ValueError(
            "Supabase returned invalid JSON data"
        )

    return result


def is_active(row):
    if row.get("is_available") is not True:
        return False

    try:
        return float(row.get("qty")) > 0
    except (ValueError, TypeError):
        return False


def validate_catalogue(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError(
            "Empty or invalid catalogue"
        )

    seen_codes = set()

    for row in rows:
        if not isinstance(row, dict):
            raise ValueError(
                "Invalid product record"
            )

        code = str(
            row.get("code") or ""
        ).strip()

        if not code:
            raise ValueError(
                "Product code missing"
            )

        if code in seen_codes:
            raise ValueError(
                f"Duplicate product code: {code}"
            )

        seen_codes.add(code)

    active = sum(
        1 for row in rows if is_active(row)
    )

    if active < MIN_ACTIVE_PRODUCTS:
        raise ValueError(
            f"Only {active} active products found. "
            "Possible incomplete inventory. "
            "Existing files preserved."
        )

    return rows


def fetch_catalog():
    base = setting(
        "SUPABASE_URL"
    ).rstrip("/")

    key = setting(
        "SUPABASE_KEY"
    )

    headers = {
        "apikey": key,
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
    }

    rows = []

    for page in range(MAX_PAGES):
        offset = page * PAGE_SIZE

        url = (
            f"{base}/rest/v1/products"
            f"?select=*"
            f"&order=code.asc"
            f"&offset={offset}"
            f"&limit={PAGE_SIZE}"
        )

        # If any request fails, an exception stops
        # the entire export. No fallback to stale CSV.
        chunk = request_json(
            url,
            headers,
        )

        for item in chunk:
            if not isinstance(item, dict):
                raise ValueError(
                    "Invalid Supabase product row"
                )

        rows.extend(chunk)

        if len(chunk) < PAGE_SIZE:
            return validate_catalogue(rows)

    raise RuntimeError(
        "Pagination safety limit exceeded. "
        "Existing output preserved."
    )


def save_backup(rows):
    validate_catalogue(rows)

    target = BACKUP_FILE

    temporary = target.with_suffix(
        ".json.tmp"
    )

    try:
        temporary.write_text(
            json.dumps(
                rows,
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            encoding="utf-8",
        )

        # Verify JSON was written successfully.
        with temporary.open(
            "r",
            encoding="utf-8",
        ) as handle:
            saved = json.load(handle)

        if len(saved) != len(rows):
            raise RuntimeError(
                "Backup verification failed"
            )

        temporary.replace(target)

    finally:
        if temporary.exists():
            temporary.unlink()

    return target


if __name__ == "__main__":
    rows = fetch_catalog()

    active_rows = [
        row
        for row in rows
        if is_active(row)
    ]

    backup = save_backup(active_rows)

    print(
        f"Total database products: {len(rows)}"
    )

    print(
        f"Active products: {len(active_rows)}"
    )

    print(
        f"Inactive excluded: "
        f"{len(rows) - len(active_rows)}"
    )

    print(
        f"Backup saved: {backup.name}"
    )
