import json
import urllib.request
import csv
import io
import re
import ssl
from datetime import datetime

# Multi-Tier Data Endpoints
APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec'
PRIMARY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?gid=100332201&single=true&output=csv'
BACKUP_CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?output=csv'
IMAGE_CDN_BASE  = 'https://kalamkari-images.kailashakalamkariacc.workers.dev'

TODAY = datetime.today().strftime('%Y-%m-%d')
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def extract_file_id(val):
    if not val:
        return ''
    val = str(val).strip()
    if re.match(r'^[a-zA-Z0-9_-]{25,50}$', val):
        return val
    m = re.search(r'(?:id=|file/d/|/d/|document/d/)([a-zA-Z0-9_-]{25,50})', val)
    return m.group(1) if m else ''

def fetch_products():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    # 1. Try Apps Script API
    try:
        print("Attempting to connect via Google API...")
        req = urllib.request.Request(APPS_SCRIPT_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and isinstance(data, list):
                print("✅ Successfully fetched products from API!")
                return data
    except Exception as e:
        print(f"⚠️ API unavailable ({e}). Trying Direct Google Sheets CSV...")

    # 2. Try Primary CSV
    try:
        req = urllib.request.Request(PRIMARY_CSV_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            text = resp.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if rows:
                print("✅ Successfully fetched live products from Google Sheets CSV!")
                return rows
    except Exception as e:
        print(f"⚠️ Primary CSV failed ({e}). Trying Backup CSV...")

    # 3. Try Backup CSV
    try:
        req = urllib.request.Request(BACKUP_CSV_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            text = resp.read().decode('utf-8')
            reader = csv.DictReader(io.StringIO(text))
            rows = list(reader)
            if rows:
                print("✅ Successfully fetched from Backup Google Sheets CSV!")
                return rows
    except Exception as e:
        print(f"❌ Backup CSV failed: {e}")

    # 4. Fallback to existing products.csv on disk
    try:
        with open('products.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            print(f"ℹ️ Loaded {len(rows)} products from local products.csv fallback.")
            return rows
    except Exception:
        return []

products = fetch_products()

sitemap_entries = [
    f"""  <url>
    <loc>https://www.kailash-kalamkari.com/</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>""",
    f"""  <url>
    <loc>https://www.kailash-kalamkari.com/?department=saree</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>""",
    f"""  <url>
    <loc>https://www.kailash-kalamkari.com/?department=dupatta</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>"""
]

count = 0
for p in products:
    code = str(p.get('Code') or p.get('code') or p.get('Style Code') or p.get('id') or '').strip()
    if not code:
        continue

    fabric = str(p.get('Fabric') or p.get('fabric') or 'Pure Silk').strip()
    raw_img = (p.get('image id') or p.get('imageId') or p.get('image link') or 
               p.get('imageLink') or p.get('image_link') or p.get('Drive Link') or '')
    
    file_id = extract_file_id(raw_img)
    clean_fabric = re.sub(r'(?i)\b(sarees?|dupp?att?as?)\b', '', fabric).strip() or "Pure Silk"
    
    dept = 'dupatta' if 'dupatta' in fabric.lower() or 'duppata' in fabric.lower() else 'saree'
    dept_label = 'Dupatta' if dept == 'dupatta' else 'Saree'
    slug_fabric = re.sub(r'[^a-z0-9]+', '-', clean_fabric.lower()).strip('-') or 'silk'
    slug = f"srikalahasthi-pen-kalamkari-{slug_fabric}-{code}"

    clean_fabric_escaped = clean_fabric.replace("&", "&amp;")
    
    img_tag = ""
    if file_id:
        cdn_img_url = f"{IMAGE_CDN_BASE}/{file_id}"
        img_tag = f"""
    <image:image>
      <image:loc>{cdn_img_url}</image:loc>
      <image:title>Srikalahasthi Pen Kalamkari {clean_fabric_escaped} {dept_label} - {code}</image:title>
      <image:caption>Authentic Hand-Painted Srikalahasti Pen Kalamkari {clean_fabric_escaped} {dept_label} Kailash Kalamkari</image:caption>
    </image:image>"""

    entry = f"""  <url>
    <loc>https://www.kailash-kalamkari.com/?department={dept}&amp;product={slug}</loc>
    <lastmod>{TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>{img_tag}
  </url>"""
    sitemap_entries.append(entry)
    count += 1

xml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
{chr(10).join(sitemap_entries)}
</urlset>
"""

with open('sitemap.xml', 'w', encoding='utf-8') as f:
    f.write(xml_content)

print(f"🎉 Created sitemap.xml successfully with {count} search-optimized product URLs!")