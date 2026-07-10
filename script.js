// Force the browser to let us manage scroll positions manually on back navigation
if ('history' in window && 'scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual';
}

const API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
// PASTE YOUR NEW WISHLIST & ORDERS GOOGLE SHEET WEB APP URL HERE:
const WISHLIST_SHEET_URL = 'https://script.google.com/macros/s/AKfycbw_KE6xV7wDL0qx0B_e06KLwRD-LfByn9wWVSNfNLlIBH-5ZfRW_7NlwdMyyNG5DE7r_A/exec';

const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23f6eedf"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Cinzel, serif" font-size="28" fill="%234a0e05"%3EImage+Preparing%3C/text%3E%3C/svg%3E';

// Helper: Aggressively resets scroll to top across every possible scroll container in the document
function forceScrollToTopAggressive() {
    const scrollTargets = [
        window,
        document.documentElement,
        document.body,
        document.querySelector('.container'),
        document.querySelector('main'),
        document.getElementById('catalogue-view'),
        document.getElementById('product-details-view'),
        document.getElementById('wishlist-view')
    ];

    let attempts = 0;
    const interval = setInterval(() => {
        scrollTargets.forEach(target => {
            if (target) {
                if (target.scrollTo) {
                    target.scrollTo(0, 0);
                }
                target.scrollTop = 0;
            }
        });
        attempts++;
        if (attempts > 30) { // Absorbs mobile layout shifts dynamically and quickly
            clearInterval(interval);
        }
    }, 15);
}

// Helper: Extract Google Drive File ID from various formats
function extractDriveFileId(urlOrId) {
    if (!urlOrId) return '';
    
    // Already a file ID (25+ chars of alphanumeric, dash, underscore)
    if (/^[-\w]{25,}$/.test(urlOrId)) {
        return urlOrId;
    }
    
    // Extract from various Google URL formats
    const idMatch = urlOrId.match(/[-\w]{25,}/);
    return idMatch ? idMatch[0] : '';
}

// Helper: Build Google CDN image URL (fastest, excellent CORS support)
function buildCdnImageUrl(fileId, width = 800) {
    if (!fileId) return '';
    // Standard Google Images CDN format
    return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

// Helper: Build direct Google Drive URL (fallback)
function buildDirectDriveUrl(fileId) {
    if (!fileId) return '';
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// Helper: Build download URL
function buildDriveDownloadUrl(fileId) {
    if (!fileId) return '';
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Helper: Build proxy URL for Google Drive (best CORS support)
function buildProxyImageUrl(fileId, width = 800) {
    if (!fileId) return '';
    return `https://images.weserv.nl/?url=https://drive.google.com/uc?export=view%26id=${fileId}&w=${width}&fit=cover`;
}

// Main: Get product image with 7-tier fallback system
function getProductImageUrl(product, width = 800) {
    if (!product) return DEFAULT_IMAGE;

    const imageLink = product.imageLink || product["image link"] || '';
    const imageId = product.imageId || product["image id"] || '';
    const image = product.image || '';
    const thumbnail = product.thumbnail || '';

    const fileId = extractDriveFileId(imageId) || 
                   extractDriveFileId(imageLink) || 
                   extractDriveFileId(image) ||
                   extractDriveFileId(thumbnail);

    const sources = [];

    // Tier 1: Proxy URL with CORS support (BEST - most reliable)
    if (fileId) {
        sources.push(buildProxyImageUrl(fileId, width));
    }

    // Tier 2: Google CDN URL
    if (fileId) {
        sources.push(buildCdnImageUrl(fileId, width));
    }

    // Tier 3: Direct Google Drive URL - export=view
    if (fileId) {
        sources.push(buildDirectDriveUrl(fileId));
    }

    // Tier 4: Google Drive download URL (export=download)
    if (fileId) {
        sources.push(buildDriveDownloadUrl(fileId));
    }

    // Tier 5: Original imageLink if it's a full URL
    if (imageLink && imageLink.startsWith('http')) {
        sources.push(imageLink);
    }

    // Tier 6: Thumbnail URL if available
    if (thumbnail && thumbnail.startsWith('http')) {
        sources.push(thumbnail);
    }

    // Tier 7: Default placeholder
    sources.push(DEFAULT_IMAGE);

    return sources.find(url => url) || DEFAULT_IMAGE;
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
    if (normalized.includes('saree')) return 'saree';
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
    window.history.replaceState({ type: 'department', department: currentDepartment }, '', url);
}

function updateDepartmentUI() {
    const activeDepartment = getDepartmentConfig();

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        const departmentKey = normalizeDepartment(element.dataset.department);
        element.classList.toggle('active', departmentKey === currentDepartment);
    });

    if (elements.searchInput) {
        elements.searchInput.placeholder = `Search ${activeDepartment.label.toLowerCase()} by fabric, paint style or motif...`;
    }
}

function setDepartment(department, { updateUrl = true } = {}) {
    const departmentKey = normalizeDepartment(department) || 'saree';
    currentDepartment = departmentKey;

    if (elements.searchInput) {
        elements.searchInput.value = '';
    }

    fabricScrollTriggerActive = false; 

    updateDepartmentUI();
    renderFilterButtons();
    filterAndSearchProducts();

    if (updateUrl) {
        const url = new URL(window.location);
        url.searchParams.set('department', currentDepartment);
        url.hash = '';
        
        if (history.state && history.state.isInitial) {
            history.replaceState(
                { type: 'department', department: currentDepartment },
                '',
                url
            );
        } else {
            history.pushState(
                { type: 'department', department: currentDepartment },
                '',
                url
            );
        }
    }

    forceScrollToTopAggressive();
}

// State Management
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
let navigationStack = [];
let openedFromShare = false;
let fabricScrollTriggerActive = false;       

// DOM Elements Map
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
    addToWishlistBtn: document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text'),
    buyNowBtn: document.getElementById("buy-now-btn"),
    whatsappInquiryBtn: document.getElementById("whatsapp-inquiry-btn"),
};

