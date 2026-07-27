// === KAILASH KALAMKARI - CLIENT WEBPAGE LOGIC (script.js) ===

const GLOBAL_DISCOUNT_PERCENTAGE = 10; 

const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
const ANALYTICS_API_URL = 'https://script.google.com/macros/s/AKfycbwF3r0BkuRyMuOah34jFJASVGeK2p-p0B_M9ZrWrGoKk8fuGjUn6L2F5DJpX-MAxEEG/exec'; 

const CONTACT_PHONE_NUMBER = '919063374020';
const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

const SHARE_ICON_SVG = `<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7 0-.24-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>`;

const DEPARTMENTS = [
    { key: 'saree', label: 'Sarees', singular: 'Saree' },
    { key: 'dupatta', label: 'Dupattas', singular: 'Dupatta' }
];

let allProducts = [];
let filteredProducts = [];
let wishlist = JSON.parse(localStorage.getItem('kalamkariWishlist')) || [];
let recentlyViewed = JSON.parse(localStorage.getItem('kalamkariRecentlyViewed')) || [];
let currentProduct = null;
let currentDepartment = getInitialDepartment();
let isDetailZoomed = false;
let isOverlayZoomed = false;
let isInitialLoad = true; 
let sessionPushedStates = 0;
let pendingShareData = null;

// Product View Timer variables
let currentTrackedProductCode = 'N/A';
let currentTrackedProductTitle = 'Browsing Main Catalogue';
let productStartTime = Date.now();

// --- CLIENT-SIDE MULTI-LAYER BOT DETECTION ---
function isBotVisitor() {
    // 1. Check for automated webdriver flags
    if (navigator.webdriver) return true;

    // 2. Comprehensive bot & crawler user-agent list
    const ua = (navigator.userAgent || navigator.vendor || window.opera || '').toLowerCase();
    const botPatterns = [
        'bot', 'crawler', 'spider', 'crawling', 'slurp', 'facebookexternalhit',
        'whatsapp', 'twitterbot', 'pinterest', 'linkedinbot', 'telegrambot',
        'discordbot', 'bingpreview', 'ahrefsbot', 'semrushbot', 'dotbot',
        'petalbot', 'bytespider', 'yandex', 'baidu', 'headlesschrome',
        'puppeteer', 'selenium', 'phantomjs', 'phantom', 'prerender',
        'googlebot', 'bingbot', 'duckduckbot', 'yandexbot', 'sogou',
        'exabot', 'facebot', 'ia_archiver'
    ];
    
    if (botPatterns.some(pattern => ua.includes(pattern))) {
        return true;
    }

    // 3. Check for headless browser properties
    if (window.callPhantom || window._phantom || window.__nightmare) return true;

    return false;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

function getGoogleDriveId(product) {
    if (!product) return null;
    if (product.imageId && typeof product.imageId === 'string' && product.imageId.length >= 25) {
        return product.imageId;
    }
    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    const isGoogleDrive = rawUrl.includes('drive.google.com') || rawUrl.includes('docs.google.com') || rawUrl.includes('googleusercontent.com');
    
    if (isGoogleDrive) {
        const idRegex = /(?:id=|file\/d\/|\/d\/|)([a-zA-Z0-9_-]{25,50})(?:[/?&]|$|=)/;
        const potentialIdMatch = rawUrl.match(idRegex);
        if (potentialIdMatch && potentialIdMatch[1]) {
            return potentialIdMatch[1];
        }
    }
    return null;
}

function getProductImageUrl(product, width = 800) {
    if (!product) return DEFAULT_IMAGE;
    const fileId = getGoogleDriveId(product);
    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
    }
    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    if (!rawUrl) return DEFAULT_IMAGE;
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return rawUrl;
    }
    if (rawUrl.includes('drive.google.com')) return 'https://' + rawUrl;
    return DEFAULT_IMAGE;
}

function setupImageFallback(imgElement, product, width = 800) {
    const fileId = getGoogleDriveId(product);
    if (!fileId) return;

    imgElement.onerror = () => {
        if (!imgElement.dataset.fallbackAttempted) {
            imgElement.dataset.fallbackAttempted = "1";
            imgElement.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
        } else if (imgElement.dataset.fallbackAttempted === "1") {
            imgElement.dataset.fallbackAttempted = "2";
            imgElement.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
        } else if (imgElement.dataset.fallbackAttempted === "2") {
            imgElement.dataset.fallbackAttempted = "failed_all";
            imgElement.src = DEFAULT_IMAGE;
        }
    };
}

