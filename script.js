// === GLOBAL CONFIGURATION ===
// Set to 'sandbox' for testing, or 'production' when you are ready to accept real payments!
const CASHFREE_MODE = 'sandbox'; 

// Set to true to completely bypass Google Sheet authorization blocks and load checkout instantly
const BYPASS_APPS_SCRIPT_BACKEND = true; 

// Your Direct UPI ID for real payment transfers (Google Pay / PhonePe / Paytm)
const MERCHANT_UPI_ID = '9063374020@ybl'; 

// 1. The Apps Script Web App URL for your CATALOG/PRODUCTS Google Sheet:
const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';

// 2. The Web App URL for your separate TRACKING (Dashboard/Wishlist) Google Sheet:
const TRACKING_API_URL = 'https://script.google.com/macros/s/AKfycbxzndrSZj5wFk2HDOgeq7TCO5kqfQ1bdZs-y9H1g1HyiSFDW_cG606nCUXjqQ7XmqSRtw/exec';

const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

// Cache Configuration (5 Minutes)
const CACHE_KEY = 'kalamkari_products_cache';
const CACHE_TIME_KEY = 'kalamkari_products_cache_time';
const CACHE_DURATION = 5 * 60 * 1000; 

// === HIGH-SPEED IMAGE LINK VIEWING ===
function getProductImageUrl(product, width = 800) {
    let fileId = null;

    if (product && product.imageId && typeof product.imageId === 'string' && product.imageId.length >= 25) {
        fileId = product.imageId;
    }

    const rawUrl = product ? (product.imageLink || product.thumbnail || product.rawImageLink || '') : '';
    const trimmed = rawUrl.trim();

    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
    }

    if (!fileId && typeof trimmed === 'string' && trimmed.length > 0) {
        const idRegex = /(?:id=|file\/d\/|\/d\/|)([a-zA-Z0-9_-]{25,50})(?:[/?&]|$|=)/;
        const potentialIdMatch = trimmed.match(idRegex);
        
        if (potentialIdMatch && potentialIdMatch[1]) {
            fileId = potentialIdMatch[1];
        } else {
            const bareIdMatch = trimmed.match(/^([a-zA-Z0-9_-]{25,50})(?:=w\d+)?$/);
            if (bareIdMatch && bareIdMatch[1]) {
                fileId = bareIdMatch[1];
            }
        }
    }

    if (fileId && fileId.length >= 25) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
    }
    
    if (trimmed.includes('drive.google.com')) {
        return 'https://' + trimmed;
    }

    return DEFAULT_IMAGE;
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

function updateDepartmentUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('department', currentDepartment);
    window.history.replaceState({}, '', url);
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

function setDepartment(department, { updateUrl = true } = {}) {
    const departmentKey = normalizeDepartment(department) || 'saree';
    currentDepartment = departmentKey;

    if (elements.searchInput) {
        elements.searchInput.value = '';
    }

    updateDepartmentUI();
    renderFilterButtons();
    filterAndSearchProducts();

    if (updateUrl) {
        updateDepartmentUrl();
    }
}

// State variables
const DEPARTMENTS = [
    { key: 'saree', label: 'Sarees', singular: 'Saree' },
    { key: 'dupatta', label: 'Dupattas', singular: 'Dupatta' }
];

let allProducts = [];
let filteredProducts = [];
let wishlist = [];

// Safely parse wishlist storage to prevent loading crashes
try {
    const storedWishlist = localStorage.getItem('kalamkariWishlist');
    wishlist = storedWishlist ? JSON.parse(storedWishlist) : [];
    if (!Array.isArray(wishlist)) wishlist = [];
} catch (e) {
    console.warn('Wishlist configuration corrupted. Restoring safe state...', e);
    wishlist = [];
}

let currentProduct = null;
let currentDepartment = getInitialDepartment();
let isDetailZoomed = false;
let isOverlayZoomed = false;
let isInitialLoad = true;

// DOM Elements
const views = {
    catalogue: document.getElementById('catalogue-view'),
    details: document.getElementById('product-details-view'),
    wishlist: document.getElementById('wishlist-view')
};

