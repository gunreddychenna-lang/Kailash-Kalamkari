// === COMPLETE CLIENT-SIDE WEBPAGE LOGIC (script.js) ===

const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
const ANALYTICS_API_URL = 'https://script.google.com/macros/s/AKfycbwBEPn5gXYOLgmMWtsromAJJL08Uai_KxSsEcKce0ZPcb9ttqmFgn0keHbi-3uEv7nWPQ/exec'; 

const CONTACT_PHONE_NUMBER = '+919063374020';
const DISCOUNT_PERCENTAGE = 10; // Heritage Discount Percentage

const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

// State Management
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

// Helper to calculate discounted price
function getDiscountedPrice(price) {
    return Math.round((price || 0) * (1 - DISCOUNT_PERCENTAGE / 100));
}

// Extract Google Drive ID cleanly from product fields
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
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    }
    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    if (!rawUrl) return DEFAULT_IMAGE;
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return rawUrl;
    }
    if (rawUrl.includes('drive.google.com')) return 'https://' + rawUrl;
    return DEFAULT_IMAGE;
}

function sortProductsByPrice(products) {
    return [...products].sort((a, b) => getDiscountedPrice(b.price) - getDiscountedPrice(a.price));
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
        elements.searchInput.placeholder = `Search ${activeDepartment.label.toLowerCase()} by code, fabric or colour...`;
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

// Telemetry & Analytics
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

async function logVisitorTraffic() {
    if (sessionStorage.getItem('trafficLogged') === 'true') return;

    let visitorId = localStorage.getItem('kalamkari_visitor_id');
    let visitorType = 'Returning';

    if (!visitorId) {
        visitorId = 'visitor-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('kalamkari_visitor_id', visitorId);
        visitorType = 'New';
    }

    let locationData = { city: 'Unknown', region: 'Unknown', country: 'Unknown', ip: 'Unknown' };

    try {
        const geoResponse = await fetch('https://ipwho.is/');
        const geoJson = await geoResponse.json();
        if (geoJson && geoJson.success) {
            locationData.city = geoJson.city || 'Unknown';
            locationData.region = geoJson.region || 'Unknown';
            locationData.country = geoJson.country || 'Unknown';
            locationData.ip = geoJson.ip ? geoJson.ip.replace(/\d+$/, 'xxx') : 'Unknown';
        }
    } catch (geoError) {
        try {
            const fallbackResponse = await fetch('https://ipapi.co/json/');
            const fallbackJson = await fallbackResponse.json();
            if (fallbackJson && !fallbackJson.error) {
                locationData.city = fallbackJson.city || 'Unknown';
                locationData.region = fallbackJson.region || 'Unknown';
                locationData.country = fallbackJson.country_name || 'Unknown';
                locationData.ip = fallbackJson.ip ? fallbackJson.ip.replace(/\d+$/, 'xxx') : 'Unknown';
            }
        } catch (fallbackError) {
            console.error('Geolocation fallback failed:', fallbackError);
        }
    }

    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'logTraffic',
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                source: detectTrafficSource(),
                browser: detectBrowser(),
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
    } catch (error) {
        console.error('Failed to log traffic:', error);
    }
}

async function logWishlistActivity(action, product) {
    if (!product) return;
    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'logWishlist',
                timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
                wishlistAction: action,
                productCode: product.code,
                productTitle: product.title,
                price: getDiscountedPrice(product.price),
                fabric: product.fabric || '',
                wishlistCount: wishlist.length
            })
        });
    } catch (error) {
        console.error('Failed to log wishlist activity:', error);
    }
}

function hideIntroAnimation() {
    const loader = document.getElementById('premium-intro-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.style.display = 'none', 800);
    }
}

function setupFloatingWhatsapp() {
    const waBtn = document.getElementById('floating-whatsapp');
    if (waBtn) {
        const text = encodeURIComponent("Namaste! I am visiting your Kailash Kalamkari website and would love to know more about your hand-painted collection.");
        waBtn.href = `https://wa.me/${CONTACT_PHONE_NUMBER.replace(/[^0-9]/g, '')}?text=${text}`;
    }
}