function updateGoogleImageSchemaAndMeta(product) {
    if (!product) return;

    const pageTitle = `Kailash Kalamkari Srikalahasthi Pen Kalamkari — ${product.title} (Code: ${product.code})`;
    const pageDesc = `Buy authentic hand-painted ${product.fabric} Kalamkari artwork (${product.title}) featuring traditional natural mineral dyes. Code: ${product.code}. Special Price: ₹${new Intl.NumberFormat('en-IN').format(product.price)}. Direct from Kailash Kalamkari Srikalahasthi Pen Kalamkari master artisans.`;
    const imageUrl = getProductImageUrl(product, 1600);
    const productUrl = `https://www.kailash-kalamkari.com/#kailash-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;

    document.title = pageTitle;

    const ogTitle = document.getElementById('og-title');
    if (ogTitle) ogTitle.setAttribute('content', pageTitle);

    const ogDesc = document.getElementById('og-desc');
    if (ogDesc) ogDesc.setAttribute('content', pageDesc);

    const ogImage = document.getElementById('og-image');
    if (ogImage) ogImage.setAttribute('content', imageUrl);

    const ogUrl = document.getElementById('og-url');
    if (ogUrl) ogUrl.setAttribute('content', productUrl);

    const schemaScript = document.getElementById('dynamic-product-schema');
    if (schemaScript) {
        const schemaData = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": `Kailash Kalamkari Srikalahasthi Pen Kalamkari — ${product.title}`,
            "image": [
                imageUrl,
                getProductImageUrl(product, 800)
            ],
            "description": product.description || pageDesc,
            "sku": product.code,
            "mpn": product.code,
            "brand": {
                "@type": "Brand",
                "name": "Kailash Kalamkari"
            },
            "category": product.category || product.department || "Srikalahasthi Pen Kalamkari Hand Painted Sarees",
            "offers": {
                "@type": "Offer",
                "url": productUrl,
                "priceCurrency": "INR",
                "price": product.price,
                "priceValidUntil": "2028-12-31",
                "itemCondition": "https://schema.org/NewCondition",
                "availability": product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                "seller": {
                    "@type": "Organization",
                    "name": "Kailash Kalamkari",
                    "url": "https://www.kailash-kalamkari.com/"
                }
            }
        };
        schemaScript.textContent = JSON.stringify(schemaData);
    }
}

function sortProductsByPrice(products) {
    return [...products].sort((a, b) => (b.price || 0) - (a.price || 0));
}

function getInitialDepartment() {
    const params = new URLSearchParams(window.location.search);
    return normalizeDepartment(params.get('department')) || 'saree';
}

function normalizeDepartment(value) {
    const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.includes('dupatta') || normalized.includes('duppata') || normalized.includes('duppatta')) return 'dupatta';
    if (normalized.includes('saree') || normalized.includes('sari')) return 'saree';
    return '';
}

function getDepartmentConfig(departmentKey = currentDepartment) {
    return DEPARTMENTS.find(department => department.key === departmentKey) || DEPARTMENTS[0];
}

function getDepartmentProducts(departmentKey = currentDepartment) {
    return allProducts.filter(product => product.departmentKey === departmentKey);
}

function inferDepartmentFromText(...values) {
    const combined = values.filter(Boolean).map(value => String(value)).join(' ');
    return normalizeDepartment(combined);
}

function navigateToState(department, fabric, hash = '', push = true) {
    const url = new URL(window.location.href);
    if (department) url.searchParams.set('department', department);
    else url.searchParams.delete('department');
    
    if (fabric && fabric !== 'all') url.searchParams.set('fabric', fabric);
    else url.searchParams.delete('fabric');
    
    url.hash = hash;
    if (push) window.history.pushState({ department, fabric, hash }, '', url);
    else window.history.replaceState({ department, fabric, hash }, '', url);
}

function updateDepartmentUI() {
    const activeDepartment = getDepartmentConfig();
    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        const departmentKey = normalizeDepartment(element.dataset.department);
        element.classList.toggle('active', departmentKey === currentDepartment);
    });

    if (elements.searchInput) {
        elements.searchInput.placeholder = `Search ${activeDepartment.label.toLowerCase()} by code, fabric or motif...`;
    }
}

function setDepartment(department, { pushState = true } = {}) {
    currentDepartment = normalizeDepartment(department) || 'saree';
    if (elements.searchInput) elements.searchInput.value = '';
    updateDepartmentUI();
    renderFilterButtons();
    if (pushState) navigateToState(currentDepartment, 'all', '', true);
    filterAndSearchProducts();
}

function detectTrafficSource() {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) return utmSource.toLowerCase().trim();

    const referrer = document.referrer ? document.referrer.toLowerCase() : '';
    if (referrer.includes('instagram.com')) return 'instagram';
    if (referrer.includes('facebook.com') || referrer.includes('fb.me')) return 'facebook';
    if (referrer.includes('whatsapp.com') || referrer.includes('wa.me')) return 'whatsapp';
    return referrer ? 'other website' : 'direct / organic';
}

function detectBrowser() {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome') || userAgent.includes('CriOS')) {
        if (userAgent.includes('Edg') || userAgent.includes('OPR')) return 'Other Browser';
        return 'Google Chrome';
    }
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
    return 'Other Browser';
}

async function getGeoLocation() {
    try {
        const res1 = await fetch('https://ipwho.is/');
        if (res1.ok) {
            const data = await res1.json();
            if (data && data.success) {
                return { city: data.city || 'Unknown', region: data.region || 'Unknown', country: data.country || 'Unknown', ip: data.ip || 'Anonymized' };
            }
        }
    } catch (e) {}

    try {
        const res2 = await fetch('https://ipapi.co/json/');
        if (res2.ok) {
            const data = await res2.json();
            if (data && data.city) {
                return { city: data.city || 'Unknown', region: data.region_code || data.region || 'Unknown', country: data.country_name || 'Unknown', ip: data.ip || 'Anonymized' };
            }
        }
    } catch (e) {}

    return { city: 'Unknown', region: 'Unknown', country: 'Unknown', ip: 'Anonymized' };
}

async function logVisitorTraffic() {
    // BOT FILTER CHECK
    if (isBotVisitor()) return;

    if (sessionStorage.getItem('trafficLogged') === 'true') return;

    const source = detectTrafficSource();
    const browser = detectBrowser();
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let visitorId = localStorage.getItem('kalamkari_visitor_id');
    let visitorType = 'Returning';

    if (!visitorId) {
        visitorId = 'visitor-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('kalamkari_visitor_id', visitorId);
        visitorType = 'New';
    }

    let locationData = { city: 'Unknown', region: 'Unknown', country: 'Unknown', ip: 'Anonymized' };

    const cachedGeo = sessionStorage.getItem('kalamkari_geo_cache');
    if (cachedGeo && !cachedGeo.includes('Unknown')) {
        try {
            locationData = JSON.parse(cachedGeo);
        } catch (e) {}
    } else {
        locationData = await getGeoLocation();
        if (locationData.city !== 'Unknown') {
            sessionStorage.setItem('kalamkari_geo_cache', JSON.stringify(locationData));
        }
    }

    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'logTraffic',
                isBot: false,
                timestamp: timestamp,
                source: source,
                browser: browser,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                visitorId: visitorId,
                visitorType: visitorType,
                city: locationData.city,
                region: locationData.region,
                country: locationData.country,
                ip: locationData.ip,
                wishlistCount: wishlist.length
            })
        });
        sessionStorage.setItem('trafficLogged', 'true');
    } catch (error) {}
}

async function logWishlistActivity(action, product) {
    if (isBotVisitor() || !product) return;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'logWishlist',
                isBot: false,
                timestamp: timestamp,
                eventAction: action,
                wishlistAction: action,
                productCode: product.code || '',
                productTitle: product.title || '',
                price: product.price || 0,
                fabric: product.fabric || '',
                wishlistCount: wishlist.length
            })
        });
    } catch (error) {}
}

function hideIntroAnimation() {
    const loader = document.getElementById('premium-intro-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.style.display = 'none', 800);
    }
}

const views = {
    catalogue: document.getElementById('catalogue-view'),
    details: document.getElementById('product-details-view'),
    wishlist: document.getElementById('wishlist-view')
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
    emptyWishlistMsg: document.getElementById('wishlist-empty'),
    
    detailImage: document.getElementById('detail-image'),
    detailImageSection: document.querySelector('.product-image-section'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    overlayClose: document.getElementById('overlay-close'),
    detailTitle: document.getElementById('detail-title'),
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailMrp: document.getElementById('detail-mrp'),
    
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    shareBtn: document.getElementById('share-btn'),
    videoCallBtn: document.getElementById('video-call-btn')
};

function scrollToDepartment(smooth = true) {
    if (isInitialLoad) return;
    const target = document.querySelector('.sticky-nav-container') || document.querySelector('.department-bar-container');
    if (target) {
        window.scrollTo({ top: target.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function goBack() {
    if (sessionPushedStates > 0) {
        sessionPushedStates--;
        window.history.back();
    } else {
        const params = new URLSearchParams(window.location.search);
        const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
        const initialFabric = params.get('fabric') || 'all';
        navigateToState(initialDept, initialFabric, '', false);
        handlePopState();
    }
}

async function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    updateWishlistCount();
    setupEventListeners();
    logVisitorTraffic();

    await fetchProducts();

    const params = new URLSearchParams(window.location.search);
    const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
    const initialFabric = params.get('fabric') || 'all';
    const hash = window.location.hash;

    navigateToState(initialDept, initialFabric, hash, false);

    if (hash.includes('kalamkari') || hash.startsWith('#product/') || hash === '#wishlist') {
        const injectHistory = () => {
            if (sessionPushedStates === 0) {
                navigateToState(initialDept, initialFabric, '', false);
                navigateToState(initialDept, initialFabric, hash, true);
                sessionPushedStates++;
            }
            cleanup();
        };

        const cleanup = () => {
            window.removeEventListener('click', injectHistory);
            window.removeEventListener('touchstart', injectHistory);
            window.removeEventListener('scroll', injectHistory);
        };

        window.addEventListener('click', injectHistory);
        window.addEventListener('touchstart', injectHistory);
        window.addEventListener('scroll', injectHistory);
    }

    handlePopState(); 
    isInitialLoad = false;
    hideIntroAnimation();
}

async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block'; 
        const response = await fetch(CATALOG_API_URL);
        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData : (rawData.value || rawData.data || rawData.records || []);
        
        const getFieldValue = (item, keys) => {
            const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedEntries = Object.entries(item).map(([itemKey, value]) => [normalize(itemKey), value]);

            for (const key of keys) {
                const normalizedKey = normalize(key);
                let value = item[key];

                if (value === undefined || value === null) {
                    const matchedEntry = normalizedEntries.find(([itemKey]) => itemKey === normalizedKey);
                    if (matchedEntry) value = matchedEntry[1];
                }

                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return String(value).trim();
                }
            }
            return '';
        };

        allProducts = data.map(item => {
            function parsePrice(val) {
                if (!val) return 0;
                const cleaned = String(val).replace(/[^0-9.\-]/g, '');
                const n = Number(cleaned);
                return isNaN(n) ? 0 : n;
            }

            const code = String(getFieldValue(item, ['code', 'style code'])).trim();
            const fabric = String(getFieldValue(item, ['fabric']) || 'Pure Silk').trim();
            const category = String(getFieldValue(item, ['category']) || 'Uncategorized').trim();
            const department = String(getFieldValue(item, ['department', 'dept', 'collection'])).trim();
            const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
            
            const imageLink = String(getFieldValue(item, ['image link', 'drive link', 'image'])).trim();
            const thumbnail = String(getFieldValue(item, ['thumbnail', 'thumbnail link'])).trim() || imageLink;
            const imageId = String(getFieldValue(item, ['image id', 'file id'])).trim();

            let rawQty = item.qty !== undefined && item.qty !== '' ? item.qty : (item.Qty !== undefined && item.Qty !== '' ? item.Qty : '');
            let qty = rawQty !== '' ? Number(rawQty) : 1;
            if (isNaN(qty)) qty = 1;

            let sellingPrice = parsePrice(getFieldValue(item, ['price', 'selling price', 'rate', 'amount']));
            let mrpFromSheet = parsePrice(getFieldValue(item, ['mrp', 'm.r.p', 'original price', 'mrp price', 'list price']));

            let rawMrp = mrpFromSheet;
            if (!rawMrp) {
                rawMrp = sellingPrice;
            }

            if (GLOBAL_DISCOUNT_PERCENTAGE > 0 && GLOBAL_DISCOUNT_PERCENTAGE < 100) {
                if (rawMrp <= sellingPrice) {
                    rawMrp = sellingPrice;
                }
                sellingPrice = Math.round(rawMrp * (1 - GLOBAL_DISCOUNT_PERCENTAGE / 100));
            }

            const description = String(getFieldValue(item, ['description', 'product description', 'desc'])).trim();
            const deptConfig = DEPARTMENTS.find(d => d.key === departmentKey) || { singular: 'Product' };
            const deptSingular = deptConfig.singular || 'Product';

            const customTitle = String(getFieldValue(item, ['product name', 'saree name', 'dupatta name', 'item name', 'name', 'title'])).trim();

            let title = customTitle;
            if (!title) {
                if (fabric) {
                    let baseFabric = fabric.trim();
                    if (departmentKey === 'saree') baseFabric = baseFabric.replace(/\s+(sarees|saree|saris|sari)\s*$/i, '');
                    else if (departmentKey === 'dupatta') baseFabric = baseFabric.replace(/\s+dup+at+as?\s*$/i, '');
                    title = `${baseFabric} ${deptSingular}`;
                } else {
                    title = `Product ${code}`;
                }
            }

            return {
                code, title, fabric, category, department, departmentKey,
                price: sellingPrice, mrp: rawMrp,
                qty, imageLink, thumbnail, imageId, description
            };
        }).filter(item => item.code && item.price > 0);

        allProducts = sortProductsByPrice(allProducts);
        if (!getDepartmentProducts(currentDepartment).length && allProducts.length) {
            currentDepartment = allProducts[0].departmentKey || 'saree';
        }
        filteredProducts = sortProductsByPrice(getDepartmentProducts());

        wishlist = wishlist.map(savedItem => {
            const freshItem = allProducts.find(p => p.code === savedItem.code);
            return freshItem || savedItem;
        });
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
        updateWishlistCount();

        if (elements.spinner) elements.spinner.style.display = 'none';
        updateDepartmentUI();
        renderFilterButtons();
        filterAndSearchProducts();
    } catch (error) {
        if (elements.spinner) {
            elements.spinner.textContent = 'Failed to load collection. Please try again later.';
        }
    }
}

function renderProducts(products, container, isHorizontal = false) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-antique-gold); padding: 3rem 0;">No sacred artworks found matching your criteria.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.code = product.code;
        if (product.qty <= 0) card.classList.add('sold-out');

        const keywordSlug = `#kailash-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;

        card.onclick = () => {
            if (isHorizontal) {
                const url = new URL(window.location.href);
                url.hash = keywordSlug;
                window.history.replaceState({ isDepartmentSelection: true }, '', url);
                handlePopState();
            } else {
                sessionPushedStates++;
                window.location.hash = keywordSlug;
            }
        };

        const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);
        const formattedMrp = new Intl.NumberFormat('en-IN').format(product.mrp);
        const discountPct = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = `Kailash Kalamkari Srikalahasthi Pen Kalamkari ${product.title} Code ${product.code} (${product.fabric})`; 
        img.title = `Kailash Kalamkari Srikalahasthi Pen Kalamkari — ${product.title}`;
        img.loading = 'lazy';
        
        const primaryUrl = getProductImageUrl(product, 800);
        img.src = primaryUrl;

        setupImageFallback(img, product, 800);
        imageWrapper.appendChild(img);

        if (discountPct > 0) {
            const discountBadge = document.createElement('span');
            discountBadge.className = 'card-discount-badge';
            discountBadge.textContent = `${discountPct}% OFF`;
            imageWrapper.appendChild(discountBadge);
        }

        if (product.qty <= 0) {
            const badge = document.createElement('span');
            badge.className = 'sold-out-badge';
            badge.textContent = 'SOLD OUT';
            imageWrapper.appendChild(badge);
        }

        const isInWishlist = wishlist.some(item => item.code === product.code);
        const quickActions = document.createElement('div');
        quickActions.className = 'card-quick-actions';

        const cardWishlistBtn = document.createElement('button');
        cardWishlistBtn.className = `card-action-btn card-wishlist-btn ${isInWishlist ? 'active' : ''}`;
        cardWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
        cardWishlistBtn.title = 'Add to Gallery Vault';
        cardWishlistBtn.onclick = (e) => {
            e.stopPropagation();
            toggleWishlist(product);
        };

        const cardShareBtn = document.createElement('button');
        cardShareBtn.className = 'card-action-btn card-share-btn';
        cardShareBtn.innerHTML = SHARE_ICON_SVG;
        cardShareBtn.title = 'Share Artwork';
        cardShareBtn.onclick = (e) => {
            e.stopPropagation();
            shareProduct(product);
        };

        quickActions.appendChild(cardWishlistBtn);
        quickActions.appendChild(cardShareBtn);
        imageWrapper.appendChild(quickActions);

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? `${String(product.description).trim().slice(0, 100)}${product.description.length > 100 ? '...' : ''}` : '';
        
        info.innerHTML = `
            <h3 class="product-title">${product.title}</h3>
            ${shortDescription ? `<p class="product-card-description">${shortDescription}</p>` : ''}
            <div class="product-price-row">
                ${product.mrp > product.price ? `<span class="mrp-price">Rs. ${formattedMrp}</span>` : ''}
                <span class="product-price">Rs. ${formattedPrice}</span>
            </div>
            <button class="card-book-now-btn">
                <span>📹 BOOK NOW</span>
            </button>
        `;

        const cardBookBtn = info.querySelector('.card-book-now-btn');
        if (cardBookBtn) {
            cardBookBtn.onclick = (e) => {
                e.stopPropagation();
                bookVideoCall(product);
            };
        }

        card.appendChild(imageWrapper);
        card.appendChild(info);
        container.appendChild(card);
    });
}

