
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://www.kailash-kalamkari.com';

const IMAGE_CDN =
    'https://kalamkari-images.kailashakalamkariacc.workers.dev';

// ============================================================
// HTML AND JSON SAFETY
// ============================================================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

// ============================================================
// WEBSITE FILES
// ============================================================

function readHomepage() {
    return fs.readFileSync(
        path.join(process.cwd(), 'home.html'),
        'utf8'
    );
}

function readWebsiteScript() {
    return fs.readFileSync(
        path.join(process.cwd(), 'script.js'),
        'utf8'
    );
}

// ============================================================
// CENTRAL DISCOUNT
// ============================================================

// The existing script.js is the single source of truth.
// The Google Merchant feed generator also reads this value.
//
// Do not create a second independent discount percentage.

function getDiscountPercent() {
    const script = readWebsiteScript();

    const match = script.match(
        /\bconst\s+GLOBAL_DISCOUNT_PERCENTAGE\s*=\s*(\d+(?:\.\d+)?)\s*;/
    );

    if (!match) {
        throw new Error(
            'Global website discount configuration missing'
        );
    }

    const discount = Number(match[1]);

    if (
        !Number.isFinite(discount) ||
        discount < 0 ||
        discount > 99
    ) {
        throw new Error(
            'Invalid global website discount'
        );
    }

    return discount;
}

// ============================================================
// RESPONSE HANDLING
// ============================================================

function sendHtml(res, status, html) {
    res.setHeader(
        'Content-Type',
        'text/html; charset=utf-8'
    );

    res.setHeader('Cache-Control', 'no-store');

    res.setHeader(
        'X-Content-Type-Options',
        'nosniff'
    );

    return res.status(status).send(html);
}

// ============================================================
// REQUEST PARAMETERS
// ============================================================

function getParams(req) {
    const url = new URL(
        req.url || '/',
        'https://internal.local'
    );

    const query = req.query || {};

    function get(name) {
        const value = query[name];

        if (typeof value === 'string') {
            return value.trim();
        }

        return (
            url.searchParams.get(name) || ''
        ).trim();
    }

    return {
        product: get('product'),
        department: get('department')
    };
}

// ============================================================
// PRODUCT URL GENERATION
// ============================================================

function cleanFabric(value) {
    return String(value || 'Silk')
        .replace(
            /\b(sarees?|dupp?att?as?)\b/gi,
            ''
        )
        .replace(/\s+/g, ' ')
        .trim() || 'Silk';
}

function departmentFor(product) {
    const value = [
        product.department,
        product.fabric,
        product.category
    ].join(' ').toLowerCase();

    return /dupatta|duppata|duppatta/.test(value)
        ? 'dupatta'
        : 'saree';
}

function makeSlug(product) {
    const fabric = cleanFabric(
        product.fabric
    )
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return (
        'srikalahasthi-pen-kalamkari-' +
        fabric +
        '-' +
        product.code
    );
}

// ============================================================
// PRODUCT IMAGES
// ============================================================

function fileId(value) {
    const str = String(
        value || ''
    ).trim();

    const match =
        str.match(/\/d\/([A-Za-z0-9_-]+)/) ||
        str.match(/[?&]id=([A-Za-z0-9_-]+)/) ||
        str.match(/^([A-Za-z0-9_-]{20,})$/);

    return match ? match[1] : '';
}

function getImage(product) {
    const archived = String(
        product.archived_image_url || ''
    ).trim();

    if (/^https:\/\//i.test(archived)) {
        return archived;
    }

    const values = [
        product.image_id,
        product.image_link,
        product.thumbnail_link
    ];

    for (const value of values) {
        const id = fileId(value);

        if (id) {
            return (
                IMAGE_CDN +
                '/' +
                encodeURIComponent(id)
            );
        }
    }

    for (const value of values) {
        if (
            /^https:\/\//i.test(
                String(value || '')
            )
        ) {
            return String(value);
        }
    }

    return SITE + '/logo.jpg';
}

// ============================================================
// PRODUCT AVAILABILITY
// ============================================================

// Mirrors the existing frontend script.js behavior:
// - Missing quantity defaults to 1.
// - Invalid quantity becomes 0.
// - Explicit unavailable status overrides quantity.
// - Null is_available does not automatically mean unavailable.
//
// No changes are made to database inventory records.

