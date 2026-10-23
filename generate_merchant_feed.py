
import csv
import re

from pathlib import Path

from export_catalog_backup import (
    fetch_catalog,
    save_backup,
)


# ============================================================
# KAILASH KALAMKARI - GOOGLE MERCHANT FEED
# Only verified active Supabase products are published.
# MRP remains unchanged in the database.
# Website discount is read from script.js.
# ============================================================

ROOT = Path(__file__).resolve().parent
OUTPUT_FILE = ROOT / "products.csv"

SITE_URL = "https://www.kailash-kalamkari.com"

IMAGE_CDN_BASE = (
    "https://kalamkari-images."
    "kailashakalamkariacc.workers.dev"
)

# Safety minimum for the current 1,185-product catalogue.
# This is NOT a fixed product-count requirement.
MIN_ACTIVE_PRODUCTS = 1000


def get_global_discount():
    script_path = ROOT / "script.js"

    source = script_path.read_text(
        encoding="utf-8-sig"
    )

    match = re.search(
        r"\bconst\s+GLOBAL_DISCOUNT_PERCENTAGE"
        r"\s*=\s*([0-9.]+)\s*;",
        source,
    )

    if not match:
        raise ValueError(
            "Global discount setting missing in script.js"
        )

    discount = float(match.group(1))

    if not 0 <= discount <= 99:
        raise ValueError(
            "Invalid global discount percentage"
        )

    return discount


def parse_price(value):
    if value is None:
        return 0.0

    cleaned = re.sub(
        r"[^0-9.\-]",
        "",
        str(value),
    )

    try:
        number = float(cleaned)
        return number if number > 0 else 0.0
    except (ValueError, OverflowError):
        return 0.0


def extract_file_id(value):
    if not value:
        return ""

    value = re.sub(
        r"=w\d+.*$",
        "",
        str(value).strip(),
    ).strip()

    if re.fullmatch(
        r"[A-Za-z0-9_-]{25,50}",
        value,
    ):
        return value

    match = re.search(
        r"(?:id=|file/d/|/d/|document/d/)"
        r"([A-Za-z0-9_-]{25,50})",
        value,
    )

    return match.group(1) if match else ""


def get_image_url(product):
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
        return f"{IMAGE_CDN_BASE}/{file_id}"

    raw_url = str(raw_image).strip()

    if raw_url.startswith("https://"):
        return raw_url

    return ""


def is_active_product(product):
    # Supabase PostgreSQL boolean should arrive as
    # Python True. Do not treat NULL/missing as active.
    if product.get("is_available") is not True:
        return False

    try:
        quantity = float(product.get("qty"))
    except (TypeError, ValueError):
        return False

    return quantity > 0


def get_product_code(product):
    return str(
        product.get("code")
        or product.get("Code")
        or product.get("Style Code")
        or product.get("id")
        or ""
    ).strip()


def get_department(product, fabric):
    department_raw = str(
        product.get("department")
        or product.get("Department")
        or ""
    ).lower()

    text = department_raw + " " + fabric.lower()

    if re.search(
        r"dupatta|duppata|duppatta",
        text,
    ):
        return "dupatta", "Dupatta"

    return "saree", "Saree"


def clean_fabric_name(fabric):
    clean = re.sub(
        r"(?i)\b(sarees?|dupp?att?as?)\b",
        "",
        fabric,
    ).strip()

    return clean or "Pure Silk"


def make_product_link(code, clean_fabric, department):
    slug_fabric = re.sub(
        r"[^a-z0-9]+",
        "-",
        clean_fabric.lower(),
    ).strip("-") or "silk"

    slug = (
        "srikalahasthi-pen-kalamkari-"
        f"{slug_fabric}-{code}"
    )

    return (
        f"{SITE_URL}/"
        f"?department={department}"
        f"&product={slug}"
    )


def get_mrp(product):
    mrp = parse_price(
        product.get("mrp")
        or product.get("MRP")
        or product.get("m.r.p")
        or product.get("original price")
    )

    if mrp > 0:
        return mrp

    return parse_price(
        product.get("price")
        or product.get("Price")
        or product.get("selling price")
        or product.get("rate")
    )


