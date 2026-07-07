const API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

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

// Helper: Build Google Drive download URL (sometimes has better CORS support)
function buildDriveDownloadUrl(fileId) {
    if (!fileId) return '';
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// Helper: Build proxy URL for Google Drive (best CORS support)
function buildProxyImageUrl(fileId, width = 800) {
    if (!fileId) return '';
    // Using public proxy services that work with Google Drive
    return `https://images.weserv.nl/?url=https://drive.google.com/uc?export=view%26id=${fileId}&w=${width}&fit=cover`;
}

// Main: Get product image with 7-tier fallback system
function getProductImageUrl(product, width = 800) {
    if (!product) return DEFAULT_IMAGE;

    // Try to get a file ID from various possible fields
    const imageLink = product.imageLink || product["image link"] || '';
    const imageId = product.imageId || product["image id"] || '';
    const image = product.image || '';
    const thumbnail = product.thumbnail || '';

    // Extract File ID from any source
    const fileId = extractDriveFileId(imageId) || 
                   extractDriveFileId(imageLink) || 
                   extractDriveFileId(image) ||
                   extractDriveFileId(thumbnail);

    // Build list of URLs to try (7-tier fallback system)
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

    // Return first valid source (browser will handle fallback if image fails to load)
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
        elements.searchInput.placeholder = `Search ${activeDepartment.label.toLowerCase()} by fabric name, design or colour...`;
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
        // Build the new URL for this department
        const url = new URL(window.location);
        url.searchParams.set('department', currentDepartment);
        url.hash = '';
        
        // Push to history for back button navigation
        history.pushState(
            { type: 'department', department: currentDepartment },
            '',
            url
        );
    }
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
// DOM Elements Link Map
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
};