function showToast(message) {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// DOM Elements Container
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
    
    // Details View
    detailImage: document.getElementById('detail-image'),
    detailImageSection: document.querySelector('.product-image-section'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    overlayClose: document.getElementById('overlay-close'),
    detailTitle: document.getElementById('detail-title'),
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailMrp: document.getElementById('detail-mrp'),
    
    // Interactive Tags/Pills
    detailWishlistPill: document.getElementById('detail-wishlist-pill'),
    detailWishlistPillIcon: document.getElementById('detail-wishlist-pill-icon'),
    detailWishlistPillText: document.getElementById('detail-wishlist-pill-text'),
    detailSharePill: document.getElementById('detail-share-pill'),
    
    // Actions
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    shareBtn: document.getElementById('share-btn'),
    bookNowBtn: document.getElementById('book-now-btn')
};

// Smooth Scroll Helper
function scrollToDepartment(smooth = true) {
    if (isInitialLoad) return;
    const target = document.querySelector('.sticky-nav-container') || document.querySelector('.department-bar');
    if (target) {
        window.scrollTo({ top: target.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
    }
}

function goBack() {
    window.history.back();
}

// Main App Initialization
async function init() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    updateWishlistCount();
    setupEventListeners();
    setupFloatingWhatsapp();
    logVisitorTraffic();

    await fetchProducts();

    const params = new URLSearchParams(window.location.search);
    const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
    const initialFabric = params.get('fabric') || 'all';

    navigateToState(initialDept, initialFabric, window.location.hash, false);
    handlePopState(); 
    isInitialLoad = false;
    hideIntroAnimation();
}

// Fetch Master Catalogue
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
                price: parsePrice(item.price || item.Price || ''),
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
        console.error('Error fetching data:', error);
        if (elements.spinner) {
            elements.spinner.textContent = 'Failed to load collection. Please try again later.';
        }
    }
}

