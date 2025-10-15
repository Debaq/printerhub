// ============================================
// UI - Renderizado y manipulación del DOM
// ============================================

import {
    VIEW_MODES,
    DEFAULT_FILTERS,
    DOM_IDS,
    CSS_CLASSES,
    GRID_SELECTORS,
    UI_TEXTS
} from './config.js';

import {
    getPrintersList,
    checkTemperature,
    getTempClass,
    formatTime,
    getRandomMessage,
    getSectionForPrinter,
    initTempChart
} from './printers.js';

import { isUserAuthenticated } from './auth.js';

// Estado del módulo
let searchTerm = '';
let filters = { ...DEFAULT_FILTERS };
let viewMode = VIEW_MODES.EXPANDED;

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar módulo de UI
 */
export function initUI() {
    setupUIEventListeners();
}

/**
 * Configurar event listeners de UI
 */
function setupUIEventListeners() {
    // Búsqueda
    document.getElementById(DOM_IDS.SEARCH_INPUT).addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderPrinters();
    });
    
    // Filtros
    document.getElementById(DOM_IDS.FILTER_PRINTING).addEventListener('change', (e) => {
        filters.printing = e.target.checked;
        renderPrinters();
    });
    
    document.getElementById(DOM_IDS.FILTER_IDLE).addEventListener('change', (e) => {
        filters.idle = e.target.checked;
        renderPrinters();
    });
    
    document.getElementById(DOM_IDS.FILTER_OFFLINE).addEventListener('change', (e) => {
        filters.offline = e.target.checked;
        renderPrinters();
    });
    
    // Modo de vista
    document.getElementById(DOM_IDS.COMPACT_VIEW).addEventListener('click', () => {
        setViewMode(VIEW_MODES.COMPACT);
    });
    
    document.getElementById(DOM_IDS.EXPANDED_VIEW).addEventListener('click', () => {
        setViewMode(VIEW_MODES.EXPANDED);
    });
    
    // Escuchar cambios de autenticación
    document.addEventListener('authChanged', () => {
        renderPrinters();
    });
}

// ============================================
// RENDERIZADO PRINCIPAL
// ============================================

/**
 * Renderizar todas las impresoras
 */
export function renderPrinters() {
    const printers = getPrintersList();
    
    const sections = {
        printing: document.querySelector(GRID_SELECTORS.printing),
        idle: document.querySelector(GRID_SELECTORS.idle),
        offline: document.querySelector(GRID_SELECTORS.offline)
    };
    
    // Limpiar secciones
    Object.values(sections).forEach(section => {
        if (section) section.innerHTML = '';
    });
    
    if (printers.length === 0) {
        sections.idle.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #9D4EDD; padding: 50px;">${UI_TEXTS.NO_PRINTERS}</div>`;
        return;
    }
    
    // Ordenar por token para mantener orden consistente
    const sortedPrinters = [...printers].sort((a, b) => a.token.localeCompare(b.token));
    
    sortedPrinters.forEach(printer => {
        // Aplicar filtros
        if (!applyFilters(printer)) return;
        
        const section = getSectionForPrinter(printer);
        if (section && sections[section]) {
            const card = createPrinterCard(printer);
            sections[section].appendChild(card);
        }
    });
    
    // Ocultar secciones vacías
    Object.entries(sections).forEach(([key, section]) => {
        const sectionElement = document.getElementById(`section-${key}`);
        if (sectionElement) {
            if (section.children.length === 0) {
                sectionElement.style.display = 'none';
            } else {
                sectionElement.style.display = 'block';
            }
        }
    });
}

/**
 * Aplicar filtros de búsqueda y checkboxes
 */
function applyFilters(printer) {
    // Filtro de búsqueda
    if (searchTerm && !printer.name.toLowerCase().includes(searchTerm)) {
        return false;
    }
    
    // Filtros de estado
    const section = getSectionForPrinter(printer);
    if (section === 'printing' && !filters.printing) return false;
    if (section === 'idle' && !filters.idle) return false;
    if (section === 'offline' && !filters.offline) return false;
    
    return true;
}

// ============================================
// CREACIÓN DE TARJETAS
// ============================================

/**
 * Crear tarjeta individual de impresora
 */