// Helper: Determine if cached content needs refreshing (11:00 AM or 2:00 PM updates)
function checkIfCacheNeedsRefresh(lastFetchTimestamp) {
    if (!lastFetchTimestamp) return true;

    const now = new Date();
    const lastFetch = new Date(lastFetchTimestamp);

    const today11 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);
    const today14 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0, 0);
    const yesterday14 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 14, 0, 0, 0);

    let latestThreshold;

    if (now >= today14) {
        latestThreshold = today14;
    } else if (now >= today11) {
        latestThreshold = today11;
    } else {
        latestThreshold = yesterday14;
    }

    return lastFetch < latestThreshold;
}

// Initialize
async function init() {
    updateWishlistCount();
    setupEventListeners();
    
    // Silently log visitor traffic session
    recordVisitorTraffic();
    
    await fetchProducts();
    
    window.history.replaceState({ isInitial: true, department: 'saree' }, '', window.location.href);

    const params = new URLSearchParams(window.location.search);
    const hashParam = window.location.hash;
    const departmentParam = params.get('department');
    
    const isDirectProductLink = hashParam.startsWith('#product/');
    
    if (isDirectProductLink) {
        const code = decodeURIComponent(hashParam.replace('#product/', ''));
        const product = allProducts.find(x => x.code === code);
        
        if (product) {
            currentDepartment = product.departmentKey;
            
            if (history.length <= 1) {
                const deptUrl = new URL(window.location);
                deptUrl.searchParams.set('department', currentDepartment);
                deptUrl.hash = '';
                history.replaceState(
                    { type: 'department', department: currentDepartment },
                    '',
                    deptUrl
                );
            }
            
            showProductDetails(product);
        }
    } else {
        const department = departmentParam || 'saree';
        setDepartment(department, { updateUrl: true });
        updateDepartmentUI();
    }
    
    renderFilterButtons();
}

