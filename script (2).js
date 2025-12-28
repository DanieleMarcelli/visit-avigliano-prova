/**
 * Visit Avigliano - Main JavaScript
 * Portale Turistico Ufficiale
 * Optimized for UX, accessibility, and performance
 */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    CSV_EVENTS: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQIXJyYXgON5vC3u4ri0duZ3MMue3ZeqfvU_j52iVmJMpWfzuzedidIob5KyTw71baMKZXNgTCiaYce/pub?gid=0&single=true&output=csv",
    CSV_CONTENT: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQIXJyYXgON5vC3u4ri0duZ3MMue3ZeqfvU_j52iVmJMpWfzuzedidIob5KyTw71baMKZXNgTCiaYce/pub?gid=643581002&single=true&output=csv",
    PLACEHOLDER_IMAGE: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=800",
    MAX_SLIDER_EVENTS: 6
};

// ============================================================
// STATE
// ============================================================
let cmsData = {};
let allEvents = [];
let filteredEvents = [];
let currentCategory = 'Tutti';

// Expose cmsData globally
window.cmsData = cmsData;

// ============================================================
// UTILITIES
// ============================================================
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim() !== '');
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('---')) continue;
        const row = [];
        let currentCell = '';
        let insideQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') { insideQuotes = !insideQuotes; }
            else if (char === ',' && !insideQuotes) { row.push(currentCell.trim()); currentCell = ''; }
            else { currentCell += char; }
        }
        row.push(currentCell.trim());
        const cleanedRow = row.map(cell => cell.replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (cleanedRow.length > 0 && cleanedRow[0] !== '') result.push(cleanedRow);
    }
    return result;
}

function formatUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('/d/')) {
        const idMatch = url.match(/\/d\/(.+?)\/|id=(.+?)&|id=(.+?)$/);
        const id = idMatch ? (idMatch[1] || idMatch[2] || idMatch[3]) : null;
        if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
    }
    return url;
}

function formatDate(dateStr, options = {}) {
    const date = new Date(dateStr);
    if (isNaN(date)) return null;
    const defaultOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('it-IT', { ...defaultOptions, ...options });
}

function getDateParts(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date)) return { day: '--', month: '---' };
    return {
        day: date.getDate(),
        month: date.toLocaleString('it-IT', { month: 'short' }).toUpperCase()
    };
}

// ============================================================
// CMS LOADER
// ============================================================
async function initCMS() {
    try {
        const resp = await fetch(CONFIG.CSV_CONTENT);
        if (!resp.ok) throw new Error("Failed to load CMS");
        const text = await resp.text();
        const rows = parseCSV(text);
        
        rows.forEach(row => {
            const id = row[0];
            const textContent = row[1];
            const imgUrl = formatUrl(row[2]);
            if (!id) return;
            
            cmsData[id] = { text: textContent, img: imgUrl };
            window.cmsData = cmsData;
            
            const elements = document.querySelectorAll(`[data-content-id="${id}"]`);
            elements.forEach(el => {
                if (imgUrl) {
                    if (el.tagName === 'IMG') {
                        el.src = imgUrl;
                        el.onload = () => el.classList.remove('opacity-0');
                    } else {
                        el.style.backgroundImage = `url('${imgUrl}')`;
                    }
                }
                if (textContent && el.tagName !== 'IMG') {
                    el.innerHTML = textContent;
                }
            });
        });
    } catch (err) {
        console.error("CMS Error:", err);
    }
}

// ============================================================
// EVENTS MANAGER
// ============================================================
async function initEvents() {
    try {
        const resp = await fetch(CONFIG.CSV_EVENTS);
        if (!resp.ok) throw new Error("Failed to load events");
        const text = await resp.text();
        const rows = parseCSV(text);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        allEvents = rows.map((row, idx) => ({
            id: `evt-${idx}`,
            dateStr: row[0],
            time: row[1] || 'Orario da definire',
            title: row[2] || 'Titolo non disponibile',
            subtitle: row[3] || '',
            desc: row[4] || '',
            loc: row[5] || 'Avigliano Umbro',
            cat: row[6] || 'Evento',
            img: formatUrl(row[7]) || CONFIG.PLACEHOLDER_IMAGE,
            organizer: row[8] || 'Comune di Avigliano Umbro'
        })).filter(e => {
            const d = new Date(e.dateStr);
            return !isNaN(d) && d >= today;
        }).sort((a, b) => new Date(a.dateStr) - new Date(b.dateStr));
        
        renderFilters();
        filterEvents('Tutti');
    } catch (err) {
        console.error("Events Error:", err);
        const slider = document.getElementById('events-slider');
        if (slider) slider.innerHTML = '<div class="w-full text-center text-white/60 py-10">Errore nel caricamento degli eventi.</div>';
    }
}