def get_description(product, fabric, label, code):
    description = str(
        product.get("description") or ""
    ).strip()

    if not description or len(description) < 20:
        description = (
            "Authentic hand-painted Srikalahasthi "
            "(Srikalahasti) Pen Kalamkari "
            f"{fabric} {label} "
            f"(Code: {code}). "
            "Traditional natural dyes, "
            "hand-drawn using bamboo/date-palm "
            "kalam pens directly from Kailash "
            "Kalamkari master artisans since 1984."
        )

    return re.sub(
        r"tamarind\s+twig\s+pens?",
        "bamboo/date-palm kalam pens",
        description,
        flags=re.IGNORECASE,
    )


def generate_feed():
    discount = get_global_discount()

    # Existing exporter handles source credentials
    # and Supabase pagination.
    products = fetch_catalog()

    if not isinstance(products, list):
        raise RuntimeError(
            "Catalogue source did not return a list. "
            "Existing files preserved."
        )

    # Reject incomplete or stale catalogue responses.
    active_products = [
        product
        for product in products
        if isinstance(product, dict)
        and is_active_product(product)
    ]

    if len(active_products) < MIN_ACTIVE_PRODUCTS:
        raise RuntimeError(
            "Safety check failed: "
            f"only {len(active_products)} active products "
            f"out of {len(products)} source records. "
            "Existing output files preserved."
        )

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
    seen_codes = set()

    for product in active_products:
        code = get_product_code(product)

        if (
            not code
            or code == "#N/A"
            or code.startswith("#")
        ):
            raise RuntimeError(
                "Active catalogue contains an invalid product code."
            )

        if code in seen_codes:
            raise RuntimeError(
                f"Duplicate active product code: {code}"
            )

        seen_codes.add(code)

        fabric = str(
            product.get("fabric")
            or product.get("Fabric")
            or "Pure Silk"
        ).strip()

        department, department_label = (
            get_department(product, fabric)
        )

        clean_fabric = clean_fabric_name(fabric)

        image_url = get_image_url(product)

        if not image_url:
            raise RuntimeError(
                f"Missing image for active product: {code}"
            )

        base_price = get_mrp(product)

        if base_price <= 0:
            raise RuntimeError(
                f"Invalid MRP for active product: {code}"
            )

        # Matches positive-price JavaScript Math.round.
        selling_price = int(
            base_price * (1 - discount / 100) + 0.5
        )

        if selling_price <= 0:
            raise RuntimeError(
                f"Invalid selling price: {code}"
            )

        product_link = make_product_link(
            code,
            clean_fabric,
            department,
        )

        title = (
            "Kailash Kalamkari Srikalahasthi "
            "Pen Kalamkari Hand-Painted "
            f"{clean_fabric} "
            f"{department_label} - {code}"
        )

        description = get_description(
            product,
            clean_fabric,
            department_label,
            code,
        )

        google_category = (
            "2271" if department == "saree" else "212"
        )

        product_type = (
            "Apparel & Accessories > Clothing > "
            "Traditional Clothing > "
            f"Pen Kalamkari {department_label}s"
        )

        rows.append([
            code,
            title,
            description,
            product_link,
            image_url,
            "in_stock",
            f"{selling_price} INR",
            "Kailash Kalamkari",
            "new",
            google_category,
            product_type,
        ])

    if len(rows) != len(active_products):
        raise RuntimeError(
            "Feed count mismatch. Existing files preserved."
        )

    temporary = OUTPUT_FILE.with_suffix(
        ".csv.tmp"
    )

    try:
        with temporary.open(
            "w",
            newline="",
            encoding="utf-8",
        ) as output:
            writer = csv.writer(output)
            writer.writerow(headers)
            writer.writerows(rows)

        # Keep the raw-price backup aligned to active stock.
        # Never store discounted prices in this backup.
        backup_path = save_backup(active_products)

        temporary.replace(OUTPUT_FILE)

    finally:
        if temporary.exists():
            temporary.unlink()

    print(f"Source catalogue: {len(products)}")
    print(f"Active products: {len(active_products)}")
    print(f"Inactive excluded: {len(products) - len(active_products)}")
    print(f"Global discount: {discount:g}%")
    print(f"Feed products: {len(rows)}")
    print(f"Backup saved: {backup_path}")
    print(f"Feed saved: {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_feed()