// Fetch Data with Caching
async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block';
        
        const CACHE_KEY = 'kalamkari_products_cache';
        const CACHE_TIME_KEY = 'kalamkari_products_cache_time';
        
        let rawData;
        const cachedData = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        
        let needsRefresh = true;
        if (cachedData && cachedTime) {
            const lastFetchTime = parseInt(cachedTime);
            needsRefresh = checkIfCacheNeedsRefresh(lastFetchTime);
        }
        
        if (!needsRefresh && cachedData) {
            rawData = JSON.parse(cachedData);
        } else {
            const response = await fetch(API_URL);
            rawData = await response.json();
            
            localStorage.setItem(CACHE_KEY, JSON.stringify(rawData));
            localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        }
        
        const data = Array.isArray(rawData) ? rawData : (rawData.value || rawData.data || rawData.records || []);
        
        const getFieldValue = (item, keys) => {
            const normalizedEntries = Object.entries(item).map(([itemKey, value]) => [
                String(itemKey).toLowerCase().replace(/\s+/g, ' ').trim(),
                value
            ]);

            for (const key of keys) {
                const normalizedKey = String(key).toLowerCase().replace(/\s+/g, ' ').trim();
                const directValue = item[key];
                const matchedEntry = normalizedEntries.find(([itemKey]) => itemKey === normalizedKey);
                const value = directValue !== undefined ? directValue : matchedEntry?.[1];

                if (value !== undefined && value !== null && String(value).trim()) {
                    return String(value);
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

            const fabric = String(getFieldValue(item, ['fabric name', 'Fabric Name', 'fabric', 'Fabric']) || 'Pure Handcrafted Silk').trim();
            const code = String(getFieldValue(item, ['code', 'Code', 'style code', 'Style Code']) || fabric).trim();
            const category = String(getFieldValue(item, ['category', 'Category']) || 'Traditional').trim();
            const department = String(getFieldValue(item, ['department', 'Department', 'dept', 'Dept', 'collection', 'Collection'])).trim();
            const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
            
            const imageLink = String(getFieldValue(item, ['image link', 'Image Link', 'drive link', 'Drive Link', 'imageLink', 'image', 'Image'])).trim();
            const thumbnail = String(getFieldValue(item, ['thumbnail', 'Thumbnail', 'thumbnail link', 'Thumbnail Link'])).trim() || imageLink;
            const imageId = String(getFieldValue(item, ['image id', 'Image ID', 'file id', 'File ID', 'imageId', 'fileId'])).trim();

            let rawQty = item.qty !== undefined && item.qty !== '' ? item.qty : (item.Qty !== undefined && item.Qty !== '' ? item.Qty : '');
            let qty = rawQty !== '' ? Number(rawQty) : 1;
            if (isNaN(qty)) qty = 1;

            return {
                code,
                title: getFieldValue(item, ['title', 'Title', 'Product Name', 'description']) || fabric,
                fabric,
                category,
                department,
                departmentKey,
                price: parsePrice(item.price || item.Price || ''),
                qty: qty,
                imageLink,
                thumbnail,
                imageId,
                description: String(getFieldValue(item, ['description', 'Description', 'product description', 'Product Description', 'desc', 'Desc'])).trim()
            };
        }).filter(item => (item.code || item.fabric) && item.price > 0);

        allProducts = sortProductsByPrice(allProducts);
        
        if (allProducts.length > 0) {
            const firstProd = allProducts[0];
            const fileId = extractDriveFileId(firstProd.imageId || firstProd.imageLink);
            if (fileId) {
                getProductImageUrl(firstProd);
            }
        }
        
        if (!getDepartmentProducts(currentDepartment).length && allProducts.length) {
            currentDepartment = allProducts[0].departmentKey || 'saree';
        }
        filteredProducts = sortProductsByPrice(getDepartmentProducts());

        wishlist = wishlist.map(savedItem => {
            const freshItem = allProducts.find(p => p.code === savedItem.code || p.fabric === savedItem.fabric);
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
            elements.spinner.textContent = 'Unable to connect to sacred temple records. Please check setup.';
        }
    }
}

// Render Grid
function renderProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #8c765c; font-family: var(--font-heritage); padding: 3rem;">No handloom pieces currently displayed in this tier.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => showProductDetails(product);

        const imgUrl = getProductImageUrl(product);
        const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);

        card.innerHTML = `
            <div class="product-image-wrapper">
                <img src="${imgUrl}" alt="${product.title}" loading="lazy" data-product-code="${product.code}">
                ${product.qty <= 0 ? '<span class="sold-out-badge">ACQUIRED</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-card-description">${product.description ? product.description.substring(0, 65) + '...' : ''}</p>
                <div class="product-price">₹ ${formattedPrice}</div>
            </div>
        `;
        
        const img = card.querySelector('img');
        if (img) {
            let attemptCount = 0;
            const urlChain = [];
            
            img.onerror = function() {
                attemptCount++;
                const productCode = this.dataset.productCode;
                const prod = allProducts.find(p => p.code === productCode);
                
                if (prod && attemptCount === 1) {
                    const fileId = extractDriveFileId(prod.imageId || prod["image id"]);
                    if (fileId) {
                        urlChain.push(
                            buildProxyImageUrl(fileId, 800),
                            buildCdnImageUrl(fileId, 800),
                            buildDirectDriveUrl(fileId),
                            buildDriveDownloadUrl(fileId),
                            DEFAULT_IMAGE
                        );
                    } else {
                        urlChain.push(DEFAULT_IMAGE);
                    }
                }
                
                if (urlChain.length > attemptCount) {
                    this.src = urlChain[attemptCount];
                } else {
                    this.src = DEFAULT_IMAGE;
                }
            };
        }
        
        container.appendChild(card);
    });
}