function syncAllCardWishlistButtons() {
    document.querySelectorAll('.product-card').forEach(card => {
        const code = card.dataset.code;
        const wishlistBtn = card.querySelector('.card-wishlist-btn');
        if (code && wishlistBtn) {
            const inWishlist = wishlist.some(item => item.code === code);
            wishlistBtn.innerHTML = inWishlist ? '♥' : '♡';
            wishlistBtn.classList.toggle('active', inWishlist);
        }
    });
}

function trackRecentlyViewed(product) {
    if (!product || !product.code) return;
    recentlyViewed = recentlyViewed.filter(p => p.code !== product.code);
    recentlyViewed.unshift(product);
    if (recentlyViewed.length > 8) recentlyViewed = recentlyViewed.slice(0, 8);
    localStorage.setItem('kalamkariRecentlyViewed', JSON.stringify(recentlyViewed));
}

function renderRecentlyViewed(currentProduct) {
    const recentSection = document.getElementById('recently-viewed-section');
    const recentGrid = document.getElementById('recently-viewed-grid');
    if (!recentSection || !recentGrid) return;

    const list = recentlyViewed.filter(p => p.code !== currentProduct.code);
    if (list.length > 0) {
        recentSection.style.display = 'block';
        renderProducts(list, recentGrid, true);
    } else {
        recentSection.style.display = 'none';
    }
}

