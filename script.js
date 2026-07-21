// === COMPLETE CLIENT-SIDE WEBPAGE LOGIC (script.js) ===

// Keep this original URL so your products continue to load
const CATALOG_API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';

// Use this new URL to log your traffic and wishlist counts to your new Google Sheet
const ANALYTICS_API_URL = 'https://script.google.com/macros/s/AKfycbznE_kXKH8nxaZuljQBPQRR-Pyp5B4sMlpq05GTnxX9jjT8YrFk4fXaDnqoOb7QaYGF/exec'; 

const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

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

// Generate the primary image URL
function getProductImageUrl(product, width = 800) {
    if (!product) return DEFAULT_IMAGE;

    const fileId = getGoogleDriveId(product);
    if (fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
    }

    const rawUrl = (product.imageLink || product.thumbnail || product.rawImageLink || '').trim();
    if (!rawUrl) return DEFAULT_IMAGE;

    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
        return rawUrl;
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        return rawUrl;
    }
    
    if (rawUrl.includes('drive.google.com')) {
        return 'https://' + rawUrl;
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

// Push or Replace current location state to allow clean back-button transitions
function navigateToState(department, fabric, hash = '', push = true) {
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
    
    url.hash = hash;
    
    if (push) {
        window.history.pushState({ department, fabric, hash }, '', url);
    } else {
        window.history.replaceState({ department, fabric, hash }, '', url);
    }
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
    const departmentKey = normalizeDepartment(department) || 'saree';
    currentDepartment = departmentKey;

    if (elements.searchInput) {
        elements.searchInput.value = '';
    }

    updateDepartmentUI();
    renderFilterButtons();

    if (pushState) {
        navigateToState(currentDepartment, 'all', '', true);
    }

    filterAndSearchProducts();
}

// === TELEMETRY TRAFFIC LOGGING FUNCTIONS ===

function detectTrafficSource() {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    
    if (utmSource) {
        return utmSource.toLowerCase().trim();
    }

    const referrer = document.referrer ? document.referrer.toLowerCase() : '';
    if (referrer.includes('instagram.com')) return 'instagram';
    if (referrer.includes('facebook.com') || referrer.includes('fb.me')) return 'facebook';
    if (referrer.includes('whatsapp.com') || referrer.includes('wa.me')) return 'whatsapp';
    
    return referrer ? 'other website' : 'direct / organic';
}

function detectBrowser() {
    const userAgent = navigator.userAgent;

    if (userAgent.includes('Chrome') || userAgent.includes('CriOS')) {
        if (userAgent.includes('Edg') || userAgent.includes('OPR')) {
            return 'Other Browser';
        }
        return 'Google Chrome';
    }

    if (userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
        return 'Safari';
    }

    return 'Other Browser';
}

async function logVisitorTraffic() {
    if (sessionStorage.getItem('trafficLogged') === 'true') return;

    const source = detectTrafficSource();
    const browser = detectBrowser();
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logTraffic',
                timestamp: timestamp,
                source: source,
                browser: browser,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
                wishlistCount: wishlist.length
            })
        });
        sessionStorage.setItem('trafficLogged', 'true');
    } catch (error) {
        console.error('Failed to log traffic data:', error);
    }
}

async function logWishlistActivity(action, product) {
    if (!product) return;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    try {
        await fetch(ANALYTICS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logWishlist',
                timestamp: timestamp,
                wishlistAction: action,
                productCode: product.code,
                productTitle: product.title,
                wishlistCount: wishlist.length
            })
        });
    } catch (error) {
        console.error('Failed to log wishlist activity:', error);
    }
}

