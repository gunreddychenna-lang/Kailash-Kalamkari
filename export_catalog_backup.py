"""Export a complete raw catalogue beside the website before deployment.

Run: python export_catalog_backup.py
Reads the existing public endpoints from script.js; never copies private env files.
On failure the previous backup is preserved and the command exits unsuccessfully.
"""
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def setting(name):
    source = (ROOT / 'script.js').read_text(encoding='utf-8')
    match = re.search(r'const\s+' + re.escape(name) + r"\s*=\s*'([^']*)'", source)
    if not match:
        raise ValueError('Missing public setting: ' + name)
    return match.group(1)


def request(url, headers=None, csv_format=False):
    req = urllib.request.Request(url, headers=headers or {})
    # Default TLS verification remains enabled.
    with urllib.request.urlopen(req, timeout=10) as response:
        text = response.read().decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(text))) if csv_format else json.loads(text)


def valid_rows(rows):
    if not isinstance(rows, list) or not rows or not all(isinstance(row, dict) for row in rows):
        raise ValueError('Empty or invalid catalogue')
    # Keep raw prices: the browser applies the global discount exactly once.
    if not any(any(re.sub(r'[^a-z0-9]', '', str(key).lower()) in
                       ('imageid', 'fileid', 'image', 'imagelink', 'thumbnail', 'thumbnaillink', 'drivelink')
                       and value for key, value in row.items()) for row in rows):
        raise ValueError('Catalogue has no image references')
    return rows


def fetch_catalog():
    try:
        rows = []
        key = setting('SUPABASE_KEY')
        headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
        for offset in range(0, 1000000, 1000):
            url = (setting('SUPABASE_URL') + '/rest/v1/products?select=*&order=code.asc'
                   + f'&offset={offset}&limit=1000')
            chunk = request(url, headers)
            if not isinstance(chunk, list):
                raise ValueError('Invalid page')
            rows.extend(chunk)
            if len(chunk) < 1000:
                return valid_rows(rows)
        raise ValueError('Pagination exceeded safety limit')
    except Exception:
        pass  # Do not return an incomplete set of pages.
    for name, csv_format in [('APPS_SCRIPT_API_URL', False),
                             ('PRIMARY_CSV_URL', True), ('BACKUP_CSV_URL', True)]:
        try:
            return valid_rows(request(setting(name), csv_format=csv_format))
        except Exception:
            pass
    raise RuntimeError('No complete catalogue could be downloaded; existing backup was preserved.')


def save_backup(rows):
    valid_rows(rows)
    target = ROOT / 'catalog-backup.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temporary.replace(target)
    return target


if __name__ == '__main__':
    rows = fetch_catalog()
    print(f'Saved {len(rows)} raw products to {save_backup(rows).name}')