function renderFilters() {
    const container = document.getElementById('category-filters');
    if (!container) return;
    
    const categories = ['Tutti', ...new Set(allEvents.map(e => e.cat).filter(c => c))];
    
    // Determina se siamo sulla pagina eventi (sfondo chiaro) o homepage (sfondo scuro)
    const isEventsPage = document.getElementById('events-page-grid') !== null;
    
    container.innerHTML = categories.map(cat => {
        const isActive = cat === currentCategory;
        let classes;
        
        if (isEventsPage) {
            // Stile per pagina eventi (sfondo chiaro)
            classes = isActive 
                ? 'bg-forest text-white border-forest' 
                : 'bg-white text-stone border-sand hover:border-forest hover:text-forest';
        } else {
            // Stile per homepage (sfondo scuro)
            classes = isActive 
                ? 'bg-white text-forest border-white' 
                : 'bg-transparent text-white/60 border-white/20 hover:border-white hover:text-white';
        }
        
        return `
            <button 
                onclick="filterEvents('${cat}')" 
                class="filter-btn px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all ${classes}"
                aria-pressed="${isActive}"
            >
                ${cat}
            </button>
        `;
    }).join('');
}

window.filterEvents = (category) => {
    currentCategory = category;
    filteredEvents = category === 'Tutti' ? allEvents : allEvents.filter(e => e.cat === category);
    renderFilters();
    renderEvents();
};

function createEventCard(event, isGrid = false) {
    const { day, month } = getDateParts(event.dateStr);
    // Card verticale 7:10 - larghezza fissa per slider, auto per grid
    const containerClass = isGrid 
        ? 'w-full aspect-[7/10]' 
        : 'w-[220px] sm:w-[240px] aspect-[7/10] flex-shrink-0 snap-start';
    
    // Stile bordo diverso per grid (sfondo chiaro) vs slider (sfondo scuro)
    const borderClass = isGrid 
        ? 'border-sand hover:border-terracotta shadow-md hover:shadow-xl' 
        : 'border-white/20 hover:border-gold';
    
    return `
    <article 
        class="${containerClass} relative rounded-2xl overflow-hidden cursor-pointer border ${borderClass} transition-all duration-500 hover:-translate-y-2 group"
        onclick="openModal('${event.id}')"
        role="button"
        tabindex="0"
        aria-label="Scopri l'evento: ${event.title}"
        onkeypress="if(event.key==='Enter')openModal('${event.id}')"
    >
        <!-- Immagine full-bleed verticale -->
        <img 
            src="${event.img}" 
            alt="${event.title}"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
        >
        
        <!-- Overlay gradient -->
        <div class="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-transparent"></div>
        
        <!-- Category badge -->
        <span class="absolute top-3 right-3 px-3 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase bg-gold text-ink shadow-lg">
            ${event.cat}
        </span>
        
        <!-- Date badge -->
        <div class="absolute top-3 left-3 flex flex-col items-center px-3 py-2 rounded-xl bg-white/95 text-ink shadow-lg">
            <span class="text-2xl font-serif font-semibold leading-none">${day}</span>
            <span class="text-[9px] font-bold tracking-wider uppercase text-terracotta">${month}</span>
        </div>
        
        <!-- Content overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-5 text-white">
            <div class="flex flex-col gap-2 mb-3 text-[11px] text-white/80">
                <span class="flex items-center gap-1.5">
                    <i data-lucide="clock" class="w-3 h-3 text-gold"></i>
                    ${event.time}
                </span>
                <span class="flex items-center gap-1.5">
                    <i data-lucide="map-pin" class="w-3 h-3 text-gold"></i>
                    ${event.loc}
                </span>
            </div>
            
            <h3 class="text-lg font-serif text-white leading-tight line-clamp-2 group-hover:text-gold transition-colors">${event.title}</h3>
            ${event.subtitle ? `<p class="text-xs text-white/60 italic line-clamp-1 mt-1">${event.subtitle}</p>` : ''}
        </div>
    </article>`;
}

