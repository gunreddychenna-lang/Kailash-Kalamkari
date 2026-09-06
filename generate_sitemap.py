import json
import urllib.request
import re
from datetime import datetime

API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec'
TODAY = datetime.today().strftime('%Y-%m-%d')

print("Fetching products from Google Sheet...")
req = urllib.request.Request(API_URL, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    products = json.loads(response.read().decode('utf-8'))

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
    code = str(p.get('Code') or p.get('code') or p.get('Style Code') or '').strip()
    fabric = str(p.get('Fabric') or p.get('fabric') or 'Silk').strip()
    
    # Strip any existing '=w...' or query parameters from the ID
    raw_id = str(p.get('image id') or p.get('imageId') or '').strip()
    file_id = re.sub(r'(=w\d+.*|\?.*)$', '', raw_id)
    
    if not code:
        continue

    # Clean slug
    clean_fabric = re.sub(r'[^a-z0-9]+', '-', fabric.lower()).strip('-')
    dept = 'dupatta' if 'dupatta' in fabric.lower() or 'duppata' in fabric.lower() else 'saree'
    slug = f"srikalahasthi-pen-kalamkari-{clean_fabric}-{code}"

    img_tag = ""
    if file_id:
        cdn_img_url = f"https://lh3.googleusercontent.com/d/{file_id}=w1400"
        img_title = fabric.replace("&", "&amp;")
        img_tag = f"""
    <image:image>
      <image:loc>{cdn_img_url}</image:loc>
      <image:title>Kailash Kalamkari {img_title} - {code}</image:title>
      <image:caption>Authentic Handpainted Srikalahasti Pen Kalamkari {img_title}</image:caption>
    </image:image>"""

    # Using &amp; for valid XML
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

print(f"✅ Created sitemap.xml with {count} valid XML product URLs!")