function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
        forceScrollToTopAggressive();
    } else {
        document.body.classList.remove('details-mode');
        forceScrollToTopAggressive();
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
            forceScrollToTopAggressive();
            fabricScrollTriggerActive = true;
        });
    });
}

function formatPriceRange(prices) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const formatOpts = { style: 'currency', currency: 'INR', maximumFractionDigits: 0 };
    const formattedMin = new Intl.NumberFormat('en-IN', formatOpts).format(minPrice);
    const formattedMax = new Intl.NumberFormat('en-IN', formatOpts).format(maxPrice);
    return minPrice === maxPrice ? formattedMin : `${formattedMin} - ${formattedMax}`;
}

// Display Full Details Dashboard Panel
function showProductDetails(product, { skipHistoryPush = false } = {}) {
    currentProduct = product;
    forceScrollToTopAggressive();

    if (!skipHistoryPush) {
        updateProductURL(product);
    }
    isDetailZoomed = false;
    updateDetailZoom();
    
    if (elements.detailImage) {
        elements.detailImage.src = getProductImageUrl(product, 2000);
        
        let attemptCount = 0;
        const urlChain = [];
        
        const fileId = extractDriveFileId(product.imageId || product["image id"]);
        if (fileId) {
            urlChain.push(
                buildProxyImageUrl(fileId, 2000),
                buildCdnImageUrl(fileId, 2000),
                buildDirectDriveUrl(fileId),
                buildDriveDownloadUrl(fileId),
                DEFAULT_IMAGE
            );
        } else {
            urlChain.push(DEFAULT_IMAGE);
        }
        
        elements.detailImage.onerror = function () {
            attemptCount++;
            if (urlChain.length > attemptCount) {
                this.src = urlChain[attemptCount];
            } else {
                this.src = DEFAULT_IMAGE;
            }
        };
    }
    
    if (elements.detailCode) elements.detailCode.textContent = `Fabric: ${product.fabric}`;
    if (elements.detailTitle) elements.detailTitle.textContent = product.title;
    
    if (elements.detailStock) {
        if (product.qty > 0) {
            elements.detailStock.textContent = 'Sacred Piece Available';
            elements.detailStock.style.backgroundColor = 'rgba(42, 107, 68, 0.09)';
            elements.detailStock.style.color = '#2A6B44';
            elements.detailStock.style.borderColor = 'rgba(42, 107, 68, 0.18)';
        } else {
            elements.detailStock.textContent = 'Acquired / In Private Vault';
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
    
    updateWishlistButtonState();
    showView("details");

    // Render similar price range products
    renderSimilarProducts(product);

    if (!navigationStack.length) {
        navigationStack.push(currentDepartment);
    }
    
    forceScrollToTopAggressive();
}

function updateDetailZoom() {
    if (!elements.detailImageSection || !elements.detailImage) return;
    if (isDetailZoomed) {
        elements.detailImageSection.classList.add('zoom-active');
    } else {
        elements.detailImageSection.classList.remove('zoom-active');
    }
}

// Full screen lightbox logic
function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;

    elements.overlayImage.src = getProductImageUrl(product, 2000);
    
    let attemptCount = 0;
    const urlChain = [];
    
    const fileId = extractDriveFileId(product.imageId || product["image id"]);
    if (fileId) {
        urlChain.push(
            buildProxyImageUrl(fileId, 2000),
            buildCdnImageUrl(fileId, 2000),
            buildDirectDriveUrl(fileId),
            buildDriveDownloadUrl(fileId),
            DEFAULT_IMAGE
        );
    } else {
        urlChain.push(DEFAULT_IMAGE);
    }
    
    elements.overlayImage.onerror = function () {
        attemptCount++;
        if (urlChain.length > attemptCount) {
            this.src = urlChain[attemptCount];
        } else {
            this.src = DEFAULT_IMAGE;
        }
    };
    
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

// Wishlist Controls
function toggleWishlist() {
    if (!currentProduct) return;
    const index = wishlist.findIndex(item => item.code === currentProduct.code);
    
    let action = "add"; // Track whether we are adding or removing
    if (index === -1) {
        wishlist.push(currentProduct);
        action = "add";
    } else {
        wishlist.splice(index, 1);
        action = "remove";
    }
    
    try {
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    } catch (e) {
        console.error("Error updating local storage", e);
    }
    
    updateWishlistCount();
    updateWishlistButtonState();

    // --- GOOGLE SHEETS WISHLIST TRACKING SYSTEM ---
    if (typeof WISHLIST_SHEET_URL !== 'undefined' && WISHLIST_SHEET_URL) {
        fetch(WISHLIST_SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: "wishlist",
                productCode: currentProduct.code || currentProduct.fabric,
                wishlistAction: action
            })
        })
        .then(() => console.log(`Google Sheets Wishlist updated: ${action} -> ${currentProduct.code || currentProduct.fabric}`))
        .catch(err => console.error("Error updating Google Sheets Wishlist:", err));
    }
    // ----------------------------------------------
}

