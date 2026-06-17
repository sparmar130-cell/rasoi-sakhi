// ==========================================================================
// RASOI SAKHI - PREMIUM SPA CLIENT ENGINE
// ==========================================================================

const API_BASE = '/api';
let ordersLimit = 50;

// Core State
let state = {
  products: [],
  testimonials: [],
  cart: JSON.parse(localStorage.getItem('rs_cart') || '[]'),
  currentCategory: 'all',
  searchQuery: '',
  selectedProduct: null,
  selectedWeight: null,
  selectedQty: 1,
  adminToken: localStorage.getItem('rs_admin_token') || null,
  adminSettings: null,
  knownOrderIds: new Set(),
  hasInitiallyLoadedOrders: false,
  modalHistoryPushed: false,
  totalOrders: 0
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  fetchProducts();
  fetchTestimonials();
  setupEventListeners();
  updateCartUI();
  prefillCheckoutForm();
  
  // Handle URL hash routing if present
  handleHashRoute();

  // Listen for browser forward/back navigation events
  window.addEventListener('hashchange', handleHashRoute);

  // Setup mobile-friendly bottom-sheet swipe logic
  setupSwipeToClose();

  // If already logged in, fetch admin details
  if (state.adminToken) {
    checkAdminAuth();
  }
}

// --- NETWORK CALLS ---
async function fetchProducts() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error("Could not fetch products");
    state.products = await res.json();
    renderProducts();
    renderPopularProducts();
  } catch (err) {
    console.error("Error fetching products:", err);
  }
}

async function fetchTestimonials() {
  try {
    const res = await fetch(`${API_BASE}/testimonials`);
    if (res.ok) {
      state.testimonials = await res.json();
      renderTestimonials();
    }
  } catch (err) {
    console.error("Error fetching testimonials:", err);
  }
}