function renderEvents() {
    const sliderContainer = document.getElementById('events-slider');
    const gridContainer = document.getElementById('events-page-grid');
    
    // Home slider
    if (sliderContainer) {
        const displayEvents = filteredEvents.slice(0, CONFIG.MAX_SLIDER_EVENTS);
        
        if (displayEvents.length === 0) {
            sliderContainer.innerHTML = '<div class="w-full text-center text-white/60 py-10 font-serif italic">Nessun evento trovato in questa categoria.</div>';
        } else {
            sliderContainer.innerHTML = displayEvents.map(e => createEventCard(e)).join('');
        }
        
        const loadBtn = document.getElementById('load-more-btn');
        if (loadBtn) loadBtn.classList.toggle('hidden', filteredEvents.length <= CONFIG.MAX_SLIDER_EVENTS);
    }
    
    // Events page grid
    if (gridContainer) {
        if (filteredEvents.length === 0) {
            gridContainer.innerHTML = '<div class="col-span-full text-center py-20 text-stone font-serif text-xl">Nessun evento in questa categoria.</div>';
        } else {
            gridContainer.innerHTML = filteredEvents.map(e => createEventCard(e, true)).join('');
        }
        
        // Update count
        const countEl = document.getElementById('events-count');
        if (countEl) countEl.textContent = filteredEvents.length;
    }
    
    if (window.lucide) lucide.createIcons();
}

// ============================================================
// MODAL
// ============================================================
window.openModal = (baseId) => {
    let content = {};
    const event = allEvents.find(e => e.id === baseId);
    
    if (event) {
        const fullDate = formatDate(event.dateStr);
        content = {
            title: event.title,
            desc: event.desc,
            img: event.img,
            subtitle: event.subtitle || 'Evento in programma',
            category: event.cat,
            time: `${fullDate} | Ore ${event.time}`,
            location: event.loc,
            organizer: event.organizer
        };
    } else {
        const titleKey = `${baseId}_title`;
        const descKey = `${baseId}_desc`;
        const imgKey = `${baseId}_img`;
        
        content = {
            title: cmsData[titleKey]?.text || cmsData[baseId]?.text || "Dettaglio",
            desc: cmsData[descKey]?.text || "",
            img: cmsData[imgKey]?.img || cmsData[baseId]?.img || "",
            subtitle: "Territorio & Cultura",
            category: "Info",
            time: "Sempre accessibile",
            location: "Avigliano Umbro",
            organizer: "Comune di Avigliano Umbro"
        };
    }
    
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
    
    setEl('modal-title', content.title);
    setEl('modal-subtitle', content.subtitle);
    setEl('modal-desc', content.desc ? content.desc.replace(/\n/g, '<br>') : '');
    setEl('modal-category', content.category);
    setEl('modal-time', content.time);
    setEl('modal-location', content.location);
    setEl('modal-organizer', content.organizer);
    
    const modalImg = document.getElementById('modal-img');
    if (modalImg) modalImg.src = content.img || CONFIG.PLACEHOLDER_IMAGE;
    
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        modal.querySelector('button')?.focus();
    }
    
    if (window.lucide) lucide.createIcons();
};

window.closeModal = () => {
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

// ============================================================
// MOBILE MENU
// ============================================================
window.toggleMobileMenu = () => {
    const menu = document.getElementById('mobile-menu');
    const btn = document.getElementById('mobile-menu-btn');
    const isHidden = menu.classList.contains('hidden');
    
    menu.classList.toggle('hidden');
    if (btn) btn.setAttribute('aria-expanded', isHidden);
    document.body.style.overflow = isHidden ? 'hidden' : '';
};

// ============================================================
// SCROLL EFFECTS
// ============================================================
function handleNavScroll() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    
    if (window.scrollY > 100) {
        nav.classList.add('bg-forest/95', 'backdrop-blur-xl', 'shadow-lg');
    } else {
        nav.classList.remove('bg-forest/95', 'backdrop-blur-xl', 'shadow-lg');
    }
}

function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ============================================================
// KEYBOARD NAVIGATION
// ============================================================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('info-modal');
        const menu = document.getElementById('mobile-menu');
        
        if (modal && !modal.classList.contains('hidden')) {
            closeModal();
        } else if (menu && !menu.classList.contains('hidden')) {
            toggleMobileMenu();
        }
    }
});

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Lucide icons
    if (window.lucide) lucide.createIcons();
    
    // Scroll effects
    handleNavScroll();
    window.addEventListener('scroll', handleNavScroll);
    
    // Scroll reveal
    initScrollReveal();
    
    // Load CMS and Events
    await initCMS();
    await initEvents();
    
    // Final icon refresh
    if (window.lucide) lucide.createIcons();
    
    console.log('✓ Visit Avigliano initialized');
});