function renderFabricProducts(currentProduct) {
    const fabricSection = document.getElementById('fabric-products-section');
    const fabricContainer = document.getElementById('fabric-products-grid');
    if (!fabricSection || !fabricContainer) return;

    const list = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.code !== currentProduct.code && 
        p.fabric.toLowerCase().trim() === currentProduct.fabric.toLowerCase().trim()
    );

    if (list.length > 0) {
        fabricSection.style.display = 'block';
        renderProducts(list.slice(0, 8), fabricContainer, true);
    } else {
        fabricSection.style.display = 'none';
    }
}

function renderSimilarProducts(currentProduct) {
    const similarSection = document.getElementById('similar-products-section');
    const similarContainer = document.getElementById('similar-products-grid');
    if (!similarSection || !similarContainer) return;

    const currentPrice = currentProduct.price;
    const currentFabric = (currentProduct.fabric || '').toLowerCase().trim();

    let list = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.code !== currentProduct.code &&
        p.fabric.toLowerCase().trim() !== currentFabric &&
        Math.abs(p.price - currentPrice) / currentPrice <= 0.25
    );

    list.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

    if (list.length === 0) {
        list = allProducts.filter(p => 
            p.departmentKey === currentProduct.departmentKey &&
            p.code !== currentProduct.code &&
            p.fabric.toLowerCase().trim() !== currentFabric
        ).sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
    }

    if (list.length > 0) {
        similarSection.style.display = 'block';
        renderProducts(list.slice(0, 8), similarContainer, true); 
    } else {
        similarSection.style.display = 'none';
    }
}