// --- DYNAMIC SVG GENERATOR FOR VEGETABLES ---
// Creates bespoke inline SVGs so the app never relies on broken external image links
function getVeggieSVG(id, strokeColor = 'var(--color-primary)', width = '100%', height = '100%') {
  const svgs = {
    'onion-diced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="35" fill="hsl(325, 40%, 93%)" stroke="hsl(325, 60%, 40%)" stroke-width="3"/>
        <path d="M50 15v70M15 50h70" stroke="hsl(325, 60%, 45%)" stroke-width="1.5" stroke-dasharray="4 4"/>
        <circle cx="50" cy="50" r="22" stroke="hsl(325, 60%, 50%)" stroke-width="2"/>
        <rect x="28" y="28" width="12" height="12" rx="2" fill="hsl(325, 60%, 60%)" opacity="0.8"/>
        <rect x="60" y="28" width="12" height="12" rx="2" fill="hsl(325, 60%, 60%)" opacity="0.8"/>
        <rect x="28" y="60" width="12" height="12" rx="2" fill="hsl(325, 60%, 60%)" opacity="0.8"/>
        <rect x="60" y="60" width="12" height="12" rx="2" fill="hsl(325, 60%, 60%)" opacity="0.8"/>
      </svg>
    `,
    'onion-sliced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="50" cy="50" rx="40" ry="25" fill="hsl(325, 40%, 93%)" stroke="hsl(325, 60%, 45%)" stroke-width="3"/>
        <ellipse cx="50" cy="50" rx="30" ry="18" stroke="hsl(325, 65%, 50%)" stroke-width="2"/>
        <ellipse cx="50" cy="50" rx="18" ry="10" stroke="hsl(325, 70%, 60%)" stroke-width="1.5"/>
      </svg>
    `,
    'tomato-chopped': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="35" fill="hsl(0, 75%, 95%)" stroke="hsl(0, 75%, 45%)" stroke-width="3.5"/>
        <path d="M50 15c0 0-8 15-8 35s8 35 8 35" stroke="hsl(0, 75%, 45%)" stroke-width="1.5"/>
        <path d="M50 15c0 0 8 15 8 35s-8 35-8 35" stroke="hsl(0, 75%, 45%)" stroke-width="1.5"/>
        <circle cx="34" cy="42" r="4" fill="hsl(38, 85%, 60%)"/>
        <circle cx="34" cy="58" r="4" fill="hsl(38, 85%, 60%)"/>
        <circle cx="66" cy="42" r="4" fill="hsl(38, 85%, 60%)"/>
        <circle cx="66" cy="58" r="4" fill="hsl(38, 85%, 60%)"/>
        <path d="M28 32l10 8m-10 28l10-8m34-20l-10 8m10 20l-10-8" stroke="hsl(0, 75%, 40%)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
    'potato-cubes': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Cube 1 -->
        <path d="M25 40l20-10 20 10-20 10z" fill="hsl(40, 60%, 82%)" stroke="hsl(40, 50%, 60%)" stroke-width="2"/>
        <path d="M25 40v20l20 10V50z" fill="hsl(40, 50%, 75%)" stroke="hsl(40, 50%, 60%)" stroke-width="2"/>
        <path d="M65 40v20l-20 10V50z" fill="hsl(40, 40%, 68%)" stroke="hsl(40, 50%, 60%)" stroke-width="2"/>
        <!-- Cube 2 -->
        <path d="M60 65l15-8 15 8-15 8z" fill="hsl(40, 60%, 85%)" stroke="hsl(40, 50%, 60%)" stroke-width="1.5"/>
        <path d="M60 65v15l15 8V73z" fill="hsl(40, 50%, 78%)" stroke="hsl(40, 50%, 60%)" stroke-width="1.5"/>
        <path d="M90 65v15l-15 8V73z" fill="hsl(40, 40%, 70%)" stroke="hsl(40, 50%, 60%)" stroke-width="1.5"/>
      </svg>
    `,
    'bhindi-sliced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 15 L58 35 L78 35 L62 48 L68 68 L50 55 L32 68 L38 48 L22 35 L42 35 Z" fill="hsl(142, 60%, 93%)" stroke="hsl(142, 60%, 35%)" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="50" cy="43" r="15" stroke="hsl(142, 60%, 40%)" stroke-width="1" stroke-dasharray="2 2"/>
        <circle cx="50" cy="43" r="3" fill="white" stroke="hsl(142, 50%, 50%)" stroke-width="1.5"/>
        <circle cx="42" cy="37" r="3" fill="white" stroke="hsl(142, 50%, 50%)" stroke-width="1.5"/>
        <circle cx="58" cy="37" r="3" fill="white" stroke="hsl(142, 50%, 50%)" stroke-width="1.5"/>
        <circle cx="45" cy="50" r="3" fill="white" stroke="hsl(142, 50%, 50%)" stroke-width="1.5"/>
        <circle cx="55" cy="50" r="3" fill="white" stroke="hsl(142, 50%, 50%)" stroke-width="1.5"/>
      </svg>
    `,
    'cabbage-sliced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 50 C15 25 35 15 50 15 C75 15 85 35 85 55 C85 75 65 85 50 85 C30 85 15 70 15 50 Z" fill="hsl(120, 50%, 93%)" stroke="hsl(120, 45%, 35%)" stroke-width="2"/>
        <path d="M18 45 C35 30 50 35 82 35" stroke="hsl(120, 40%, 45%)" stroke-width="1.5"/>
        <path d="M25 60 C40 50 60 55 80 50" stroke="hsl(120, 40%, 45%)" stroke-width="1.5"/>
        <path d="M50 15 C48 35 52 65 50 85" stroke="hsl(120, 55%, 55%)" stroke-width="2"/>
        <path d="M30 30 C32 40 45 42 48 55" stroke="hsl(120, 40%, 45%)" stroke-width="1"/>
        <path d="M68 25 C62 38 55 45 52 60" stroke="hsl(120, 40%, 45%)" stroke-width="1"/>
      </svg>
    `,
    'loki-chopped': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="25" y="25" width="50" height="50" rx="15" fill="hsl(130, 55%, 93%)" stroke="hsl(130, 60%, 35%)" stroke-width="3"/>
        <circle cx="50" cy="50" r="15" fill="none" stroke="hsl(130, 40%, 60%)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="45" cy="45" r="2.5" fill="white" stroke="hsl(130, 40%, 55%)"/>
        <circle cx="55" cy="45" r="2.5" fill="white" stroke="hsl(130, 40%, 55%)"/>
        <circle cx="50" cy="56" r="2.5" fill="white" stroke="hsl(130, 40%, 55%)"/>
      </svg>
    `,
    'cucumber-chopped': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="35" fill="hsl(138, 50%, 94%)" stroke="hsl(145, 70%, 25%)" stroke-width="5"/>
        <path d="M50 15v70M15 50h70" stroke="hsl(138, 50%, 80%)" stroke-width="2"/>
        <circle cx="38" cy="38" r="2" fill="hsl(138, 40%, 50%)"/>
        <circle cx="62" cy="38" r="2" fill="hsl(138, 40%, 50%)"/>
        <circle cx="38" cy="62" r="2" fill="hsl(138, 40%, 50%)"/>
        <circle cx="62" cy="62" r="2" fill="hsl(138, 40%, 50%)"/>
      </svg>
    `,
    'cucumber-sliced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="35" fill="hsl(138, 50%, 94%)" stroke="hsl(145, 70%, 25%)" stroke-width="5"/>
        <circle cx="50" cy="50" r="22" stroke="hsl(138, 40%, 80%)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="50" cy="40" r="2.5" fill="white" stroke="hsl(138, 55%, 45%)" stroke-width="1"/>
        <circle cx="42" cy="47" r="2.5" fill="white" stroke="hsl(138, 55%, 45%)" stroke-width="1"/>
        <circle cx="58" cy="47" r="2.5" fill="white" stroke="hsl(138, 55%, 45%)" stroke-width="1"/>
        <circle cx="45" cy="56" r="2.5" fill="white" stroke="hsl(138, 55%, 45%)" stroke-width="1"/>
        <circle cx="55" cy="56" r="2.5" fill="white" stroke="hsl(138, 55%, 45%)" stroke-width="1"/>
      </svg>
    `,
    'carrot-cubes': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 40l20-10 20 10-20 10z" fill="hsl(28, 95%, 65%)" stroke="hsl(28, 85%, 45%)" stroke-width="2"/>
        <path d="M25 40v20l20 10V50z" fill="hsl(28, 85%, 55%)" stroke="hsl(28, 85%, 45%)" stroke-width="2"/>
        <path d="M65 40v20l-20 10V50z" fill="hsl(28, 75%, 48%)" stroke="hsl(28, 85%, 45%)" stroke-width="2"/>
      </svg>
    `,
    'carrot-sliced': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="35" fill="hsl(28, 95%, 63%)" stroke="hsl(28, 90%, 45%)" stroke-width="3"/>
        <circle cx="50" cy="50" r="25" stroke="hsl(28, 85%, 55%)" stroke-width="2" stroke-dasharray="4 2"/>
        <path d="M50 25 C48 35 48 45 50 75" stroke="hsl(28, 90%, 45%)" stroke-width="1.5"/>
      </svg>
    `,
    'peas': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 50 C25 25 75 25 85 50 C75 75 25 75 15 50 Z" fill="hsl(142, 50%, 88%)" stroke="hsl(142, 60%, 35%)" stroke-width="2"/>
        <circle cx="32" cy="50" r="10" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1.5"/>
        <circle cx="50" cy="50" r="10" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1.5"/>
        <circle cx="68" cy="50" r="10" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1.5"/>
      </svg>
    `,
    'capsicum-chopped': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 15 C30 12 15 25 15 50 C15 70 30 85 50 85 C70 85 85 70 85 50 C85 25 70 12 50 15 Z" fill="hsl(135, 55%, 90%)" stroke="hsl(135, 65%, 28%)" stroke-width="3"/>
        <path d="M48 15 C38 25 38 45 42 75M52 15 C62 25 62 45 58 75" stroke="hsl(135, 60%, 40%)" stroke-width="1.5"/>
        <rect x="30" y="35" width="10" height="10" fill="hsl(135, 60%, 45%)" opacity="0.8"/>
        <rect x="60" y="45" width="10" height="10" fill="hsl(135, 60%, 45%)" opacity="0.8"/>
      </svg>
    `,
    // Ready to Cook Packages
    'pav-bhaji-pack': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="hsl(40, 30%, 95%)" stroke="hsl(40, 20%, 70%)" stroke-width="3"/>
        <!-- Potato Cube -->
        <rect x="25" y="32" width="15" height="15" fill="hsl(40, 60%, 80%)" stroke="hsl(40, 50%, 60%)" stroke-width="1"/>
        <!-- Tomato chunk -->
        <circle cx="48" cy="36" r="8" fill="hsl(0, 75%, 60%)" stroke="hsl(0, 75%, 45%)" stroke-width="1"/>
        <!-- Peas -->
        <circle cx="70" cy="38" r="6" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1"/>
        <circle cx="62" cy="48" r="6" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1"/>
        <!-- Carrot cube -->
        <rect x="30" y="55" width="14" height="14" fill="hsl(28, 95%, 60%)" stroke="hsl(28, 85%, 45%)" stroke-width="1"/>
        <!-- Onion slice -->
        <ellipse cx="52" cy="62" rx="14" ry="7" fill="none" stroke="hsl(325, 60%, 50%)" stroke-width="1.5"/>
      </svg>
    `,
    'biryani-pack': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="hsl(40, 30%, 95%)" stroke="hsl(40, 20%, 70%)" stroke-width="3"/>
        <!-- Mint leaf -->
        <path d="M35 30c0 10 15 15 15 15s-5-15-15-15z" fill="hsl(142, 60%, 40%)" stroke="hsl(142, 60%, 25%)" stroke-width="1"/>
        <!-- Carrot julienne -->
        <rect x="58" y="28" width="5" height="20" rx="2" fill="hsl(28, 95%, 60%)" stroke="hsl(28, 85%, 45%)" stroke-width="1" transform="rotate(30 58 28)"/>
        <!-- French Bean -->
        <rect x="25" y="52" width="6" height="22" rx="3" fill="hsl(130, 60%, 38%)" stroke="hsl(130, 60%, 25%)" stroke-width="1" transform="rotate(-45 25 52)"/>
        <!-- Peas -->
        <circle cx="68" cy="58" r="6" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1"/>
        <!-- Sliced onion -->
        <ellipse cx="50" cy="68" rx="15" ry="8" fill="none" stroke="hsl(325, 60%, 50%)" stroke-width="1.5"/>
      </svg>
    `,
    'mixed-veg-pack': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="hsl(40, 30%, 95%)" stroke="hsl(40, 20%, 70%)" stroke-width="3"/>
        <rect x="25" y="28" width="12" height="12" fill="hsl(40, 60%, 80%)" stroke="hsl(40, 50%, 60%)" stroke-width="1"/>
        <rect x="42" y="26" width="12" height="12" fill="hsl(28, 95%, 60%)" stroke="hsl(28, 85%, 45%)" stroke-width="1"/>
        <circle cx="68" cy="34" r="6" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1"/>
        <!-- French bean chunk -->
        <rect x="22" y="55" width="6" height="18" fill="hsl(130, 60%, 38%)" stroke="hsl(130, 60%, 25%)" stroke-width="1" transform="rotate(45 22 55)"/>
        <!-- Cauliflower floret -->
        <path d="M50 55c-4 0-7 3-7 7s6 8 7 8 7-4 7-8-3-7-7-7z" fill="white" stroke="hsl(40, 10%, 60%)" stroke-width="1"/>
        <circle cx="68" cy="62" r="6" fill="hsl(142, 60%, 45%)" stroke="hsl(142, 60%, 30%)" stroke-width="1"/>
      </svg>
    `,
    'stir-fry-pack': `
      <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="40" fill="hsl(40, 30%, 95%)" stroke="hsl(40, 20%, 70%)" stroke-width="3"/>
        <!-- Julienne slices crosswise -->
        <line x1="25" y1="35" x2="55" y2="25" stroke="hsl(28, 95%, 60%)" stroke-width="2" stroke-linecap="round"/>
        <line x1="30" y1="45" x2="60" y2="40" stroke="hsl(135, 65%, 28%)" stroke-width="2" stroke-linecap="round"/>
        <line x1="25" y1="58" x2="50" y2="62" stroke="hsl(120, 45%, 35%)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="45" y1="68" x2="75" y2="60" stroke="hsl(120, 45%, 35%)" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="50" y1="30" x2="72" y2="48" stroke="hsl(28, 95%, 60%)" stroke-width="2" stroke-linecap="round"/>
        <line x1="40" y1="52" x2="70" y2="35" stroke="hsl(135, 65%, 28%)" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `
  };

  // Fallback if ID is custom or not configured yet
  const fallback = `
    <svg viewBox="0 0 100 100" width="${width}" height="${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="38" fill="hsl(142, 60%, 96%)" stroke="${strokeColor}" stroke-width="2"/>
      <path d="M35 50 C35 35 65 35 65 50 C65 65 35 65 35 50 Z" fill="hsl(142, 60%, 80%)" stroke="${strokeColor}" stroke-width="2"/>
      <path d="M50 20c0 10-6 12-6 12s8-1 8-12z" fill="${strokeColor}"/>
    </svg>
  `;

  return svgs[id] || fallback;
}

// Helper to load generated veggie images or fallback to inline SVGs
function getProductVisualHTML(imageName, name, cssStyles = 'width: 100%; height: 100%; object-fit: cover;') {
  if (imageName && (imageName.startsWith('http') || imageName.startsWith('/assets/'))) {
    return `<img src="${imageName}" alt="${name}" style="${cssStyles}">`;
  }

  const knownImages = [
    'onion-diced', 'tomato-chopped', 'potato-cubes', 'bhindi-sliced', 'peas', 'pav-bhaji-pack', 'mixed-veg-pack',
    'cabbage-sliced', 'loki-chopped', 'cucumber-sliced', 'carrot-cubes', 'capsicum-chopped', 'biryani-pack', 'stir-fry-pack'
  ];
  if (knownImages.includes(imageName)) {
    return `<img src="/assets/${imageName}.png" alt="${name}" style="${cssStyles}">`;
  }
  // Fallback to inline SVG
  return `<div style="width: 50%; height: 50%; display: flex; align-items: center; justify-content: center;">${getVeggieSVG(imageName)}</div>`;
}

// --- RENDERING SCRIPTS ---

// Renders the shop product grid
function renderProducts() {
  const listEl = document.getElementById('shop-products-list');
  if (!listEl) return;

  const filtered = state.products.filter(p => {
    const matchesCategory = state.currentCategory === 'all' || p.category === state.currentCategory;
    const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(state.searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (!filtered.length) {
    listEl.innerHTML = `<div class="w-100" style="grid-column: 1/-1; text-align: center; color: var(--color-text-muted); padding: 40px 0;">No vegetables found matching your query.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(p => {
    const isPopular = p.popular ? `<span class="popular-badge">Popular</span>` : '';
    const visualHTML = getProductVisualHTML(p.image, p.name);
    const baseWeightStr = p.weightOptions && p.weightOptions.length ? p.weightOptions[0].weight : p.baseWeight;
    const cartItem = state.cart.find(item => item.id === p.id && item.weight === baseWeightStr);
    const qty = cartItem ? cartItem.quantity : 0;
    
    let actionHTML = '';
    if (p.soldOut) {
      actionHTML = `<span class="sold-out-badge">Sold Out</span>`;
    } else if (qty > 0) {
      actionHTML = `
        <div class="product-qty-controller">
          <button class="qty-btn dec" data-id="${p.id}" data-weight="${baseWeightStr}">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn inc" data-id="${p.id}" data-weight="${baseWeightStr}">+</button>
        </div>
      `;
    } else {
      actionHTML = `
        <div class="add-to-cart-trigger" data-id="${p.id}" aria-label="Add to cart">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      `;
    }

    const soldOutClass = p.soldOut ? 'sold-out' : '';

    return `
      <div class="product-item ${soldOutClass}" data-id="${p.id}">
        <div class="product-visual">
          ${isPopular}
          ${visualHTML}
        </div>
        <div class="product-details">
          <span class="product-category">${p.category === 'ready_to_cook' ? 'Ready-To-Cook Pack' : 'Fresh Cut Essential'}</span>
          <h3 class="product-name">${p.name}</h3>
          <p class="product-desc-short">${p.description}</p>
          <div class="product-purchase">
            <span class="product-price">₹${p.price}<span class="product-weight">/ ${p.baseWeight}</span></span>
            ${actionHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Renders the Popular Products section on Home
function renderPopularProducts() {
  const container = document.getElementById('popular-products-list');
  if (!container) return;

  const popular = state.products.filter(p => p.popular).slice(0, 4);

  container.innerHTML = popular.map(p => {
    const visualHTML = getProductVisualHTML(p.image, p.name);
    const baseWeightStr = p.weightOptions && p.weightOptions.length ? p.weightOptions[0].weight : p.baseWeight;
    const cartItem = state.cart.find(item => item.id === p.id && item.weight === baseWeightStr);
    const qty = cartItem ? cartItem.quantity : 0;
    
    let actionHTML = '';
    if (p.soldOut) {
      actionHTML = `<span class="sold-out-badge">Sold Out</span>`;
    } else if (qty > 0) {
      actionHTML = `
        <div class="product-qty-controller">
          <button class="qty-btn dec" data-id="${p.id}" data-weight="${baseWeightStr}">-</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn inc" data-id="${p.id}" data-weight="${baseWeightStr}">+</button>
        </div>
      `;
    } else {
      actionHTML = `
        <div class="add-to-cart-trigger" data-id="${p.id}">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      `;
    }

    const soldOutClass = p.soldOut ? 'sold-out' : '';

    return `
      <div class="product-item ${soldOutClass}" data-id="${p.id}">
        <div class="product-visual">
          <span class="popular-badge">Popular</span>
          ${visualHTML}
        </div>
        <div class="product-details">
          <span class="product-category">${p.category === 'ready_to_cook' ? 'Ready-To-Cook Pack' : 'Fresh Cut Essential'}</span>
          <h3 class="product-name">${p.name}</h3>
          <p class="product-desc-short">${p.description}</p>
          <div class="product-purchase">
            <span class="product-price">₹${p.price}<span class="product-weight">/ ${p.baseWeight}</span></span>
            ${actionHTML}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Renders the client reviews
function renderTestimonials() {
  const container = document.getElementById('testimonials-container');
  if (!container) return;

  container.innerHTML = state.testimonials.map(t => {
    const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
    return `
      <div class="testimonial-card">
        <div class="quote-icon">“</div>
        <p class="testimonial-quote">${t.quote}</p>
        <div class="testimonial-stars">${stars}</div>
        <h4 class="testimonial-author">${t.name}</h4>
        <span class="testimonial-role">${t.role}</span>
      </div>
    `;
  }).join('');
}

// Cart drawer open/close — module-level so sticky bar can also call them
function openCartDrawer() {
  document.getElementById('cart-drawer').classList.add('open');
  // Hide the sticky bar so it doesn't cover the Order Now button
  const stickyBar = document.getElementById('rs-sticky-cart-bar');
  if (stickyBar) stickyBar.classList.add('drawer-hidden');
}

function closeCartDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  // Restore sticky bar if cart still has items
  const stickyBar = document.getElementById('rs-sticky-cart-bar');
  if (stickyBar) stickyBar.classList.remove('drawer-hidden');
}

// --- EVENT LISTENERS setup ---
function setupEventListeners() {
  
  // Navigation Tabs Switching (for desktop nav and mobile bottom nav)
  const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target') || link.dataset.target;
      const scrollTo = link.getAttribute('data-scroll'); // e.g. 'inline-shop'
      const href = link.getAttribute('href');
      
      if (target) {
        if (target === 'home-section') {
          if (scrollTo) {
            window.location.hash = `#${scrollTo}`;
          } else if (href && href.startsWith('#') && href.length > 1) {
            window.location.hash = href;
          } else {
            window.location.hash = '';
          }
        } else {
          window.location.hash = `#${target.replace('-section', '')}`;
        }
      }
    });
  });

  // Logo Button
  document.getElementById('header-logo-btn').addEventListener('click', () => {
    window.location.hash = '';
  });

  // Home CTA Buttons
  document.getElementById('hero-shop-btn').addEventListener('click', () => {
    // Scroll to the inline shop catalog on the landing page
    const inlineShop = document.getElementById('inline-shop');
    if (inlineShop) inlineShop.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('hero-process-btn').addEventListener('click', () => {
    window.location.hash = '#process';
  });
  // view-all-shop-btn removed (popular products section commented out)

  // Shop Categories
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentCategory = tab.dataset.category;
      renderProducts();
    });
  });

  // Shop Search input
  const searchInput = document.getElementById('shop-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderProducts();
    });
  }

  // Delegate Product Item Clicking (opens detail modal or manages quantity)
  document.addEventListener('click', (e) => {
    const productCard = e.target.closest('.product-item');
    const isCartTrigger = e.target.closest('.add-to-cart-trigger');
    const isQtyDec = e.target.closest('.product-qty-controller .qty-btn.dec');
    const isQtyInc = e.target.closest('.product-qty-controller .qty-btn.inc');
    const isQtyController = e.target.closest('.product-qty-controller');
    
    if (isQtyDec) {
      e.stopPropagation();
      const prodId = isQtyDec.dataset.id;
      const weight = isQtyDec.dataset.weight;
      updateCartQty(prodId, weight, -1);
    } else if (isQtyInc) {
      e.stopPropagation();
      const prodId = isQtyInc.dataset.id;
      const weight = isQtyInc.dataset.weight;
      updateCartQty(prodId, weight, 1);
    } else if (isQtyController) {
      e.stopPropagation();
    } else if (isCartTrigger) {
      e.stopPropagation();
      const prodId = isCartTrigger.dataset.id;
      quickAddToCart(prodId);
    } else if (productCard) {
      const prodId = productCard.dataset.id;
      openProductDetails(prodId);
    }
  });

  // Cart Drawer opening and closing
  const cartDrawer = document.getElementById('cart-drawer');

  document.getElementById('cart-toggle-btn').addEventListener('click', openCartDrawer);
  // bottom-cart-btn removed from DOM — cart is only in top header now
  document.getElementById('cart-close-btn').addEventListener('click', closeCartDrawer);

  // Close overlays when clicking background
  cartDrawer.addEventListener('click', (e) => {
    if (e.target === cartDrawer) closeCartDrawer();
  });

  const detailModal = document.getElementById('product-detail-modal');
  document.getElementById('product-modal-close-btn').addEventListener('click', () => {
    closeProductDetails();
  });
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeProductDetails();
  });

  // Terms and Privacy Modals Event Listeners
  const termsModal = document.getElementById('terms-modal');
  const privacyModal = document.getElementById('privacy-modal');

  document.getElementById('footer-terms-btn').addEventListener('click', (e) => {
    e.preventDefault();
    termsModal.classList.add('open');
  });
  document.getElementById('footer-privacy-btn').addEventListener('click', (e) => {
    e.preventDefault();
    privacyModal.classList.add('open');
  });

  document.getElementById('terms-close-btn').addEventListener('click', () => {
    termsModal.classList.remove('open');
  });
  document.getElementById('privacy-close-btn').addEventListener('click', () => {
    privacyModal.classList.remove('open');
  });

  termsModal.addEventListener('click', (e) => {
    if (e.target === termsModal) termsModal.classList.remove('open');
  });
  privacyModal.addEventListener('click', (e) => {
    if (e.target === privacyModal) privacyModal.classList.remove('open');
  });

  // Product detail modal quantity changes
  document.getElementById('detail-qty-inc').addEventListener('click', () => {
    state.selectedQty++;
    document.getElementById('detail-qty-val').innerText = state.selectedQty;
    updateDetailPrice();
  });
  document.getElementById('detail-qty-dec').addEventListener('click', () => {
    if (state.selectedQty > 1) {
      state.selectedQty--;
      document.getElementById('detail-qty-val').innerText = state.selectedQty;
      updateDetailPrice();
    }
  });

  // Product detail add to cart
  document.getElementById('detail-add-to-cart-btn').addEventListener('click', () => {
    if (!state.selectedProduct || !state.selectedWeight) return;
    addToCart(state.selectedProduct.id, state.selectedWeight.weight, state.selectedWeight.price, state.selectedQty);
    closeProductDetails();
  });

  // Checkout Form Submission
  document.getElementById('checkout-form').addEventListener('submit', handleCheckoutSubmit);

  // UPI payment instruction visibility
  document.getElementById('cust-payment').addEventListener('change', (e) => {
    const isUPI = e.target.value === 'UPI Payment';
    document.getElementById('checkout-upi-helper').classList.toggle('hide', !isUPI);
  });

  // Admin login button triggers — header (desktop) + bottom nav (mobile)
  document.getElementById('admin-login-trigger').addEventListener('click', () => {
    window.location.hash = '#admin';
  });
  const adminHeaderBtn = document.getElementById('admin-header-btn');
  if (adminHeaderBtn) {
    adminHeaderBtn.addEventListener('click', () => {
      window.location.hash = '#admin';
    });
  }

  // Contact form submission
  const contactForm = document.getElementById('contact-us-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const statusEl = document.getElementById('contact-form-status');
      statusEl.className = 'form-status success';
      statusEl.innerText = 'Thank you! Your message has been sent successfully.';
      contactForm.reset();
    });
  }

  // Save form details dynamically as the user types
  const formFields = ['cust-name', 'cust-phone', 'cust-email', 'cust-address', 'cust-landmark', 'cust-slot', 'cust-payment'];
  formFields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.addEventListener('input', saveFormDetailsToLocalStorage);
      el.addEventListener('change', saveFormDetailsToLocalStorage);
    }
  });

  // Setup admin panel controls
  setupAdminListeners();
}

