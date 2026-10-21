
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BASE = 'https://www.kailash-kalamkari.com';
const DISCOUNT = 10;

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const safeJson = value => JSON.stringify(value)
    .replace(/</g, '\\u003c');

function departmentFor(p) {
    const text = [
        p.department,
        p.fabric,
        p.category,
        p.code,
        p.description
    ].join(' ').toLowerCase();

    return /dupatt?a|duppatt?a/.test(text)
        ? 'dupatta'
        : 'saree';
}

function makeSlug(p) {
    const fabric = String(p.fabric || 'silk')
        .toLowerCase()
        .replace(/\b(sarees?|dupp?att?as?)\b/gi, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'silk';

    return `srikalahasthi-pen-kalamkari-${fabric}-${p.code}`;
}

function imageUrl(p) {
    if (/^https:\/\//i.test(p.archived_image_url || '')) {
        return p.archived_image_url;
    }

    const values = [
        p.image_id,
        p.image_link,
        p.thumbnail_link
    ];

    for (const value of values) {
        const text = String(value || '');
        const match = text.match(/\/d\/([\w-]+)/) ||
            text.match(/[?&]id=([\w-]+)/) ||
            text.match(/^([\w-]{20,})$/);

        if (match) {
            return 'https://kalamkari-images.kailashakalamkariacc.workers.dev/'
                + encodeURIComponent(match[1]);
        }
    }

    return values.find(v => /^https:\/\//i.test(v || '')) ||
        BASE + '/logo.jpg';
}

async function findProduct(code) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error('Supabase configuration missing');
    }

    const endpoint = new URL('/rest/v1/products', url);
    endpoint.searchParams.set('select', '*');
    endpoint.searchParams.set('code', `eq.${code}`);
    endpoint.searchParams.set('limit', '1');

    const response = await fetch(endpoint, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
        },
        signal: AbortSignal.timeout(7000)
    });

    if (!response.ok) {
        throw new Error(`Supabase HTTP ${response.status}`);
    }

    const rows = await response.json();
    return rows[0] || null;
}

function makeHtml(p, slug, department) {
    const htmlPath = path.join(process.cwd(), 'home.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    const fabric = String(p.fabric || 'Pure Silk')
        .replace(/\b(sarees?|dupp?att?as?)\b/gi, '')
        .trim() || 'Pure Silk';

    const type = department === 'dupatta' ? 'Dupatta' : 'Saree';
    const title = `${fabric} Pen Kalamkari ${type} ${p.code} | Kailash Kalamkari`;

    const description = `Explore authentic hand-painted Srikalahasthi Pen Kalamkari ${fabric} ${type}, product ${p.code}, at Kailash Kalamkari.`;

    const rawMrp = Number(p.mrp) > 0
        ? Number(p.mrp)
        : Number(p.price || 0);

    const sellingPrice = Math.round(rawMrp * (1 - DISCOUNT / 100));
    const canonical = `${BASE}/?department=${department}&product=${slug}`;
    const image = imageUrl(p);
    const available = p.is_available !== false && Number(p.qty) > 0;

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: `${fabric} ${type} ${p.code}`,
        sku: p.code,
        description: p.description || description,
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
            itemCondition: 'https://schema.org/NewCondition',
            availability: available
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock'
        }
    };

    html = html.replace(
        /<title>[\s\S]*?<\/title>/i,
        `<title>${escapeHtml(title)}</title>`
    );

    html = html.replace(
        /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
        `<link rel="canonical" id="canonical-url" href="${escapeHtml(canonical)}">`
    );

    html = html.replace(
        /<meta\s+name="description"[\s\S]*?>/i,
        `<meta name="description" content="${escapeHtml(description)}">`
    );

    const metadata = `
<meta property="og:type" content="product">
<meta name="kk-server-product" content="${escapeHtml(p.code)}">
<script type="application/ld+json">${safeJson(schema)}</script>
`;

    html = html.replace('</head>', `${metadata}</head>`);

    const summary = `
<section aria-label="Product details" id="server-product-summary">
<h1>${escapeHtml(fabric)} ${escapeHtml(type)} — ${escapeHtml(p.code)}</h1>
<p>${escapeHtml(p.description || description)}</p>
<p>Price: ₹${sellingPrice}</p>
<img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" width="480" loading="lazy">
</section>`;

    // The existing JavaScript shopping interface remains unchanged.
    // This initial summary is available before JavaScript loads.
    html = html.replace(
        '<body',
        '<body'
    );

    html = html.replace(
        /(<body[^>]*>)/i,
        `$1\n${summary}`
    );

    return html;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).end();
    }

    const slug = typeof req.query.product === 'string'
        ? req.query.product.trim()
        : '';

    const department = typeof req.query.department === 'string'
        ? req.query.department.trim()
        : '';

    if (!/^[a-z0-9-]{1,200}$/i.test(slug) ||
        !['saree', 'dupatta'].includes(department)) {
        return res.status(404).send('Product not found');
    }

    const match = slug.match(/-([A-Za-z0-9]+)$/);
    if (!match) {
        return res.status(404).send('Product not found');
    }

    try {
        const product = await findProduct(match[1]);

        if (!product ||
            makeSlug(product).toLowerCase() !== slug.toLowerCase() ||
            departmentFor(product) !== department) {
            return res.status(404).send('Product not found');
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        return res.status(200).send(
            makeHtml(product, slug, department)
        );
    } catch (error) {
        console.error('Product SEO error:', error.message);
        res.setHeader('Retry-After', '60');
        return res.status(503).send('Product temporarily unavailable');
    }
};