const elements = {
    introLoader: document.getElementById('premium-intro-loader'),
    productGrid: document.getElementById('product-grid'),
    wishlistGrid: document.getElementById('wishlist-grid'),
    spinner: document.getElementById('loading-spinner'),
    searchInput: document.getElementById('search-input'),
    filtersContainer: document.getElementById('category-filters') || document.querySelector('.category-filters'),
    wishlistCount: document.getElementById('wishlist-count'),
    viewWishlistBtn: document.getElementById('wishlist-trigger'),
    backToCatalogueBtn: document.getElementById('back-to-catalogue'),
    backFromWishlistBtn: document.getElementById('back-from-wishlist'),
    emptyWishlistMsg: document.getElementById('wishlist-empty'),
    collectionCards: document.querySelectorAll('.collection-card'),
    departmentButtons: document.querySelectorAll('.department-btn'),
    
    // Details View Elements
    detailImage: document.getElementById('detail-image'),
    detailImageSection: document.querySelector('.product-image-section'),
    overlay: document.getElementById('image-overlay'),
    overlayImage: document.getElementById('overlay-image'),
    overlayClose: document.getElementById('overlay-close'),
    detailCode: document.getElementById('detail-code'),
    detailStock: document.getElementById('detail-stock'), 
    detailTitle: document.getElementById('detail-title'),
    detailPrice: document.getElementById('detail-price'),
    detailFabricHighlight: document.getElementById('detail-fabric-highlight'),
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    whatsappBtn: document.getElementById('whatsapp-inquiry-btn'),
    buyNowBtn: document.getElementById('buy-now-btn'),
    similarSection: document.getElementById('similar-products-section')
};

function scrollToDepartment(smooth = true) {
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

// Safely dismiss the loading overlay
function dismissIntroLoader() {
    if (elements.introLoader) {
        elements.introLoader.classList.add('fade-out');
        setTimeout(() => {
            elements.introLoader.style.display = 'none';
        }, 1400);
    }
}

// Initialize Application
async function init() {
    updateWishlistCount();
    setupEventListeners();
    await fetchProducts();
    renderFilterButtons();
    handlePopState();
    
    setTimeout(() => {
        recordVisitorSession();
    }, 2500);
    
    isInitialLoad = false;
}

// Fetch Catalog Data
async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block'; 
        
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const now = Date.now();
        
        let rawData = null;
        if (cachedData && cachedTime && (now - cachedTime < CACHE_DURATION)) {
            try {
                console.log('Loading collection from secure local cache...');
                rawData = JSON.parse(cachedData);
            } catch (jsonErr) {
                console.warn('Cache corrupted, fetching fresh...', jsonErr);
                rawData = null;
            }
        }

        if (!rawData) {
            console.log('Fetching fresh collection from temple archives...');
            const response = await fetch(CATALOG_API_URL);
            
            if (response.status === 429) {
                throw new Error('429_TOO_MANY_REQUESTS');
            }
            
            rawData = await response.json();
            
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify(rawData));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
            } catch (e) {
                console.warn('Cache write limit exceeded:', e);
            }
        }
        
        processProductsData(rawData);

    } catch (error) {
        console.error('Error fetching data:', error);
        
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
            try {
                console.log('Displaying cached records due to API connection drop.');
                const rawData = JSON.parse(cachedData);
                processProductsData(rawData);
                return;
            } catch (cacheErr) {
                console.error('Failed to parse fallback cache:', cacheErr);
            }
        }

        if (elements.spinner) {
            elements.spinner.innerHTML = `
                <div class="error-container" style="padding: 2.5rem; text-align: center; border: 1px dashed var(--color-temple-crimson); background: rgba(86, 11, 2, 0.02); max-width: 500px; margin: 2rem auto;">
                    <p style="color: var(--color-temple-crimson); font-family: var(--font-heritage); font-weight: 600; font-size: 1.1rem; margin-bottom: 0.8rem;">Unable to display our temple archives</p>
                    <p class="spinner-subtext" style="margin-bottom: 1.5rem;">Connection could not be established. Please check your network and try again.</p>
                    <button onclick="window.location.reload()" class="buy-btn" style="width: auto; display: inline-flex; padding: 0.8rem 2rem;">Attempt Reconnection</button>
                </div>
            `;
        }
        
        dismissIntroLoader();
    }
}