function isProductAvailable(product) {
    const rawQuantity = product.qty;

    let quantity =
        rawQuantity === null ||
        rawQuantity === undefined ||
        String(rawQuantity).trim() === ''
            ? 1
            : Number(rawQuantity);

    if (!Number.isFinite(quantity)) {
        quantity = 0;
    }

    const availability = String(
        product.is_available ??
        product.availability ??
        ''
    ).trim().toLowerCase();

    const unavailableValues = [
        'false',
        '0',
        'no',
        'out_of_stock',
        'out of stock',
        'sold out',
        'unavailable'
    ];

    if (unavailableValues.includes(availability)) {
        quantity = 0;
    }

    return quantity > 0;
}

// ============================================================
// SUPABASE PRODUCT LOOKUP
// ============================================================

async function findProduct(code) {
    const base = String(
        process.env.SUPABASE_URL || ''
    ).trim();

    const key = String(
        process.env.SUPABASE_ANON_KEY || ''
    ).trim();

    if (!base || !key) {
        throw new Error(
            'Supabase configuration missing'
        );
    }

    const endpoint = new URL(
        '/rest/v1/products',
        base
    );

    endpoint.searchParams.set(
        'select',
        '*'
    );

    endpoint.searchParams.set(
        'code',
        'eq.' + code
    );

    endpoint.searchParams.set(
        'limit',
        '1'
    );

    const response = await fetch(
        endpoint,
        {
            headers: {
                apikey: key,
                Authorization: 'Bearer ' + key,
                Accept: 'application/json'
            },
            signal: AbortSignal.timeout(8000)
        }
    );

    if (!response.ok) {
        throw new Error(
            'Supabase HTTP ' +
            response.status
        );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
        throw new Error(
            'Invalid product response'
        );
    }

    return rows[0] || null;
}

// ============================================================
// META TAG UPDATER
// ============================================================

function replaceMeta(html, id, value) {
    const escapedId = id.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
    );

    const regex = new RegExp(
        '<meta\\b(?=[^>]*\\bid=["\\\']' +
        escapedId +
        '["\\\'])[^>]*>',
        'i'
    );

    return html.replace(regex, tag => {
        const content =
            'content="' +
            escapeHtml(value) +
            '"';

        if (
            /\bcontent=["'][^"']*["']/i.test(
                tag
            )
        ) {
            return tag.replace(
                /\bcontent=["'][^"']*["']/i,
                content
            );
        }

        return tag.replace(
            />$/,
            ' ' + content + '>'
        );
    });
}

// ============================================================
// PRODUCT SEO HTML
// ============================================================