// Switch SPA View Panel
function switchView(targetId) {
  // Update state/navigation links active statuses
  const navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
  navLinks.forEach(link => {
    const linkTarget = link.getAttribute('data-target') || link.dataset.target;
    if (linkTarget === targetId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update views
  const sections = document.querySelectorAll('.view-section');
  sections.forEach(sec => {
    if (sec.id === targetId) {
      sec.style.display = 'block';
      setTimeout(() => sec.classList.add('active'), 50);
    } else {
      sec.classList.remove('active');
      sec.style.display = 'none';
    }
  });

  // Scroll to top when changing page
  window.scrollTo({ top: 0, behavior: 'instant' });

  // Update URL hash using replaceState ONLY if called programmatically and it differs
  if (targetId === 'home-section') {
    if (window.location.hash !== '' && window.location.hash !== '#') {
      history.replaceState(null, '', ' ');
    }
  } else {
    const expectedHash = `#${targetId.replace('-section', '')}`;
    if (window.location.hash !== expectedHash) {
      history.replaceState(null, '', expectedHash);
    }
  }

  // Fetch admin stats if switching to dashboard
  if (targetId === 'admin-section' && state.adminToken) {
    loadAdminDashboard();
  }

  // Update sticky cart bar visibility based on active page
  updateStickyCartBar();
}

function handleHashRoute() {
  const hash = window.location.hash;
  if (!hash) {
    switchView('home-section');
    return;
  }

  // #shop now lives inline on the home page
  if (hash === '#shop') {
    switchView('home-section');
    setTimeout(() => {
      const el = document.getElementById('inline-shop');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return;
  }

  // Handle home section anchor points (e.g., #process)
  if (['#process', '#features', '#about', '#hero'].includes(hash)) {
    switchView('home-section');
    setTimeout(() => {
      const el = document.getElementById(hash.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return;
  }

  const targetId = `${hash.slice(1)}-section`;
  const view = document.getElementById(targetId);
  if (view) {
    switchView(targetId);
  } else {
    switchView('home-section');
  }
}

// --- PRODUCT DETAIL BOTTOM SHEET LOGIC ---
function openProductDetails(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  state.selectedProduct = product;
  state.selectedQty = 1;
  state.selectedWeight = product.weightOptions[0];

  // Populate HTML elements
  document.getElementById('detail-title').innerText = product.name;
  document.getElementById('detail-category').innerText = product.category === 'ready_to_cook' ? 'Ready-To-Cook Pack' : 'Fresh Cut Essential';
  document.getElementById('detail-desc').innerText = product.description;
  document.getElementById('detail-freshness').innerText = product.freshnessInfo;
  document.getElementById('detail-storage').innerText = product.storageInstructions;
  document.getElementById('detail-qty-val').innerText = state.selectedQty;
  
  // Popular badge
  document.getElementById('detail-popular-badge').classList.toggle('hide', !product.popular);

  // Image or SVG graphic injection
  document.getElementById('detail-graphic').innerHTML = getProductVisualHTML(product.image, product.name);

  // Weight Options Buttons
  const optContainer = document.getElementById('detail-weight-options');
  optContainer.innerHTML = product.weightOptions.map((opt, i) => {
    const isSelected = i === 0 ? 'selected' : '';
    return `<button class="weight-btn ${isSelected}" data-index="${i}">${opt.weight}</button>`;
  }).join('');

  // Add click handlers to weight buttons
  optContainer.querySelectorAll('.weight-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      optContainer.querySelectorAll('.weight-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      
      const index = parseInt(btn.dataset.index);
      state.selectedWeight = product.weightOptions[index];
      updateDetailPrice();
    });
  });

  // Handle Sold Out state in modal
  const btn = document.getElementById('detail-add-to-cart-btn');
  const qtyDec = document.getElementById('detail-qty-dec');
  const qtyInc = document.getElementById('detail-qty-inc');
  
  if (product.soldOut) {
    btn.innerText = "Sold Out";
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
    qtyDec.style.opacity = '0.5';
    qtyDec.style.pointerEvents = 'none';
    qtyInc.style.opacity = '0.5';
    qtyInc.style.pointerEvents = 'none';
  } else {
    btn.innerText = "Add to Cart";
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
    qtyDec.style.opacity = '1';
    qtyDec.style.pointerEvents = 'auto';
    qtyInc.style.opacity = '1';
    qtyInc.style.pointerEvents = 'auto';
  }

  updateDetailPrice();
  
  // Push state to handle back button close
  if (!state.modalHistoryPushed) {
    history.pushState({ modal: 'product-detail' }, '');
    state.modalHistoryPushed = true;
  }

  document.getElementById('product-detail-modal').classList.add('open');
}

function updateDetailPrice() {
  if (!state.selectedWeight) return;
  const total = state.selectedWeight.price * state.selectedQty;
  document.getElementById('detail-price').innerText = `₹${total}`;
}

// --- CART STATE LOGIC ---

// Triggers immediately when clicking "+" in card
function quickAddToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  
  // Default to first weight option
  const opt = product.weightOptions[0];
  addToCart(product.id, opt.weight, opt.price, 1);
  
  // Trigger micro-animation on shopping cart icon
  const cartTrigger = document.getElementById('cart-toggle-btn');
  cartTrigger.style.transform = 'scale(1.25)';
  setTimeout(() => cartTrigger.style.transform = 'none', 200);
}

// Persistent sticky "Proceed to Buy" bar — shows whenever cart has items
function updateStickyCartBar() {
  let bar = document.getElementById('rs-sticky-cart-bar');

  // Create bar if it doesn't exist yet
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'rs-sticky-cart-bar';
    bar.innerHTML = `
      <div id="rs-sticky-cart-info">
        <span id="rs-sticky-cart-count"></span>
        <span id="rs-sticky-cart-total"></span>
      </div>
      <button id="rs-sticky-cart-btn">
        Proceed to Buy &rarr;
      </button>
    `;
    document.body.appendChild(bar);

    // Wire up button AFTER appending — calls openCartDrawer() to properly hide the bar
    document.getElementById('rs-sticky-cart-btn').addEventListener('click', () => {
      openCartDrawer();
    });
  }

  const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const homeSec = document.getElementById('home-section');
  const isHome = homeSec ? (homeSec.classList.contains('active') || homeSec.style.display === 'block') : true;

  if (totalItems === 0 || !isHome) {
    // Hide bar when cart is empty or not on home page
    bar.classList.remove('visible');
  } else {
    // Update and show
    document.getElementById('rs-sticky-cart-count').textContent = `${totalItems} item${totalItems > 1 ? 's' : ''} in cart`;
    document.getElementById('rs-sticky-cart-total').textContent = `\u20b9${totalPrice}`;
    bar.classList.add('visible');
  }
}

// Legacy toast — no longer used (replaced by persistent sticky bar)
function showAddedToast(productName) {
  // Kept for reference — now using updateStickyCartBar instead
}

function addToCart(productId, weight, price, quantity) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existingIndex = state.cart.findIndex(item => item.id === productId && item.weight === weight);

  if (existingIndex !== -1) {
    state.cart[existingIndex].quantity += quantity;
  } else {
    state.cart.push({
      id: productId,
      name: product.name,
      weight: weight,
      price: price,
      quantity: quantity
    });
  }

  saveCart();
  updateCartUI();

  // Show a toast with "Proceed to Cart" instead of auto-opening the drawer
  showAddedToast(product.name);
}

function updateCartQty(productId, weight, amount) {
  const index = state.cart.findIndex(item => item.id === productId && item.weight === weight);
  if (index === -1) return;

  state.cart[index].quantity += amount;
  if (state.cart[index].quantity <= 0) {
    state.cart.splice(index, 1);
  }
  
  saveCart();
  updateCartUI();
}

function removeCartItem(productId, weight) {
  state.cart = state.cart.filter(item => !(item.id === productId && item.weight === weight));
  saveCart();
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('rs_cart', JSON.stringify(state.cart));
}

// Sync counts and totals
function updateCartUI() {
  // Sync quantity controllers on product cards
  renderProducts();
  renderPopularProducts();

  // Update Cart Badge counts
  const totalItemsCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-count').forEach(el => {
    el.innerText = totalItemsCount;
    el.classList.toggle('hide', totalItemsCount === 0);
  });

  // Update the persistent sticky "Proceed to Buy" bar
  updateStickyCartBar();

  const cartList = document.getElementById('cart-items-list');
  const summaryWrap = document.getElementById('cart-summary-wrapper');
  
  if (!cartList) return;

  if (state.cart.length === 0) {
    cartList.innerHTML = `<div style="text-align: center; color: var(--color-text-muted); padding: 40px 0;">Your cart is empty. Let's browse products!</div>`;
    summaryWrap.classList.add('hide');
    return;
  }

  summaryWrap.classList.remove('hide');

  // Render items list
  cartList.innerHTML = state.cart.map(item => {
    const itemTotal = item.price * item.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-details">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-meta">${item.weight} x ₹${item.price}</span>
          <span class="cart-item-price">₹${itemTotal}</span>
        </div>
        <div class="cart-item-actions">
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="updateCartQty('${item.id}', '${item.weight}', -1)">-</button>
            <span>${item.quantity}</span>
            <button class="cart-qty-btn" onclick="updateCartQty('${item.id}', '${item.weight}', 1)">+</button>
          </div>
          <span class="cart-item-remove" onclick="removeCartItem('${item.id}', '${item.weight}')">Remove</span>
        </div>
      </div>
    `;
  }).join('');

  // Calculate pricing totals
  const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Set defaults (overwritten if admin configs load, but fallback is standard)
  const deliveryCharge = subtotal >= 299 ? 0 : 30;
  const grandTotal = subtotal + deliveryCharge;

  document.getElementById('summary-subtotal').innerText = `₹${subtotal}`;
  document.getElementById('summary-delivery').innerText = deliveryCharge === 0 ? 'FREE' : `₹${deliveryCharge}`;
  document.getElementById('summary-total').innerText = `₹${grandTotal}`;

  const freeBadge = document.getElementById('free-delivery-badge');
  if (subtotal >= 299) {
    freeBadge.innerText = 'You qualify for Free Delivery.';
    freeBadge.style.backgroundColor = 'var(--color-primary-light)';
    freeBadge.style.color = 'var(--color-primary)';
  } else {
    const remaining = 299 - subtotal;
    freeBadge.innerText = `Add ₹${remaining} more for Free Delivery`;
    freeBadge.style.backgroundColor = 'var(--color-accent-light)';
    freeBadge.style.color = 'var(--color-accent)';
  }
}

// Make globally accessible since they are inline onclick hooks
window.updateCartQty = updateCartQty;
window.removeCartItem = removeCartItem;

// --- CHECKOUT & ORDER REDIRECTION ---
function openWhatsApp(url) {
  // Strategy 1: Standard new tab (works on most desktop & Android Chrome)
  const newTab = window.open(url, '_blank', 'noopener,noreferrer');
  if (newTab) {
    try { newTab.focus(); } catch (_) {}
    return;
  }
  // Strategy 2: Direct location replace (works when popups are blocked)
  // Slight delay so the order confirmation alert has time to close first.
  setTimeout(() => {
    try {
      window.location.href = url;
      return;
    } catch (_) {}
    // Strategy 3: Invisible <a> click (last resort — works in restrictive WebViews)
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 500);
    } catch (err) {
      console.error('WhatsApp redirect failed on all strategies:', err);
    }
  }, 300);
}

function completeCheckoutFlow(formElement, customerDetails, whatsappUrl) {
  // Save all form details (including slot & payment) to localStorage for autofill next time
  saveFormDetailsToLocalStorage();

  // Clear cart
  state.cart = [];
  saveCart();
  updateCartUI();

  // Close Cart Drawer
  const cartDrawer = document.getElementById('cart-drawer');
  if (cartDrawer) {
    cartDrawer.classList.remove('open');
  }

  // Reset form but immediately prefill the saved details back
  if (formElement) formElement.reset();
  prefillCheckoutForm();

  // Show confirmation then redirect to WhatsApp
  alert("Order placed successfully!\nWe are now redirecting you to WhatsApp to confirm your slot.");
  openWhatsApp(whatsappUrl);
}

async function pollPaymentVerification(orderId, maxAttempts = 5, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${API_BASE}/orders/${orderId}/verify-payment`);
      if (res.ok) {
        const data = await res.json();
        if (data.verified) {
          return true;
        }
      }
    } catch (err) {
      console.warn("Polling attempt failed:", err);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
}

async function handleCheckoutSubmit(e) {
  e.preventDefault();

  if (state.cart.length === 0) return;

  const checkoutBtn = e.target.querySelector('button[type="submit"]');
  checkoutBtn.disabled = true;
  checkoutBtn.innerText = "Creating secure order...";

  const pincode = document.getElementById('cust-pincode').value.trim();
  if (pincode !== '392011') {
    alert("Sorry, we only deliver to pincode 392011.");
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "Order Now via WhatsApp & Excel";
    return;
  }

  const rawPhone = document.getElementById('cust-phone').value.replace(/[^0-9]/g, '');
  if (rawPhone.length !== 10) {
    alert("Please enter a valid 10-digit Indian mobile number.");
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "Order Now via WhatsApp & Excel";
    return;
  }

  // Collect user info
  const orderPayload = {
    customerName: document.getElementById('cust-name').value,
    customerPhone: '91' + rawPhone,
    customerEmail: document.getElementById('cust-email').value,
    deliveryAddress: document.getElementById('cust-address').value,
    deliveryPincode: pincode,
    landmark: document.getElementById('cust-landmark').value,
    deliverySlot: document.getElementById('cust-slot').value,
    paymentMethod: document.getElementById('cust-payment').value,
    items: state.cart.map(item => ({
      productId: item.id,
      weight: item.weight,
      quantity: item.quantity
    }))
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) throw new Error("Could not process order details.");

    const responseData = await res.json();

    if (responseData.success) {
      const customerDetails = {
        name: orderPayload.customerName,
        phone: rawPhone, // store without country code prefix for clean prefill
        email: orderPayload.customerEmail,
        address: orderPayload.deliveryAddress,
        landmark: orderPayload.landmark,
        slot: document.getElementById('cust-slot')?.value || '',
        payment: document.getElementById('cust-payment')?.value || ''
      };

      if (responseData.paymentRequired) {
        checkoutBtn.innerText = "Awaiting payment...";
        const options = {
          key: responseData.keyId,
          amount: responseData.amount,
          currency: responseData.currency,
          name: "Rasoi Sakhi",
          description: "Vegetables Order Payment",
          order_id: responseData.razorpayOrderId,
          prefill: { 
            name: orderPayload.customerName, 
            contact: orderPayload.customerPhone, 
            email: orderPayload.customerEmail 
          },
          theme: { color: "#2e7d32" },
           handler: async function (response) {
            checkoutBtn.innerText = "Verifying payment...";
            const isVerified = await pollPaymentVerification(responseData.orderId);
            if (isVerified) {
              completeCheckoutFlow(e.target, customerDetails, responseData.whatsappUrl);
            } else {
              alert("Payment confirmation received. Proceeding to WhatsApp to complete your slot booking.");
              completeCheckoutFlow(e.target, customerDetails, responseData.whatsappUrl);
            }
          },
          modal: { 
            ondismiss: function () { 
              checkoutBtn.disabled = false; 
              checkoutBtn.innerText = "Order Now via WhatsApp & Excel"; 
            } 
          }
        };
        const rzp1 = new Razorpay(options);
        rzp1.open();
      } else {
        completeCheckoutFlow(e.target, customerDetails, responseData.whatsappUrl);
      }
    }
  } catch (err) {
    console.error("Order processing error:", err);
    alert("There was an issue processing your order. Please try again or call support.");
  } finally {
    checkoutBtn.disabled = false;
    checkoutBtn.innerText = "Order Now via WhatsApp & Excel";
  }
}