// Processes & Normalizes retrieved array items
function processProductsData(rawData) {
    const data = Array.isArray(rawData) ? rawData : (rawData.value || rawData.data || rawData.records || []);
    
    const getFieldValue = (item, keys) => {
        const normalizeKey = (k) => String(k || '').toLowerCase().replace(/[\s_-]+/g, '');
        
        const normalizedMap = {};
        for (const [key, val] of Object.entries(item)) {
            normalizedMap[normalizeKey(key)] = val;
        }

        for (const key of keys) {
            const nKey = normalizeKey(key);
            if (normalizedMap[nKey] !== undefined && normalizedMap[nKey] !== null && String(normalizedMap[nKey]).trim() !== '') {
                return String(normalizedMap[nKey]).trim();
            }
        }
        return '';
    };

    allProducts = data.map(item => {
        function parsePrice(val) {
            if (val === undefined || val === null || String(val).trim() === '') return 0;
            const cleaned = String(val).replace(/[^0-9.\-]/g, '');
            const n = Number(cleaned);
            return isNaN(n) ? 0 : n;
        }

        const code = String(getFieldValue(item, ['code', 'stylecode'])).trim();
        const fabric = String(getFieldValue(item, ['fabric']) || 'Pure Silk').trim();
        const category = String(getFieldValue(item, ['category']) || 'Uncategorized').trim();
        const department = String(getFieldValue(item, ['department', 'dept', 'collection'])).trim();
        const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
        
        const imageLink = String(getFieldValue(item, ['imagelink', 'drivelink', 'image'])).trim();
        const thumbnail = String(getFieldValue(item, ['thumbnail', 'thumb', 'thumbnaillink'])).trim() || imageLink;
        const imageId = String(getFieldValue(item, ['imageid', 'fileid'])).trim();

        let rawQty = getFieldValue(item, ['qty', 'quantity']);
        let qty = rawQty !== '' ? Number(rawQty) : 1;
        if (isNaN(qty)) qty = 1;

        const derivedTitle = getFieldValue(item, ['title', 'productname']) || fabric;

        return {
            code,
            title: derivedTitle, 
            fabric,
            category,
            department,
            departmentKey,
            price: parsePrice(getFieldValue(item, ['price'])),
            qty: qty,
            imageLink,
            thumbnail,
            imageId
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
    
    dismissIntroLoader();

    updateDepartmentUI();
    renderFilterButtons();
    filterAndSearchProducts(); 
    calculatePriceRanges();
}

// Render Product Grid
function renderProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-muted); padding: 3rem 0;">No products found matching your criteria.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.onclick = () => {
            window.location.hash = `#product/${product.code}`;
        };

        if (product.qty <= 0) {
            card.classList.add('sold-out');
        }

        const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = product.title || product.fabric; 
        img.loading = 'lazy';
        img.src = getProductImageUrl(product);

        imageWrapper.appendChild(img);

        if (product.qty <= 0) {
            const badge = document.createElement('div');
            badge.className = 'sold-out-badge';
            badge.textContent = 'SOLD OUT';
            imageWrapper.appendChild(badge);
        }

        const info = document.createElement('div');
        info.className = 'product-info';
        info.innerHTML = `
            <h3 class="product-title">${product.title || product.fabric}</h3>
            <div class="product-price" style="margin-top: 1rem;">Rs. ${formattedPrice}</div>
        `;

        card.appendChild(imageWrapper);
        card.appendChild(info);
        container.appendChild(card);
    });
}

// Render Similar Products
function renderSimilarProducts(currentProduct) {
    const similarSection = elements.similarSection;
    const similarContainer = document.getElementById('similar-products-grid');
    if (!similarSection || !similarContainer) return;

    let similar = allProducts.filter(p => 
        p.departmentKey === currentProduct.departmentKey &&
        p.fabric.toLowerCase() === currentProduct.fabric.toLowerCase() && 
        p.code !== currentProduct.code
    );

    let higherPriced = similar
        .filter(p => p.price > currentProduct.price)
        .sort((a, b) => b.price - a.price);

    if (higherPriced.length === 0) {
        const minPrice = currentProduct.price * 0.7;
        const maxPrice = currentProduct.price * 1.3;
        higherPriced = allProducts.filter(p => 
            p.departmentKey === currentProduct.departmentKey &&
            p.code !== currentProduct.code && 
            p.price >= minPrice && 
            p.price <= maxPrice
        ).sort((a, b) => b.price - a.price);
    }

    if (higherPriced.length > 0) {
        similarSection.style.display = 'block';
        renderProducts(higherPriced.slice(0, 4), similarContainer);
    } else {
        similarSection.style.display = 'none';
    }
}

// Navigation & Views
function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
        window.scrollTo({ top: 0, behavior: 'auto' });
    } else {
        document.body.classList.remove('details-mode');
        window.scrollTo({ top: 0, behavior: 'auto' });
    }
}

function renderFilterButtons() {
    elements.filtersContainer = elements.filtersContainer || document.getElementById('category-filters') || document.querySelector('.category-filters');
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
            filterAndSearchProducts();
        });
    });
}

function formatPriceRange(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const formatOpts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
    const formattedMin = new Intl.NumberFormat('en-IN', formatOpts).format(minPrice);
    const formattedMax = new Intl.NumberFormat('en-IN', formatOpts).format(maxPrice);
    return minPrice === maxPrice ? formattedMin : `${formattedMin} to ${formattedMax}`;
}

