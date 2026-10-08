import json
import urllib.request
import csv
import io
import re
import ssl
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
OUTPUT_FILE     = 'products.csv'

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

    # 1. Primary: Supabase REST API (Sub-second speed)
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

    return []

products = fetch_products()

# Official Google Merchant Center standard taxonomy headers
headers = [
    'id',
    'title',
    'description',
    'link',
    'image_link',
    'availability',
    'price',
    'brand',
    'condition',
    'google_product_category',
    'product_type'
]

rows = []
count = 0

for p in products:
    code = str(p.get('code') or p.get('Code') or p.get('Style Code') or p.get('id') or '').strip()
    if not code or code == '#N/A' or code.startswith('#'):
        continue

    fabric = str(p.get('fabric') or p.get('Fabric') or 'Pure Silk').strip()
    
    # Identify department
    dept_raw = str(p.get('department') or p.get('Department') or '').lower()
    if 'dupatta' in dept_raw or 'duppata' in dept_raw or 'dupatta' in fabric.lower() or 'duppata' in fabric.lower():
        dept = 'dupatta'
        dept_label = 'Dupatta'
    else:
        dept = 'saree'
        dept_label = 'Saree'
    
    clean_fabric = re.sub(r'(?i)\b(sarees?|dupp?att?as?)\b', '', fabric).strip()
    if not clean_fabric:
        clean_fabric = "Pure Silk"

    # Extract image
    raw_img = (p.get('image_id') or p.get('image id') or p.get('imageId') or 
               p.get('image_link') or p.get('image link') or p.get('imageLink') or 
               p.get('Drive Link') or '')
    file_id = extract_file_id(raw_img)
    
    if file_id:
        image_url = f"{IMAGE_CDN_BASE}/{file_id}"
    else:
        image_url = f"https://lh3.googleusercontent.com/d/{file_id}=w1200" if file_id else ""

    slug_fabric = re.sub(r'[^a-z0-9]+', '-', clean_fabric.lower()).strip('-') or 'silk'
    slug = f"srikalahasthi-pen-kalamkari-{slug_fabric}-{code}"
    product_link = f"https://www.kailash-kalamkari.com/?department={dept}&product={slug}"

    # Price handling
    raw_price = str(p.get('price') or p.get('Price') or p.get('selling price') or p.get('rate') or '').strip()
    numeric_price = re.sub(r'[^0-9]', '', raw_price)
    if not numeric_price or numeric_price == '0':
        numeric_price = '2500' if dept == 'dupatta' else '14500'
    price_str = f"{numeric_price} INR"

    # Availability based on quantity
    raw_qty = str(p.get('qty') or p.get('quantity') or p.get('Qty') or '1').strip()
    qty = int(raw_qty) if raw_qty.isdigit() else 1
    availability = 'in_stock' if qty > 0 else 'out_of_stock'

    # High CTR SEO optimized Title & Description
    title = f"Kailash Kalamkari Srikalahasthi Pen Kalamkari Hand-Painted {clean_fabric} {dept_label} - {code}"

    desc = str(p.get('description') or "").strip()
    if not desc or len(desc) < 20:
        desc = (f"Authentic hand-painted Srikalahasthi (Srikalahasti) Pen Kalamkari {clean_fabric} {dept_label} (Code: {code}). "
                f"100% natural organic vegetable dyes hand-drawn using traditional tamarind twig pens directly from Kailash Kalamkari master artisans since 1984.")

    google_category = "2271" if dept == 'saree' else "212"
    product_type = f"Apparel & Accessories > Clothing > Traditional Clothing > Pen Kalamkari {dept_label}s"

    rows.append([
        code,
        title,
        desc,
        product_link,
        image_url,
        availability,
        price_str,
        "Kailash Kalamkari",
        "new",
        google_category,
        product_type
    ])
    count += 1

with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows)

print(f"🎉 Created {OUTPUT_FILE} successfully with {count} search-optimized products!")