function renderQuickCategoryPills(currentProd = currentProduct) {
    const section = document.getElementById('category-browse-section');
    const container = document.getElementById('quick-category-pills');
    if (!section || !container) return;

    container.innerHTML = '';
    const targetDept = currentProd ? currentProd.departmentKey : currentDepartment;
    const deptProducts = allProducts.filter(p => p.departmentKey === targetDept);

    const fabricMap = new Map();
    deptProducts.forEach(product => {
        const fabric = (product.fabric || '').trim();
        if (!fabric) return;
        const key = fabric.toLowerCase().replace(/\s+/g, ' ').trim();

        if (!fabricMap.has(key)) {
            const deptConfig = DEPARTMENTS.find(d => d.key === targetDept) || { label: 'Products' };
            const isPluralFabric = fabric.toLowerCase().includes('saree') || fabric.toLowerCase().includes('sari') || fabric.toLowerCase().includes('dupatta');
            
            fabricMap.set(key, {
                key: key,
                fabricName: fabric,
                label: isPluralFabric ? fabric : `${fabric} ${deptConfig.label}`,
                products: []
            });
        }
        fabricMap.get(key).products.push(product);
    });

    if (fabricMap.size === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    const gridsWrapper = document.createElement('div');
    gridsWrapper.className = 'fabric-grids-wrapper';

    fabricMap.forEach((item) => {
        const block = document.createElement('div');
        block.className = 'fabric-collection-block';

        const blockTitle = document.createElement('h3');
        blockTitle.className = 'fabric-block-title';
        blockTitle.innerHTML = `
            <span>${item.label}</span>
            <button class="view-all-fabric-btn">View All (${item.products.length}) &rarr;</button>
        `;
        
        const viewAllBtn = blockTitle.querySelector('.view-all-fabric-btn');
        viewAllBtn.onclick = () => {
            setDepartment(targetDept, { pushState: false });
            navigateToState(targetDept, item.key, '', true);
            syncFabricFilterUI(item.key);
            showView('catalogue');
            scrollToDepartment(true);
        };

        const grid = document.createElement('div');
        grid.className = 'product-grid horizontal-scroll-grid';

        renderProducts(item.products.slice(0, 8), grid, true);

        block.appendChild(blockTitle);
        block.appendChild(grid);
        gridsWrapper.appendChild(block);
    });

    container.appendChild(gridsWrapper);
}

function showView(viewName) {
    if (viewName === 'catalogue') {
        switchProductTracking('Browsing Main Catalogue', 'N/A');
    } else if (viewName === 'wishlist') {
        switchProductTracking('Viewing Gallery Vault (Wishlist)', 'N/A');
    }

    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
    } else {
        document.body.classList.remove('details-mode');
        if (viewName === 'catalogue') {
            scrollToDepartment(true);
            document.title = "Kalamkari Sarees — Srikalahasti & Sreekalahasthi Kalamkari Sarees | Kailash Kalamkari";
        } else {
            window.scrollTo(0, 0);
        }
    }
}