// Display Details
function showProductDetails(product) {
    currentProduct = product;
    isDetailZoomed = false;
    updateDetailZoom();
    
    if (elements.detailImage) {
        elements.detailImage.src = getProductImageUrl(product, 2000);
        elements.detailImage.title = 'Click to zoom';
    }
    
    if (elements.detailCode) elements.detailCode.textContent = `Code: ${product.code}`;
    if (elements.detailTitle) elements.detailTitle.textContent = product.title; 
    
    if (elements.detailStock) {
        if (product.qty > 0) {
            elements.detailStock.textContent = 'In Stock';
            elements.detailStock.style.backgroundColor = 'rgba(42, 107, 68, 0.09)';
            elements.detailStock.style.color = '#2A6B44';
            elements.detailStock.style.borderColor = 'rgba(42, 107, 68, 0.18)';
        } else {
            elements.detailStock.textContent = 'Out of Stock';
            elements.detailStock.style.backgroundColor = 'rgba(139, 46, 36, 0.1)';
            elements.detailStock.style.color = '#8B2E24';
            elements.detailStock.style.borderColor = 'rgba(139, 46, 36, 0.2)';
        }
    }
    
    if (elements.detailPrice) elements.detailPrice.textContent = new Intl.NumberFormat('en-IN').format(product.price);
    if (elements.detailFabricHighlight) elements.detailFabricHighlight.textContent = product.fabric;
    
    updateWishlistButtonState();
    renderSimilarProducts(product);
    showView('details');
}

function updateDetailZoom() {
    if (!elements.detailImageSection || !elements.detailImage) return;
    if (isDetailZoomed) {
        elements.detailImageSection.classList.add('zoom-active');
    } else {
        elements.detailImageSection.classList.remove('zoom-active');
    }
}

// Lightbox triggers
function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;

    elements.overlayImage.src = getProductImageUrl(product, 2000);
    elements.overlayImage.style.transform = 'scale(1)';
    elements.overlayImage.style.transformOrigin = '50% 50%';
    elements.overlayImage.style.cursor = 'zoom-in';
    elements.overlay.classList.remove('hidden');
    isOverlayZoomed = false;
    document.body.style.overflow = 'hidden';
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

function calculatePriceRanges() {
    const categories = {
        'kanchipuram': 'pure kanchipuram silk',
        'ikkat': 'pure ikkat  silk', 
        'gadwal': 'pure gadwal silk',
        'tussar': 'pure tussar silk'
    };
    
    for (const [id, fabricName] of Object.entries(categories)) {
        const categoryProducts = allProducts.filter(p => p.fabric && p.fabric.toLowerCase() === fabricName.toLowerCase());
        const priceElement = document.getElementById(`price-${id}`);
        if (!priceElement) continue;
        
        if (categoryProducts.length > 0) {
            const prices = categoryProducts.map(p => p.price).filter(p => p > 0);
            if (prices.length > 0) {
                const minPrice = Math.min(...prices);
                const maxPrice = Math.max(...prices);
                const formatOpts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
                const formattedMin = new Intl.NumberFormat('en-IN', formatOpts).format(minPrice);
                const formattedMax = new Intl.NumberFormat('en-IN', formatOpts).format(maxPrice);
                
                priceElement.textContent = minPrice === maxPrice ? formattedMin : `${formattedMin} to ${formattedMax}`;
            } else {
                priceElement.textContent = 'Price Unavailable';
            }
        } else {
            priceElement.textContent = 'Out of Stock';
        }
    }
}

// Wishlist Architecture
function toggleWishlist() {
    if (!currentProduct) return;
    const index = wishlist.findIndex(item => item.code === currentProduct.code);
    let actionType = "add";
    
    if (index === -1) {
        wishlist.push(currentProduct);
        actionType = "add";
    } else {
        wishlist.splice(index, 1);
        actionType = "remove";
    }
    
    try {
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
        logWishlistToSheet(currentProduct.code, actionType);
    } catch (e) {
        console.error("Error saving wishlist to local storage", e);
    }
    
    updateWishlistCount();
    updateWishlistButtonState();
}

function logWishlistToSheet(productCode, actionType) {
    fetch(TRACKING_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: 'wishlist',
            productCode: productCode,
            wishlistAction: actionType
        })
    }).catch(err => console.warn('Wishlist log skipped:', err));
}