// Render Products Grid with MRP & Discount
function renderProducts(products, container, isSimilar = false) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-muted);">No products found matching your criteria.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.code = product.code;
        if (product.qty <= 0) card.classList.add('sold-out');

        card.onclick = () => {
            if (isSimilar) {
                const url = new URL(window.location.href);
                url.hash = `#product/${product.code}`;
                window.history.replaceState({ isDepartmentSelection: true }, '', url);
                handlePopState();
            } else {
                window.location.hash = `#product/${product.code}`;
            }
        };

        const mrp = product.price;
        const finalPrice = getDiscountedPrice(mrp);
        const formattedMrp = new Intl.NumberFormat('en-IN').format(mrp);
        const formattedFinalPrice = new Intl.NumberFormat('en-IN').format(finalPrice);

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = product.title || product.fabric; 
        img.loading = 'lazy';
        
        const fileId = getGoogleDriveId(product);
        const primaryUrl = getProductImageUrl(product, 800);
        img.src = primaryUrl;

        if (fileId) {
            img.onerror = () => {
                if (!img.dataset.fallbackAttempted) {
                    img.dataset.fallbackAttempted = "true";
                    img.src = primaryUrl.includes('drive.google.com/thumbnail') 
                        ? `https://lh3.googleusercontent.com/d/${fileId}=w800`
                        : `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
                } else {
                    img.src = DEFAULT_IMAGE; 
                }
            };
        }

        imageWrapper.appendChild(img);

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
        cardWishlistBtn.onclick = (e) => {
            e.stopPropagation();
            toggleWishlist(product);
        };

        const cardShareBtn = document.createElement('button');
        cardShareBtn.className = 'card-action-btn card-share-btn';
        cardShareBtn.innerHTML = '🔗';
        cardShareBtn.onclick = (e) => {
            e.stopPropagation();
            shareProduct(product);
        };

        quickActions.appendChild(cardWishlistBtn);
        quickActions.appendChild(cardShareBtn);
        imageWrapper.appendChild(quickActions);

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? `${String(product.description).trim().slice(0, 110)}${product.description.length > 110 ? '...' : ''}` : '';
        info.innerHTML = `
            <h3 class="product-title">${product.title}</h3>
            ${shortDescription ? `<p class="product-card-description">${shortDescription}</p>` : ''}
            <div class="product-price-row">
                <span class="mrp-price">Rs. ${formattedMrp}</span>
                <span class="product-price">Rs. ${formattedFinalPrice}</span>
                <span class="discount-badge">${DISCOUNT_PERCENTAGE}% OFF</span>
            </div>
            <button class="card-book-now-btn" aria-label="Book Video Call">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
                <span>Book Video Call</span>
            </button>
        `;

        const cardBookBtn = info.querySelector('.card-book-now-btn');
        if (cardBookBtn) {
            cardBookBtn.onclick = (e) => {
                e.stopPropagation();
                handleBookNowForProduct(product);
            };
        }

        card.appendChild(imageWrapper);
        card.appendChild(info);
        container.appendChild(card);
    });
}

// === RECENTLY VIEWED LOGIC ===
function addToRecentlyViewed(product) {
    if (!product || !product.code) return;
    recentlyViewed = recentlyViewed.filter(item => item.code !== product.code);
    recentlyViewed.unshift(product);
    if (recentlyViewed.length > 8) recentlyViewed = recentlyViewed.slice(0, 8);
    try {
        localStorage.setItem('kalamkariRecentlyViewed', JSON.stringify(recentlyViewed));
    } catch (e) {
        console.error("Error saving recently viewed to local storage", e);
    }
}

function renderRecentlyViewedProducts(currentProduct) {
    const section = document.getElementById('recently-viewed-section');
    const container = document.getElementById('recently-viewed-grid');
    if (!section || !container) return;

    const itemsToDisplay = recentlyViewed.filter(p => p.code !== currentProduct.code);
    if (itemsToDisplay.length > 0) {
        section.style.display = 'block';
        renderProducts(itemsToDisplay.slice(0, 8), container, true);
    } else {
        section.style.display = 'none';
    }
}

// === GRID 1: MORE IN SAME FABRIC ===
function renderSameFabricProducts(currentProduct) {
    const section = document.getElementById('same-fabric-section');
    const container = document.getElementById('same-fabric-grid');
    const titleEl = document.getElementById('same-fabric-title');
    if (!section || !container) return;

    const sameFabricProducts = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.fabric.toLowerCase().trim() === currentProduct.fabric.toLowerCase().trim() && 
        p.code !== currentProduct.code
    );

    if (sameFabricProducts.length > 0) {
        if (titleEl) titleEl.textContent = `More in ${currentProduct.fabric}`;
        section.style.display = 'block';
        renderProducts(sameFabricProducts.slice(0, 8), container, true);
    } else {
        section.style.display = 'none';
    }
}

// === GRID 2: SIMILAR PRICE RANGE PRODUCTS (EXCLUDES SAME FABRIC) ===
function renderSimilarProducts(currentProduct) {
    const section = document.getElementById('similar-products-section');
    const container = document.getElementById('similar-products-grid');
    const titleEl = document.getElementById('similar-products-title');
    if (!section || !container) return;

    const currentPrice = currentProduct.price;
    const currentFabric = (currentProduct.fabric || '').toLowerCase().trim();

    let priceMatches = allProducts.filter(p => 
        p.code !== currentProduct.code &&
        p.fabric.toLowerCase().trim() !== currentFabric && 
        Math.abs(p.price - currentPrice) / currentPrice <= 0.25
    );

    priceMatches.sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));

    if (priceMatches.length === 0) {
        priceMatches = allProducts.filter(p => 
            p.code !== currentProduct.code &&
            p.fabric.toLowerCase().trim() !== currentFabric
        ).sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice));
    }

    if (priceMatches.length > 0) {
        if (titleEl) titleEl.textContent = 'Similar Price Range Masterpieces';
        section.style.display = 'block';
        renderProducts(priceMatches.slice(0, 8), container, true);
    } else {
        section.style.display = 'none';
    }
}

// === GRID 3: EXPLORE MORE COLLECTIONS (SEPARATE PICTURE GRIDS PER FABRIC) ===
function renderQuickCategoryPills(currentProd = currentProduct) {
    const container = document.getElementById('quick-category-pills');
    if (!container) return;
    container.innerHTML = '';

    const targetDept = currentProd ? currentProd.departmentKey : currentDepartment;
    const deptProducts = allProducts.filter(p => p.departmentKey === targetDept);

    const fabricMap = new Map();
    deptProducts.forEach(product => {
        const fabric = (product.fabric || '').trim();
        if (!fabric) return;
        const key = fabric.toLowerCase().replace(/\s+/g, ' ').trim();

        if (!fabricMap.has(key)) {
            const deptConfig = DEPARTMENTS.find(d => d.key === targetDept) || { singular: 'Product', label: 'Products' };
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

    if (fabricMap.size === 0) return;

    const gridsWrapper = document.createElement('div');
    gridsWrapper.className = 'fabric-grids-wrapper';

    fabricMap.forEach((item) => {
        const block = document.createElement('div');
        block.className = 'fabric-collection-block';
        block.dataset.fabric = item.key;

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
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
    } else {
        document.body.classList.remove('details-mode');
        if (viewName === 'catalogue') scrollToDepartment(true);
        else window.scrollTo(0, 0);
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
        fabricMap.get(key).prices.push(getDiscountedPrice(product.price) || 0);
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
            scrollToDepartment(true);
        });
    });
}

function syncFabricFilterUI(fabricParam) {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    let matched = false;
    
    buttons.forEach(btn => {
        if (btn.dataset.filter === fabricParam) {
            btn.classList.add('active');
            matched = true;
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (!matched && buttons.length > 0) {
        buttons[0].classList.add('active');
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

// Show Full Details
// Function to tell Google Search that this photo belongs to your website URL
function injectProductImageSchema(product) {
    let schemaScript = document.getElementById('product-schema-json');
    if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = 'product-schema-json';
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
    }

    const imageUrl = getProductImageUrl(product, 2000);
    const productUrl = `${window.location.origin}${window.location.pathname}#product/${product.code}`;

    const schemaData = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.title,
        "image": [imageUrl],
        "description": product.description || product.title,
        "sku": product.code,
        "brand": {
            "@type": "Brand",
            "name": "Kailash Kalamkari"
        },
        "offers": {
            "@type": "Offer",
            "url": productUrl,
            "priceCurrency": "INR",
            "price": getDiscountedPrice(product.price),
            "availability": product.qty > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
        }
    };

    schemaScript.textContent = JSON.stringify(schemaData);
}

// Lightbox Overlay Handlers
function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;
    delete elements.overlayImage.dataset.fallbackAttempted;

    const overlayFileId = getGoogleDriveId(product);
    const overlayPrimaryUrl = getProductImageUrl(product, 2000);

    elements.overlayImage.src = overlayPrimaryUrl;
    elements.overlayImage.style.transform = 'scale(1)';
    elements.overlay.classList.remove('hidden');
    isOverlayZoomed = false;
    document.body.style.overflow = 'hidden';

    if (overlayFileId) {
        elements.overlayImage.onerror = () => {
            if (!elements.overlayImage.dataset.fallbackAttempted) {
                elements.overlayImage.dataset.fallbackAttempted = "true";
                elements.overlayImage.src = `https://lh3.googleusercontent.com/d/${overlayFileId}=w2000`;
            } else {
                elements.overlayImage.src = DEFAULT_IMAGE;
            }
        };
    }
}

