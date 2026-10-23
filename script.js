// =========================================================================
// KAILASH KALAMKARI E-COMMERCE ENGINE
// =========================================================================

const SORT_STRATEGY = 'PRICE_HIGH_TO_LOW';
const TARGET_MIDDLE_PRICE = 26500;
const FEATURED_FABRIC_FIRST = 'Kanchipuram';

// Change this value to update the discount across all products.
// Set to 0 to disable the discount.
const GLOBAL_DISCOUNT_PERCENTAGE = 10;

// =========================================================================
// PUBLIC DATABASE ENDPOINTS
// =========================================================================

const SUPABASE_URL =
    'https://ehovvhckvgwfkbgfvchi.supabase.co';

const SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob3Z2aGNrdmd3ZmtiZ2Z2Y2hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNDc4MzAsImV4cCI6MjEwNjkyMzgzMH0.Mx5PyiObZ7aTsL37QKADwUrJnIldWItXaeO2Kma9zKg';

const APPS_SCRIPT_API_URL =
    'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';

const PRIMARY_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?gid=100332201&single=true&output=csv';

const BACKUP_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQVgsqxAaO2_LUzSAxUz_2P_WhdreXSnASw7x30UJFRiCHX4i6WR0yIkhtDuF0wrNTDydZfLPZHRfhx/pub?output=csv';

// =========================================================================
// IMAGES AND BRAND SETTINGS
// =========================================================================

const IMAGE_CDN_URL =
    'https://kalamkari-images.kailashakalamkariacc.workers.dev';

const CONTACT_PHONE_NUMBER = '919063374020';

const BASE_DOMAIN = 'https://www.kailash-kalamkari.com';

const DEFAULT_IMAGE =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

const SHARE_ICON_SVG = `
<svg viewBox="0 0 24 24">
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
</svg>
`;

const DEPARTMENTS = [
    {
        key: 'saree',
        label: 'Sarees',
        singular: 'Saree'
    },
    {
        key: 'dupatta',
        label: 'Dupattas',
        singular: 'Dupatta'
    }
];

const CACHE_STORAGE_KEY = 'kalamkari_catalog_v28';
const CACHE_TIME_KEY = 'kalamkari_catalog_time_v28';
const CACHE_TTL_MS = 5 * 60 * 1000;

// =========================================================================
// SAFE BROWSER STORAGE
// =========================================================================

// The catalogue must continue working if storage is blocked or full.
const memoryStorage = new Map();

const safeStorage = {
    getItem(key) {
        try {
            return (
                memoryStorage.get(key) ??
                localStorage.getItem(key) ??
                null
            );
        } catch (_) {
            return memoryStorage.get(key) ?? null;
        }
    },

    setItem(key, value) {
        const stringValue = String(value);

        memoryStorage.set(key, stringValue);

        try {
            localStorage.setItem(key, stringValue);
        } catch (_) {
            // Continue using memory storage.
        }
    },

    removeItem(key) {
        memoryStorage.delete(key);

        try {
            localStorage.removeItem(key);
        } catch (_) {
            // Storage may be unavailable.
        }
    }
};

function readSavedProducts(key) {
    try {
        const value = JSON.parse(safeStorage.getItem(key));

        if (!Array.isArray(value)) {
            return [];
        }

        return value.filter(
            product =>
                product &&
                typeof product.code === 'string'
        );
    } catch (_) {
        return [];
    }
}

function escapeHtml(value) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    return String(value).replace(
        /[&<>"']/g,
        character => replacements[character]
    );
}

function refreshSavedProducts() {
    const byCode = new Map(
        allProducts.map(product => [product.code, product])
    );

    wishlist = wishlist
        .map(product => byCode.get(product.code))
        .filter(Boolean);

    recentlyViewed = recentlyViewed
        .map(product => byCode.get(product.code))
        .filter(Boolean);

    safeStorage.setItem(
        'kalamkariWishlist',
        JSON.stringify(wishlist)
    );

    safeStorage.setItem(
        'kalamkariRecentlyViewed',
        JSON.stringify(recentlyViewed)
    );

    updateWishlistCount();
}

// =========================================================================
// APPLICATION STATE
// =========================================================================

let allProducts = [];
let filteredProducts = [];

let wishlist = readSavedProducts('kalamkariWishlist');

let recentlyViewed = readSavedProducts(
    'kalamkariRecentlyViewed'
);

let currentProduct = null;
let currentDepartment = getInitialDepartment();
let isInitialLoad = true;
let sessionPushedStates = 0;
let pendingShareData = null;

// =========================================================================
// DOM REFERENCES
// =========================================================================

const views = {
    catalogue: document.getElementById('catalogue-view'),
    details: document.getElementById('product-details-view'),
    wishlist: document.getElementById('wishlist-view'),
    policy: document.getElementById('return-policy-view')
};