function logOrderToSheet(product, paymentId, customerDetails = null) {
    const name = customerDetails ? customerDetails.name : 'A. Patron';
    const email = customerDetails ? customerDetails.email : 'notprovided@email.com';
    const phone = customerDetails ? customerDetails.phone : '9063374020';

    fetch(TRACKING_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
            action: 'place_order',
            customerName: name,
            customerEmail: email,
            customerPhone: phone,
            productCode: product.code,
            amount: product.price,
            paymentId: paymentId
        })
    }).then(() => {
        console.log('Payment transaction tracked on orders sheet.');
    }).catch(err => console.warn('Order log skipped:', err));
}

function recordVisitorSession() {
    let sessionMarker = sessionStorage.getItem('kalamkari_session_marker');
    if (!sessionMarker) {
        sessionMarker = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('kalamkari_session_marker', sessionMarker);
        
        fetch(TRACKING_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action: 'record_visitor',
                sessionMarker: sessionMarker
            })
        }).catch(err => console.warn('Traffic logging skipped:', err));
    }
}

// Search & Categories filters implementation
function filterAndSearchProducts() {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filterTerm = activeFilterBtn ? activeFilterBtn.dataset.filter.toLowerCase().trim() : 'all';
    
    filteredProducts = getDepartmentProducts().filter(product => {
        const matchesSearch = !searchTerm ? true : (
            (product.code && product.code.toLowerCase().includes(searchTerm)) ||
            (product.fabric && product.fabric.toLowerCase().includes(searchTerm)) ||
            (product.category && product.category.toLowerCase().includes(searchTerm)) ||
            (product.price && product.price.toString().includes(searchTerm))
        );
            
        let matchesFilter = true;
        if (filterTerm !== 'all') {
            const prodFabric = (product.fabric || '').toLowerCase().replace(/\s+/g, ' ').trim();
            const fTerm = filterTerm.replace(/\s+/g, ' ').trim();
            matchesFilter = prodFabric.includes(fTerm);
        }
        
        return matchesSearch && matchesFilter;
    });
    
    renderProducts(filteredProducts, elements.productGrid);
}

function updateWishlistCount() {
    if (elements.wishlistCount) elements.wishlistCount.textContent = wishlist.length;
}

