"""Build sitemap.xml from the generated products.csv merchant feed."""

import csv
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


ROOT = Path(__file__).resolve().parent
FEED_FILE = ROOT / "products.csv"
OUTPUT_FILE = ROOT / "sitemap.xml"

SITE_URL = "https://www.kailash-kalamkari.com/"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1"

ET.register_namespace("", SITEMAP_NS)
ET.register_namespace("image", IMAGE_NS)


def add_url(root, link, image_link=""):
    entry = ET.SubElement(root, f"{{{SITEMAP_NS}}}url")
    ET.SubElement(entry, f"{{{SITEMAP_NS}}}loc").text = link

    if image_link:
        image = ET.SubElement(entry, f"{{{IMAGE_NS}}}image")
        ET.SubElement(image, f"{{{IMAGE_NS}}}loc").text = image_link


def main():
    if not FEED_FILE.is_file():
        raise FileNotFoundError(
            f"Missing {FEED_FILE}. "
            "Run generate_merchant_feed.py first."
        )

    with FEED_FILE.open(
        "r", newline="", encoding="utf-8-sig"
    ) as source:
        reader = csv.DictReader(source)
        required = {"id", "link", "image_link"}

        if not required.issubset(reader.fieldnames or []):
            raise ValueError(
                "products.csv is missing required columns: "
                "id, link, image_link."
            )

        products = list(reader)

    if not products:
        raise ValueError(
            "products.csv is empty. Existing sitemap was preserved."
        )

    root = ET.Element(f"{{{SITEMAP_NS}}}urlset")
    main_links = [
        SITE_URL,
        SITE_URL + "?department=saree",
        SITE_URL + "?department=dupatta",
    ]

    for link in main_links:
        add_url(root, link)

    seen_links = set(main_links)
    count = 0
    duplicates = 0

    for line_number, product in enumerate(products, start=2):
        link = (product.get("link") or "").strip()
        image_link = (product.get("image_link") or "").strip()

        parsed = urlsplit(link)
        query = parse_qs(parsed.query)

        if (
            parsed.scheme != "https"
            or parsed.netloc != "www.kailash-kalamkari.com"
            or parsed.path not in ("", "/")
            or parsed.fragment
            or not query.get("product")
        ):
            raise ValueError(
                f"Invalid product link on CSV row {line_number}. "
                "Existing sitemap was preserved."
            )

        if image_link:
            parsed_image = urlsplit(image_link)
            if (
                parsed_image.scheme not in ("https", "http")
                or not parsed_image.netloc
            ):
                raise ValueError(
                    f"Invalid image link on CSV row {line_number}. "
                    "Existing sitemap was preserved."
                )

        if link in seen_links:
            duplicates += 1
            continue

        add_url(root, link, image_link)
        seen_links.add(link)
        count += 1

    if not count:
        raise ValueError(
            "No product URLs found. Existing sitemap was preserved."
        )

    if len(seen_links) > 50000:
        raise ValueError(
            "More than 50,000 URLs. Split sitemap files are required. "
            "Existing sitemap was preserved."
        )

    # Do not invent lastmod dates: generation time does not prove
    # when each product page was last materially updated.
    ET.indent(root, space="  ")
    tree = ET.ElementTree(root)
    temporary = OUTPUT_FILE.with_suffix(".xml.tmp")

    try:
        tree.write(
            temporary,
            encoding="utf-8",
            xml_declaration=True,
        )

        # Verify the generated XML before replacing the existing file.
        ET.parse(temporary)

        if temporary.stat().st_size > 50 * 1024 * 1024:
            raise ValueError(
                "Sitemap exceeds 50 MB. Existing sitemap was preserved."
            )

        temporary.replace(OUTPUT_FILE)

    finally:
        if temporary.exists():
            temporary.unlink()

    print(f"Feed rows: {len(products)}")
    print(f"Product URLs: {count}")
    print(f"Main/category URLs: {len(main_links)}")
    print(f"Duplicate links skipped: {duplicates}")
    print(f"Total sitemap URLs: {len(seen_links)}")
    print(f"Saved: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()