const elements = {
    productGrid: document.getElementById('product-grid'),
    wishlistGrid: document.getElementById('wishlist-grid'),
    spinner: document.getElementById('loading-spinner'),
    searchInput: document.getElementById('search-input'),
    filtersContainer: document.getElementById('category-filters'),
    wishlistCount: document.getElementById('wishlist-count'),
    viewWishlistBtn: document.getElementById('wishlist-trigger'),
    backToCatalogueBtn: document.getElementById('back-to-catalogue'),
    backFromWishlistBtn: document.getElementById('back-from-wishlist'),
    backFromPolicyBtn: document.getElementById('back-from-policy'),
    emptyWishlistMsg: document.getElementById('wishlist-empty'),

    detailImage: document.getElementById('detail-image'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    detailTitle: document.getElementById('detail-title'),
    detailCode: document.getElementById('detail-code'),
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailMrp: document.getElementById('detail-mrp'),

    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    shareBtn: document.getElementById('share-btn'),
    videoCallBtn: document.getElementById('video-call-btn'),
    detailBuyNowBtn: document.getElementById('detail-buy-now-btn')
};

// =========================================================================
// TOAST
// =========================================================================

function showToast(message) {
    const toast = document.getElementById('toast');

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// =========================================================================
// IMAGE HANDLING
// =========================================================================

function extractDriveFileId(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    let trimmed = value.trim();

    trimmed = trimmed.replace(/=w\d+.*$/i, '').trim();

    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
        return trimmed;
    }

    const match = trimmed.match(
        /(?:id=|file\/d\/|\/d\/|document\/d\/)([a-zA-Z0-9_-]{25,50})/
    );

    return match && match[1] ? match[1] : null;
}

function getProductImageSources(product) {
    if (!product) return [DEFAULT_IMAGE];

    const sources = [];
    const add = value => {
        const url = String(value || '').trim();
        if (/^https:\/\//i.test(url) && !sources.includes(url)) {
            sources.push(url);
        }
    };

    // Prefer backed-up images, then retain every existing Google Drive fallback.
    add(product.archivedImageUrl || product.archived_image_url);

    const fileId =
        extractDriveFileId(product.imageId) ||
        extractDriveFileId(product.image_id) ||
        extractDriveFileId(product['File ID']) ||
        extractDriveFileId(product['image id']) ||
        extractDriveFileId(product['Drive Link']) ||
        extractDriveFileId(product.imageLink) ||
        extractDriveFileId(product.image_link) ||
        extractDriveFileId(product['image link']) ||
        extractDriveFileId(product.thumbnail_link) ||
        extractDriveFileId(product.thumbnail);

    if (fileId) {
        add(`${IMAGE_CDN_URL}/${fileId}`);
        add(`https://lh3.googleusercontent.com/d/${fileId}=w1000`);
        add(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
    }

    add(product.thumbnail);
    add(product.thumbnail_link);
    add(product.imageLink);
    add(product.image_link);
    sources.push(DEFAULT_IMAGE);
    return [...new Set(sources)];
}

function attachProductImage(imgElement, product) {
    const sources = getProductImageSources(product);

    let currentIndex = 0;

    // Register the error handler before assigning the source.
    imgElement.onerror = () => {
        currentIndex++;

        if (currentIndex < sources.length) {
            imgElement.src = sources[currentIndex];
        } else {
            imgElement.onerror = null;
            imgElement.src = DEFAULT_IMAGE;
        }
    };

    imgElement.src = sources[0];
}

// =========================================================================
// PRODUCT LINKS AND METADATA
// =========================================================================

// KK_SEMI_CRAPE_FIX_V2 — fabric display, not URL change.
function isSemiCrapeProduct(product) {
    const text = [product.fabric, product.category].join(' ');
    const code = String(product.code || '');
    return (
        /\bsemi[\s-]*(?:crape|crepe)\b/i.test(text) ||
        /\b(?:crape|crepe)\s+(?:pure\s+)?semi\b/i.test(text) ||
        /^[CD]CP\d+$/i.test(code)
    );
}
function getProductSlug(product) {
    const cleanFabric =
        (product.slugFabric || product.fabric || 'silk')
            .toLowerCase()
            .replace(/\b(sarees?|dupp?att?as?)\b/gi, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'silk';

    return (
        `srikalahasthi-pen-kalamkari-` +
        `${cleanFabric}-${product.code}`
    );
}

function getProductFullUrl(product) {
    const slug = getProductSlug(product);
    const department = product.departmentKey || 'saree';

    return (
        `${BASE_DOMAIN}/?department=${department}` +
        `&product=${slug}`
    );
}

function updateCanonicalUrl(url) {
    const canonical =
        document.getElementById('canonical-url') ||
        document.querySelector('link[rel="canonical"]');

    if (canonical) {
        canonical.setAttribute('href', url);
    }
}

function updateGoogleImageSchemaAndMeta(product) {
    if (!product) {
        return;
    }

    const departmentLabel =
        product.departmentKey === 'dupatta'
            ? 'Dupatta'
            : 'Saree';

    const cleanFabric =
        (product.fabric || 'Pure Silk')
            .replace(/\b(sarees?|dupp?att?as?)\b/gi, '')
            .trim() || 'Pure Silk';

    const fullOptimizedTitle =
        `Kailash Kalamkari Srikalahasthi Pen Kalamkari ` +
        `Hand-Painted ${cleanFabric} ${departmentLabel} ` +
        `- ${product.code}`;

    const pageTitle = `${cleanFabric} Pen Kalamkari ${departmentLabel} ${product.code} | Kailash Kalamkari`;

    const pageDescription =
        `Buy authentic hand-painted Srikalahasthi ` +
        `(Srikalahasti) Pen Kalamkari ${cleanFabric} ` +
        `${departmentLabel} (${product.code}) with 100% ` +
        `traditional natural dyes directly from ` +
        `Kailash Kalamkari master artisans since 1984.`;

    const imageUrl = getProductImageSources(product)[0];

    const productUrl = getProductFullUrl(product);

    document.title = pageTitle;
    updateCanonicalUrl(productUrl);

    const metaDescription = document.querySelector(
        'meta[name="description"]'
    );

    if (metaDescription) {
        metaDescription.setAttribute(
            'content',
            pageDescription
        );
    }

    const ogTitle = document.getElementById('og-title');

    if (ogTitle) {
        ogTitle.setAttribute('content', pageTitle);
    }

    const ogDescription = document.getElementById('og-desc');

    if (ogDescription) {
        ogDescription.setAttribute(
            'content',
            pageDescription
        );
    }

    const ogImage = document.getElementById('og-image');

    if (ogImage) {
        ogImage.setAttribute('content', imageUrl);
    }

    const ogUrl = document.getElementById('og-url');

    if (ogUrl) {
        ogUrl.setAttribute('content', productUrl);
    }

    const twitterTitle = document.getElementById(
        'twitter-title'
    );

    if (twitterTitle) {
        twitterTitle.setAttribute('content', pageTitle);
    }

    const twitterDescription = document.getElementById(
        'twitter-desc'
    );

    if (twitterDescription) {
        twitterDescription.setAttribute(
            'content',
            pageDescription
        );
    }

    const twitterImage = document.getElementById(
        'twitter-image'
    );

    if (twitterImage) {
        twitterImage.setAttribute('content', imageUrl);
    }

    const schemaScript = document.getElementById(
        'dynamic-product-schema'
    );

    if (schemaScript) {
        const schemaData = {
            '@context': 'https://schema.org/',
            '@type': 'Product',
            name: fullOptimizedTitle,
            image: [imageUrl],
            description:
                product.fabric === 'Semi Crape'
                    ? pageDescription
                    : (product.description || pageDescription),
            sku: product.code,

            brand: {
                '@type': 'Brand',
                name: 'Kailash Kalamkari'
            },

            offers: {
                '@type': 'Offer',
                url: productUrl,
                priceCurrency: 'INR',
                price: product.price,
                itemCondition:
                    'https://schema.org/NewCondition',
                availability:
                    product.qty > 0
                        ? 'https://schema.org/InStock'
                        : 'https://schema.org/OutOfStock'
            }
        };

        schemaScript.textContent = JSON.stringify(
            schemaData
        );
    }
}

// =========================================================================
// SORTING
// =========================================================================

function sortProductsByPrice(products) {
    return [...products].sort((a, b) => {
        if (
            FEATURED_FABRIC_FIRST &&
            FEATURED_FABRIC_FIRST.toLowerCase() !== 'none'
        ) {
            const featuredKey =
                FEATURED_FABRIC_FIRST.toLowerCase().trim();

            const aIsFeatured =
                (a.fabric || '')
                    .toLowerCase()
                    .includes(featuredKey) ||
                (a.title || '')
                    .toLowerCase()
                    .includes(featuredKey);

            const bIsFeatured =
                (b.fabric || '')
                    .toLowerCase()
                    .includes(featuredKey) ||
                (b.title || '')
                    .toLowerCase()
                    .includes(featuredKey);

            if (aIsFeatured && !bIsFeatured) {
                return -1;
            }

            if (!aIsFeatured && bIsFeatured) {
                return 1;
            }
        }

        if (SORT_STRATEGY === 'PRICE_LOW_TO_HIGH') {
            return (a.price || 0) - (b.price || 0);
        }

        if (SORT_STRATEGY === 'MIDDLE_BUDGET_FIRST') {
            const distanceA = Math.abs(
                (a.price || 0) - TARGET_MIDDLE_PRICE
            );

            const distanceB = Math.abs(
                (b.price || 0) - TARGET_MIDDLE_PRICE
            );

            return distanceA - distanceB;
        }

        return (b.price || 0) - (a.price || 0);
    });
}

// =========================================================================
// DEPARTMENTS
// =========================================================================

function getInitialDepartment() {
    const parameters = new URLSearchParams(
        window.location.search
    );

    return (
        normalizeDepartment(
            parameters.get('department')
        ) || 'saree'
    );
}

function normalizeDepartment(value) {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    if (
        normalized.includes('duppata') ||
        normalized.includes('duppatta') ||
        normalized.includes('dupatta') ||
        normalized.includes('dupattas') ||
        normalized.includes('stole')
    ) {
        return 'dupatta';
    }

    if (
        normalized.includes('saree') ||
        normalized.includes('sari') ||
        normalized.includes('sarees')
    ) {
        return 'saree';
    }

    return '';
}

function getDepartmentConfig(
    departmentKey = currentDepartment
) {
    return (
        DEPARTMENTS.find(
            department =>
                department.key === departmentKey
        ) || DEPARTMENTS[0]
    );
}

function getDepartmentProducts(
    departmentKey = currentDepartment
) {
    return allProducts.filter(
        product =>
            product.departmentKey === departmentKey
    );
}

function inferDepartmentFromText(
    explicitDepartment,
    ...values
) {
    const normalizedDepartment =
        normalizeDepartment(explicitDepartment);

    if (normalizedDepartment) {
        return normalizedDepartment;
    }

    const combined = values
        .filter(Boolean)
        .map(value => String(value))
        .join(' ')
        .toLowerCase();

    if (
        combined.includes('duppata') ||
        combined.includes('duppatta') ||
        combined.includes('duppatas') ||
        combined.includes('dupatta') ||
        combined.includes('dupattas') ||
        combined.includes('stole') ||
        combined.includes('odhani') ||
        combined.includes('chunni')
    ) {
        return 'dupatta';
    }

    if (
        combined.includes('saree') ||
        combined.includes('sarees') ||
        combined.includes('sari')
    ) {
        return 'saree';
    }

    for (const value of values) {
        const code = String(value || '')
            .toUpperCase()
            .trim();

        if (!code) {
            continue;
        }

        if (
            /^(CBMD|CBWD|DBMD|DBWD|DBSD|BMD|BSD|BWD|DCOT|DIKK|DCRA|DCD|CCD|CD4|CD|CCRA|CPCFD|DPCFD|PCFD|CPCSD|PCSD|CPKD|KD|DUP|CIKD|IKD|DPTD|PTD)/.test(
                code
            )
        ) {
            return 'dupatta';
        }

        if (
            /^(CPKS|CPIS|CPGS|CPCS|CPPS|DPKS|DPPS|DPAT|DPTS|DPCS|CCHE|CSKB|CSEM|CMAN|MGC|MGS|MG|PIS|PKS|KB|CSB|CH|PTS|PGS|GD|SKB|SKS|PPS|CSBW|CCS|KTS|KT|BSC|BSBW|PCS|CB\d)/.test(
                code
            )
        ) {
            return 'saree';
        }
    }

    return 'saree';
}

// =========================================================================
// NAVIGATION
// =========================================================================

function navigateToState(
    department,
    fabric,
    hash = '',
    push = true
) {
    const url = new URL(window.location.href);

    if (department) {
        url.searchParams.set('department', department);
    } else {
        url.searchParams.delete('department');
    }

    if (fabric && fabric !== 'all') {
        url.searchParams.set('fabric', fabric);
    } else {
        url.searchParams.delete('fabric');
    }

    url.searchParams.delete('product');
    url.hash = hash;

    const state = {
        department,
        fabric,
        hash
    };

    if (push) {
        window.history.pushState(state, '', url);
    } else {
        window.history.replaceState(state, '', url);
    }
}

function updateDepartmentUI() {
    const activeDepartment = getDepartmentConfig();

    document
        .querySelectorAll('.department-btn')
        .forEach(element => {
            if (element.id === 'wishlist-trigger') {
                return;
            }

            const departmentKey = normalizeDepartment(
                element.dataset.department
            );

            element.classList.toggle(
                'active',
                departmentKey === currentDepartment
            );
        });

    if (elements.searchInput) {
        elements.searchInput.placeholder =
            `Search ` +
            `${activeDepartment.label.toLowerCase()} ` +
            `by code or fabric...`;
    }
}

function setDepartment(
    department,
    { pushState = true } = {}
) {
    currentDepartment =
        normalizeDepartment(department) || 'saree';

    if (elements.searchInput) {
        elements.searchInput.value = '';
    }

    updateDepartmentUI();
    renderFilterButtons('all');

    if (pushState) {
        navigateToState(
            currentDepartment,
            'all',
            '',
            true
        );
    }

    filterAndSearchProducts();
    scrollToDepartment(true);
}

function scrollToDepartment(smooth = true) {
    if (isInitialLoad) {
        return;
    }

    setTimeout(() => {
        const stickyNavigation = document.querySelector(
            '.sticky-nav-container'
        );

        let targetScrollY = 0;

        if (stickyNavigation) {
            const productGrid = document.getElementById(
                'product-grid'
            );

            if (productGrid) {
                const gridTop =
                    productGrid.getBoundingClientRect().top +
                    window.pageYOffset;

                const navigationHeight =
                    stickyNavigation.offsetHeight || 120;

                targetScrollY = Math.max(
                    0,
                    gridTop - navigationHeight - 10
                );
            }
        }

        window.scrollTo({
            top: targetScrollY,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }, 50);
}

function goBack() {
    if (sessionPushedStates > 0) {
        sessionPushedStates--;
        window.history.back();

        return;
    }

    const parameters = new URLSearchParams(
        window.location.search
    );

    const initialDepartment =
        normalizeDepartment(
            parameters.get('department')
        ) || currentDepartment;

    const initialFabric =
        parameters.get('fabric') || 'all';

    navigateToState(
        initialDepartment,
        initialFabric,
        '',
        false
    );

    handlePopState();
}

// =========================================================================
// CATALOGUE DATA NORMALIZATION AND GLOBAL DISCOUNT
// =========================================================================

function processRawCatalogData(rawData) {
    const getFieldValue = (item, keys) => {
        const normalize = value =>
            String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');

        const normalizedEntries = Object.entries(
            item
        ).map(([key, value]) => [
            normalize(key),
            value
        ]);

        for (const key of keys) {
            const normalizedKey = normalize(key);

            let value = item[key];

            if (
                value === undefined ||
                value === null
            ) {
                const matchedEntry =
                    normalizedEntries.find(
                        ([itemKey]) =>
                            itemKey === normalizedKey
                    );

                if (matchedEntry) {
                    value = matchedEntry[1];
                }
            }

            if (
                value !== undefined &&
                value !== null &&
                String(value).trim() !== ''
            ) {
                return String(value).trim();
            }
        }

        return '';
    };

    function parsePrice(value) {
        if (!value) {
            return 0;
        }

        const cleaned = String(value).replace(
            /[^0-9.\-]/g,
            ''
        );

        const number = Number(cleaned);

        return Number.isFinite(number) ? number : 0;
    }

    return rawData
        .map(item => {
            const code = String(
                getFieldValue(item, [
                    'code',
                    'style code',
                    'stylecode',
                    'item code',
                    'barcode',
                    'sku',
                    'id'
                ])
            ).trim();

            const rawFabric = String(
                getFieldValue(item, [
                    'fabric',
                    'fabric type',
                    'material',
                    'saree name',
                    'name',
                    'title'
                ]) || 'Pure Silk'
            ).trim();

            const category = String(
                getFieldValue(item, [
                    'category',
                    'type',
                    'section'
                ]) || 'Uncategorized'
            ).trim();

            const rawDepartment = String(
                getFieldValue(item, [
                    'department',
                    'dept',
                    'collection'
                ])
            ).trim();

            const description = String(
                getFieldValue(item, [
                    'description',
                    'product description',
                    'desc',
                    'details'
                ])
            ).trim();

            const departmentKey =
                inferDepartmentFromText(
                    rawDepartment,
                    rawFabric,
                    category,
                    code,
                    description
                );

            const departmentLabel =
                departmentKey === 'dupatta'
                    ? 'Dupatta'
                    : 'Saree';

            const cleanFabric =
                rawFabric
                    .replace(
                        /\b(sarees?|dupp?att?as?)\b/gi,
                        ''
                    )
                    .trim() || 'Pure Silk';

            const displayFabric = isSemiCrapeProduct({
                code, fabric: rawFabric, category
            }) ? 'Semi Crape' : cleanFabric;

            const title =
                `${displayFabric} ${departmentLabel}`;

            const imageLink = String(
                getFieldValue(item, [
                    'image_link',
                    'image link',
                    'imagelink',
                    'thumbnail link',
                    'drive link',
                    'image',
                    'photo link',
                    'thumbnail l'
                ])
            ).trim();

            const thumbnail =
                String(
                    getFieldValue(item, [
                        'thumbnail_link',
                        'thumbnail',
                        'thumbnail link',
                        'thumb',
                        'thumbnail l'
                    ])
                ).trim() || imageLink;

            const imageId =
                String(
                    getFieldValue(item, [
                        'image_id',
                        'image id',
                        'imageid',
                        'file id',
                        'fileid',
                        'drive id'
                    ])
                ).trim() ||
                extractDriveFileId(imageLink) ||
                extractDriveFileId(thumbnail);

            const rawQuantity = getFieldValue(item, [
                'qty',
                'quantity',
                'stock',
                'available',
                'count'
            ]);

            let quantity =
                rawQuantity !== ''
                    ? Number(rawQuantity)
                    : 1;

            if (!Number.isFinite(quantity)) {
                quantity = 0;
            }

            const availability = getFieldValue(item, [
                'is_available', 'availability'
            ]).trim().toLowerCase();

            if ([
                'false', '0', 'no', 'out_of_stock', 'out of stock',
                'sold out', 'unavailable'
            ].includes(availability)) {
                quantity = 0;
            }

            const sourcePrice = parsePrice(
                getFieldValue(item, [
                    'price',
                    'selling price',
                    'rate',
                    'amount',
                    'offer price',
                    'cost'
                ])
            );

            const sourceMrp = parsePrice(
                getFieldValue(item, [
                    'mrp',
                    'm.r.p',
                    'original price',
                    'mrp price',
                    'list price'
                ])
            );

            // Use explicit MRP when available.
            // Otherwise use the source price as the base.
            const rawMrp =
                sourceMrp > 0
                    ? sourceMrp
                    : sourcePrice;

            const discount =
                Number.isFinite(
                    GLOBAL_DISCOUNT_PERCENTAGE
                )
                    ? Math.min(
                        99,
                        Math.max(
                            0,
                            GLOBAL_DISCOUNT_PERCENTAGE
                        )
                    )
                    : 0;

            const sellingPrice = Math.round(
                rawMrp * (1 - discount / 100)
            );

            return {
                code,
                title,
                fabric: displayFabric,
                slugFabric: cleanFabric,
                category,
                department: rawDepartment,
                departmentKey,
                price: sellingPrice,
                mrp: rawMrp,
                qty: quantity,
                imageLink,
                thumbnail,
                imageId,
                archivedImageUrl: getFieldValue(item, [
                    'archived_image_url', 'archived image url'
                ]),
                description
            };
        })
        .filter(
            product =>
                product.code &&
                product.mrp > 0 &&
                product.qty > 0 &&
                (
                    product.imageId ||
                    product.imageLink ||
                    product.thumbnail ||
                    product.archivedImageUrl
                )
        );
}

// =========================================================================
// CSV PARSER
// =========================================================================

// Handles commas, quoted values, escaped quotes and multiline fields.
// No external CSV library is required.
function parseCatalogCsv(text) {
    const rows = [];

    let row = [];
    let field = '';
    let quoted = false;

    text = text.replace(/^\uFEFF/, '');

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (character === '"') {
            if (
                quoted &&
                text[index + 1] === '"'
            ) {
                field += '"';
                index++;
            } else {
                quoted = !quoted;
            }
        } else if (
            character === ',' &&
            !quoted
        ) {
            row.push(field);
            field = '';
        } else if (
            (
                character === '\n' ||
                character === '\r'
            ) &&
            !quoted
        ) {
            row.push(field);
            field = '';

            if (
                row.some(value => value.trim())
            ) {
                rows.push(row);
            }

            row = [];

            if (
                character === '\r' &&
                text[index + 1] === '\n'
            ) {
                index++;
            }
        } else {
            field += character;
        }
    }

    if (quoted) {
        throw new Error(
            'Incomplete catalogue CSV'
        );
    }

    row.push(field);

    if (
        row.some(value => value.trim())
    ) {
        rows.push(row);
    }

    const headers = rows.shift() || [];

    return rows.map(values =>
        Object.fromEntries(
            headers.map((key, index) => [
                key.trim(),
                values[index] || ''
            ])
        )
    );
}

// =========================================================================
// CATALOGUE NETWORK REQUESTS
// =========================================================================

async function fetchCatalogPayload(
    url,
    options = {},
    format = 'json',
    timeoutMs = 5000
) {
    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(
                `Catalogue HTTP ${response.status}`
            );
        }

        if (format === 'csv') {
            const text = await response.text();

            return parseCatalogCsv(text);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function requireCatalog(rows) {
    if (
        !Array.isArray(rows) ||
        !processRawCatalogData(rows).length
    ) {
        throw new Error(
            'No usable catalogue products'
        );
    }

    return rows;
}

async function fetchFreshCatalogData() {
    // Inventory safety: only the live Supabase status is authoritative.
    // Static JSON, published CSV, Apps Script and browser cache may contain
    // previously available products, so must not republish sold-out items.
    const rows = [];
    const batchSize = 1000;
    const deadline = Date.now() + 12000;

    for (let from = 0; ; from += batchSize) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            throw new Error('Catalogue pagination timed out');
        }

        const url = `${SUPABASE_URL}/rest/v1/products` +
            `?select=*&is_available=eq.true&qty=gt.0` +
            `&order=code.asc&offset=${from}&limit=${batchSize}`;

        const chunk = await fetchCatalogPayload(url, {
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`
            }
        }, 'json', Math.min(5000, remainingMs));

        if (!Array.isArray(chunk)) {
            throw new Error('Invalid catalogue response');
        }
        rows.push(...chunk);
        if (chunk.length < batchSize) return requireCatalog(rows);
    }
}

async function loadAndApplyCatalog(
    isBackgroundSync = false
) {
    try {
        if (
            !isBackgroundSync &&
            elements.spinner
        ) {
            elements.spinner.style.display =
                'block';
        }

        const freshRawData =
            await fetchFreshCatalogData();

        if (
            !freshRawData ||
            !freshRawData.length
        ) {
            throw new Error(
                'Empty catalogue'
            );
        }

        const processed =
            processRawCatalogData(freshRawData);

        if (!processed.length) {
            throw new Error(
                'Invalid catalogue'
            );
        }

        const currentSignature =
            JSON.stringify(allProducts);

        const newSignature = JSON.stringify(
            sortProductsByPrice(processed)
        );

        allProducts =
            sortProductsByPrice(processed);

        safeStorage.setItem(
            CACHE_STORAGE_KEY,
            JSON.stringify(freshRawData)
        );

        safeStorage.setItem(
            CACHE_TIME_KEY,
            String(Date.now())
        );

        if (
            currentSignature !== newSignature ||
            !isBackgroundSync
        ) {
            if (
                !getDepartmentProducts(
                    currentDepartment
                ).length &&
                allProducts.length
            ) {
                currentDepartment =
                    allProducts[0].departmentKey ||
                    'saree';
            }

            filteredProducts =
                sortProductsByPrice(
                    getDepartmentProducts()
                );

            refreshSavedProducts();

            const parameters =
                new URLSearchParams(
                    window.location.search
                );

            const currentFabric =
                parameters.get('fabric') ||
                'all';

            updateDepartmentUI();
            renderFilterButtons(currentFabric);
            syncFabricFilterUI(currentFabric);
            handlePopState();
        }

        if (elements.spinner) {
            elements.spinner.style.display =
                'none';
        }
    } catch (error) {
        if (
            elements.spinner &&
            !isBackgroundSync
        ) {
            elements.spinner.innerHTML = `
                <p
                    style="
                        color: var(--color-temple-crimson);
                        font-weight: 600;
                    "
                >
                    Unable to connect to live catalog.
                </p>

                <button
                    onclick="location.reload()"
                    style="
                        margin-top: 1rem;
                        padding: 0.6rem 1.4rem;
                        background: var(--color-temple-crimson);
                        color: white;
                        border: none;
                        cursor: pointer;
                        border-radius: 3px;
                    "
                >
                    Retry
                </button>
            `;
        }
    }
}

// =========================================================================
// PRODUCT CARD RENDERING
// =========================================================================

function renderProducts(
    products,
    container,
    isHorizontal = false
) {
    if (!container) {
        return;
    }

    // Cancel any older unfinished render for this container.
    container._renderToken = null;
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = `
            <p
                style="
                    grid-column: 1/-1;
                    text-align: center;
                    color: var(--color-antique-gold);
                    padding: 3rem 0;
                "
            >
                No authentic hand-painted Kalamkari artworks
                found matching your search.
            </p>
        `;

        return;
    }

    const renderToken = {};

    container._renderToken = renderToken;

    let nextIndex = 0;

    function appendBatch() {
        if (
            container._renderToken !== renderToken
        ) {
            return;
        }

        const fragment =
            document.createDocumentFragment();

        const endIndex = Math.min(
            nextIndex + 32,
            products.length
        );

        for (
            ;
            nextIndex < endIndex;
            nextIndex++
        ) {
            const product = products[nextIndex];

            const card =
                document.createElement('a');

            card.className = 'product-card';
            card.dataset.code = product.code;

            if (product.qty <= 0) {
                card.classList.add('sold-out');
            }

            const keywordSlug =
                getProductSlug(product);

            const productDepartment =
                product.departmentKey ||
                'saree';

            card.href =
                `/?department=${productDepartment}` +
                `&product=${keywordSlug}`;

            card.onclick = event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();

                const newUrl = new URL(
                    window.location.href
                );

                newUrl.searchParams.set(
                    'department',
                    productDepartment
                );

                newUrl.searchParams.set(
                    'product',
                    keywordSlug
                );

                newUrl.hash = '';

                if (isHorizontal) {
                    window.history.replaceState(
                        {
                            productCode: product.code
                        },
                        '',
                        newUrl
                    );
                } else {
                    sessionPushedStates++;

                    window.history.pushState(
                        {
                            productCode: product.code
                        },
                        '',
                        newUrl
                    );
                }

                showProductDetails(product);
            };

            const formattedPrice =
                new Intl.NumberFormat(
                    'en-IN'
                ).format(product.price);

            const formattedMrp =
                new Intl.NumberFormat(
                    'en-IN'
                ).format(product.mrp);

            const discountPercentage =
                product.mrp > product.price
                    ? Math.round(
                        (
                            (
                                product.mrp -
                                product.price
                            ) /
                            product.mrp
                        ) * 100
                    )
                    : 0;

            const imageWrapper =
                document.createElement('div');

            imageWrapper.className =
                'product-image-wrapper';

            const image =
                document.createElement('img');

            image.alt =
                `Srikalahasthi Pen Kalamkari ` +
                `${product.title} - ${product.code}`;

            image.title =
                `Srikalahasthi Pen Kalamkari ` +
                `— ${product.title}`;

            image.loading =
                !isHorizontal && nextIndex < 2
                    ? 'eager'
                    : 'lazy';

            if (
                !isHorizontal &&
                nextIndex === 0
            ) {
                image.fetchPriority = 'high';
            }

            image.decoding = 'async';

            attachProductImage(
                image,
                product
            );

            imageWrapper.appendChild(image);

            if (discountPercentage > 0) {
                const discountBadge =
                    document.createElement('span');

                discountBadge.className =
                    'card-discount-badge';

                discountBadge.textContent =
                    `${discountPercentage}% OFF`;

                imageWrapper.appendChild(
                    discountBadge
                );
            }

            if (product.code) {
                const codeBadge =
                    document.createElement('span');

                codeBadge.className =
                    'card-code-badge';

                codeBadge.textContent =
                    product.code;

                imageWrapper.appendChild(
                    codeBadge
                );
            }

            if (product.qty <= 0) {
                const soldOutBadge =
                    document.createElement('span');

                soldOutBadge.className =
                    'sold-out-badge';

                soldOutBadge.textContent =
                    'SOLD OUT';

                imageWrapper.appendChild(
                    soldOutBadge
                );
            }

            const isInWishlist =
                wishlist.some(
                    item =>
                        item.code === product.code
                );

            const quickActions =
                document.createElement('div');

            quickActions.className =
                'card-quick-actions';

            const wishlistButton =
                document.createElement('button');

            wishlistButton.className =
                `card-action-btn card-wishlist-btn ` +
                `${isInWishlist ? 'active' : ''}`;

            wishlistButton.innerHTML =
                isInWishlist ? '♥' : '♡';

            wishlistButton.title =
                'Add to Gallery Vault';

            wishlistButton.setAttribute(
                'aria-label',
                'Save Saree'
            );

            wishlistButton.onclick = event => {
                event.preventDefault();
                event.stopPropagation();

                toggleWishlist(product);
            };

            const shareButton =
                document.createElement('button');

            shareButton.className =
                'card-action-btn card-share-btn';

            shareButton.innerHTML =
                SHARE_ICON_SVG;

            shareButton.title =
                'Share Artwork';

            shareButton.setAttribute(
                'aria-label',
                'Share Saree Artwork'
            );

            shareButton.onclick = event => {
                event.preventDefault();
                event.stopPropagation();

                shareProduct(product);
            };

            quickActions.appendChild(
                wishlistButton
            );

            quickActions.appendChild(
                shareButton
            );

            imageWrapper.appendChild(
                quickActions
            );

            const info =
                document.createElement('div');

            info.className = 'product-info';

            info.innerHTML = `
                <h3 class="product-title">
                    ${escapeHtml(product.title)}
                </h3>

                <div class="product-price-row">
                    ${
                        product.mrp > product.price
                            ? `
                                <span class="mrp-price">
                                    Rs. ${formattedMrp}
                                </span>
                            `
                            : ''
                    }

                    <span class="product-price">
                        Rs. ${formattedPrice}
                    </span>
                </div>

                <div class="card-actions-row">
                    <button
                        class="card-video-btn"
                        type="button"
                    >
                        📹 VIDEO CALL
                    </button>

                    <button
                        class="card-buy-btn"
                        type="button"
                    >
                        🛍️ BUY NOW
                    </button>
                </div>
            `;

            const buyButton =
                info.querySelector(
                    '.card-buy-btn'
                );

            const videoButton =
                info.querySelector(
                    '.card-video-btn'
                );

            if (buyButton) {
                buyButton.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();

                    buyNow(product);
                };
            }

            if (videoButton) {
                videoButton.onclick = event => {
                    event.preventDefault();
                    event.stopPropagation();

                    bookVideoCall(product);
                };
            }

            card.appendChild(imageWrapper);
            card.appendChild(info);

            fragment.appendChild(card);
        }

        container.appendChild(fragment);

        if (nextIndex < products.length) {
            setTimeout(appendBatch, 0);
        }
    }

    appendBatch();
}

// =========================================================================
// RECENTLY VIEWED
// =========================================================================

function trackRecentlyViewed(product) {
    if (!product || !product.code) {
        return;
    }

    recentlyViewed =
        recentlyViewed.filter(
            item =>
                item.code !== product.code
        );

    recentlyViewed.unshift(product);

    if (recentlyViewed.length > 8) {
        recentlyViewed =
            recentlyViewed.slice(0, 8);
    }

    safeStorage.setItem(
        'kalamkariRecentlyViewed',
        JSON.stringify(recentlyViewed)
    );
}

function renderRecentlyViewed(product) {
    const section = document.getElementById(
        'recently-viewed-section'
    );

    const grid = document.getElementById(
        'recently-viewed-grid'
    );

    if (!section || !grid) {
        return;
    }

    const list = recentlyViewed.filter(
        item =>
            item.code !== product.code
    );

    if (list.length > 0) {
        section.style.display = 'block';

        renderProducts(
            list,
            grid,
            true
        );
    } else {
        section.style.display = 'none';
    }
}

// =========================================================================
// RELATED PRODUCTS
// =========================================================================

function renderFabricProducts(product) {
    const section = document.getElementById(
        'fabric-products-section'
    );

    const container = document.getElementById(
        'fabric-products-grid'
    );

    if (!section || !container) {
        return;
    }

    const list = allProducts.filter(
        item =>
            item.departmentKey ===
                product.departmentKey &&
            item.code !== product.code &&
            item.fabric
                .toLowerCase()
                .trim() ===
                product.fabric
                    .toLowerCase()
                    .trim()
    );

    if (list.length > 0) {
        section.style.display = 'block';

        renderProducts(
            list.slice(0, 8),
            container,
            true
        );
    } else {
        section.style.display = 'none';
    }
}

function renderSimilarProducts(product) {
    const section = document.getElementById(
        'similar-products-section'
    );

    const container = document.getElementById(
        'similar-products-grid'
    );

    if (!section || !container) {
        return;
    }

    const currentPrice = product.price;

    const currentFabric =
        (product.fabric || '')
            .toLowerCase()
            .trim();

    let list = allProducts.filter(
        item =>
            item.departmentKey ===
                product.departmentKey &&
            item.code !== product.code &&
            item.fabric
                .toLowerCase()
                .trim() !== currentFabric &&
            Math.abs(
                item.price - currentPrice
            ) / currentPrice <= 0.25
    );

    list.sort(
        (a, b) =>
            Math.abs(
                a.price - currentPrice
            ) -
            Math.abs(
                b.price - currentPrice
            )
    );

    if (list.length === 0) {
        list = allProducts
            .filter(
                item =>
                    item.departmentKey ===
                        product.departmentKey &&
                    item.code !== product.code &&
                    item.fabric
                        .toLowerCase()
                        .trim() !== currentFabric
            )
            .sort(
                (a, b) =>
                    Math.abs(
                        a.price - currentPrice
                    ) -
                    Math.abs(
                        b.price - currentPrice
                    )
            );
    }

    if (list.length > 0) {
        section.style.display = 'block';

        renderProducts(
            list.slice(0, 8),
            container,
            true
        );
    } else {
        section.style.display = 'none';
    }
}

function renderQuickCategoryPills(
    product = currentProduct
) {
    const section = document.getElementById(
        'category-browse-section'
    );

    const container = document.getElementById(
        'quick-category-pills'
    );

    if (!section || !container) {
        return;
    }

    container.innerHTML = '';

    const targetDepartment = product
        ? product.departmentKey
        : currentDepartment;

    const departmentProducts =
        allProducts.filter(
            item =>
                item.departmentKey ===
                targetDepartment
        );

    const fabricMap = new Map();

    departmentProducts.forEach(item => {
        const fabric =
            (item.fabric || '').trim();

        if (!fabric) {
            return;
        }

        const key = fabric
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        if (!fabricMap.has(key)) {
            fabricMap.set(key, {
                key,
                fabricName: fabric,
                label: fabric.toUpperCase(),
                products: []
            });
        }

        fabricMap.get(key).products.push(item);
    });

    if (fabricMap.size === 0) {
        section.style.display = 'none';

        return;
    }

    section.style.display = 'block';

    const gridsWrapper =
        document.createElement('div');

    gridsWrapper.className =
        'fabric-grids-wrapper';

    fabricMap.forEach(item => {
        const block =
            document.createElement('div');

        block.className =
            'fabric-collection-block';

        const blockTitle =
            document.createElement('h3');

        blockTitle.className =
            'fabric-block-title';

        blockTitle.innerHTML = `
            <span>${item.label}</span>

            <a
                href="/?department=${targetDepartment}&fabric=${item.key}"
                class="view-all-fabric-btn"
            >
                View All (${item.products.length}) &rarr;
            </a>
        `;

        const viewAllButton =
            blockTitle.querySelector(
                '.view-all-fabric-btn'
            );

        viewAllButton.onclick = event => {
            event.preventDefault();

            setDepartment(
                targetDepartment,
                { pushState: false }
            );

            navigateToState(
                targetDepartment,
                item.key,
                '',
                true
            );

            syncFabricFilterUI(item.key);
            showView('catalogue');
            scrollToDepartment(true);
        };

        const grid =
            document.createElement('div');

        grid.className =
            'product-grid horizontal-scroll-grid';

        renderProducts(
            item.products.slice(0, 8),
            grid,
            true
        );

        block.appendChild(blockTitle);
        block.appendChild(grid);

        gridsWrapper.appendChild(block);
    });

    container.appendChild(gridsWrapper);
}

// =========================================================================
// VIEW SWITCHING
// =========================================================================


// Restore page-level metadata when leaving a product, including back navigation.
function resetCatalogueMetadata() {
    const parameters = new URLSearchParams(window.location.search);
    const department = normalizeDepartment(parameters.get('department'));
    const isDupatta = department === 'dupatta';
    const title = isDupatta
        ? 'Srikalahasthi Pen Kalamkari Dupattas | Kailash Kalamkari'
        : 'Srikalahasthi Pen Kalamkari Sarees | Kailash Kalamkari';
    const description = `Authentic hand-painted Srikalahasthi (Srikalahasti) Pen Kalamkari ${isDupatta ? 'dupattas' : 'sarees'}, made with traditional natural dyes. Direct from Kailash Kalamkari artisans since 1984.`;
    const canonical = BASE_DOMAIN + '/' + (department ? '?department=' + department : '');
    document.title = title;
    updateCanonicalUrl(canonical);
    const schema = document.getElementById('dynamic-product-schema');
    if (schema) schema.textContent = '';
    const values = {
        'meta[name="description"]': description,
        '#og-title': title, '#twitter-title': title,
        '#og-desc': description, '#twitter-desc': description,
        '#og-url': canonical,
        '#og-image': BASE_DOMAIN + '/logo.jpg',
        '#twitter-image': BASE_DOMAIN + '/logo.jpg'
    };
    Object.entries(values).forEach(([selector, value]) => {
        document.querySelector(selector)?.setAttribute('content', value);
    });
}

function showView(viewName) {
    Object.values(views).forEach(view => {
        view?.classList.remove('active');
    });

    views[viewName]?.classList.add('active');

    if (viewName === 'details') {
        document.body.classList.add(
            'details-mode'
        );

        return;
    }

    document.body.classList.remove(
        'details-mode'
    );
    resetCatalogueMetadata();

    if (viewName === 'catalogue') {
        scrollToDepartment(true);

        resetCatalogueMetadata();
    } else if (viewName === 'policy') {
        document.title =
            'Return Policy — ' +
            'Kailash Kalamkari Srikalahasti';

        updateCanonicalUrl(
            BASE_DOMAIN + '/#return-policy'
        );

        window.scrollTo(0, 0);
    } else {
        window.scrollTo(0, 0);
    }
}

// =========================================================================
// FABRIC FILTERS
// =========================================================================

function renderFilterButtons(activeKey = null) {
    if (!elements.filtersContainer) {
        return;
    }

    const departmentProducts =
        getDepartmentProducts();

    const fabricMap = new Map();

    departmentProducts.forEach(product => {
        const fabric =
            (product.fabric || 'Unknown').trim();

        if (!fabric) {
            return;
        }

        const key = fabric
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        if (!fabricMap.has(key)) {
            fabricMap.set(key, {
                label: fabric,
                prices: []
            });
        }

        fabricMap.get(key).prices.push(
            product.price || 0
        );
    });

    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const targetFilter = (
        activeKey ||
        parameters.get('fabric') ||
        'all'
    )
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    elements.filtersContainer.innerHTML = '';

    const activeDepartment =
        getDepartmentConfig();

    const isAllActive =
        targetFilter === 'all';

    const allButton =
        document.createElement('a');

    allButton.href =
        `/?department=${currentDepartment}`;

    allButton.className =
        `filter-btn ` +
        `${isAllActive ? 'active' : ''}`;

    allButton.dataset.filter = 'all';

    allButton.innerHTML = `
        <span class="filter-title">
            ALL ${activeDepartment.label.toUpperCase()}
        </span>
    `;

    allButton.onclick = event => {
        event.preventDefault();

        elements.filtersContainer
            .querySelectorAll('.filter-btn')
            .forEach(button => {
                button.classList.remove(
                    'active'
                );
            });

        allButton.classList.add('active');

        navigateToState(
            currentDepartment,
            'all',
            '',
            true
        );

        filterAndSearchProducts();
        showView('catalogue');
        scrollToDepartment(true);
    };

    elements.filtersContainer.appendChild(
        allButton
    );

    fabricMap.forEach((entry, key) => {
        const prices = entry.prices.filter(
            price => price > 0
        );

        const minimumPrice =
            prices.length
                ? Math.min(...prices)
                : 0;

        const maximumPrice =
            prices.length
                ? Math.max(...prices)
                : 0;

        const formatter =
            new Intl.NumberFormat('en-IN');

        const priceText =
            minimumPrice === maximumPrice
                ? `₹${formatter.format(minimumPrice)}`
                : (
                    `₹${formatter.format(minimumPrice)}` +
                    ` - ₹${formatter.format(maximumPrice)}`
                );

        const isActive =
            !isAllActive &&
            targetFilter === key;

        const button =
            document.createElement('a');

        button.href =
            `/?department=${currentDepartment}` +
            `&fabric=${key}`;

        button.className =
            `filter-btn ` +
            `${isActive ? 'active' : ''}`;

        button.dataset.filter = key;

        button.innerHTML = `
            <span class="filter-title">
                ${escapeHtml(entry.label.toUpperCase())}
            </span>

            <span class="filter-price">
                ${priceText}
            </span>
        `;

        button.onclick = event => {
            event.preventDefault();

            elements.filtersContainer
                .querySelectorAll('.filter-btn')
                .forEach(filterButton => {
                    filterButton.classList.remove(
                        'active'
                    );
                });

            button.classList.add('active');

            navigateToState(
                currentDepartment,
                button.dataset.filter,
                '',
                true
            );

            filterAndSearchProducts();
            showView('catalogue');
            scrollToDepartment(true);
        };

        elements.filtersContainer.appendChild(
            button
        );
    });
}

function syncFabricFilterUI(fabricParameter) {
    if (!elements.filtersContainer) {
        return;
    }

    const buttons =
        elements.filtersContainer.querySelectorAll(
            '.filter-btn'
        );

    if (!buttons.length) {
        return;
    }

    let matched = false;

    const cleanParameter = String(
        fabricParameter || 'all'
    )
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    buttons.forEach(button => {
        const buttonFilter = String(
            button.dataset.filter || ''
        )
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        if (
            cleanParameter !== 'all' &&
            buttonFilter === cleanParameter
        ) {
            button.classList.add('active');
            matched = true;
        } else {
            button.classList.remove('active');
        }
    });

    if (!matched) {
        const allButton =
            Array.from(buttons).find(
                button =>
                    button.dataset.filter === 'all'
            );

        if (allButton) {
            allButton.classList.add('active');
        }
    }

    filterAndSearchProducts();
}

// =========================================================================
// PRODUCT DETAILS
// =========================================================================

function showProductDetails(product) {
    currentProduct = product;

    trackRecentlyViewed(product);

    if (
        product.departmentKey &&
        product.departmentKey !==
            currentDepartment
    ) {
        currentDepartment =
            product.departmentKey;

        updateDepartmentUI();
        renderFilterButtons();
    }

    if (elements.detailImage) {
        attachProductImage(
            elements.detailImage,
            product
        );

        elements.detailImage.alt =
            `Srikalahasthi Pen Kalamkari ` +
            product.title;
    }

    const detailDiscountBadge =
        document.getElementById(
            'detail-image-discount-badge'
        );

    if (detailDiscountBadge) {
        const discountPercentage =
            product.mrp > product.price
                ? Math.round(
                    (
                        (
                            product.mrp -
                            product.price
                        ) /
                        product.mrp
                    ) * 100
                )
                : 0;

        detailDiscountBadge.style.display =
            discountPercentage > 0
                ? 'block'
                : 'none';

        if (discountPercentage > 0) {
            detailDiscountBadge.textContent =
                `${discountPercentage}% OFF`;
        }
    }

    if (elements.detailTitle) {
        elements.detailTitle.textContent =
            product.title;
    }

    if (elements.detailCode) {
        elements.detailCode.textContent =
            product.code || 'N/A';
    }

    if (elements.detailDescription) {
        elements.detailDescription.textContent =
            product.description || '';

        elements.detailDescription.style.display =
            product.description
                ? 'block'
                : 'none';
    }

    if (elements.detailPrice) {
        elements.detailPrice.textContent =
            new Intl.NumberFormat(
                'en-IN'
            ).format(product.price);
    }

    if (elements.detailMrp) {
        if (
            product.mrp &&
            product.mrp > product.price
        ) {
            elements.detailMrp.textContent =
                `INR ` +
                new Intl.NumberFormat(
                    'en-IN'
                ).format(product.mrp);

            elements.detailMrp.style.display =
                'inline-flex';
        } else {
            elements.detailMrp.style.display =
                'none';
        }
    }

    updateGoogleImageSchemaAndMeta(product);
    updateWishlistButtonState();
    renderFabricProducts(product);
    renderSimilarProducts(product);
    renderQuickCategoryPills(product);
    renderRecentlyViewed(product);

    showView('details');

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// =========================================================================
// FULLSCREEN IMAGE
// =========================================================================

function openFullScreenImage(product) {
    if (
        !product ||
        !elements.overlay ||
        !elements.overlayImage
    ) {
        return;
    }

    attachProductImage(
        elements.overlayImage,
        product
    );

    elements.overlay.classList.remove(
        'hidden'
    );

    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    if (!elements.overlay) {
        return;
    }

    elements.overlay.classList.add(
        'hidden'
    );

    document.body.style.overflow = '';
}

// =========================================================================
// WISHLIST
// =========================================================================

function syncAllCardWishlistButtons() {
    const savedCodes = new Set(
        wishlist.map(product => product.code)
    );

    document
        .querySelectorAll('.product-card')
        .forEach(card => {
            const button = card.querySelector(
                '.card-wishlist-btn'
            );

            if (!button) {
                return;
            }

            const saved = savedCodes.has(
                card.dataset.code
            );

            button.classList.toggle(
                'active',
                saved
            );

            button.textContent =
                saved ? '\u2665' : '\u2661';
        });
}

function toggleWishlist(
    product = currentProduct
) {
    if (!product) {
        return;
    }

    const index = wishlist.findIndex(
        item =>
            item.code === product.code
    );

    if (index === -1) {
        wishlist.push(product);

        showToast(
            'Added to Gallery Vault!'
        );
    } else {
        wishlist.splice(index, 1);

        showToast(
            'Removed from Gallery Vault.'
        );
    }

    safeStorage.setItem(
        'kalamkariWishlist',
        JSON.stringify(wishlist)
    );

    updateWishlistCount();
    updateWishlistButtonState();
    syncAllCardWishlistButtons();

    if (
        views.wishlist &&
        views.wishlist.classList.contains(
            'active'
        )
    ) {
        renderWishlist();
    }
}

function renderWishlist() {
    if (!elements.wishlistGrid) {
        return;
    }

    const visibleWishlist = wishlist
        .map(saved => allProducts.find(item => item.code === saved.code))
        .filter(Boolean);

    if (visibleWishlist.length === 0) {
        elements.wishlistGrid.style.display =
            'none';

        if (elements.emptyWishlistMsg) {
            elements.emptyWishlistMsg.style.display =
                'block';
        }
    } else {
        elements.wishlistGrid.style.display =
            'grid';

        if (elements.emptyWishlistMsg) {
            elements.emptyWishlistMsg.style.display =
                'none';
        }

        renderProducts(
            visibleWishlist,
            elements.wishlistGrid
        );
    }
}

function updateWishlistCount() {
    if (elements.wishlistCount) {
        elements.wishlistCount.textContent =
            wishlist.length;
    }
}

function updateWishlistButtonState() {
    if (!elements.addToWishlistBtn) {
        return;
    }

    const isInWishlist = currentProduct
        ? wishlist.some(
            item =>
                item.code ===
                currentProduct.code
        )
        : false;

    elements.addToWishlistBtn.classList.toggle(
        'active',
        isInWishlist
    );

    if (elements.wishlistBtnText) {
        elements.wishlistBtnText.textContent =
            isInWishlist
                ? 'In Gallery Vault'
                : 'Add to Gallery Vault';
    }

    if (elements.wishlistBtnIcon) {
        elements.wishlistBtnIcon.textContent =
            isInWishlist
                ? '♥'
                : '❤️';
    }
}

// =========================================================================
// SEARCH
// =========================================================================

function filterAndSearchProducts() {
    const searchTerm = elements.searchInput
        ? elements.searchInput.value
            .toLowerCase()
            .trim()
        : '';

    const activeFilterButton =
        document.querySelector(
            '.filter-btn.active'
        );

    const filterTerm = activeFilterButton
        ? activeFilterButton.dataset.filter
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim()
        : 'all';

    filteredProducts =
        getDepartmentProducts().filter(
            product => {
                const matchesSearch =
                    !searchTerm ||
                    (
                        product.code &&
                        product.code
                            .toLowerCase()
                            .includes(searchTerm)
                    ) ||
                    (
                        product.fabric &&
                        product.fabric
                            .toLowerCase()
                            .includes(searchTerm)
                    ) ||
                    (
                        product.title &&
                        product.title
                            .toLowerCase()
                            .includes(searchTerm)
                    ) ||
                    (
                        product.description &&
                        product.description
                            .toLowerCase()
                            .includes(searchTerm)
                    );

                let matchesFilter = true;

                if (filterTerm !== 'all') {
                    const productFabric =
                        (product.fabric || '')
                            .toLowerCase()
                            .replace(/\s+/g, ' ')
                            .trim();

                    matchesFilter =
                        productFabric === filterTerm;
                }

                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );

    renderProducts(
        filteredProducts,
        elements.productGrid
    );
}

// =========================================================================
// WHATSAPP PURCHASE AND VIDEO CALL
// =========================================================================

function buyNow(product = currentProduct) {
    if (!product || product.qty <= 0 ||
        !allProducts.some(item => item.code === product.code && item.qty > 0)) {
        showToast('This artwork is currently unavailable.');
        return;
    }

    const visitorId =
        safeStorage.getItem(
            'crm_visitor_id'
        ) ||
        safeStorage.getItem(
            'kalamkari_visitor_id'
        ) ||
        'New';

    const productUrl =
        getProductFullUrl(product);

    const formattedPrice =
        new Intl.NumberFormat(
            'en-IN'
        ).format(product.price);

    const text =
        `Namaste Kailash Kalamkari Workshop,\n\n` +
        `I want to BUY this authentic hand-painted ` +
        `Kalamkari masterpiece:\n\n` +
        `• Code: ${product.code}\n` +
        `• Fabric: ${product.fabric}\n` +
        `• Offer Price: INR ${formattedPrice}\n` +
        `• Web Link: ${productUrl}\n\n` +
        `• Ref ID: ${visitorId}\n\n` +
        `Please share payment details and shipping process.`;

    window.open(
        `https://wa.me/${CONTACT_PHONE_NUMBER}` +
        `?text=${encodeURIComponent(text)}`,
        '_blank'
    );
}

function bookVideoCall(
    product = currentProduct
) {
    if (!product || product.qty <= 0 ||
        !allProducts.some(item => item.code === product.code && item.qty > 0)) {
        showToast('This artwork is currently unavailable.');
        return;
    }

    const visitorId =
        safeStorage.getItem(
            'crm_visitor_id'
        ) ||
        safeStorage.getItem(
            'kalamkari_visitor_id'
        ) ||
        'New';

    const productUrl =
        getProductFullUrl(product);

    const formattedPrice =
        new Intl.NumberFormat(
            'en-IN'
        ).format(product.price);

    const text =
        `Namaste Kailash Kalamkari Workshop,\n\n` +
        `I would like to BOOK A LIVE VIDEO CALL ` +
        `to inspect this hand-painted Kalamkari artwork:\n\n` +
        `• Code: ${product.code}\n` +
        `• Fabric: ${product.fabric}\n` +
        `• Offer Price: INR ${formattedPrice}\n` +
        `• Web Link: ${productUrl}\n\n` +
        `• Ref ID: ${visitorId}\n\n` +
        `Please let me know your available time slots.`;

    window.open(
        `https://wa.me/${CONTACT_PHONE_NUMBER}` +
        `?text=${encodeURIComponent(text)}`,
        '_blank'
    );
}

// =========================================================================
// SHARING
// =========================================================================

function shareProduct(
    product = currentProduct
) {
    if (!product) {
        return;
    }

    const shareUrl =
        getProductFullUrl(product);

    const shareText =
        `Explore this authentic hand-painted ` +
        `Kailash Kalamkari artwork: ` +
        `"${product.title}" ` +
        `(Code: ${product.code})`;

    pendingShareData = {
        title: product.title,
        text: shareText,
        url: shareUrl
    };

    if (
        navigator.share &&
        /Android|iPhone|iPad/i.test(
            navigator.userAgent
        )
    ) {
        navigator
            .share({
                title: product.title,
                text: shareText,
                url: shareUrl
            })
            .catch(() => {});
    } else {
        const modal =
            document.getElementById(
                'share-modal'
            );

        if (modal) {
            modal.classList.remove(
                'hidden'
            );
        }
    }
}

// =========================================================================
// EVENT LISTENERS
// =========================================================================

function setupEventListeners() {
    if (elements.backToCatalogueBtn) {
        elements.backToCatalogueBtn
            .addEventListener(
                'click',
                goBack
            );
    }

    if (elements.backFromWishlistBtn) {
        elements.backFromWishlistBtn
            .addEventListener(
                'click',
                goBack
            );
    }

    if (elements.backFromPolicyBtn) {
        elements.backFromPolicyBtn
            .addEventListener(
                'click',
                goBack
            );
    }

    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn
            .addEventListener(
                'click',
                event => {
                    event.preventDefault();

                    sessionPushedStates++;

                    window.location.hash =
                        '#wishlist';

                    renderWishlist();
                    showView('wishlist');
                }
            );
    }

    const footerPolicyLink =
        document.getElementById(
            'footer-policy-link'
        );

    if (footerPolicyLink) {
        footerPolicyLink.addEventListener(
            'click',
            event => {
                event.preventDefault();

                sessionPushedStates++;

                window.location.hash =
                    '#return-policy';

                showView('policy');
            }
        );
    }

    if (elements.addToWishlistBtn) {
        elements.addToWishlistBtn
            .addEventListener(
                'click',
                () =>
                    toggleWishlist(
                        currentProduct
                    )
            );
    }

    if (elements.shareBtn) {
        elements.shareBtn
            .addEventListener(
                'click',
                () =>
                    shareProduct(
                        currentProduct
                    )
            );
    }

    if (elements.videoCallBtn) {
        elements.videoCallBtn
            .addEventListener(
                'click',
                () =>
                    bookVideoCall(
                        currentProduct
                    )
            );
    }

    if (elements.detailBuyNowBtn) {
        elements.detailBuyNowBtn
            .addEventListener(
                'click',
                () =>
                    buyNow(
                        currentProduct
                    )
            );
    }

    if (elements.searchInput) {
        let searchTimer;

        elements.searchInput
            .addEventListener(
                'input',
                () => {
                    clearTimeout(searchTimer);

                    searchTimer = setTimeout(
                        filterAndSearchProducts,
                        120
                    );
                }
            );
    }

    const floatingWishlistButton =
        document.getElementById(
            'detail-floating-wishlist-btn'
        );

    if (floatingWishlistButton) {
        floatingWishlistButton
            .addEventListener(
                'click',
                () =>
                    toggleWishlist(
                        currentProduct
                    )
            );
    }

    const floatingShareButton =
        document.getElementById(
            'detail-floating-share-btn'
        );

    if (floatingShareButton) {
        floatingShareButton
            .addEventListener(
                'click',
                () =>
                    shareProduct(
                        currentProduct
                    )
            );
    }

    const shareCloseButton =
        document.getElementById(
            'share-modal-close'
        );

    const shareBackdrop =
        document.getElementById(
            'share-modal-backdrop'
        );

    if (shareCloseButton) {
        shareCloseButton.addEventListener(
            'click',
            () => {
                document
                    .getElementById(
                        'share-modal'
                    )
                    ?.classList.add(
                        'hidden'
                    );
            }
        );
    }

    if (shareBackdrop) {
        shareBackdrop.addEventListener(
            'click',
            () => {
                document
                    .getElementById(
                        'share-modal'
                    )
                    ?.classList.add(
                        'hidden'
                    );
            }
        );
    }

    const shareWhatsappButton =
        document.getElementById(
            'share-whatsapp-btn'
        );

    if (shareWhatsappButton) {
        shareWhatsappButton
            .addEventListener(
                'click',
                () => {
                    if (!pendingShareData) {
                        return;
                    }

                    const text =
                        pendingShareData.text +
                        '\n' +
                        pendingShareData.url;

                    window.open(
                        'https://api.whatsapp.com/send' +
                        `?text=${encodeURIComponent(text)}`,
                        '_blank'
                    );
                }
            );
    }

    const shareCopyButton =
        document.getElementById(
            'share-copy-btn'
        );

    if (shareCopyButton) {
        shareCopyButton.addEventListener(
            'click',
            async () => {
                if (!pendingShareData) {
                    return;
                }

                await navigator.clipboard.writeText(
                    pendingShareData.url
                );

                showToast(
                    'Masterpiece link copied to clipboard!'
                );

                document
                    .getElementById(
                        'share-modal'
                    )
                    ?.classList.add(
                        'hidden'
                    );
            }
        );
    }

    document
        .querySelectorAll(
            '.department-btn'
        )
        .forEach(element => {
            element.addEventListener(
                'click',
                event => {
                    if (
                        element.id ===
                        'wishlist-trigger'
                    ) {
                        return;
                    }

                    event.preventDefault();

                    setDepartment(
                        element.dataset.department,
                        {
                            pushState: true
                        }
                    );

                    showView('catalogue');
                }
            );
        });

    if (elements.detailImage) {
        elements.detailImage
            .addEventListener(
                'click',
                () =>
                    openFullScreenImage(
                        currentProduct
                    )
            );
    }

    if (elements.overlay) {
        elements.overlay
            .addEventListener(
                'click',
                closeOverlay
            );
    }

    window.addEventListener(
        'popstate',
        handlePopState
    );
}

// =========================================================================
// BROWSER HISTORY AND DIRECT PRODUCT LINKS
// =========================================================================

function handlePopState() {
    const parameters =
        new URLSearchParams(
            window.location.search
        );

    const productParameter =
        parameters.get('product') ||
        parameters.get('code') ||
        parameters.get('id');

    const departmentParameter =
        normalizeDepartment(
            parameters.get('department')
        ) || 'saree';

    const fabricParameter =
        parameters.get('fabric') ||
        'all';

    const hash = window.location.hash;

    currentDepartment =
        departmentParameter;

    updateDepartmentUI();

    if (
        hash === '#return-policy' ||
        hash === '#policy'
    ) {
        showView('policy');

        return;
    }

    if (productParameter) {
        const codeMatch =
            productParameter.match(
                /(?:.*-)?([A-Za-z0-9]+)$/
            );

        const targetCode = (
            codeMatch
                ? codeMatch[1]
                : productParameter
        )
            .toUpperCase()
            .trim();

        const product = allProducts.find(
            item =>
                item.code
                    .toUpperCase()
                    .trim() === targetCode
        );

        if (product) {
            showProductDetails(product);
        } else {
            showView('catalogue');
        }

        return;
    }

    if (
        hash.includes('kalamkari') ||
        hash.startsWith('#product/')
    ) {
        const codeMatch = hash.match(
            /(?:[A-Za-z0-9_-]+-)?([A-Za-z0-9]+)$/
        );

        const productCode = (
            codeMatch
                ? codeMatch[1]
                : hash.split('/').pop()
        )
            .toUpperCase()
            .trim();

        const product = allProducts.find(
            item =>
                item.code
                    .toUpperCase()
                    .trim() === productCode
        );

        if (product) {
            showProductDetails(product);
        } else {
            showView('catalogue');
        }

        return;
    }

    if (hash === '#wishlist') {
        renderWishlist();
        showView('wishlist');

        return;
    }

    renderFilterButtons(
        fabricParameter
    );

    syncFabricFilterUI(
        fabricParameter
    );

    showView('catalogue');
}

// =========================================================================
// INITIALIZATION
// =========================================================================

async function init() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    updateWishlistCount();
    setupEventListeners();

    // Do not render cached inventory: it can contain items removed from Drive.
    // A live inventory request must succeed before products become purchasable.
    safeStorage.removeItem(CACHE_STORAGE_KEY);
    safeStorage.removeItem(CACHE_TIME_KEY);
    await loadAndApplyCatalog(false);
    isInitialLoad = false;
}

document.addEventListener(
    'DOMContentLoaded',
    init
);