// ==========================================================================
// ADMIN DASHBOARD CLIENT-SIDE MODULE
// ==========================================================================

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Explicitly resume in case the browser suspended the context
    if (ctx.state === 'suspended') {
      ctx.resume().catch(e => console.warn("Failed to resume audio context:", e));
    }
    
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.4, startTime); // Increased from 0.08 to 0.4 for audibility
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    
    // Play sweet two-tone chime (C5 then E5)
    playTone(523.25, ctx.currentTime, 0.15);
    playTone(659.25, ctx.currentTime + 0.12, 0.35);
  } catch (e) {
    console.error("Failed to play chime notification:", e);
  }
}

function showNewOrderToast(order) {
  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.style.cssText = 'position: fixed; top: 24px; right: 24px; z-index: 10000; display: flex; flex-direction: column; gap: 12px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'admin-new-order-toast';
  toast.style.cssText = `
    background: #ffffff;
    color: var(--color-text-dark);
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.12);
    border-left: 5px solid var(--color-accent);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 300px;
    max-width: 380px;
    animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    cursor: pointer;
    border-top: 1px solid rgba(0,0,0,0.03);
    border-right: 1px solid rgba(0,0,0,0.03);
    border-bottom: 1px solid rgba(0,0,0,0.03);
  `;

  toast.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="color: var(--color-accent); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.8px; display: inline-flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: var(--color-accent); animation: pulse 1s infinite;"></span>
        New Order Alert
      </strong>
      <span style="font-size: 1.1rem; font-weight: bold; color: var(--color-text-muted); cursor: pointer; transition: color 0.2s;" onclick="event.stopPropagation(); this.parentElement.parentElement.remove()">&times;</span>
    </div>
    <div style="font-weight: 700; font-size: 1rem; color: var(--color-text-dark); margin-top: 4px;">${order.customerName}</div>
    <div style="font-size: 0.8rem; color: var(--color-text-muted);">ID: <strong>${order.id}</strong> • Total: <strong>₹${order.totalAmount}</strong></div>
  `;

  toast.addEventListener('click', () => {
    // Focus search on this order
    const searchInput = document.getElementById('orders-search-filter');
    if (searchInput) {
      searchInput.value = order.id;
      renderAdminOrdersTable();
    }
    toast.style.animation = 'fadeOut 0.25s ease-out forwards';
    setTimeout(() => toast.remove(), 250);
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'fadeOut 0.4s ease-out forwards';
      setTimeout(() => toast.remove(), 400);
    }
  }, 7500);
}

let adminPollInterval = null;

function startAdminPolling() {
  stopAdminPolling();
  // Poll every 10 seconds for real-time responsiveness
  adminPollInterval = setInterval(() => {
    if (state.adminToken) {
      loadAdminOrders();
    }
  }, 10000);
}

function stopAdminPolling() {
  if (adminPollInterval) {
    clearInterval(adminPollInterval);
    adminPollInterval = null;
  }
}

async function markAsRead(orderId) {
  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.adminToken}`
      }
    });
    if (res.ok) {
      const order = adminOrders.find(o => o.id === orderId);
      if (order) {
        order.isRead = true;
        renderAdminOrdersTable();
      }
    } else {
      alert("Failed to mark order as read.");
    }
  } catch (err) {
    console.error("Error marking order as read:", err);
  }
}