function closeOverlay() {
    if (!elements.overlay) return;
    elements.overlay.classList.add('hidden');
    isOverlayZoomed = false;
    document.body.style.overflow = '';
}

function toggleOverlayZoom() {
    if (!elements.overlayImage) return;
    isOverlayZoomed = !isOverlayZoomed;
    elements.overlayImage.style.transform = isOverlayZoomed ? 'scale(2.5)' : 'scale(1)';
    elements.overlayImage.style.cursor = isOverlayZoomed ? 'zoom-out' : 'zoom-in';
}

function moveOverlayZoom(event) {
    if (!isOverlayZoomed || !elements.overlayImage) return;
    const rect = elements.overlayImage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    elements.overlayImage.style.transformOrigin = `${x}% ${y}%`;
}

// Wishlist Logic
function toggleWishlist(product = currentProduct) {
    if (!product) return;
    const index = wishlist.findIndex(item => item.code === product.code);
    let action = '';
    
    if (index === -1) {
        wishlist.push(product);
        action = 'Added';
    } else {
        wishlist.splice(index, 1);
        action = 'Removed';
    }
    
    localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    updateWishlistCount();
    updateWishlistButtonState();
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

// Sharing & WhatsApp Video Call Booking Handlers
async function shareProduct(product = currentProduct) {
    if (!product) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#product/${product.code}`;
    const shareData = {
        title: product.title,
        text: `Explore this hand-painted Kalamkari masterpiece: "${product.title}" (Code: ${product.code})`,
        url: shareUrl
    };
    
    try {
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(shareUrl);
            showToast("Masterpiece link copied to clipboard!");
        }
    } catch (error) {
        console.error("Error sharing:", error);
    }
}