function renderFilterButtons() {
    if (!elements.filtersContainer) return;
    const departmentProducts = getDepartmentProducts();
    const fabricMap = new Map();

    departmentProducts.forEach(product => {
        const fabric = (product.fabric || 'Unknown').trim();
        if (!fabric) return;
        const key = fabric.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!fabricMap.has(key)) {
            fabricMap.set(key, { label: fabric, prices: [] });
        }
        fabricMap.get(key).prices.push(product.price || 0);
    });

    elements.filtersContainer.innerHTML = '';
    const activeDepartment = getDepartmentConfig();
    
    const allButton = document.createElement('button');
    allButton.className = 'filter-btn active';
    allButton.dataset.filter = 'all';
    allButton.innerHTML = `<span class="filter-title">ALL ${activeDepartment.label.toUpperCase()}</span>`;
    elements.filtersContainer.appendChild(allButton);

    fabricMap.forEach((entry, key) => {
        const prices = entry.prices.filter(price => price > 0);
        const priceText = prices.length > 0 ? formatPriceRange(prices) : 'Price Unavailable';

        const button = document.createElement('button');
        button.className = 'filter-btn';
        button.dataset.filter = key;
        button.innerHTML = `
            <span class="filter-title">${entry.label.toUpperCase()}</span>
            <span class="filter-price">${priceText}</span>
        `;
        elements.filtersContainer.appendChild(button);
    });

    attachFilterHandlers();
}

function attachFilterHandlers() {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            navigateToState(currentDepartment, btn.dataset.filter, '', true);
            filterAndSearchProducts();
            showView('catalogue');
            scrollToDepartment(true);
        });
    });
}

function syncFabricFilterUI(fabricParam) {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    if (!buttons.length) return;

    let matched = false;
    const cleanParam = String(fabricParam || 'all').toLowerCase().replace(/\s+/g, ' ').trim();

    buttons.forEach(btn => {
        const btnFilter = String(btn.dataset.filter || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (btnFilter === cleanParam) {
            btn.classList.add('active');
            matched = true;
        } else {
            btn.classList.remove('active');
        }
    });

    if (!matched) {
        buttons.forEach(btn => {
            const btnFilter = String(btn.dataset.filter || '').toLowerCase().replace(/\s+/g, ' ').trim();
            if (cleanParam !== 'all' && (btnFilter.includes(cleanParam) || cleanParam.includes(btnFilter))) {
                btn.classList.add('active');
                matched = true;
            }
        });
    }

    if (!matched && buttons.length > 0) {
        const allBtn = Array.from(buttons).find(b => b.dataset.filter === 'all');
        if (allBtn) allBtn.classList.add('active');
    }

    filterAndSearchProducts();
}

function formatPriceRange(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const opts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
    const formattedMin = new Intl.NumberFormat('en-IN', opts).format(minPrice);
    const formattedMax = new Intl.NumberFormat('en-IN', opts).format(maxPrice);
    return minPrice === maxPrice ? formattedMin : `${formattedMin} to ${formattedMax}`;
}

function showProductDetails(product) {
    switchProductTracking(product.title || `Product ${product.code}`, product.code);

    currentProduct = product;
    isDetailZoomed = false;
    
    trackRecentlyViewed(product);

    if (product.departmentKey && product.departmentKey !== currentDepartment) {
        currentDepartment = product.departmentKey;
        updateDepartmentUI();
        renderFilterButtons();
    } else if (!elements.filtersContainer || !elements.filtersContainer.children.length) {
        renderFilterButtons();
    }

    const params = new URLSearchParams(window.location.search);
    const fabricParam = params.get('fabric') || (product.fabric ? product.fabric.toLowerCase().replace(/\s+/g, ' ').trim() : 'all');
    syncFabricFilterUI(fabricParam);

    if (elements.detailImage) {
        delete elements.detailImage.dataset.fallbackAttempted;
        const detailPrimaryUrl = getProductImageUrl(product, 2000);
        elements.detailImage.src = detailPrimaryUrl;
        elements.detailImage.alt = `Kailash Kalamkari Srikalahasthi Pen Kalamkari ${product.title} Code ${product.code} (${product.fabric})`;
        elements.detailImage.title = `${product.title} - Click to Zoom Artwork Details`;
        setupImageFallback(elements.detailImage, product, 2000);
    }

    const detailImgBadge = document.getElementById('detail-image-discount-badge');
    if (detailImgBadge) {
        const discountPct = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
        if (discountPct > 0) {
            detailImgBadge.textContent = `${discountPct}% OFF`;
            detailImgBadge.style.display = 'block';
        } else {
            detailImgBadge.style.display = 'none';
        }
    }
    
    if (elements.detailTitle) elements.detailTitle.textContent = product.title;
    
    if (elements.detailDescription) {
        if (product.description) {
            elements.detailDescription.textContent = product.description;
            elements.detailDescription.style.display = 'block';
        } else {
            elements.detailDescription.style.display = 'none';
        }
    }
    
    if (elements.detailPrice) elements.detailPrice.textContent = new Intl.NumberFormat('en-IN').format(product.price);
    
    if (elements.detailMrp) {
        if (product.mrp && product.mrp > product.price) {
            elements.detailMrp.textContent = `INR ${new Intl.NumberFormat('en-IN').format(product.mrp)}`;
            elements.detailMrp.style.display = 'inline-flex';
        } else {
            elements.detailMrp.style.display = 'none';
        }
    }
    
    updateGoogleImageSchemaAndMeta(product);

    updateWishlistButtonState();
    renderFabricProducts(product);
    renderSimilarProducts(product);
    renderQuickCategoryPills(product);
    renderRecentlyViewed(product);

    showView('details');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;
    delete elements.overlayImage.dataset.fallbackAttempted;

    const overlayPrimaryUrl = getProductImageUrl(product, 2000);
    elements.overlayImage.src = overlayPrimaryUrl;
    elements.overlayImage.alt = `Kailash Kalamkari Srikalahasthi Pen Kalamkari ${product.title} Detail`;
    elements.overlayImage.style.transform = 'scale(1)';
    elements.overlayImage.style.transformOrigin = '50% 50%';
    elements.overlayImage.style.cursor = 'zoom-in';
    elements.overlay.classList.remove('hidden');
    isOverlayZoomed = false;
    document.body.style.overflow = 'hidden';

    setupImageFallback(elements.overlayImage, product, 2000);
}

function closeOverlay() {
    if (!elements.overlay) return;
    elements.overlay.classList.add('hidden');
    if (elements.overlayImage) {
        elements.overlayImage.style.transform = 'scale(1)';
        elements.overlayImage.style.transformOrigin = '50% 50%';
        elements.overlayImage.style.cursor = 'zoom-in';
    }
    isOverlayZoomed = false;
    document.body.style.overflow = '';
}

function toggleOverlayZoom() {
    if (!elements.overlayImage) return;
    isOverlayZoomed = !isOverlayZoomed;
    if (isOverlayZoomed) {
        elements.overlayImage.style.transform = 'scale(2.5)';
        elements.overlayImage.style.cursor = 'zoom-out';
    } else {
        elements.overlayImage.style.transform = 'scale(1)';
        elements.overlayImage.style.transformOrigin = '50% 50%';
        elements.overlayImage.style.cursor = 'zoom-in';
    }
}

function moveOverlayZoom(event) {
    if (!isOverlayZoomed || !elements.overlayImage) return;
    const rect = elements.overlayImage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    elements.overlayImage.style.transformOrigin = `${x}% ${y}%`;
}

function toggleWishlist(product = currentProduct) {
    if (!product) return;
    const index = wishlist.findIndex(item => item.code === product.code);
    let action = '';
    
    if (index === -1) {
        wishlist.push(product);
        action = 'Added';
        showToast(`Added to Gallery Vault!`);
    } else {
        wishlist.splice(index, 1);
        action = 'Removed';
        showToast(`Removed from Gallery Vault.`);
    }
    
    localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    updateWishlistButtonState();
    syncAllCardWishlistButtons();
    filterAndSearchProducts();

    if (views.wishlist && views.wishlist.classList.contains('active')) {
        renderWishlist();
    }

    logWishlistActivity(action, product);
}

function renderWishlist() {
    if (!elements.wishlistGrid) return;
    if (wishlist.length === 0) {
        elements.wishlistGrid.style.display = 'none';
        if (elements.emptyWishlistMsg) elements.emptyWishlistMsg.style.display = 'block';
    } else {
        elements.wishlistGrid.style.display = 'grid';
        if (elements.emptyWishlistMsg) elements.emptyWishlistMsg.style.display = 'none';
        renderProducts(wishlist, elements.wishlistGrid);
    }
}

function filterAndSearchProducts() {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filterTerm = activeFilterBtn ? activeFilterBtn.dataset.filter.toLowerCase().trim() : 'all';
    
    filteredProducts = getDepartmentProducts().filter(product => {
        const matchesSearch = !searchTerm ? true : (
            (product.code && product.code.toLowerCase().includes(searchTerm)) ||
            (product.fabric && product.fabric.toLowerCase().includes(searchTerm)) ||
            (product.category && product.category.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm))
        );
            
        let matchesFilter = true;
        if (filterTerm !== 'all') {
            const prodFabric = (product.fabric || '').toLowerCase().replace(/\s+/g, ' ').trim();
            matchesFilter = prodFabric.includes(filterTerm.replace(/\s+/g, ' ').trim());
        }
        
        return matchesSearch && matchesFilter;
    });
    
    renderProducts(filteredProducts, elements.productGrid);
}