// Purchase Integration with Automated Google Sheets Logging (Inventory Reduction Bypassed)
function handleBuyNow() {
    if (!currentProduct) return;
    
    // Prevent purchase if the product is already sold out (qty <= 0)
    if (currentProduct.qty <= 0) {
        alert("This masterpiece has already been acquired.");
        return;
    }

    const options = {
        "key": "YOUR_RAZORPAY_KEY_ID", // Replace with your actual Razorpay Key ID
        "amount": currentProduct.price * 100, // Amount in paise
        "currency": "INR",
        "name": "Kailash Kalamkari",
        "description": `Acquisition of Saree: ${currentProduct.code}`,
        "handler": function (response) {
            alert("Payment verified. Recording your order details...");

            // Send order details to WISHLIST_SHEET_URL (where your Wishlist and Orders sheets reside)
            fetch(WISHLIST_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: "place_order",
                    customerName: response.billing_name || "Customer",
                    customerEmail: response.billing_email || "Not Provided",
                    customerPhone: response.billing_phone || "Not Provided",
                    productCode: currentProduct.code,
                    amount: currentProduct.price,
                    paymentId: response.razorpay_payment_id
                })
            })
            .then(() => {
                alert("Order recorded successfully! We will connect with you shortly.");
                location.reload();
            })
            .catch(err => {
                console.error("Error writing order:", err);
                alert("Payment was successful, but we had trouble updating the logs. Please share your payment ID with us.");
            });
        },
        "theme": {
            "color": "#560b02" // Matching your Temple Crimson theme
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.open();
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

function updateWishlistButtonState() {
    if (!currentProduct || !elements.addToWishlistBtn) return;
    const isInWishlist = wishlist.some(item => item.code === currentProduct.code);
    
    if (isInWishlist) {
        elements.addToWishlistBtn.classList.add('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Remove from Gallery';
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

// Event Listeners Setup
function setupEventListeners() {
    if (elements.backToCatalogueBtn) {
        elements.backToCatalogueBtn.addEventListener('click', (e) => {
            e.preventDefault();
            forceScrollToTopAggressive();
            history.back();
        });
    }
    
    if (elements.backFromWishlistBtn) {
        elements.backFromWishlistBtn.addEventListener('click', () => {
            const url = new URL(window.location);
            url.searchParams.set('department', currentDepartment);
            url.hash = '';
            history.pushState(
                { type: 'department', department: currentDepartment },
                '',
                url
            );
            showView('catalogue');
            forceScrollToTopAggressive();
        });
    }
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            renderWishlist();
            showView('wishlist');
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', toggleWishlist);
    if (elements.buyNowBtn) elements.buyNowBtn.addEventListener('click', handleBuyNow);
    if (elements.searchInput) elements.searchInput.addEventListener('input', filterAndSearchProducts);

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            setDepartment(element.dataset.department);
            showView('catalogue');
            forceScrollToTopAggressive();
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

    window.addEventListener('scroll', () => {
        if (fabricScrollTriggerActive) {
            if (window.scrollY > 400) {
                forceScrollToTopAggressive();
                fabricScrollTriggerActive = false;
            }
        }
    });

    window.addEventListener('popstate', handlePopState);
}

function handlePopState(event) {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    
    let departmentParam = 'saree';
    if (event && event.state && event.state.department) {
        departmentParam = event.state.department;
    } else {
        departmentParam = params.get('department') || 'saree';
    }

    departmentParam = normalizeDepartment(departmentParam) || 'saree';

    if (hash.startsWith('#product/')) {
        const productCode = decodeURIComponent(hash.split('/')[1]);
        if (allProducts.length === 0) {
            fetchProducts().then(() => {
                const product = allProducts.find(p => p.code === productCode || p.fabric === productCode);
                if (product) {
                    showProductDetails(product, { skipHistoryPush: true });
                } else {
                    showView('catalogue');
                }
            });
        } else {
            const product = allProducts.find(p => p.code === productCode || p.fabric === productCode);
            if (product) {
                showProductDetails(product, { skipHistoryPush: true });
            } else {
                showView('catalogue');
            }
        }
    } else if (hash === '#wishlist') {
        showView('wishlist');
    } else {
        setDepartment(departmentParam, { updateUrl: false });
        updateDepartmentUI();
        showView('catalogue');
        forceScrollToTopAggressive();
    }
}

document.addEventListener('DOMContentLoaded', init);

function dismissalPremiumIntroScreen() {
    const loaderElement = document.getElementById('premium-intro-loader');
    if (loaderElement) {
        setTimeout(() => {
            loaderElement.classList.add('fade-out');
            setTimeout(() => {
                loaderElement.remove();
            }, 1200);
        }, 1500);
    }
}

function updateProductURL(product) {
    const url = new URL(window.location);
    url.searchParams.set("department", currentDepartment);
    url.hash = `product/${product.code}`;
    history.pushState(
        {
            type: "product",
            product: product.code,
            department: currentDepartment
        },
        "",
        url
    );
}

window.addEventListener('load', dismissalPremiumIntroScreen);

// Function to fetch and display products of a similar price range
function renderSimilarProducts(product) {
    const similarGrid = document.getElementById('similar-products-grid');
    if (!similarGrid) return;

    // 1. Filter out the current product, only selecting items from the same department
    const candidates = allProducts.filter(p => p.code !== product.code && p.departmentKey === product.departmentKey);

    // 2. Sort candidates by the absolute price difference (closest match first)
    candidates.sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price));

    // 3. Take the 3 closest products in price range
    const similarProducts = candidates.slice(0, 3);

    // 4. Render them using the existing clean grid rendering system
    renderProducts(similarProducts, similarGrid);
}

// Function to track unique website traffic sessions silently
function recordVisitorTraffic() {
    if (typeof WISHLIST_SHEET_URL !== 'undefined' && WISHLIST_SHEET_URL) {
        let sessionKey = sessionStorage.getItem('kalamkari_session');
        if (!sessionKey) {
            sessionKey = 'session_' + Math.random().toString(36).substring(2, 15);
            sessionStorage.setItem('kalamkari_session', sessionKey);
            
            fetch(WISHLIST_SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: "record_visitor",
                    sessionMarker: sessionKey
                })
            })
            .then(() => console.log("Visitor session logged."))
            .catch(err => console.error("Error recording visitor:", err));
        }
    }
}

// WhatsApp Inquiry Integration with Dynamic Product Details
function handleWhatsAppInquiry() {
    if (!currentProduct) return;
    
    const phoneNumber = "919063374020"; // Your WhatsApp Business Number
    
    // Create a personalized dynamic message
    const message = `Namaste, I am interested in inquiring about this Kalamkari masterpiece:

Saree Title: ${currentProduct.title}
Product Code: ${currentProduct.code}
Heritage Value: ₹${new Intl.NumberFormat('en-IN').format(currentProduct.price)}

Is this piece currently available in the workshop? Here is the link: ${window.location.href}`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Open WhatsApp safely in a new tab
    window.open(whatsappUrl, '_blank');
}