function handleBookNowForProduct(product) {
    const prod = product || currentProduct;
    if (!prod) return;
    
    const mrp = prod.price;
    const finalPrice = getDiscountedPrice(mrp);
    
    const productUrl = `${window.location.origin}${window.location.pathname}#product/${prod.code}`;
    const visitorId = localStorage.getItem('kalamkari_visitor_id') || 'New';
    
    const message = `Namaste Kailash Kalamkari Workshop,\n\nI would like to book a video call to view this hand-painted masterpiece:\n\n` +
                    `*Product:* ${prod.title}\n` +
                    `*Code:* ${prod.code}\n` +
                    `*Price:* Rs. ${new Intl.NumberFormat('en-IN').format(finalPrice)} (${DISCOUNT_PERCENTAGE}% OFF, MRP: Rs. ${new Intl.NumberFormat('en-IN').format(mrp)})\n` +
                    `*Fabric:* ${prod.fabric}\n` +
                    `*Link:* ${productUrl}\n\n` +
                    `*Ref:* ${visitorId}\n\n` +
                    `Please let me know your availability for a video call. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${CONTACT_PHONE_NUMBER.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
}

// Event Listeners Registration
function setupEventListeners() {
    if (elements.backToCatalogueBtn) elements.backToCatalogueBtn.addEventListener('click', goBack);
    if (elements.backFromWishlistBtn) elements.backFromWishlistBtn.addEventListener('click', goBack);
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            window.location.hash = '#wishlist';
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    if (elements.shareBtn) elements.shareBtn.addEventListener('click', () => shareProduct(currentProduct));
    if (elements.bookNowBtn) elements.bookNowBtn.addEventListener('click', () => handleBookNowForProduct(currentProduct));

    // Detail Interactive Pill Buttons
    if (elements.detailWishlistPill) {
        elements.detailWishlistPill.addEventListener('click', () => toggleWishlist(currentProduct));
    }
    if (elements.detailSharePill) {
        elements.detailSharePill.addEventListener('click', () => shareProduct(currentProduct));
    }

    // Floating actions
    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) floatingWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    
    const floatingShareBtn = document.getElementById('detail-floating-share-btn');
    if (floatingShareBtn) floatingShareBtn.addEventListener('click', () => shareProduct(currentProduct));

    if (elements.searchInput) elements.searchInput.addEventListener('input', filterAndSearchProducts);

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
        if (event.key === 'Escape') closeOverlay();
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

    if (hash.startsWith('#product/')) {
        const productCode = hash.split('/')[1];
        const product = allProducts.find(p => p.code === productCode);
        if (product) showProductDetails(product);
        else showView('catalogue');
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
    if (!currentProduct) return;
    const isInWishlist = wishlist.some(item => item.code === currentProduct.code);
    
    if (elements.addToWishlistBtn) {
        if (isInWishlist) {
            elements.addToWishlistBtn.classList.add('active');
            if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'In Gallery';
            if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '♥';
        } else {
            elements.addToWishlistBtn.classList.remove('active');
            if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Add to Gallery';
            if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '❤️';
        }
    }

    if (elements.detailWishlistPill) {
        if (isInWishlist) {
            elements.detailWishlistPill.classList.add('active');
            if (elements.detailWishlistPillText) elements.detailWishlistPillText.textContent = 'Wishlisted';
            if (elements.detailWishlistPillIcon) elements.detailWishlistPillIcon.textContent = '♥';
        } else {
            elements.detailWishlistPill.classList.remove('active');
            if (elements.detailWishlistPillText) elements.detailWishlistPillText.textContent = 'Wishlist';
            if (elements.detailWishlistPillIcon) elements.detailWishlistPillIcon.textContent = '♡';
        }
    }

    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) {
        floatingWishlistBtn.classList.toggle('active', isInWishlist);
        floatingWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
    }
}

document.addEventListener('DOMContentLoaded', init);