window.markAsRead = markAsRead;

function setupAdminListeners() {
  // Login Form
  document.getElementById('admin-login-form').addEventListener('submit', handleAdminLogin);

  // Show / Hide password toggle
  const togglePwdBtn = document.getElementById('toggle-password-btn');
  if (togglePwdBtn) {
    togglePwdBtn.addEventListener('click', () => {
      const pwdInput = document.getElementById('admin-password');
      const eyeShow = document.getElementById('eye-icon-show');
      const eyeHide = document.getElementById('eye-icon-hide');
      const isHidden = pwdInput.type === 'password';
      pwdInput.type = isHidden ? 'text' : 'password';
      eyeShow.style.display = isHidden ? 'none' : 'inline';
      eyeHide.style.display = isHidden ? 'inline' : 'none';
    });
  }

  // Logout Form
  document.getElementById('admin-logout-btn').addEventListener('click', handleAdminLogout);

  // Load More Orders Button
  const loadMoreBtn = document.getElementById('orders-load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      ordersLimit += 50;
      loadAdminOrders();
    });
  }

  // Settings Save Form
  document.getElementById('admin-settings-form').addEventListener('submit', saveAdminSettings);

  // Export CSV
  document.getElementById('admin-export-orders-btn').addEventListener('click', downloadOrdersCSV);

  // Admin section sub-tab switching
  const tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetTab = tab.dataset.tab;
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(targetTab).classList.add('active');
    });
  });

  // Search/Filter orders
  document.getElementById('orders-search-filter').addEventListener('input', renderAdminOrdersTable);
  document.getElementById('orders-status-filter').addEventListener('change', renderAdminOrdersTable);

  // Add product form drawer trigger
  document.getElementById('admin-add-product-btn').addEventListener('click', () => {
    openProductEditor(null);
  });
  
  // Close Product editor
  document.getElementById('editor-close-btn').addEventListener('click', () => {
    document.getElementById('product-editor-modal').classList.add('hide');
  });

  // Product editor form submit
  document.getElementById('product-editor-form').addEventListener('submit', handleProductSaveSubmit);

  // Image Upload Preview Listener
  const fileInput = document.getElementById('edit-prod-image-file');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const previewImg = document.getElementById('upload-preview-img');
          previewImg.src = e.target.result;
          document.getElementById('image-upload-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }
}