function updateWishlistCount() {
    if (elements.wishlistCount) elements.wishlistCount.textContent = wishlist.length;
}

function bookVideoCall(product = currentProduct) {
    if (!product) return;
    const visitorId = localStorage.getItem('kalamkari_visitor_id') || 'New';
    const productUrl = `https://www.kailash-kalamkari.com/#kailash-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;
    const text = `Namaste Kailash Kalamkari Workshop,\n\nI would like to BOOK NOW to inspect this hand-painted artwork:\n\n• Code: ${product.code}\n• Title: ${product.title}\n• Fabric: ${product.fabric}\n• Special Offer Price: INR ${new Intl.NumberFormat('en-IN').format(product.price)} (MRP: INR ${new Intl.NumberFormat('en-IN').format(product.mrp)})\n• Web Link: ${productUrl}\n\n• Ref ID: ${visitorId}\n\nPlease let me know your available time slots.`;
    
    window.open(`https://wa.me/${CONTACT_PHONE_NUMBER}?text=${encodeURIComponent(text)}`, '_blank');
    showToast('Redirecting to WhatsApp to Book Now...');
}

function shareProduct(product = currentProduct) {
    if (!product) return;
    const shareUrl = `https://www.kailash-kalamkari.com/#kailash-kalamkari-srikalahasthi-pen-kalamkari-${product.code}`;
    const shareText = `Explore this authentic hand-painted Kailash Kalamkari Srikalahasthi Pen Kalamkari artwork: "${product.title}" (Code: ${product.code})`;
    
    pendingShareData = { title: product.title, text: shareText, url: shareUrl };

    if (navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        navigator.share({
            title: product.title,
            text: shareText,
            url: shareUrl
        }).catch(err => {
            if (err.name !== 'AbortError') {
                openShareModal(product.title, shareUrl, shareText);
            }
        });
    } else {
        openShareModal(product.title, shareUrl, shareText);
    }
}

function openShareModal(title, shareUrl, shareText) {
    const modal = document.getElementById('share-modal');
    const subtitle = document.getElementById('share-modal-subtitle');
    if (!modal) return;

    if (subtitle) subtitle.textContent = `Choose your preferred channel to share "${title}":`;
    modal.classList.remove('hidden');
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) modal.classList.add('hidden');
}