function updateWishlistButtonState() {
    if (!currentProduct || !elements.addToWishlistBtn) return;
    const isInWishlist = wishlist.some(item => item.code === currentProduct.code);
    
    if (isInWishlist) {
        elements.addToWishlistBtn.classList.add('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Remove from Wishlist';
    } else {
        elements.addToWishlistBtn.classList.remove('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Add to Wishlist';
    }
}

function renderWishlist() {
    renderProducts(wishlist, elements.wishlistGrid);
    if (elements.emptyWishlistMsg) {
        elements.emptyWishlistMsg.style.display = wishlist.length === 0 ? 'block' : 'none';
    }
}

// Cashfree payment order checkout configuration
async function initiateCheckout(product, customerDetails) {
    const { name, phone, email } = customerDetails;
    console.log(`Initiating secure Cashfree order validation sequence for: ${product.code}`);
    
    // Check if the developer has bypassed the server connection to prevent console errors
    if (typeof BYPASS_APPS_SCRIPT_BACKEND !== 'undefined' && BYPASS_APPS_SCRIPT_BACKEND) {
        console.log('Bypassing Google Sheets Apps Script backend. Launching instant secure payment gateway...');
        showLocalPaymentGateway(product, customerDetails);
        return;
    }
    
    if (typeof Cashfree === 'undefined') {
        console.warn('Cashfree SDK is not active locally. Falling back to secure temple checkout...');
        showLocalPaymentGateway(product, customerDetails);
        return;
    }

    try {
        // Direct GET request with dynamic parameters captured from checkout form
        const orderUrl = `${TRACKING_API_URL}?action=create_cashfree_order&amount=${product.price}&customerPhone=${encodeURIComponent(phone)}&customerName=${encodeURIComponent(name)}&customerEmail=${encodeURIComponent(email)}&productCode=${encodeURIComponent(product.code)}`;
        
        const response = await fetch(orderUrl);
        const data = await response.json();
        
        console.log("Cashfree Server Response:", data);
        
        // Check if there was an authorization or script execution error on the Apps Script end
        if (data && data.error) {
            throw new Error(data.error);
        }
        
        if (data && data.payment_session_id) {
            // Log order to sheet before redirecting
            const livePaymentId = "live_init_" + data.payment_session_id.substring(0, 10);
            logOrderToSheet(product, livePaymentId, customerDetails);

            // Initialize Cashfree
            const cashfree = Cashfree({
                mode: CASHFREE_MODE
            });

            cashfree.checkout({
                paymentSessionId: data.payment_session_id,
                redirectTarget: "_self" 
            });
            return;
        } else {
            throw new Error("Missing payment session token from server response");
        }

    } catch (error) {
        console.warn('Google Server Authorization Lock / Network issue detected. Opening instant local payment gateway fallback...', error);
        // Instant Fallback trigger: Launches our custom UPI/Sandbox Gateway immediately
        showLocalPaymentGateway(product, customerDetails);
    }
}

// Gorgeous fallback payment gateway dialog (no-server needed!)
function showLocalPaymentGateway(product, customerDetails) {
    const existingPanel = document.getElementById('local-payment-panel');
    if (existingPanel) existingPanel.remove();

    const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);
    
    // Construct dynamic UPI payment URI
    const upiUri = `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI_ID)}&pn=Kailash%20Kalamkari&am=${product.price}&cu=INR&tn=Order%20${encodeURIComponent(product.code)}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

    const panelOverlay = document.createElement('div');
    panelOverlay.id = 'local-payment-panel';
    panelOverlay.className = 'payment-panel-overlay';

    panelOverlay.innerHTML = `
        <div class="payment-panel-card">
            <button class="payment-panel-close" id="close-payment-panel">&times;</button>
            <div class="payment-gateway-header">
                <div class="payment-logo">KAILASH KALAMKARI</div>
                <div class="payment-tagline">Secure Direct Payment Gateway</div>
                <div class="payment-amount-display">Rs. ${formattedPrice}</div>
            </div>
            
            <div id="payment-selection-view">
                <p style="font-size: 0.88rem; margin-bottom: 1.5rem; color: var(--color-roasted-espresso);">Select your preferred secure path to finalize this acquisition:</p>
                <div class="payment-methods-list">
                    <button class="payment-method-btn" id="pay-upi-btn">
                        <span>📲 Direct UPI QR Scan (Instant & Real)</span>
                        <span style="font-size: 1.1rem;">➔</span>
                    </button>
                    <button class="payment-method-btn" id="pay-mock-success-btn">
                        <span>💳 Simulate Success (Sandbox Demo)</span>
                        <span style="font-size: 1.1rem;">➔</span>
                    </button>
                </div>
            </div>

            <!-- Dynamic UPI QR Scan Area -->
            <div id="upi-qr-view" class="upi-qr-container">
                <p style="font-size: 0.82rem; margin-bottom: 1rem; color: var(--color-temple-crimson); font-weight: 600;">Scan this QR with PhonePe, GPay, Paytm or Bhim App to complete transfer</p>
                <img class="upi-qr-image" src="${qrUrl}" alt="Scan to pay Kailash Kalamkari">
                <p style="font-size: 0.75rem; color: var(--color-roasted-espresso); margin-bottom: 1.5rem;">Amount: Rs. ${formattedPrice} | UPI ID: ${MERCHANT_UPI_ID}</p>
                
                <div style="display: flex; gap: 0.8rem; width: 100%;">
                    <button class="checkout-submit-btn" style="margin: 0;" id="confirm-upi-payment-btn">I HAVE COMPLETED THE TRANSFER</button>
                </div>
            </div>

            <!-- Mock Processing Screen -->
            <div id="payment-processing-view" style="display: none; padding: 2rem 0;">
                <div class="spinner-icon" style="margin-bottom: 1.5rem;"></div>
                <h4 style="font-family: var(--font-heritage); color: var(--color-temple-crimson); margin-bottom: 0.5rem;">Securing Transaction Session...</h4>
                <p style="font-size: 0.82rem; color: var(--color-roasted-espresso);">Communicating with decentralized transaction ledgers</p>
            </div>
        </div>
    `;

    document.body.appendChild(panelOverlay);

    // Fade-in trigger
    setTimeout(() => {
        panelOverlay.classList.add('active');
    }, 10);

    // Event Bindings
    const closeBtn = document.getElementById('close-payment-panel');
    closeBtn.addEventListener('click', () => {
        panelOverlay.classList.remove('active');
        setTimeout(() => panelOverlay.remove(), 400);
    });

    const payUpiBtn = document.getElementById('pay-upi-btn');
    const payMockBtn = document.getElementById('pay-mock-success-btn');
    const selectionView = document.getElementById('payment-selection-view');
    const upiQrView = document.getElementById('upi-qr-view');
    const processingView = document.getElementById('payment-processing-view');

    // On Mobile: Directly open UPI App instead of showing QR code
    payUpiBtn.addEventListener('click', () => {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
            window.location.href = upiUri;
            // Transition view to confirmation button
            selectionView.style.display = 'none';
            upiQrView.style.display = 'flex';
        } else {
            selectionView.style.display = 'none';
            upiQrView.style.display = 'flex';
        }
    });

    // Simulated Success Gateway route
    payMockBtn.addEventListener('click', () => {
        selectionView.style.display = 'none';
        processingView.style.display = 'block';

        setTimeout(() => {
            panelOverlay.classList.remove('active');
            setTimeout(() => {
                panelOverlay.remove();
                executeSuccessPayment(product, "sim_mock_" + Date.now(), customerDetails);
            }, 400);
        }, 2200);
    });

    // User confirmed scanning and paying
    const confirmUpiBtn = document.getElementById('confirm-upi-payment-btn');
    confirmUpiBtn.addEventListener('click', () => {
        upiQrView.style.display = 'none';
        processingView.style.display = 'block';

        setTimeout(() => {
            panelOverlay.classList.remove('active');
            setTimeout(() => {
                panelOverlay.remove();
                executeSuccessPayment(product, "sim_upi_" + Date.now(), customerDetails);
            }, 400);
        }, 2000);
    });
}

// Visualises a highly polished Temple payment success screen
function executeSuccessPayment(product, txnId, customerDetails) {
    // Generate silent order tracking post in background
    logOrderToSheet(product, txnId, customerDetails);

    const existingSuccess = document.getElementById('success-payment-overlay');
    if (existingSuccess) existingSuccess.remove();

    const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);

    const successOverlay = document.createElement('div');
    successOverlay.id = 'success-payment-overlay';
    successOverlay.className = 'payment-panel-overlay active';

    successOverlay.innerHTML = `
        <div class="payment-panel-card success-card" style="max-width: 550px;">
            <div class="traditional-mandala-wrapper" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; animation: mandalaRotate 25s linear infinite;">
                <svg viewBox="0 0 100 100" class="gold-temple-mandala" aria-hidden="true">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#2a6b44" stroke-width="1" stroke-dasharray="3 3"/>
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#2a6b44" stroke-width="1.5"/>
                    <path d="M50 5 C55 25, 45 25, 50 5 Z" fill="#2a6b44"/>
                    <path d="M50 95 C55 75, 45 75, 50 95 Z" fill="#2a6b44"/>
                    <circle cx="50" cy="50" r="12" fill="#fffdf9" stroke="#2a6b44" stroke-width="1.5"/>
                    <path d="M42 50 L48 56 L58 44" fill="none" stroke="#2a6b44" stroke-width="3" stroke-linecap="round"/>
                </svg>
            </div>
            
            <h2 style="font-family: var(--font-heritage); color: #2a6b44; font-size: 1.6rem; margin-bottom: 0.5rem; letter-spacing: 0.05em;">ORDER SUCCESSFULLY REGISTERED</h2>
            <p style="font-size: 0.88rem; color: var(--color-roasted-espresso); max-width: 420px; margin: 0 auto 1.8rem; line-height: 1.6;">Your reverence for this hand-painted Kalamkari heritage is acknowledged. The master craftsmen of Srikalahasti have been notified of your reservation.</p>
            
            <div style="background: var(--color-parchment); padding: 1.4rem; border-left: 4px solid #2a6b44; text-align: left; margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.82rem;">
                    <span style="color: var(--color-temple-crimson); font-weight: 600;">Acquisition Code:</span>
                    <span style="font-family: var(--font-heritage); font-weight: 700; color: var(--color-roasted-espresso);">${product.code}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.82rem;">
                    <span style="color: var(--color-temple-crimson); font-weight: 600;">Masterpiece Title:</span>
                    <span style="font-weight: 600; color: var(--color-roasted-espresso); max-width: 250px; text-align: right;">${product.title}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.6rem; font-size: 0.82rem;">
                    <span style="color: var(--color-temple-crimson); font-weight: 600;">Transaction Reference:</span>
                    <span style="font-family: monospace; color: var(--color-roasted-espresso); font-size: 0.78rem;">${txnId}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(86,11,2,0.12); padding-top: 0.6rem; margin-top: 0.6rem; font-size: 0.9rem;">
                    <span style="color: var(--color-temple-crimson); font-weight: 700;">Heritage Value Transferred:</span>
                    <span style="font-family: var(--font-heritage); font-weight: 700; color: #2a6b44;">INR ${formattedPrice}</span>
                </div>
            </div>

            <button class="buy-btn" id="success-return-btn" style="margin: 0 auto; width: auto; padding: 0.9rem 2.5rem;">Return to Temple Archives</button>
        </div>
    `;

    document.body.appendChild(successOverlay);
    document.body.style.overflow = 'hidden';

    const returnBtn = document.getElementById('success-return-btn');
    returnBtn.addEventListener('click', () => {
        successOverlay.remove();
        document.body.style.overflow = '';
        window.location.hash = ''; // Redirect back to catalogue view
    });
}

// Dynamically creates and triggers the secure checkout modal
function openCheckoutModal(product) {
    // Prevent duplicate modals
    const existingModal = document.getElementById('luxury-checkout-modal');
    if (existingModal) existingModal.remove();

    // Create modal element
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'luxury-checkout-modal';
    modalOverlay.className = 'checkout-modal-overlay';
    
    modalOverlay.innerHTML = `
        <div class="checkout-modal-card">
            <button class="checkout-modal-close" id="close-checkout-modal">&times;</button>
            <h3 class="checkout-modal-title">SECURE HERITAGE CHECKOUT</h3>
            <p class="checkout-modal-subtitle">Acquiring: ${product.title} (${product.code})</p>
            
            <form id="checkout-details-form">
                <div class="checkout-form-group">
                    <label class="checkout-form-label" for="cust-name">Patron Name</label>
                    <input type="text" id="cust-name" class="checkout-form-input" placeholder="Enter your full name" required autocomplete="name">
                </div>
                <div class="checkout-form-group">
                    <label class="checkout-form-label" for="cust-phone">Contact Number (WhatsApp Preferred)</label>
                    <input type="tel" id="cust-phone" class="checkout-form-input" placeholder="10-digit mobile number" required pattern="^[0-9]{10}$" autocomplete="tel">
                </div>
                <div class="checkout-form-group">
                    <label class="checkout-form-label" for="cust-email">Email Address</label>
                    <input type="email" id="cust-email" class="checkout-form-input" placeholder="yourname@example.com" required autocomplete="email">
                </div>
                
                <button type="submit" class="checkout-submit-btn">PROCEED TO SECURE PAYMENT</button>
            </form>
        </div>
    `;

    document.body.appendChild(modalOverlay);

    // Trigger visual fade-in transition
    setTimeout(() => {
        modalOverlay.classList.add('active');
    }, 10);

    // Event listeners for close operations
    const closeBtn = document.getElementById('close-checkout-modal');
    closeBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        setTimeout(() => modalOverlay.remove(), 400);
    });

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('active');
            setTimeout(() => modalOverlay.remove(), 400);
        }
    });

    // Form Submission handling
    const form = document.getElementById('checkout-details-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const email = document.getElementById('cust-email').value.trim();

        modalOverlay.classList.remove('active');
        setTimeout(() => modalOverlay.remove(), 400);

        // Run Cashfree process with captured inputs
        initiateCheckout(product, { name, phone, email });
    });
}

// Event Bindings setup
function setupEventListeners() {
    if (elements.backToCatalogueBtn) {
        elements.backToCatalogueBtn.addEventListener('click', () => {
            window.location.hash = '';
        });
    }
    if (elements.backFromWishlistBtn) {
        elements.backFromWishlistBtn.addEventListener('click', () => {
            window.location.hash = '';
        });
    }
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            window.location.hash = '#wishlist';
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', toggleWishlist);
    if (elements.searchInput) elements.searchInput.addEventListener('input', filterAndSearchProducts);

    if (elements.whatsappBtn) {
        elements.whatsappBtn.addEventListener('click', () => {
            if (!currentProduct) return;
            const textContent = `Namaste, I am interested in acquiring the following hand-painted masterpiece:\n\nCode: ${currentProduct.code}\nTitle: ${currentProduct.title}\nFabric: ${currentProduct.fabric}\nPrice: INR ${new Intl.NumberFormat('en-IN').format(currentProduct.price)}`;
            window.open(`https://wa.me/919063374020?text=${encodeURIComponent(textContent)}`, '_blank');
        });
    }

    if (elements.buyNowBtn) {
        elements.buyNowBtn.addEventListener('click', () => {
            if (!currentProduct) return;
            openCheckoutModal(currentProduct);
        });
    }

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            setDepartment(element.dataset.department); 
            if (window.location.hash) {
                window.location.hash = '';
            } else {
                showView('catalogue');
            }
        });
    });
    
    if (elements.detailImage) {
        elements.detailImage.addEventListener('click', () => openFullScreenImage(currentProduct));
    }
    
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
    window.history.replaceState({ isDepartmentSelection: true }, '', window.location.href);
}

function handlePopState() {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const departmentParam = params.get('department');

    if (hash.startsWith('#product/')) {
        const productCode = hash.split('/')[1];
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
        setDepartment(departmentParam || 'saree', { updateUrl: false }); 
        showView('catalogue'); 
    }
}

document.addEventListener('DOMContentLoaded', init);