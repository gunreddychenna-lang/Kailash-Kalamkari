import json
import urllib.request
import csv
import re

API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec'
OUTPUT_FILE = 'products.csv'

print("Connecting to live database and fetching products...")
req = urllib.request.Request(API_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    products = json.loads(response.read().decode('utf-8'))

# Google Merchant Center standard required & recommended headers
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
    code = str(p.get('Code') or p.get('code') or p.get('Style Code') or '').strip()
    if not code:
        continue

    fabric = str(p.get('Fabric') or p.get('fabric') or 'Pure Silk').strip()
    dept = 'dupatta' if 'dupatta' in fabric.lower() or 'duppata' in fabric.lower() else 'saree'
    dept_label = 'Dupatta' if dept == 'dupatta' else 'Saree'
    
    # Clean duplicate words (e.g., prevents "Sarees Saree" or "Duppatas Dupatta")
    clean_fabric = re.sub(r'(?i)\b(sarees?|dupp?att?as?)\b', '', fabric).strip()
    if not clean_fabric:
        clean_fabric = "Pure Silk"

    # Clean image file ID
    raw_id = str(p.get('image id') or p.get('imageId') or '').strip()
    file_id = re.sub(r'(=w\d+.*|\?.*)$', '', raw_id)
    image_url = f"https://lh3.googleusercontent.com/d/{file_id}=w1200" if file_id else ""

    # Clean URL Slug
    slug_fabric = re.sub(r'[^a-z0-9]+', '-', clean_fabric.lower()).strip('-')
    slug = f"srikalahasthi-pen-kalamkari-{slug_fabric}-{code}"
    product_link = f"https://www.kailash-kalamkari.com/?department={dept}&product={slug}"

    # Price handling
    raw_price = str(p.get('price') or p.get('selling price') or p.get('rate') or '').strip()
    numeric_price = re.sub(r'[^0-9]', '', raw_price)
    if not numeric_price or numeric_price == '0':
        numeric_price = '2500' if dept == 'dupatta' else '14500'
    price_str = f"{numeric_price} INR"

    # Stock / Availability handling
    raw_qty = str(p.get('qty') or p.get('quantity') or '1').strip()
    qty = int(raw_qty) if raw_qty.isdigit() else 1
    availability = 'in_stock' if qty > 0 else 'out_of_stock'

    # HIGH SEARCH VOLUME OPTIMIZED TITLE
    # Formula: Brand + Location + Pen Kalamkari + Hand-Painted + Fabric + Department + Code
    title = f"Kailash Kalamkari Srikalahasthi Pen Kalamkari Hand-Painted {clean_fabric} {dept_label} - {code}"

    # Rich Keyword Description
    desc = str(p.get('description') or "").strip()
    if not desc or len(desc) < 20:
        desc = (f"Authentic hand-painted Srikalahasthi (Srikalahasti) Pen Kalamkari {clean_fabric} {dept_label} (Code: {code}). "
                f"100% natural organic vegetable dyes hand-drawn using traditional tamarind twig pens directly from Kailash Kalamkari master artisans since 1984.")

    # Google Product Category (Official Google Taxonomy)
    # 2271 = Traditional & Ceremonial Clothing > Sarees
    # 212 = Clothing Accessories > Scarves & Shawls
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

print(f"✅ Created {OUTPUT_FILE} successfully with {count} search-optimized products!")