function setupEventListeners() {
    if (elements.backToCatalogueBtn) elements.backToCatalogueBtn.addEventListener('click', goBack);
    if (elements.backFromWishlistBtn) elements.backFromWishlistBtn.addEventListener('click', goBack);
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            sessionPushedStates++;
            window.location.hash = '#wishlist';
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    if (elements.shareBtn) elements.shareBtn.addEventListener('click', () => shareProduct(currentProduct));
    if (elements.videoCallBtn) elements.videoCallBtn.addEventListener('click', () => bookVideoCall(currentProduct));

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) floatingWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    
    const floatingShareBtn = document.getElementById('detail-floating-share-btn');
    if (floatingShareBtn) floatingShareBtn.addEventListener('click', () => shareProduct(currentProduct));

    const shareCloseBtn = document.getElementById('share-modal-close');
    const shareBackdrop = document.getElementById('share-modal-backdrop');
    if (shareCloseBtn) shareCloseBtn.addEventListener('click', closeShareModal);
    if (shareBackdrop) shareBackdrop.addEventListener('click', closeShareModal);

    const shareWhatsappBtn = document.getElementById('share-whatsapp-btn');
    if (shareWhatsappBtn) {
        shareWhatsappBtn.addEventListener('click', () => {
            if (!pendingShareData) return;
            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(pendingShareData.text + '\n' + pendingShareData.url)}`;
            window.open(waUrl, '_blank');
            closeShareModal();
        });
    }

    const shareCopyBtn = document.getElementById('share-copy-btn');
    if (shareCopyBtn) {
        shareCopyBtn.addEventListener('click', async () => {
            if (!pendingShareData) return;
            try {
                await navigator.clipboard.writeText(pendingShareData.url);
                showToast("Masterpiece link copied to clipboard!");
            } catch (err) {
                showToast("Failed to copy link.");
            }
            closeShareModal();
        });
    }

    const shareFacebookBtn = document.getElementById('share-facebook-btn');
    if (shareFacebookBtn) {
        shareFacebookBtn.addEventListener('click', () => {
            if (!pendingShareData) return;
            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pendingShareData.url)}`;
            window.open(fbUrl, '_blank');
            closeShareModal();
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', () => {
            if (views.details && views.details.classList.contains('active')) {
                showView('catalogue');
            }
            filterAndSearchProducts();
        });
    }

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            setDepartment(element.dataset.department, { pushState: true }); 
            showView('catalogue');
        });
    });
    
    if (elements.detailImage) elements.detailImage.addEventListener('click', () => openFullScreenImage(currentProduct));
    
    if (elements.overlay) {
        elements.overlay.addEventListener('click', event => {
            if (event.target === elements.overlay || event.target === elements.overlayClose) {
                closeOverlay();
            }
        });
    }
    if (elements.overlayImage) {
        elements.overlayImage.addEventListener('click', toggleOverlayZoom);
        elements.overlayImage.addEventListener('mousemove', moveOverlayZoom);
    }
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeOverlay();
            closeShareModal();
        }
    });

    window.addEventListener('popstate', handlePopState); 
}

function handlePopState() {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const departmentParam = normalizeDepartment(params.get('department')) || 'saree';
    const fabricParam = params.get('fabric') || 'all';

    currentDepartment = departmentParam;
    updateDepartmentUI();

    if (hash.includes('kalamkari') || hash.startsWith('#product/')) {
        const codeMatch = hash.match(/(?:[A-Za-z0-9_-]+-)?([A-Za-z0-9]+)$/);
        const productCode = codeMatch ? codeMatch[1] : hash.split('/').pop();

        if (allProducts.length === 0) {
            fetchProducts().then(() => {
                const product = allProducts.find(p => p.code === productCode);
                if (product) showProductDetails(product);
                else showView('catalogue'); 
            });
        } else {
            const product = allProducts.find(p => p.code === productCode);
            if (product) showProductDetails(product);
            else showView('catalogue');
        }
    } else if (hash === '#wishlist') {
        renderWishlist();
        showView('wishlist');
    } else {
        renderFilterButtons();
        syncFabricFilterUI(fabricParam);
        showView('catalogue'); 
    }
}

function updateWishlistButtonState() {
    if (!currentProduct || !elements.addToWishlistBtn) return;
    const isInWishlist = wishlist.some(item => item.code === currentProduct.code);
    
    if (isInWishlist) {
        elements.addToWishlistBtn.classList.add('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'In Gallery Vault';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '♥';
    } else {
        elements.addToWishlistBtn.classList.remove('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Add to Gallery Vault';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '❤️';
    }

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) {
        floatingWishlistBtn.classList.toggle('active', isInWishlist);
        floatingWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
    }
}

// === EVENT-BASED PRODUCT VIEW TIME TRACKING (BOT-FILTERED) ===
function recordProductTimeSpent() {
    if (isBotVisitor()) return;

    const durationSeconds = Math.round((Date.now() - productStartTime) / 1000);
    
    if (durationSeconds >= 2) {
        const visitorId = localStorage.getItem('kalamkari_visitor_id') || 'Unknown';
        const visitorType = sessionStorage.getItem('trafficLogged') === 'true' ? 'Returning' : 'New';
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const formattedTime = `${minutes}m ${seconds}s`;

        const payload = JSON.stringify({
            action: 'logTimeSpent',
            isBot: false,
            timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            visitorId: visitorId,
            visitorType: visitorType,
            activeProduct: currentTrackedProductTitle,
            productCode: currentTrackedProductCode,
            durationSeconds: durationSeconds,
            durationFormatted: formattedTime,
            pageUrl: window.location.href
        });

        try {
            fetch(ANALYTICS_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain' },
                body: payload
            });
        } catch (e) {}
    }
}

function switchProductTracking(newTitle, newCode) {
    recordProductTimeSpent();

    currentTrackedProductTitle = newTitle || 'Browsing Main Catalogue';
    currentTrackedProductCode = newCode || 'N/A';
    productStartTime = Date.now();
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') recordProductTimeSpent();
});
window.addEventListener('pagehide', recordProductTimeSpent);

document.addEventListener('DOMContentLoaded', init);