// Initialize
async function init() {
    updateWishlistCount();
    setupEventListeners();
    await fetchProducts();
    
    const params = new URLSearchParams(window.location.search);
    const hashParam = window.location.hash;
    const departmentParam = params.get('department');
    
    // Detect if opening a shared product link directly
    const isDirectProductLink = hashParam.startsWith('#product/');
    
    if (isDirectProductLink) {
        const code = decodeURIComponent(hashParam.replace('#product/', ''));
        const product = allProducts.find(x => x.code === code);
        
        if (product) {
            currentDepartment = product.departmentKey;
            
            // For shared links, create history: department → product
            // This ensures back button takes them through history naturally
            if (history.length <= 1) {
                // Likely a direct link, create intermediate history entry
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
        // Normal catalog view
        const department = departmentParam || 'saree';
        setDepartment(department, { updateUrl: false });
        updateDepartmentUI();
    }
    
    renderFilterButtons();
    window.addEventListener('popstate', handlePopState);
}

// Fetch Data from Google Sheet JSON Endpoint
async function fetchProducts() {
    try {
        if (elements.spinner) elements.spinner.style.display = 'block';
        const response = await fetch(API_URL);
        const rawData = await response.json();
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

            // Maps cleanly to 'Fabric Name' header row properties directly
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
        
        // Debug logging for image URLs
        if (allProducts.length > 0) {
            const firstProd = allProducts[0];
            console.log('%c🖼️ FIRST PRODUCT DATA:', 'color: #FF6B6B; font-weight: bold; font-size: 14px', {
                code: firstProd.code,
                imageLink: firstProd.imageLink,
                thumbnail: firstProd.thumbnail,
                imageId: firstProd.imageId,
                rawImageLink: firstProd.imageLink ? firstProd.imageLink.substring(0, 100) : 'EMPTY'
            });
            
            const fileId = extractDriveFileId(firstProd.imageId || firstProd.imageLink);
            console.log('%c📝 EXTRACTED FILE ID:', 'color: #4ECDC4; font-weight: bold; font-size: 14px', fileId || '❌ FAILED TO EXTRACT');
            
            if (fileId) {
                const urls = {
                    'Proxy (CORS)': buildProxyImageUrl(fileId, 800),
                    'Google CDN': buildCdnImageUrl(fileId, 800),
                    'Google Drive Direct': buildDirectDriveUrl(fileId),
                    'Google Drive Download': buildDriveDownloadUrl(fileId)
                };
                console.log('%c🔗 GENERATED URLS:', 'color: #95E1D3; font-weight: bold; font-size: 14px', urls);
                
                const finalUrl = getProductImageUrl(firstProd);
                console.log('%c✅ FINAL URL USED:', 'color: #F38181; font-weight: bold; font-size: 14px', finalUrl.substring(0, 150) + '...');
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
        calculatePriceRanges();
    } catch (error) {
        console.error('Error fetching data:', error);
        if (elements.spinner) {
            elements.spinner.textContent = 'Failed to load collection. Please verify column headings setup.';
        }
    }
}

// Render Grid
// Replace the renderProducts function in script.js with this:
function renderProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">No items discovered.</p>';
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
                ${product.qty <= 0 ? '<span class="sold-out-badge">SOLD OUT</span>' : ''}
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-card-description">${product.description ? product.description.substring(0, 60) + '...' : ''}</p>
                <div class="product-price">Rs. ${formattedPrice}</div>
            </div>
        `;
        
        // Add error handler for image
        const img = card.querySelector('img');
        if (img) {
            let attemptCount = 0;
            const urlChain = [];
            
            img.onerror = function() {
                attemptCount++;
                const productCode = this.dataset.productCode;
                const prod = allProducts.find(p => p.code === productCode);
                
                if (prod && attemptCount === 1) {
                    // Build the full chain on first error
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
                
                // Try next URL in chain
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

// Ensure the detail view image updates correctly:
function showProductDetails(product) {
    currentProduct = product;
    window.location.hash = `product/${encodeURIComponent(product.code)}`;
    
    // Explicitly set the source
    const imgEl = document.getElementById('detail-image');
    if (imgEl) {
        imgEl.src = getProductImageUrl(product);
        imgEl.onerror = () => { imgEl.src = DEFAULT_IMAGE; };
    }
    
    document.getElementById('detail-title').textContent = product.title;
    document.getElementById('detail-code').textContent = `Style: ${product.code}`;
    document.getElementById('detail-description').textContent = product.description;
    document.getElementById('detail-price').textContent = `Rs. ${new Intl.NumberFormat('en-IN').format(product.price)}`;
    
    showView('details');
}

// Render Curated Connections
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
        renderProducts(higherPriced.slice(0, 4), similarContainer);
    } else {
        similarSection.style.display = 'none';
    }
}

function showView(viewName) {
    Object.values(views).forEach(v => v?.classList.remove('active'));
    views[viewName]?.classList.add('active');
    
    if (viewName === 'details') {
        document.body.classList.add('details-mode');
    } else {
        document.body.classList.remove('details-mode');
        window.scrollTo(0, 0);
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

// Display Full Details Dashboard Panel
function showProductDetails(product, { skipHistoryPush = false } = {}) {
    currentProduct = product;
    
    // Only push to history if not coming from back navigation
    if (!skipHistoryPush) {
        updateProductURL(product);
    }
    isDetailZoomed = false;
    updateDetailZoom();
    
    if (elements.detailImage) {
        elements.detailImage.src = getProductImageUrl(product, 2000);
        
        // Set up onerror handler to try fallback options if primary fails
        let attemptCount = 0;
        const urlChain = [];
        
        // Build URL chain on first load
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
            // Try next URL in chain
            if (urlChain.length > attemptCount) {
                this.src = urlChain[attemptCount];
            } else {
                this.src = DEFAULT_IMAGE;
                console.warn(`⚠️ Image failed to load after ${attemptCount} attempts for product:`, product.code);
            }
        };

        elements.detailImage.title = 'Click to view full screen texture';
    }
    
    // Updates UI dynamically to render clean Fabric labels perfectly
    if (elements.detailCode) elements.detailCode.textContent = `Fabric: ${product.fabric}`;
    if (elements.detailTitle) elements.detailTitle.textContent = product.title;
    
    if (elements.detailStock) {
        if (product.qty > 0) {
            elements.detailStock.textContent = 'Ready to dispatch';
            elements.detailStock.style.backgroundColor = 'rgba(42, 107, 68, 0.09)';
            elements.detailStock.style.color = '#2A6B44';
            elements.detailStock.style.borderColor = 'rgba(42, 107, 68, 0.18)';
        } else {
            elements.detailStock.textContent = 'Acquired / Sold Out';
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
    showView("details");

if (!navigationStack.length) {
    navigationStack.push(currentDepartment);
}
    
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

function openFullScreenImage(product) {
    if (!product || !elements.overlay || !elements.overlayImage) return;

    elements.overlayImage.src = getProductImageUrl(product, 2000);
    
    // Set up onerror handler to try fallback options if primary fails
    let attemptCount = 0;
    const urlChain = [];
    
    // Build URL chain on first load
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
        // Try next URL in chain
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

// Wishlist Controls
function toggleWishlist() {
    if (!currentProduct) return;
    const index = wishlist.findIndex(item => item.code === currentProduct.code || item.fabric === currentProduct.fabric);
    
    if (index === -1) {
        wishlist.push(currentProduct);
    } else {
        wishlist.splice(index, 1);
    }
    
    try {
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    } catch (e) {
        console.error("Error updating local storage key data", e);
    }
    
    updateWishlistCount();
    updateWishlistButtonState();
}

// Handle Buy Now button click
function handleBuyNow() {
    if (!currentProduct) {
        console.warn('No product selected for purchase');
        return;
    }
    
    // Prepare order data
    const orderData = {
        productCode: currentProduct.code,
        productName: currentProduct.title,
        fabric: currentProduct.fabric,
        price: currentProduct.price,
        quantity: 1,
        timestamp: new Date().toISOString()
    };
    
    console.log('📦 Purchase initiated:', orderData);
    
    // TODO: Integrate payment gateway here
    // Examples:
    // - Razorpay
    // - PayPal
    // - Stripe
    // - Google Pay
    // - PhonePe
    
    // For now, show a message
    const message = `Processing purchase for ${currentProduct.title}\nAmount: ₹${currentProduct.price}\n\nPayment gateway will be integrated soon!`;
    alert(message);
}

// Global Filter engine parsing
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
    const isInWishlist = wishlist.some(item => item.code === currentProduct.code || item.fabric === currentProduct.fabric);
    
    if (isInWishlist) {
        elements.addToWishlistBtn.classList.add('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Remove from Gallery';
    } else {
        elements.addToWishlistBtn.classList.remove('active');
        if (elements.wishlistBtnText) elements.wishlistBtnText.textContent = 'Acquire into Wishlist';
    }
}

function renderWishlist() {
    renderProducts(wishlist, elements.wishlistGrid);
    if (elements.emptyWishlistMsg) {
        elements.emptyWishlistMsg.style.display = wishlist.length === 0 ? 'block' : 'none';
    }
}

// Event Listeners Map Setup
function setupEventListeners() {
    // Back from product details - use browser history
    if (elements.backToCatalogueBtn) {
        elements.backToCatalogueBtn.addEventListener('click', () => {
            history.back();
        });
    }
    
    // Back from wishlist - go to catalogue view
    if (elements.backFromWishlistBtn) {
        elements.backFromWishlistBtn.addEventListener('click', () => {
            // Set department URL and show catalogue
            const url = new URL(window.location);
            url.searchParams.set('department', currentDepartment);
            url.hash = '';
            history.pushState(
                { type: 'department', department: currentDepartment },
                '',
                url
            );
            showView('catalogue');
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

function handlePopState(event) {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const departmentParam = params.get('department') || 'saree';
    
    // Check the state object to determine what view to show
    const state = event?.state || {};

    if (hash.startsWith('#product/')) {
        // Show product details
        const productCode = decodeURIComponent(hash.split('/')[1]);
        if (allProducts.length === 0) {
            fetchProducts().then(() => {
                const product = allProducts.find(p => p.code === productCode || p.fabric === productCode);
                if (product) {
                    currentDepartment = product.departmentKey;
                    showProductDetails(product, { skipHistoryPush: true });
                } else {
                    showView('catalogue');
                }
            });
        } else {
            const product = allProducts.find(p => p.code === productCode || p.fabric === productCode);
            if (product) {
                currentDepartment = product.departmentKey;
                showProductDetails(product, { skipHistoryPush: true });
            } else {
                showView('catalogue');
            }
        }
    } else if (hash === '#wishlist') {
        // Show wishlist
        showView('wishlist');
    } else {
        // Show catalog/department view
        setDepartment(departmentParam, { updateUrl: false });
        updateDepartmentUI();
        showView('catalogue');
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
        }, 1800);
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

function updateDepartmentHistory() {

    const url = new URL(window.location);

    url.searchParams.set("department", currentDepartment);

    url.hash = "";

    history.pushState(
        {
            type: "department",
            department: currentDepartment
        },
        "",
        url
    );

}

window.addEventListener('load', dismissalPremiumIntroScreen);