// Check if admin is logged in securely
async function checkAdminAuth() {
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });

    if (res.ok) {
      // Valid session
      showAdminDashboard();
    } else {
      // Expired token
      handleAdminLogout();
    }
  } catch (err) {
    console.error("Auth validation failed:", err);
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  
  const payload = {
    username: document.getElementById('admin-username').value,
    password: document.getElementById('admin-password').value
  };

  try {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      state.adminToken = data.token;
      localStorage.setItem('rs_admin_token', data.token);
      document.getElementById('login-error').innerText = '';
      showAdminDashboard();
    } else {
      document.getElementById('login-error').innerText = data.error || 'Authentication failed.';
    }
  } catch (err) {
    console.error("Login call error:", err);
    document.getElementById('login-error').innerText = 'Connection error.';
  } finally {
    submitBtn.disabled = false;
  }
}

function handleAdminLogout() {
  state.adminToken = null;
  localStorage.removeItem('rs_admin_token');
  stopAdminPolling();
  ordersLimit = 50;
  
  // UI views update
  document.getElementById('admin-dashboard-panel').classList.add('hide');
  document.getElementById('admin-auth-panel').classList.remove('hide');
  
  // Clear fields
  document.getElementById('admin-username').value = '';
  document.getElementById('admin-password').value = '';
}

function showAdminDashboard() {
  document.getElementById('admin-auth-panel').classList.add('hide');
  document.getElementById('admin-dashboard-panel').classList.remove('hide');
  loadAdminDashboard();
  startAdminPolling();
  initPushNotifications();
}

async function loadAdminDashboard() {
  if (!state.adminToken) return;

  // Load Settings
  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    if (res.ok) {
      state.adminSettings = await res.json();
      populateSettingsForm();
    }
  } catch (err) { console.error("Error loading settings:", err); }

  // Load Analytics
  try {
    const res = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    if (res.ok) {
      const stats = await res.json();
      document.getElementById('stat-total-orders').innerText = stats.totalOrders;
      document.getElementById('stat-total-revenue').innerText = `₹${stats.totalRevenue}`;
      document.getElementById('stat-active-products').innerText = stats.productCount;
    }
  } catch (err) { console.error("Error loading analytics:", err); }

  // Load orders table
  loadAdminOrders();

  // Load admin catalog table
  renderAdminProductsTable();
}

// Render Settings values into forms
function populateSettingsForm() {
  if (!state.adminSettings) return;
  document.getElementById('settings-webhook').value = state.adminSettings.googleSheetsWebhookUrl || '';
  document.getElementById('settings-whatsapp').value = state.adminSettings.whatsappNumber || '';
  document.getElementById('settings-delivery-fee').value = state.adminSettings.deliveryCharge || 0;
  document.getElementById('settings-free-delivery').value = state.adminSettings.freeDeliveryThreshold || 0;
}

async function saveAdminSettings(e) {
  e.preventDefault();
  
  const statusEl = document.getElementById('settings-status');
  statusEl.className = 'form-status';
  statusEl.innerText = 'Saving...';

  const payload = {
    googleSheetsWebhookUrl: document.getElementById('settings-webhook').value,
    whatsappNumber: document.getElementById('settings-whatsapp').value,
    deliveryCharge: document.getElementById('settings-delivery-fee').value,
    freeDeliveryThreshold: document.getElementById('settings-free-delivery').value
  };

  try {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      statusEl.className = 'form-status success';
      statusEl.innerText = 'Settings saved successfully!';
      // Reload products catalog in case delivery configurations updated values
      fetchProducts();
    } else {
      statusEl.className = 'form-status error';
      statusEl.innerText = 'Failed to save settings.';
    }
  } catch (err) {
    statusEl.className = 'form-status error';
    statusEl.innerText = 'Server communication error.';
  }
}