function buildProductHtml(
    product,
    slug,
    department
) {
    let html = readHomepage();

    const code = String(
        product.code
    );

    const fabric = cleanFabric(
        product.fabric
    );

    const type =
        department === 'dupatta'
            ? 'Dupatta'
            : 'Saree';

    const name =
        fabric + ' ' + type;

    const title =
        name +
        ' ' +
        code +
        ' | Kailash Kalamkari';

    const description = String(
        product.description ||
        (
            'Explore Srikalahasthi Pen Kalamkari ' +
            name +
            ', style code ' +
            code +
            ', at Kailash Kalamkari.'
        )
    ).trim();

    // ========================================================
    // PRICING
    // ========================================================

    // Same pricing rules as script.js:
    // Use MRP if present, otherwise source price.
    // Apply the global website discount.

    const rawMrp =
        Number(product.mrp) > 0
            ? Number(product.mrp)
            : Number(product.price || 0);

    if (
        !Number.isFinite(rawMrp) ||
        rawMrp <= 0
    ) {
        throw new Error(
            'Invalid product MRP'
        );
    }

    const discount =
        getDiscountPercent();

    const sellingPrice = Math.round(
        rawMrp *
        (1 - discount / 100)
    );

    // ========================================================
    // CANONICAL URL
    // ========================================================

    const canonical =
        SITE +
        '/?department=' +
        department +
        '&product=' +
        encodeURIComponent(slug);

    const image =
        getImage(product);

    const available =
        isProductAvailable(product);

    // ========================================================
    // PRODUCT STRUCTURED DATA
    // ========================================================

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',

        name: name,
        sku: code,

        description: description,
        image: [image],
        url: canonical,

        brand: {
            '@type': 'Brand',
            name: 'Kailash Kalamkari'
        },

        offers: {
            '@type': 'Offer',

            url: canonical,

            priceCurrency: 'INR',

            price: sellingPrice,

            availability: available
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',

            itemCondition:
                'https://schema.org/NewCondition'
        }
    };

    // ========================================================
    // TITLE
    // ========================================================

    html = html.replace(
        /<title>[\s\S]*?<\/title>/i,

        '<title>' +
        escapeHtml(title) +
        '</title>'
    );

    // ========================================================
    // CANONICAL META TAG
    // ========================================================

    html = html.replace(
        /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,

        '<link rel="canonical" ' +
        'id="canonical-url" ' +
        'href="' +
        escapeHtml(canonical) +
        '">'
    );

    // ========================================================
    // DESCRIPTION META TAG
    // ========================================================

    html = html.replace(
        /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,

        '<meta name="description" content="' +
        escapeHtml(description) +
        '">'
    );

    // ========================================================
    // SOCIAL SHARING METADATA
    // ========================================================

    const social = [
        ['og-title', title],
        ['og-desc', description],
        ['og-image', image],
        ['og-url', canonical],

        ['twitter-title', title],
        ['twitter-desc', description],
        ['twitter-image', image]
    ];

    for (const [id, value] of social) {
        html = replaceMeta(
            html,
            id,
            value
        );
    }

    // ========================================================
    // ONE PRODUCT JSON-LD ELEMENT
    // ========================================================

    // Reuse the original schema placeholder.
    // Do not create a duplicate Product script.

    const schemaElementPattern =
        /<script\b(?=[^>]*\bid=["']dynamic-product-schema["'])[^>]*>[\s\S]*?<\/script>/i;

    if (!schemaElementPattern.test(html)) {
        throw new Error(
            'Product schema placeholder missing'
        );
    }

    html = html.replace(
        schemaElementPattern,

        '<script ' +
        'type="application/ld+json" ' +
        'id="dynamic-product-schema">' +
        safeJson(schema) +
        '</script>'
    );

    // ========================================================
    // SEO VERIFICATION MARKER
    // ========================================================

    const marker =
        '<meta name="kk-server-product" ' +
        'content="' +
        escapeHtml(code) +
        '">';

    html = html.replace(
        '</head>',
        marker + '\n</head>'
    );

    // Keep the existing product detail HTML and UI.
    // Browser script.js still handles rendering,
    // navigation, wishlist and WhatsApp buttons.

    return html;
}

// ============================================================
// VERCEL SERVERLESS HANDLER
// ============================================================

module.exports = async function handler(
    req,
    res
) {
    if (req.method !== 'GET') {
        res.setHeader(
            'Allow',
            'GET'
        );

        return res
            .status(405)
            .send('Method not allowed');
    }

    let params;

    try {
        params = getParams(req);
    } catch (error) {
        return res
            .status(400)
            .send('Invalid request');
    }

    const slug =
        params.product;

    const department =
        params.department;

    // ========================================================
    // HOMEPAGE
    // ========================================================

    if (!slug) {
        try {
            return sendHtml(
                res,
                200,
                readHomepage()
            );
        } catch (error) {
            console.error(
                'Homepage error:',
                error.message
            );

            return res
                .status(503)
                .send(
                    'Homepage temporarily unavailable'
                );
        }
    }

    // ========================================================
    // PRODUCT URL VALIDATION
    // ========================================================

    if (
        !/^[a-z0-9-]{1,200}$/i.test(slug) ||
        !['saree', 'dupatta'].includes(
            department
        )
    ) {
        return res
            .status(404)
            .send('Product not found');
    }

    const match = slug.match(
        /-([A-Za-z0-9]+)$/
    );

    if (!match) {
        return res
            .status(404)
            .send('Product not found');
    }

    // ========================================================
    // FETCH PRODUCT AND GENERATE SEO
    // ========================================================

    try {
        const product = await findProduct(
            match[1]
        );

        if (!product) {
            return res
                .status(404)
                .send('Product not found');
        }

        const expectedSlug =
            makeSlug(product);

        const expectedDepartment =
            departmentFor(product);

        if (
            expectedSlug.toLowerCase() !==
                slug.toLowerCase() ||
            expectedDepartment !== department
        ) {
            return res
                .status(404)
                .send(
                    'Product URL not found'
                );
        }

        const html = buildProductHtml(
            product,
            slug,
            department
        );

        return sendHtml(
            res,
            200,
            html
        );

    } catch (error) {
        console.error(
            'Product SEO error:',
            error.message
        );

        res.setHeader(
            'Retry-After',
            '60'
        );

        return res
            .status(503)
            .send(
                'Product temporarily unavailable'
            );
    }
};