function createPrinterCard(printer) {
    const card = document.createElement('div');
    card.className = `${CSS_CLASSES.PRINTER_CARD} ${printer.status === 'offline' ? CSS_CLASSES.PRINTER_OFFLINE : ''}`;
    card.dataset.printerId = printer.id;
    
    // Alertas de temperatura
    const tempWarning = checkTemperature(printer.temp_hotend, printer.temp_bed);
    if (tempWarning) card.classList.add(tempWarning);
    
    const funnyMessage = getRandomMessage(printer.status);
    const progressPercent = printer.progress || 0;
    const isAuthenticated = isUserAuthenticated();
    
    card.innerHTML = `
        ${renderPrinterHeader(printer, funnyMessage)}
        ${renderPrinterImage(printer)}
        ${renderPrinterInfo(printer, funnyMessage, progressPercent)}
        ${renderTempChart(printer)}
        ${isAuthenticated && printer.status !== 'offline' ? renderPrinterControls(printer, progressPercent) : ''}
    `;
    
    // Inicializar gráfico de temperatura después de agregar al DOM
    setTimeout(() => initTempChart(printer.id, printer), 100);
    
    return card;
}

/**
 * Renderizar encabezado de la tarjeta
 */
function renderPrinterHeader(printer, funnyMessage) {
    return `
        <div class="printer-header">
            <div class="printer-title-area">
                <div class="printer-name">${printer.name}</div>
                <div class="printer-tags">
                    ${printer.tags ? printer.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
                </div>
            </div>
            <div class="status-badge status-${printer.status}">${printer.status.toUpperCase()}</div>
        </div>
    `;
}

/**
 * Renderizar imagen de la impresora
 */
function renderPrinterImage(printer) {
    return `
        <div class="printer-image">
            ${printer.image ? 
                `<img src="${printer.image}" alt="Preview">` : 
                `<div class="no-image">${UI_TEXTS.NO_IMAGE}</div>`
            }
        </div>
    `;
}

/**
 * Renderizar información de la impresora
 */
function renderPrinterInfo(printer, funnyMessage, progressPercent) {
    return `
        <div class="printer-info">
            <div class="info-line">
                <span class="info-label">ESTADO:</span>
                <span class="info-value">${funnyMessage}</span>
            </div>
            ${printer.current_file ? `
                <div class="info-line">
                    <span class="info-label">ARCHIVO:</span>
                    <span class="info-value">${printer.current_file}</span>
                </div>
            ` : ''}
            ${printer.time_remaining ? `
                <div class="info-line">
                    <span class="info-label">TIEMPO REST:</span>
                    <span class="info-value">${formatTime(printer.time_remaining)}</span>
                </div>
            ` : ''}
            <div class="info-line">
                <span class="info-label">TEMP HOTEND:</span>
                <span class="info-value ${getTempClass(printer.temp_hotend, 250)}">${printer.temp_hotend || 0}°C</span>
            </div>
            <div class="info-line">
                <span class="info-label">TEMP CAMA:</span>
                <span class="info-value ${getTempClass(printer.temp_bed, 100)}">${printer.temp_bed || 0}°C</span>
            </div>
            ${printer.print_speed ? `
                <div class="info-line">
                    <span class="info-label">VELOCIDAD:</span>
                    <span class="info-value">${printer.print_speed}%</span>
                </div>
            ` : ''}
            ${printer.last_completed ? `
                <div class="info-line">
                    <span class="info-label">ÚLTIMO TRABAJO:</span>
                    <span class="info-value">${printer.last_completed}</span>
                </div>
            ` : ''}
            ${printer.bed_status ? `
                <div class="info-line">
                    <span class="info-label">ESTADO CAMA:</span>
                    <span class="info-value">${printer.bed_status}</span>
                </div>
            ` : ''}
            ${printer.uptime ? `
                <div class="info-line">
                    <span class="info-label">UPTIME:</span>
                    <span class="info-value">${printer.uptime}</span>
                </div>
            ` : ''}
            ${printer.status === 'printing' ? `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    <div class="progress-text">${progressPercent}%</div>
                </div>
            ` : ''}
            ${printer.filament ? renderFilamentInfo(printer.filament) : ''}
        </div>
    `;
}

/**
 * Renderizar información de filamento
 */
function renderFilamentInfo(filament) {
    const isEmpty = !filament.remaining || filament.remaining < 10;
    return `
        <div class="filament-info ${isEmpty ? 'empty' : ''}">
            <div class="info-line">
                <span class="info-label">FILAMENTO:</span>
                <span class="info-value">${filament.material || 'N/A'} - ${filament.color || 'N/A'}</span>
            </div>
            ${filament.remaining !== undefined ? `
                <div class="info-line">
                    <span class="info-label">RESTANTE:</span>
                    <span class="info-value">${filament.remaining}%</span>
                </div>
            ` : ''}
        </div>
    `;
}

