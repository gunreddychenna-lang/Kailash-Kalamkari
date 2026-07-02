const API_URL = 'https://script.google.com/macros/s/AKfycbzAXbuROmepx2ZwMM3vyj3wOivE5EOVlbsn59KAosQZPn3qoB0mFIgVWu-TeuJht3j1ng/exec';
const DEFAULT_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960"%3E%3Crect width="720" height="960" fill="%23F5EFE6"/%3E%3Ctext x="50%25" y="48%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="%23A67D5A"%3EImage+Not+Available%3C/text%3E%3C/svg%3E';

// === RESTORED ORIGINAL DIRECT IMAGE LINK VIEWING ===
function getProductImageUrl(product) {
    const rawUrl = product.imageLink || product.thumbnail || product.rawImageLink || '';
    if (!rawUrl || typeof rawUrl !== 'string') return DEFAULT_IMAGE;

    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.includes('googleusercontent.com')) {
        return trimmed;
    }

    if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
        const match = trimmed.match(/(?:id=|file\/d\/|\/d\/|\/document\/d\/)([\w-]+)/);
        const fileId = match ? match[1] : '';
        if (fileId) {
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
        }
    }

    return trimmed;
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

function setDepartment(department, { updateUrl = true, scrollToCatalogue = false } = {}) {
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
        window.history.pushState({ isDepartmentSelection: true }, '');
    }

    if (scrollToCatalogue) {
        document.getElementById('catalogue-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    viewWishlistBtn: document.getElementById('view-wishlist-btn') || document.getElementById('wishlist-trigger'),
    backToCatalogueBtn: document.getElementById('back-to-catalogue'),
    backFromWishlistBtn: document.getElementById('back-from-wishlist'),
    emptyWishlistMsg: document.getElementById('empty-wishlist') || document.getElementById('wishlist-empty'),
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
    addToWishlistBtn: document.getElementById('add-to-wishlist-btn') || document.getElementById('wishlist-btn'),
    wishlistBtnText: document.getElementById('wishlist-btn-text')
};

// Initialize
async function init() {
    updateWishlistCount();
    setupEventListeners();
    await fetchProducts();
    renderFilterButtons();
}

// Fetch Data
async function fetchProducts() {
    try {
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

            const code = String(getFieldValue(item, ['code', 'Code', 'style code', 'Style Code'])).trim();
            const fabric = String(getFieldValue(item, ['fabric', 'Fabric']) || 'Pure Silk').trim();
            const category = String(getFieldValue(item, ['category', 'Category']) || 'Uncategorized').trim();
            const department = String(getFieldValue(item, ['department', 'Department', 'dept', 'Dept', 'collection', 'Collection'])).trim();
            const departmentKey = normalizeDepartment(department) || inferDepartmentFromText(fabric, category, code) || 'saree';
            
            const imageLink = String(getFieldValue(item, ['image link', 'Image Link', 'drive link', 'Drive Link', 'imageLink', 'image', 'Image'])).trim();
            const thumbnail = String(getFieldValue(item, ['thumbnail', 'Thumbnail', 'thumbnail link', 'Thumbnail Link'])).trim() || imageLink;

            let rawQty = item.qty !== undefined && item.qty !== '' ? item.qty : (item.Qty !== undefined && item.Qty !== '' ? item.Qty : '');
            let qty = rawQty !== '' ? Number(rawQty) : 1;
            if (isNaN(qty)) qty = 1;

            return {
                code,
                fabric,
                category,
                department,
                departmentKey,
                price: parsePrice(item.price || item.Price || ''),
                qty: qty,
                imageLink,
                thumbnail,
                description: String(getFieldValue(item, ['description', 'Description', 'product description', 'Product Description', 'desc', 'Desc'])).trim()
            };
        }).filter(item => item.code);

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
        renderProducts(filteredProducts, elements.productGrid);
        calculatePriceRanges();
    } catch (error) {
        console.error('Error fetching data:', error);
        if (elements.spinner) {
            elements.spinner.textContent = 'Failed to load collection. Please try again later.';
        }
    }
}

// Render Product Grid
function renderProducts(products, container) {
    if (!container) return;
    container.innerHTML = '';
    
    if (products.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No products found matching your criteria.</p>';
        return;
    }
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.onclick = () => showProductDetails(product);

        if (product.qty <= 0) {
            card.classList.add('sold-out');
        }

        const formattedPrice = new Intl.NumberFormat('en-IN').format(product.price);

        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'product-image-wrapper';

        const img = document.createElement('img');
        img.alt = product.fabric;
        img.loading = 'lazy';
        img.src = getProductImageUrl(product);

        imageWrapper.appendChild(img);

        if (product.qty <= 0) {
            const badge = document.createElement('span');
            badge.className = 'sold-out-badge';
            badge.textContent = 'SOLD OUT';
            imageWrapper.appendChild(badge);
        }

        const info = document.createElement('div');
        info.className = 'product-info';
        const shortDescription = product.description ? `${String(product.description).trim().slice(0, 120)}${product.description.length > 120 ? '...' : ''}` : '';
        info.innerHTML = `
            <h3 class="product-title">${product.fabric}</h3>
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

// Full product details display
function showProductDetails(product) {
    currentProduct = product;
    isDetailZoomed = false;
    updateDetailZoom();
    
    if (elements.detailImage) {
        elements.detailImage.src = getProductImageUrl(product);
        elements.detailImage.title = 'Click to zoom';
    }
    
    if (elements.detailCode) elements.detailCode.textContent = `Code: ${product.code}`;
    if (elements.detailTitle) elements.detailTitle.textContent = product.fabric;
    
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

    elements.overlayImage.src = getProductImageUrl(product);
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

// Wishlist Logic
function toggleWishlist() {
    if (!currentProduct) return;
    const index = wishlist.findIndex(item => item.code === currentProduct.code);
    
    if (index === -1) {
        wishlist.push(currentProduct);
    } else {
        wishlist.splice(index, 1);
    }
    
    try {
        localStorage.setItem('kalamkariWishlist', JSON.stringify(wishlist));
    } catch (e) {
        console.error("Error saving wishlist to local storage", e);
    }
    
    updateWishlistCount();
    updateWishlistButtonState();
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

// Event Bindings
function setupEventListeners() {
    if (elements.backToCatalogueBtn) elements.backToCatalogueBtn.addEventListener('click', () => showView('catalogue'));
    if (elements.backFromWishlistBtn) elements.backFromWishlistBtn.addEventListener('click', () => showView('catalogue'));
    
    if (elements.viewWishlistBtn) {
        elements.viewWishlistBtn.addEventListener('click', () => {
            renderWishlist();
            showView('wishlist');
        });
    }
    
    if (elements.addToWishlistBtn) elements.addToWishlistBtn.addEventListener('click', toggleWishlist);
    if (elements.searchInput) elements.searchInput.addEventListener('input', filterAndSearchProducts);

    document.querySelectorAll('.collection-card, .department-btn').forEach(element => {
        element.addEventListener('click', () => {
            setDepartment(element.dataset.department, { scrollToCatalogue: true });
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

    window.addEventListener('popstate', () => {
        if (views.catalogue?.classList.contains('active')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    
    // === CONSOLE WARNING FIXED HERE ===
    // Swapped from pushState to replaceState during initialization setup context
    window.history.replaceState({ isDepartmentSelection: true }, '', window.location.href);
}

document.addEventListener('DOMContentLoaded', init);