// Automatically dismiss stuck loader or intro splash screen
function hideIntroAnimation() {
    const selectors = [
        '#intro', '#loader', '#splash', '#welcome', '#splash-screen', '#intro-loader', '#intro-screen', '#loading-screen',
        '.intro', '.loader', '.splash', '.splash-screen', '.intro-screen', '.intro-animation', '.loading-screen', '.welcome-screen'
    ];
    
    let introElement = null;
    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
            introElement = el;
            break;
        }
    }
    
    // Auto-detection fallback: search for container containing Kailash brand texts
    if (!introElement) {
        const possibleContainers = Array.from(document.querySelectorAll('h1, h2, div, section, span, p'));
        const matchedElement = possibleContainers.find(el => {
            const txt = el.textContent.toLowerCase();
            return txt.includes('kailash') || txt.includes('eternal heritage') || txt.includes('hand-painted devotion');
        });
        
        if (matchedElement) {
            let topParent = matchedElement;
            while (topParent && topParent.parentElement && topParent.parentElement !== document.body) {
                topParent = topParent.parentElement;
            }
            if (topParent && topParent !== document.body && topParent.tagName !== 'HEADER') {
                introElement = topParent;
            }
        }
    }

    if (introElement) {
        // Apply active CSS states
        introElement.classList.add('fade-out', 'hidden', 'inactive');
        
        // Inline fallback styling guarantees transparency/dismissal
        introElement.style.transition = 'opacity 0.8s ease, visibility 0.8s ease';
        introElement.style.opacity = '0';
        introElement.style.visibility = 'hidden';
        introElement.style.pointerEvents = 'none';
        
        setTimeout(() => {
            introElement.style.display = 'none';
        }, 800);
    }
}

// State
const DEPARTMENTS = [
    { key: 'saree', label: 'Sarees', singular: 'Saree' },
    { key: 'dupatta', label: 'Dupattas', singular: 'Dupatta' }
];

let allProducts = [];
let filteredProducts = [];
let wishlist = JSON.parse(localStorage.getItem('kalamkariWishlist')) || [];
let currentProduct = null;
let currentDepartment = getInitialDepartment();
let isDetailZoomed = false;
let isOverlayZoomed = false;
let isInitialLoad = true; 
let sessionPushedStates = 0;

// DOM Elements
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
    detailDescription: document.getElementById('detail-description'),
    detailPrice: document.getElementById('detail-price'),
    detailFabricHighlight: document.getElementById('detail-fabric-highlight'),
    
    // Action Buttons
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    wishlistBtnIcon: document.getElementById('wishlist-btn-icon'),
    shareBtn: document.getElementById('share-btn'),
    shareBtnText: document.getElementById('share-btn-text'),
    buyNowBtn: document.getElementById('buy-now-btn')
};