/**
 * Renderizar gráfico de temperatura
 */
function renderTempChart(printer) {
    return `<div class="temp-chart" id="chart-${printer.id}"></div>`;
}

/**
 * Renderizar controles de la impresora
 */
function renderPrinterControls(printer, progressPercent) {
    return `
        <div class="printer-controls">
            <button class="btn-action" onclick="sendCommand('${printer.id}', 'home')">🏠 HOME</button>
            <button class="btn-action" onclick="sendCommand('${printer.id}', 'heat')">🔥 CALENTAR</button>
            <button class="btn-action" onclick="showFileSelector('${printer.id}')">📄 IMPRIMIR</button>
            <button class="btn-action" onclick="sendCommand('${printer.id}', '${printer.status === 'printing' ? 'pause' : 'resume'}')">
                ${printer.status === 'printing' ? '⏸️ PAUSAR' : '▶️ REANUDAR'}
            </button>
            <button class="btn-action small" onclick="toggleFan('${printer.id}')">💨 FAN</button>
            <button class="btn-action small" onclick="sendCommand('${printer.id}', 'reboot')">🔄 REBOOT</button>
            <button class="btn-action small btn-secondary" onclick="showNotes('${printer.id}')">📝 NOTAS</button>
            <button class="btn-action small btn-secondary" onclick="showLogs('${printer.id}')">📜 LOGS</button>
            ${printer.status === 'printing' ? renderSpeedControl(printer) : ''}
            <button class="btn-action btn-emergency" onclick="sendCommand('${printer.id}', 'emergency_stop')">🚨 STOP EMERGENCIA</button>
        </div>
    `;
}

/**
 * Renderizar control de velocidad
 */
function renderSpeedControl(printer) {
    return `
        <div class="speed-control" style="grid-column: 1 / -1;">
            <label>⚡ VELOCIDAD:</label>
            <input type="range" min="50" max="200" value="${printer.print_speed || 100}"
                onchange="changeSpeed('${printer.id}', this.value)"
                oninput="this.nextElementSibling.textContent = this.value + '%'">
            <span class="speed-value">${printer.print_speed || 100}%</span>
        </div>
    `;
}

// ============================================
// MODO DE VISTA
// ============================================

/**
 * Cambiar modo de vista
 */
function setViewMode(mode) {
    viewMode = mode;
    document.body.classList.toggle(CSS_CLASSES.COMPACT_MODE, mode === VIEW_MODES.COMPACT);
    document.getElementById(DOM_IDS.COMPACT_VIEW).classList.toggle(CSS_CLASSES.BTN_VIEW_ACTIVE, mode === VIEW_MODES.COMPACT);
    document.getElementById(DOM_IDS.EXPANDED_VIEW).classList.toggle(CSS_CLASSES.BTN_VIEW_ACTIVE, mode === VIEW_MODES.EXPANDED);
}

/**
 * Obtener modo de vista actual
 */
export function getViewMode() {
    return viewMode;
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Mostrar mensaje de carga
 */
export function showLoading() {
    const sections = {
        printing: document.querySelector(GRID_SELECTORS.printing),
        idle: document.querySelector(GRID_SELECTORS.idle),
        offline: document.querySelector(GRID_SELECTORS.offline)
    };
    
    Object.values(sections).forEach(section => {
        if (section) section.innerHTML = '';
    });
    
    sections.idle.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #9D4EDD; padding: 50px;">⏳ CARGANDO IMPRESORAS...</div>';
}

/**
 * Limpiar búsqueda
 */
export function clearSearch() {
    const searchInput = document.getElementById(DOM_IDS.SEARCH_INPUT);
    if (searchInput) {
        searchInput.value = '';
        searchTerm = '';
    }
}

/**
 * Resetear filtros
 */
export function resetFilters() {
    filters = { ...DEFAULT_FILTERS };
    document.getElementById(DOM_IDS.FILTER_PRINTING).checked = filters.printing;
    document.getElementById(DOM_IDS.FILTER_IDLE).checked = filters.idle;
    document.getElementById(DOM_IDS.FILTER_OFFLINE).checked = filters.offline;
}

// Export default
export default {
    initUI,
    renderPrinters,
    getViewMode,
    showLoading,
    clearSearch,
    resetFilters
};