// Download Excel CSV
async function downloadOrdersCSV() {
  try {
    const response = await fetch(`${API_BASE}/admin/orders/export`, {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    if (!response.ok) throw new Error("Failed to generate report.");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rasoi_sakhi_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Could not export orders report. Try logging in again.");
  }
}

// Manage Orders
let adminOrders = [];

async function loadAdminOrders() {
  try {
    const res = await fetch(`${API_BASE}/admin/orders?limit=${ordersLimit}&offset=0`, {
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });
    if (res.ok) {
      const { orders, total } = await res.json();
      state.totalOrders = total || 0;
      
      let hasNewUnread = false;
      orders.forEach(o => {
        if (!state.knownOrderIds.has(o.id)) {
          state.knownOrderIds.add(o.id);
          // Only play notification/show toast if we had already loaded orders once before
          if (state.hasInitiallyLoadedOrders) {
            hasNewUnread = true;
            showNewOrderToast(o);
          }
        }
      });

      if (hasNewUnread) {
        playNotificationSound();
      }

      state.hasInitiallyLoadedOrders = true;
      adminOrders = orders;
      renderAdminOrdersTable();
    }
  } catch (err) { console.error("Error loading orders:", err); }
}

function updateUnreadOrdersCount() {
  const unreadCount = adminOrders.filter(o => !o.isRead).length;
  const badge = document.getElementById('admin-orders-unread-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.innerText = unreadCount;
      badge.classList.remove('hide');
    } else {
      badge.classList.add('hide');
    }
  }
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('admin-orders-table-body');
  if (!tbody) return;

  const searchQuery = document.getElementById('orders-search-filter').value.toLowerCase();
  const statusFilter = document.getElementById('orders-status-filter').value;

  const filtered = adminOrders.filter(o => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch = o.id.toLowerCase().includes(searchQuery) ||
                          o.customerName.toLowerCase().includes(searchQuery) ||
                          o.customerPhone.includes(searchQuery) ||
                          o.deliveryAddress.toLowerCase().includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--color-text-muted);">No orders found.</td></tr>`;
    updateUnreadOrdersCount();
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const dateStr = new Date(o.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    const itemsList = o.items.map(item => `• ${item.name} (${item.weight} x ${item.quantity})`).join('<br>');
    
    // Dropdown for status update
    const statuses = ["Pending", "Payment Received", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
    const statusSelect = `
      <select onchange="updateOrderStatus('${o.id}', this.value)" style="border: 1px solid var(--color-border-soft); padding: 4px; border-radius: 4px;">
        ${statuses.map(st => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`).join('')}
      </select>
    `;

    const newBadge = o.isRead ? '' : `<span class="new-badge-indicator" style="background: var(--color-accent); color: white; padding: 2px 6px; font-size: 0.65rem; border-radius: 4px; margin-left: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; animation: pulse 1.5s infinite; vertical-align: middle;">New</span>`;
    
    const readBtn = o.isRead ? '' : `
      <button onclick="markAsRead('${o.id}')" class="btn-read-tick" title="Mark as Read" style="background: none; border: none; cursor: pointer; color: var(--color-primary); font-size: 1.25rem; font-weight: bold; padding: 4px; display: inline-flex; align-items: center; justify-content: center; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform='scale(1)'">
        ✓
      </button>
    `;

    const actionCell = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${statusSelect}
        ${readBtn}
      </div>
    `;

    // Dynamic Payment Method Badge
    const payMethod = o.paymentMethod || 'Cash On Delivery';
    const isUPI = payMethod.toLowerCase().includes('upi');
    const payBadgeColor = isUPI 
      ? 'background-color: #ede7f6; color: #5e35b1; border: 1px solid #d1c4e9;' 
      : 'background-color: #efebe9; color: #4e342e; border: 1px solid #d7ccc8;';
    const paymentBadge = `
      <span class="payment-method-badge" style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-top: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${payBadgeColor}">
        ${isUPI ? 'UPI' : 'COD'}
      </span>
    `;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 4px;">
            <strong>${o.id}</strong>
            ${newBadge}
          </div>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">${dateStr}</span>
        </td>
        <td>
          <strong>${o.customerName}</strong><br>
          <span style="font-size: 0.75rem;">${o.customerPhone}</span><br>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">${o.customerEmail || 'No Email'}</span>
        </td>
        <td style="font-size: 0.8rem;">${itemsList}</td>
        <td style="min-width: 115px; white-space: nowrap; line-height: 1.5;">
          <strong>₹${o.totalAmount}</strong><br>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Sub: ₹${o.subtotal}</span><br>
          ${paymentBadge}
        </td>
        <td>
          <span style="font-size: 0.8rem;">Slot: ${o.deliverySlot}</span><br>
          <span style="font-size: 0.75rem; color: var(--color-text-muted);">Address: ${o.deliveryAddress} (${o.landmark || 'N/A'})</span>
        </td>
        <td><span class="status-pill status-${o.status.toLowerCase().replace(/\s/g, '-')}" style="font-weight:600;">${o.status}</span></td>
        <td>${actionCell}</td>
      </tr>
    `;
  }).join('');

  // Show/Hide Load More container based on loaded vs total count
  const loadMoreContainer = document.getElementById('orders-load-more-container');
  if (loadMoreContainer) {
    if (adminOrders.length < (state.totalOrders || 0)) {
      loadMoreContainer.classList.remove('hide');
    } else {
      loadMoreContainer.classList.add('hide');
    }
  }
 
  updateUnreadOrdersCount();
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      // Reload orders to verify state update
      loadAdminOrders();
    } else {
      alert("Failed to update status.");
    }
  } catch (err) {
    console.error("Error updating status:", err);
  }
}

window.updateOrderStatus = updateOrderStatus;

// Manage Products Catalog (CRUD)
function renderAdminProductsTable() {
  const tbody = document.getElementById('admin-products-table-body');
  if (!tbody) return;

  if (!state.products.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--color-text-muted);">No products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.products.map(p => {
    const safeId = p.id.replace(/'/g, "\\'");
    return `
      <tr id="prod-row-${p.id}">
        <td>
          <div style="display:flex; align-items:center; gap: 8px;">
            <div style="width: 28px; height: 28px; display:flex; align-items:center; justify-content:center;">${getProductVisualHTML(p.image, p.name)}</div>
            <strong>${p.name}</strong> ${p.soldOut ? '<span style="font-size: 0.65rem; color: #D32F2F; background: #FFEBEE; padding: 2px 6px; border-radius: 4px; font-weight: 600; margin-left: 6px;">Sold Out</span>' : ''}
          </div>
        </td>
        <td style="text-transform: capitalize;">${p.category.replace(/_/g, ' ')}</td>
        <td>₹${p.price}</td>
        <td>${p.baseWeight}</td>
        <td>${p.popular ? 'Yes' : 'No'}</td>
        <td>
          <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px;" onclick="openProductEditor('${safeId}')">Edit</button>
          <button id="del-btn-${p.id}" class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem; border-radius: 4px; color: #c0392b; border-color: #c0392b; margin-left: 4px;" onclick="deleteProduct('${safeId}', this)">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.deleteProduct = async function(id, btn) {
  // Two-step confirmation: first click shows "Confirm?", second click deletes
  if (!btn) return;

  if (btn.dataset.confirming !== 'true') {
    // First click — ask for confirmation inline
    btn.dataset.confirming = 'true';
    btn.innerText = 'Confirm?';
    btn.style.background = '#c0392b';
    btn.style.color = 'white';
    btn.style.borderColor = '#c0392b';
    // Auto-reset after 4 seconds if not clicked again
    setTimeout(() => {
      if (btn.dataset.confirming === 'true') {
        btn.dataset.confirming = 'false';
        btn.innerText = 'Delete';
        btn.style.background = '';
        btn.style.color = '#c0392b';
      }
    }, 4000);
    return;
  }

  // Second click — actually delete
  btn.disabled = true;
  btn.innerText = 'Deleting...';
  btn.style.opacity = '0.6';

  if (!state.adminToken) {
    btn.innerText = 'Error: Not logged in';
    console.error('Delete failed: no admin token in state');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.adminToken}` }
    });

    console.log('Delete response status:', res.status);

    if (res.ok) {
      // Visually remove the row immediately
      const row = document.getElementById(`prod-row-${id}`);
      if (row) row.remove();
      // Refresh products in state
      await fetchProducts();
      loadAdminDashboard();
    } else {
      const errBody = await res.json().catch(() => ({}));
      console.error('Delete API error:', res.status, errBody);
      btn.disabled = false;
      btn.innerText = `Failed (${res.status})`;
      btn.style.opacity = '1';
      btn.dataset.confirming = 'false';
    }
  } catch (err) {
    console.error('Delete fetch error:', err);
    btn.disabled = false;
    btn.innerText = 'Error!';
    btn.style.opacity = '1';
    btn.style.color = '#c0392b';
    btn.dataset.confirming = 'false';
  }
};

function openProductEditor(productId = null) {
  const form = document.getElementById('product-editor-form');
  form.reset();

  if (productId) {
    // Edit Mode
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('editor-title').innerText = "Edit Product";
    document.getElementById('edit-prod-is-new').value = "false";
    document.getElementById('edit-prod-id').value = product.id;
    document.getElementById('edit-prod-id').readOnly = true;
    document.getElementById('edit-prod-name').value = product.name;
    document.getElementById('edit-prod-category').value = product.category;
    document.getElementById('edit-prod-price').value = product.price;
    document.getElementById('edit-prod-weight').value = product.baseWeight;
    document.getElementById('edit-prod-popular').checked = product.popular;
    document.getElementById('edit-prod-sold-out').checked = !!product.soldOut;
    document.getElementById('edit-prod-description').value = product.description || '';
    document.getElementById('edit-prod-freshness').value = product.freshnessInfo || '';
    document.getElementById('edit-prod-storage').value = product.storageInstructions || '';

    // Prefill image preview if existing custom image
    const previewContainer = document.getElementById('image-upload-preview');
    const previewImg = document.getElementById('upload-preview-img');
    if (product.image && (product.image.startsWith('http') || product.image.startsWith('/assets/'))) {
      previewImg.src = product.image;
      previewContainer.style.display = 'block';
    } else {
      previewContainer.style.display = 'none';
    }
  } else {
    // New Mode
    document.getElementById('editor-title').innerText = "New Product";
    document.getElementById('edit-prod-is-new').value = "true";
    document.getElementById('edit-prod-id').value = '';
    document.getElementById('edit-prod-id').readOnly = false;
    document.getElementById('edit-prod-popular').checked = false;
    document.getElementById('edit-prod-sold-out').checked = false;
    document.getElementById('image-upload-preview').style.display = 'none';
  }

  // Reset file input
  const fileInput = document.getElementById('edit-prod-image-file');
  if (fileInput) fileInput.value = '';

  document.getElementById('product-editor-modal').classList.remove('hide');
}

window.openProductEditor = openProductEditor;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

async function handleProductSaveSubmit(e) {
  e.preventDefault();

  const isNew = document.getElementById('edit-prod-is-new').value === 'true';
  const id = document.getElementById('edit-prod-id').value;
  
  let imageVal = id;
  if (!isNew) {
    const existing = state.products.find(p => p.id === id);
    if (existing) imageVal = existing.image;
  }

  // Check file upload
  const fileInput = document.getElementById('edit-prod-image-file');
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;
  
  if (file) {
    try {
      const base64Data = await fileToBase64(file);
      const uploadRes = await fetch(`${API_BASE}/admin/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.adminToken}`
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          filename: file.name
        })
      });

      if (!uploadRes.ok) {
        throw new Error("Image upload failed");
      }

      const uploadData = await uploadRes.json();
      imageVal = uploadData.imageUrl;
    } catch (err) {
      console.error(err);
      alert("Failed to upload product image. Storing product without updated image.");
    }
  }

  const payload = {
    id: id,
    name: document.getElementById('edit-prod-name').value,
    category: document.getElementById('edit-prod-category').value,
    price: parseFloat(document.getElementById('edit-prod-price').value),
    baseWeight: document.getElementById('edit-prod-weight').value,
    popular: document.getElementById('edit-prod-popular').checked,
    soldOut: document.getElementById('edit-prod-sold-out').checked,
    description: document.getElementById('edit-prod-description').value,
    freshnessInfo: document.getElementById('edit-prod-freshness').value,
    storageInstructions: document.getElementById('edit-prod-storage').value,
    image: imageVal,
    weightOptions: [{
      weight: document.getElementById('edit-prod-weight').value,
      price: parseFloat(document.getElementById('edit-prod-price').value)
    }]
  };

  try {
    const url = isNew ? `${API_BASE}/admin/products` : `${API_BASE}/admin/products/${id}`;
    const method = isNew ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert("Product saved successfully!");
      document.getElementById('product-editor-modal').classList.add('hide');
      await fetchProducts(); // Refresh client catalog
      loadAdminDashboard(); // Refresh stats and catalog tables
    } else {
      const errData = await res.json();
      alert(`Save failed: ${errData.error || 'Server error'}`);
    }
  } catch (err) {
    console.error("Save product API failed:", err);
    alert("Connection issue.");
  }
}

// Prefills checkout form with customer details from localStorage if present
function prefillCheckoutForm() {
  const pinInput = document.getElementById('cust-pincode');
  if (pinInput) {
    pinInput.value = '392011';
  }

  const detailsJson = localStorage.getItem('rs_customer_details');
  if (!detailsJson) return;

  try {
    const details = JSON.parse(detailsJson);
    if (details.name) document.getElementById('cust-name').value = details.name;
    if (details.phone) {
      const cleanedPhone = details.phone.replace(/[^0-9]/g, '').slice(-10);
      document.getElementById('cust-phone').value = cleanedPhone;
    }
    if (details.email) document.getElementById('cust-email').value = details.email;
    if (details.address) document.getElementById('cust-address').value = details.address;
    if (details.landmark) document.getElementById('cust-landmark').value = details.landmark;
    if (details.slot) document.getElementById('cust-slot').value = details.slot;
    if (details.payment) {
      document.getElementById('cust-payment').value = details.payment;
      // Trigger change event to update UPI helper visibility
      document.getElementById('cust-payment').dispatchEvent(new Event('change'));
    }
  } catch (err) {
    console.error("Error prefilling checkout details:", err);
  }
}

// Saves checkout form details to localStorage on input/change
function saveFormDetailsToLocalStorage() {
  const customerDetails = {
    name: document.getElementById('cust-name')?.value || "",
    phone: document.getElementById('cust-phone')?.value || "",
    email: document.getElementById('cust-email')?.value || "",
    address: document.getElementById('cust-address')?.value || "",
    landmark: document.getElementById('cust-landmark')?.value || "",
    slot: document.getElementById('cust-slot')?.value || "",
    payment: document.getElementById('cust-payment')?.value || ""
  };
  localStorage.setItem('rs_customer_details', JSON.stringify(customerDetails));
}

// Close details modal and pop history state if pushed
function closeProductDetails() {
  const detailModal = document.getElementById('product-detail-modal');
  if (detailModal) {
    detailModal.classList.remove('open');
    const modalContent = detailModal.querySelector('.prod-modal');
    if (modalContent) {
      modalContent.style.transform = '';
      modalContent.style.transition = '';
    }
  }
  if (state.modalHistoryPushed) {
    state.modalHistoryPushed = false;
    if (history.state && history.state.modal === 'product-detail') {
      history.back();
    }
  }
}

// Setup swipe gesture to close bottom sheet modal on mobile
function setupSwipeToClose() {
  const detailModal = document.getElementById('product-detail-modal');
  if (!detailModal) return;

  const modalContent = detailModal.querySelector('.prod-modal');
  if (!modalContent) return;

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  modalContent.addEventListener('touchstart', (e) => {
    // Only allow drag if scrolled to top
    if (modalContent.scrollTop > 0) return;
    
    startY = e.touches[0].clientY;
    isDragging = true;
    modalContent.style.transition = 'none'; // Disable transition during drag
  }, { passive: true });

  modalContent.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    
    const clientY = e.touches[0].clientY;
    const diffY = clientY - startY;

    // Only allow dragging down (diffY > 0)
    if (diffY > 0) {
      modalContent.style.transform = `translateY(${diffY}px)`;
      currentY = diffY;
      // Prevent page scrolling behind the modal
      if (e.cancelable) e.preventDefault();
    } else {
      modalContent.style.transform = 'translateY(0)';
      currentY = 0;
    }
  }, { passive: false });

  modalContent.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    
    modalContent.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    if (currentY > 80) {
      // Swiped down enough -> close the modal
      closeProductDetails();
    } else {
      // Not swiped enough -> bounce back
      modalContent.style.transform = 'translateY(0)';
    }
    currentY = 0;
  });

  // Handle browser back button to close modal
  window.addEventListener('popstate', (e) => {
    if (detailModal.classList.contains('open')) {
      detailModal.classList.remove('open');
      modalContent.style.transform = '';
      modalContent.style.transition = '';
      state.modalHistoryPushed = false;
    }
  });

  // Handle escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailModal.classList.contains('open')) {
      closeProductDetails();
    }
  });
}

// ==========================================================================
// BROWSER PUSH NOTIFICATIONS
// ==========================================================================

let swRegistration = null;
let isPushEnabled = false;

// Register service worker and check push notification status
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    updatePushButtonUI(false, false);
    return;
  }
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    const existing = await swRegistration.pushManager.getSubscription();
    isPushEnabled = !!existing;
    updatePushButtonUI(true, isPushEnabled);
  } catch (err) {
    updatePushButtonUI(false, false);
  }
}

// Request notification permission and subscribe
async function enablePushNotifications() {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    alert('Please enable notifications in your browser settings to receive payment alerts.');
    return;
  }
  if (permission !== 'granted') return;

  try {
    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.register('/sw.js');
    }
    const keyRes = await fetch(`${API_BASE}/admin/push-vapid-key`);
    if (!keyRes.ok) throw new Error('Push not configured on server');
    const { publicKey } = await keyRes.json();

    const sub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const res = await fetch(`${API_BASE}/admin/push-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.adminToken}`
      },
      body: JSON.stringify(sub)
    });

    if (res.ok) {
      isPushEnabled = true;
      updatePushButtonUI(true, true);
      showInPageToast('Push notifications enabled — you will be alerted when payments arrive.');
    } else {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${res.status}`);
    }
  } catch (err) {
    console.error('Error enabling push notifications:', err);
    
    let helpMsg = `Failed to enable push notifications: ${err.message}\n\n`;
    if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
      helpMsg += `Troubleshooting for iOS:\n1. Open this website in Safari.\n2. Tap the Share button and select "Add to Home Screen".\n3. Open the app from your Home Screen and log in to enable notifications.`;
    } else {
      helpMsg += `Troubleshooting:\n1. Make sure notifications are allowed for this site in your browser settings.\n2. Ensure you are using a secure connection (HTTPS) or localhost.`;
    }
    
    alert(helpMsg);
    updatePushButtonUI(true, false);
  }
}

