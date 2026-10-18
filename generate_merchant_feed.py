import csv
import re

from pathlib import Path

from export_catalog_backup import (
    fetch_catalog,
    save_backup,
)


IMAGE_CDN_BASE = (
    "https://kalamkari-images."
    "kailashakalamkariacc.workers.dev"
)

OUTPUT_FILE = Path(__file__).resolve().with_name("products.csv")


# Read the same discount setting used by the website.
source = (
    Path(__file__)
    .with_name("script.js")
    .read_text(encoding="utf-8")
)

match = re.search(
    r"const GLOBAL_DISCOUNT_PERCENTAGE\s*=\s*([0-9.]+)",
    source,
)

if not match:
    raise ValueError(
        "Cannot read the global discount in script.js"
    )

discount = min(
    99,
    max(
        0,
        float(match.group(1)),
    ),
)


if discount != 10:
    raise ValueError("Expected a 10% global discount; no files changed.")

def parse_price(value):
    try:
        cleaned = re.sub(
            r"[^0-9.\-]",
            "",
            str(value),
        )

        return float(cleaned)

    except ValueError:
        return 0


def extract_file_id(value):
    if not value:
        return ""

    value = re.sub(r"=w\d+.*$", "", str(value).strip()).strip()

    if re.match(
        r"^[a-zA-Z0-9_-]{25,50}$",
        value,
    ):
        return value

    match = re.search(
        r"(?:id=|file/d/|/d/|document/d/)"
        r"([a-zA-Z0-9_-]{25,50})",
        value,
    )

    return match.group(1) if match else ""


# Fetch the complete raw catalogue.
# If fetching fails, the existing output is not overwritten.
products = fetch_catalog()

# Save raw prices for the website backup.
# The website applies the discount when displaying products.
# Save only after validating and preparing the feed below.


headers = [
    "id",
    "title",
    "description",
    "link",
    "image_link",
    "availability",
    "price",
    "brand",
    "condition",
    "google_product_category",
    "product_type",
]

rows = []
count = 0


for product in products:
    code = str(
        product.get("code")
        or product.get("Code")
        or product.get("Style Code")
        or product.get("id")
        or ""
    ).strip()

    if (
        not code
        or code == "#N/A"
        or code.startswith("#")
    ):
        continue

    fabric = str(
        product.get("fabric")
        or product.get("Fabric")
        or "Pure Silk"
    ).strip()

    department_raw = str(
        product.get("department")
        or product.get("Department")
        or ""
    ).lower()

    if (
        "dupatta" in department_raw
        or "duppata" in department_raw
        or "dupatta" in fabric.lower()
        or "duppata" in fabric.lower()
    ):
        department = "dupatta"
        department_label = "Dupatta"

    else:
        department = "saree"
        department_label = "Saree"

    clean_fabric = re.sub(
        r"(?i)\b(sarees?|dupp?att?as?)\b",
        "",
        fabric,
    ).strip()

    if not clean_fabric:
        clean_fabric = "Pure Silk"

    raw_image = (
        product.get("image_id")
        or product.get("image id")
        or product.get("imageId")
        or product.get("image_link")
        or product.get("image link")
        or product.get("imageLink")
        or product.get("Drive Link")
        or ""
    )

    file_id = extract_file_id(raw_image)

    if file_id:
        image_url = (
            f"{IMAGE_CDN_BASE}/{file_id}"
        )

    else:
        image_url = (
            str(raw_image).strip()
            if str(raw_image).startswith(
                ("https://", "http://")
            )
            else ""
        )

    if not image_url:
        continue

    slug_fabric = (
        re.sub(
            r"[^a-z0-9]+",
            "-",
            clean_fabric.lower(),
        ).strip("-")
        or "silk"
    )

    slug = (
        "srikalahasthi-pen-kalamkari-"
        f"{slug_fabric}-{code}"
    )

    product_link = (
        "https://www.kailash-kalamkari.com/"
        f"?department={department}"
        f"&product={slug}"
    )

    # Explicit MRP is the base price when available.
    base_price = parse_price(
        product.get("mrp")
        or product.get("MRP")
        or product.get("m.r.p")
        or product.get("original price")
    )

    # Otherwise use the source price.
    if base_price <= 0:
        base_price = parse_price(
            product.get("price")
            or product.get("Price")
            or product.get("selling price")
            or product.get("rate")
        )

    # Do not invent prices for unpriced products.
    if base_price <= 0:
        continue

    # Match JavaScript rounding for positive prices.
    numeric_price = int(
        base_price * (1 - discount / 100)
        + 0.5
    )

    price_string = (
        f"{numeric_price} INR"
    )

    # Preserve zero stock instead of treating it
    # as a missing quantity.
    raw_quantity = next(
        (
            product[key]
            for key in (
                "qty",
                "quantity",
                "Qty",
            )
            if (
                key in product
                and product[key] is not None
                and str(product[key]).strip()
            )
        ),
        1,
    )

    try:
        quantity = float(
            raw_quantity
        )

    except (
        ValueError,
        TypeError,
    ):
        quantity = 0

    availability = (
        "in_stock"
        if quantity > 0
        else "out_of_stock"
    )

    title = (
        "Kailash Kalamkari Srikalahasthi "
        "Pen Kalamkari Hand-Painted "
        f"{clean_fabric} "
        f"{department_label} - {code}"
    )

    description = str(
        product.get("description")
        or ""
    ).strip()

    if (
        not description
        or len(description) < 20
    ):
        description = (
            "Authentic hand-painted Srikalahasthi "
            "(Srikalahasti) Pen Kalamkari "
            f"{clean_fabric} {department_label} "
            f"(Code: {code}). "
            "Traditional natural dyes, "
            "hand-drawn using bamboo/date-palm "
            "kalam pens directly from Kailash "
            "Kalamkari master artisans since 1984."
        )

    description = re.sub(
        r"tamarind\s+twig\s+pens?",
        "bamboo/date-palm kalam pens",
        description,
        flags=re.IGNORECASE,
    )

    google_category = (
        "2271"
        if department == "saree"
        else "212"
    )

    product_type = (
        "Apparel & Accessories > Clothing > "
        "Traditional Clothing > "
        f"Pen Kalamkari {department_label}s"
    )

    rows.append(
        [
            code,
            title,
            description,
            product_link,
            image_url,
            availability,
            price_string,
            "Kailash Kalamkari",
            "new",
            google_category,
            product_type,
        ]
    )

    count += 1


if not rows:
    raise RuntimeError("No valid feed rows; existing output files preserved.")

temporary = OUTPUT_FILE.with_suffix(".csv.tmp")
try:
    with temporary.open("w", newline="", encoding="utf-8") as output:
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
    backup_path = save_backup(products)
    temporary.replace(OUTPUT_FILE)
finally:
    if temporary.exists():
        temporary.unlink()

print(f"Source catalogue: {len(products)} products")
print(f"Global discount: {discount:g}%")
print(f"Backup saved: {backup_path}")
print(f"Feed saved: {OUTPUT_FILE}")
print(f"Feed products: {count}")
print(f"Skipped products: {len(products) - count}")
