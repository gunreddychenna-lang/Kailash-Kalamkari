import json
import urllib.request
import csv
import io
import re
import ssl
from xml.sax.saxutils import escape as xml_escape
from datetime import datetime

# =========================================================================
# ENDPOINTS (Supabase Fast DB -> Apps Script -> Google Sheets CSV)
# =========================================================================
SUPABASE_URL = "https://ehovvhckvgwfkbgfvchi.supabase.co/rest/v1/products?select=*&limit=5000"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3Z2aGNrdmd3ZmtiZ2Z2Y2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDc4MzAsImV4cCI6MjEwNjkyMzgzMH0.Mx5PyiObZ7aTsL37QKADwUrJnIldWItXaeO2Kma9zKg"

APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec'
PRIMARY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?gid=100332201&single=true&output=csv'
BACKUP_CSV_URL  = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?output=csv'

IMAGE_CDN_BASE  = 'https://kalamkari-images.kailashakalamkariacc.workers.dev'
OUTPUT_FILE     = 'sitemap.xml'

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
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Range': '0-4999'
    }

    # 1. Primary: Supabase REST API
    try:
        print("⚡ Connecting to Supabase Database...")
        req = urllib.request.Request(SUPABASE_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=5, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and isinstance(data, list) and len(data) > 0:
                print(f"✅ Successfully fetched {len(data)} products from Supabase!")
                return data
    except Exception as e:
        print(f"⚠️ Supabase unavailable ({e}). Trying Apps Script API...")

    # 2. Fallback: Google Apps Script API
    try:
        req = urllib.request.Request(APPS_SCRIPT_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data and isinstance(data, list) and len(data) > 0:
                print(f"✅ Successfully fetched {len(data)} products from Apps Script API!")
                return data
    except Exception as e:
        print(f"⚠️ Apps Script unavailable ({e}). Trying Primary Google Sheets CSV...")

    # 3. Fallback: Primary Google Sheets CSV
    try:
        req = urllib.request.Request(PRIMARY_CSV_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            text = resp.read().decode('utf-8')
            rows = list(csv.DictReader(io.StringIO(text)))
            if rows:
                print(f"✅ Successfully fetched {len(rows)} products from Primary CSV!")
                return rows
    except Exception as e:
        print(f"⚠️ Primary CSV failed ({e}). Trying Backup CSV...")

    # 4. Fallback: Backup Google Sheets CSV
    try:
        req = urllib.request.Request(BACKUP_CSV_URL, headers=headers)
        with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
            text = resp.read().decode('utf-8')
            rows = list(csv.DictReader(io.StringIO(text)))
            if rows:
                print(f"✅ Successfully fetched {len(rows)} products from Backup CSV!")
                return rows
    except Exception as e:
        print(f"❌ Backup CSV failed: {e}")

    # 5. Local products.csv disk fallback
    try:
        with open('products.csv', 'r', encoding='utf-8') as f:
            rows = list(csv.DictReader(f))
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
    code = str(p.get('code') or p.get('Code') or p.get('Style Code') or p.get('id') or '').strip()
    if not code or code == '#N/A' or code.startswith('#'):
        continue

    fabric = str(p.get('fabric') or p.get('Fabric') or 'Pure Silk').strip()
    raw_img = (p.get('image_id') or p.get('image id') or p.get('imageId') or 
               p.get('image_link') or p.get('image link') or p.get('imageLink') or 
               p.get('Drive Link') or '')
    
    file_id = extract_file_id(raw_img)
    clean_fabric = re.sub(r'(?i)\b(sarees?|dupp?att?as?)\b', '', fabric).strip() or "Pure Silk"
    
    dept_raw = str(p.get('department') or p.get('Department') or '').lower()
    if 'dupatta' in dept_raw or 'duppata' in dept_raw or 'dupatta' in fabric.lower() or 'duppata' in fabric.lower():
        dept = 'dupatta'
        dept_label = 'Dupatta'
    else:
        dept = 'saree'
        dept_label = 'Saree'

    slug_fabric = re.sub(r'[^a-z0-9]+', '-', clean_fabric.lower()).strip('-') or 'silk'
    slug = f"srikalahasthi-pen-kalamkari-{slug_fabric}-{code}"

    clean_fabric_escaped = xml_escape(clean_fabric)
    code_escaped = xml_escape(code)
    
    img_tag = ""
    if file_id:
        cdn_img_url = f"{IMAGE_CDN_BASE}/{file_id}"
        img_tag = f"""
    <image:image>
      <image:loc>{cdn_img_url}</image:loc>
      <image:title>Srikalahasthi Pen Kalamkari {clean_fabric_escaped} {dept_label} - {code_escaped}</image:title>
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

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(xml_content)

print(f"🎉 Created {OUTPUT_FILE} successfully with {count} search-optimized product URLs!")