// Unsubscribe from push notifications
async function disablePushNotifications() {
  try {
    const sub = await swRegistration.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch(`${API_BASE}/admin/push-unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.adminToken}`
        },
        body: JSON.stringify({ endpoint: sub.endpoint })
      });
    }
    isPushEnabled = false;
    updatePushButtonUI(true, false);
    showInPageToast('Push notifications disabled.');
  } catch (err) {
    console.error('Error disabling push notifications:', err);
  }
}

// Convert VAPID base64url to Uint8Array (browser push API requires this)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Update push notification button appearance based on state
function updatePushButtonUI(supported, enabled) {
  const btn = document.getElementById('push-notif-btn');
  if (!btn) return;

  const existingWarning = document.getElementById('push-notif-unsupported-msg');
  if (existingWarning) {
    existingWarning.remove();
  }

  if (!supported) {
    btn.style.display = 'none';
    
    const warning = document.createElement('p');
    warning.id = 'push-notif-unsupported-msg';
    warning.style.fontSize = '0.85rem';
    warning.style.color = '#d32f2f';
    warning.style.marginTop = 'var(--spacing-sm)';
    warning.style.display = 'flex';
    warning.style.alignItems = 'center';
    warning.style.gap = '6px';
    warning.style.lineHeight = '1.4';
    
    const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      warning.innerHTML = `⚠️ Push notifications require a secure connection (HTTPS) or localhost.`;
    } else {
      warning.innerHTML = `⚠️ Push notifications are not supported by this browser.`;
    }
    btn.parentNode.appendChild(warning);
    return;
  }

  btn.style.display = '';

  if (enabled) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg> Notifications On`;
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-success');
    btn.onclick = disablePushNotifications;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zM8.5 11c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm7 0c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z"/></svg> Enable Notifications`;
    btn.classList.remove('btn-success');
    btn.classList.add('btn-secondary');
    btn.onclick = enablePushNotifications;
  }
}

// Small non-intrusive in-page toast
function showInPageToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = [
    'position:fixed', 'top:20px', 'right:20px', 'z-index:10001',
    'background:#2e7d32', 'color:#fff',
    'padding:10px 18px', 'border-radius:8px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
    'font-size:0.88rem', 'max-width:280px',
    'animation:slideInRight 0.3s ease',
    'font-family:var(--font-body,inherit)'
  ].join(';');
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