// Smooth scroll targeting layout coordinates
function scrollToDepartment(smooth = true) {
    if (isInitialLoad) return;
    
    const performScroll = () => {
        const target = document.querySelector('.department-bar');
        if (target) {
            const targetY = target.offsetTop;
            window.scrollTo({
                top: targetY,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    };

    performScroll();
    setTimeout(performScroll, 50);
    setTimeout(performScroll, 150);
    setTimeout(performScroll, 300);
}

// Clean UI Back button handler
function goBack() {
    window.history.back();
}

// Initialize
async function init() {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    updateWishlistCount();
    setupEventListeners();
    
    // Send visit log data silently to Google Sheets
    logVisitorTraffic();

    await fetchProducts();

    const params = new URLSearchParams(window.location.search);
    const initialDept = normalizeDepartment(params.get('department')) || currentDepartment;
    const initialFabric = params.get('fabric') || 'all';

    navigateToState(initialDept, initialFabric, window.location.hash, false);

    handlePopState(); 
    isInitialLoad = false;
    
    // Smoothly hide any active or stuck intro screen
    hideIntroAnimation();
}

// Fetch Data
async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block'; 
        const response = await fetch(CATALOG_API_URL);
        const rawData = await response.json();
        const data = Array.isArray(rawData) ? rawData : (rawData.value || rawData.data || rawData.records || []);
        
        const getFieldValue = (item, keys) => {
            const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            
            const normalizedEntries = Object.entries(item).map(([itemKey, value]) => [
                normalize(itemKey),
                value
            ]);

            for (const key of keys) {
                const normalizedKey = normalize(key);
                let value = item[key];

                if (value === undefined || value === null) {
                    const matchedEntry = normalizedEntries.find(([itemKey]) => itemKey === normalizedKey);
                    if (matchedEntry) {
                        value = matchedEntry[1];
                    }
                }

                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return String(value).trim();
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

            const customTitle = String(getFieldValue(item, [
                'product name', 'saree name', 'dupatta name', 'item name', 'name', 'title', 'product'
            ])).trim();

            // Clean up the fabric string to prevent redundant trailing singular/plural variations
            let title = customTitle;
            if (!title) {
                if (fabric) {
                    let baseFabric = fabric.trim();
                    if (departmentKey === 'saree') {
                        // Safely removes variations of sarees/saree/saris/sari at the end of the text
                        baseFabric = baseFabric.replace(/\s+(sarees|saree|saris|sari)\s*$/i, '');
                    } else if (departmentKey === 'dupatta') {
                        // Bulletproof pattern matching any spelling combination of dupata/dupatta/duppatas/etc.
                        baseFabric = baseFabric.replace(/\s+dup+at+as?\s*$/i, '');
                    }
                    title = `${baseFabric} ${deptSingular}`;
                } else {
                    title = `Product ${code}`;
                }
            }

            return {
                code,
                title, 
                fabric,
                category,
                department,
                departmentKey,
                price: parsePrice(item.price || item.Price || ''),
                qty: qty,
                imageLink,
                thumbnail,
                imageId,
                description
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
        calculatePriceRanges();
    } catch (error) {
        console.error('Error fetching data:', error);
        if (elements.spinner) {
            elements.spinner.textContent = 'Failed to load collection. Please try again later.';
        }
    }
}

// Render Product Grid
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
        
        card.onclick = () => {
            if (isSimilar) {
                const url = new URL(window.location.href);
                url.hash = `#product/${product.code}`;
                window.history.replaceState({ isDepartmentSelection: true }, '', url);
                handlePopState();
            } else {
                sessionPushedStates++;
                window.location.hash = `#product/${product.code}`;
            }
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
        
        const fileId = getGoogleDriveId(product);
        const primaryUrl = getProductImageUrl(product, 800);
        img.src = primaryUrl;

        if (fileId) {
            img.onerror = () => {
                if (!img.dataset.fallbackAttempted) {
                    img.dataset.fallbackAttempted = "true";
                    if (primaryUrl.includes('drive.google.com/thumbnail')) {
                        img.src = `https://lh3.googleusercontent.com/d/${fileId}=w800`;
                    } else {
                        img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
                    }
                } else if (img.dataset.fallbackAttempted === "true") {
                    img.dataset.fallbackAttempted = "failed_all";
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

        // --- NEW CARD QUICK ACTIONS OVERLAY ---
        const isInWishlist = wishlist.some(item => item.code === product.code);
        const quickActions = document.createElement('div');
        quickActions.className = 'card-quick-actions';

        const cardWishlistBtn = document.createElement('button');
        cardWishlistBtn.className = `card-action-btn card-wishlist-btn ${isInWishlist ? 'active' : ''}`;
        cardWishlistBtn.innerHTML = isInWishlist ? '♥' : '♡';
        cardWishlistBtn.setAttribute('aria-label', 'Add to Gallery');
        cardWishlistBtn.onclick = (e) => {
            e.stopPropagation();
            toggleWishlist(product);
        };

        const cardShareBtn = document.createElement('button');
        cardShareBtn.className = 'card-action-btn card-share-btn';
        cardShareBtn.innerHTML = '🔗';
        cardShareBtn.setAttribute('aria-label', 'Share Masterpiece');
        cardShareBtn.onclick = (e) => {
            e.stopPropagation();
            shareProduct(product);
        };

        quickActions.appendChild(cardWishlistBtn);
        quickActions.appendChild(cardShareBtn);
        imageWrapper.appendChild(quickActions);
        // --------------------------------------

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? `${String(product.description).trim().slice(0, 120)}${product.description.length > 120 ? '...' : ''}` : '';
        info.innerHTML = `
            <h3 class="product-title">${product.title}</h3>
            ${shortDescription ? `<p class="product-card-description">${shortDescription}</p>` : ''}
            <div class="product-price">Rs. ${formattedPrice}</div>
        `;

        card.appendChild(imageWrapper);
        card.appendChild(info);
        container.appendChild(card);
    });
}

// Render Similar Products
function renderSimilarProducts(currentProduct) {
    const similarSection = document.getElementById('similar-products-section');
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
        renderProducts(higherPriced.slice(0, 4), similarContainer, true); 
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
    } else {
        document.body.classList.remove('details-mode');
        if (viewName === 'catalogue') {
            scrollToDepartment(true);
        } else {
            window.scrollTo(0, 0);
        }
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
            
            const filterTerm = btn.dataset.filter;
            navigateToState(currentDepartment, filterTerm, '', true);
            
            filterAndSearchProducts();
            scrollToDepartment(true);
        });
    });
}

// Sync active classes to filter buttons on backward/forward navigation
function syncFabricFilterUI(fabricParam) {
    if (!elements.filtersContainer) return;
    const buttons = elements.filtersContainer.querySelectorAll('.filter-btn');
    let matched = false;
    
    buttons.forEach(btn => {
        const btnFilter = btn.dataset.filter;
        if (btnFilter === fabricParam) {
            btn.classList.add('active');
            matched = true;
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (!matched && buttons.length > 0) {
        buttons.forEach(btn => {
            if (btn.dataset.filter === 'all') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    filterAndSearchProducts();
}

function formatPriceRange(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const formatOpts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
    const formattedMin = new Intl.NumberFormat('en-IN', formatOpts).format(minPrice);
    const formattedMax = new Intl.NumberFormat('en-IN', formatOpts).format(maxPrice);
    return minPrice === maxPrice ? formattedMin : `${formattedMin} to ${formattedMax}`;
}

// Full product details display
function showProductDetails(product) {
    currentProduct = product;
    isDetailZoomed = false;
    updateDetailZoom();
    
    if (elements.detailImage) {
        delete elements.detailImage.dataset.fallbackAttempted;

        const detailFileId = getGoogleDriveId(product);
        const detailPrimaryUrl = getProductImageUrl(product, 2000);
        elements.detailImage.src = detailPrimaryUrl;
        elements.detailImage.title = 'Click to zoom';

        if (detailFileId) {
            elements.detailImage.onerror = () => {
                if (!elements.detailImage.dataset.fallbackAttempted) {
                    elements.detailImage.dataset.fallbackAttempted = "true";
                    if (detailPrimaryUrl.includes('drive.google.com/thumbnail')) {
                        elements.detailImage.src = `https://lh3.googleusercontent.com/d/${detailFileId}=w2000`;
                    } else {
                        elements.detailImage.src = `https://drive.google.com/thumbnail?id=${detailFileId}&sz=w2000`;
                    }
                } else if (elements.detailImage.dataset.fallbackAttempted === "true") {
                    elements.detailImage.dataset.fallbackAttempted = "failed_all";
                    elements.detailImage.src = DEFAULT_IMAGE;
                }
            };
        }
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
    
    if (elements.detailDescription) {
        if (product.description) {
            elements.detailDescription.textContent = product.description;
            elements.detailDescription.style.display = 'block';
        } else {
            elements.detailDescription.style.display = 'none';
        }
    }
    
    if (elements.detailPrice) elements.detailPrice.textContent = new Intl.NumberFormat('en-IN').format(product.price);
    if (elements.detailFabricHighlight) elements.detailFabricHighlight.textContent = product.fabric;
    
    updateWishlistButtonState();
    renderSimilarProducts(product);
    showView('details');
    
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

function updateDetailZoom() {
    if (!elements.detailImageSection || !elements.detailImage) return;
    if (isDetailZoomed) {
        elements.detailImageSection.classList.add('zoom-active');
    } else {
        elements.detailImageSection.classList.remove('zoom-active');
    }
}

// Lightbox controls
function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;

    delete elements.overlayImage.dataset.fallbackAttempted;

    const overlayFileId = getGoogleDriveId(product);
    const overlayPrimaryUrl = getProductImageUrl(product, 2000);

    elements.overlayImage.src = overlayPrimaryUrl;
    elements.overlayImage.style.transform = 'scale(1)';
    elements.overlayImage.style.transformOrigin = '50% 50%';
    elements.overlayImage.style.cursor = 'zoom-in';
    elements.overlay.classList.remove('hidden');
    isOverlayZoomed = false;
    document.body.style.overflow = 'hidden';

    if (overlayFileId) {
        elements.overlayImage.onerror = () => {
            if (!elements.overlayImage.dataset.fallbackAttempted) {
                elements.overlayImage.dataset.fallbackAttempted = "true";
                if (overlayPrimaryUrl.includes('drive.google.com/thumbnail')) {
                    elements.overlayImage.src = `https://lh3.googleusercontent.com/d/${overlayFileId}=w2000`;
                } else {
                    elements.overlayImage.src = `https://drive.google.com/thumbnail?id=${overlayFileId}&sz=w2000`;
                }
            } else if (elements.overlayImage.dataset.fallbackAttempted === "true") {
                elements.overlayImage.dataset.fallbackAttempted = "failed_all";
                elements.overlayImage.src = DEFAULT_IMAGE;
            }
        };
    }
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

// Toggle zoom on lightbox images
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
    
    try {
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    } catch (e) {
        console.error("Error saving wishlist to local storage", e);
    }
    
    updateWishlistCount();
    updateWishlistButtonState();

    // Dynamically update UI views to ensure state changes are visible instantly
    filterAndSearchProducts();
    if (views.wishlist && views.wishlist.classList.contains('active')) {
        renderWishlist();
    }

    logWishlistActivity(action, product);
}

// Render Wishlist Page
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

// Filters implementation
function filterAndSearchProducts() {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase().trim() : '';
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filterTerm = activeFilterBtn ? activeFilterBtn.dataset.filter.toLowerCase().trim() : 'all';
    
    filteredProducts = getDepartmentProducts().filter(product => {
        const matchesSearch = !searchTerm ? true : (
            (product.code && product.code.toLowerCase().includes(searchTerm)) ||
            (product.fabric && product.fabric.toLowerCase().includes(searchTerm)) ||
            (product.category && product.category.toLowerCase().includes(searchTerm)) ||
            (product.description && product.description.toLowerCase().includes(searchTerm)) ||
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

// Dynamic Share Feature Logic
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
            // Asynchronous clipboard copy fallback
            await navigator.clipboard.writeText(shareUrl);
            alert("Masterpiece link copied to clipboard!");
        }
    } catch (error) {
        console.error("Error executing share operation:", error);
    }
}

// Dynamic WhatsApp Booking Inquiry Formatter
function sendWhatsappInquiry() {
    if (!currentProduct) return;
    
    const message = `Namaste, I would like to book this hand-painted masterpiece:\n\n• Code: ${currentProduct.code}\n• Title: ${currentProduct.title}\n• Fabric: ${currentProduct.fabric}\n• Link: ${window.location.href}`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/919063374020?text=${encodedMessage}`, '_blank');
}

// Event Bindings
function setupEventListeners() {
    if (elements.backToCatalogueBtn) {
        elements.backToCatalogueBtn.addEventListener('click', goBack);
    }
    if (elements.backFromWishlistBtn) {
        elements.backFromWishlistBtn.addEventListener('click', goBack);
    }
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            sessionPushedStates++;
            window.location.hash = '#wishlist';
        });
    }
    
    if (elements.addToWishlistBtn) {
        elements.addToWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    }
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => shareProduct(currentProduct));
    }
    if (elements.buyNowBtn) {
        elements.buyNowBtn.addEventListener('click', sendWhatsappInquiry);
    }
    
    // Floating detail page quick actions setup
    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) {
        floatingWishlistBtn.addEventListener('click', () => toggleWishlist(currentProduct));
    }
    
    const floatingShareBtn = document.getElementById('detail-floating-share-btn');
    if (floatingShareBtn) {
        floatingShareBtn.addEventListener('click', () => shareProduct(currentProduct));
    }

    if (elements.searchInput) elements.searchInput.addEventListener('input', filterAndSearchProducts);

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            const selectedDept = normalizeDepartment(element.dataset.department);
            setDepartment(selectedDept, { pushState: true }); 
            showView('catalogue');
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
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'In Gallery';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '♥';
    } else {
        elements.addToWishlistBtn.classList.remove('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Add to Gallery';
        if (elements.wishlistBtnIcon) elements.wishlistBtnIcon.textContent = '❤️';
    }

    // Update the floating detail page button overlaying the main product detail image
    const floatingWishlistBtn = document.getElementById('detail-floating-wishlist-btn');
    if (floatingWishlistBtn) {
        if (isInWishlist) {
            floatingWishlistBtn.classList.add('active');
            floatingWishlistBtn.innerHTML = '♥';
        } else {
            floatingWishlistBtn.classList.remove('active');
            floatingWishlistBtn.innerHTML = '♡';
        }
    }
}

document.addEventListener('DOMContentLoaded', init);