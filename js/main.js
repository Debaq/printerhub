// ============================================
// MAIN - Orquestador principal de la aplicación
// ============================================

import { REFRESH_INTERVAL } from './config.js';
import { initAuth } from './auth.js';
import { initModals } from './modals.js';
import { initFiles } from './files.js';
import { initPrinters, loadPrinters } from './printers.js';
import { initUI, renderPrinters, showLoading } from './ui.js';

// ============================================
// ESTADO GLOBAL
// ============================================

let refreshInterval = null;

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar aplicación
 */
async function initApp() {
    console.log('🌈 Iniciando TecMedHub...');
    
    // Inicializar módulos
    initAuth();
    initModals();
    initFiles();
    initPrinters();
    initUI();
    
    // Configurar event listeners globales
    setupGlobalEventListeners();
    
    // Cargar impresoras inicialmente
    showLoading();
    await loadAndRenderPrinters();
    
    // Iniciar actualización automática
    startAutoRefresh();
    
    console.log('✅ TecMedHub iniciado correctamente');
}

/**
 * Configurar event listeners globales
 */
function setupGlobalEventListeners() {
    // Evento para recargar impresoras
    document.addEventListener('reloadPrinters', async () => {
        await loadAndRenderPrinters();
    });
    
    // Escuchar errores no capturados
    window.addEventListener('error', (e) => {
        console.error('Error global:', e.error);
    });
    
    // Escuchar errores de promesas no capturadas
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Promesa rechazada no capturada:', e.reason);
    });
}

// ============================================
// CARGA Y RENDERIZADO
// ============================================

/**
 * Cargar y renderizar impresoras
 */
async function loadAndRenderPrinters() {
    try {
        await loadPrinters();
        renderPrinters();
    } catch (error) {
        console.error('Error cargando y renderizando impresoras:', error);
    }
}

// ============================================
// AUTO-REFRESH
// ============================================

/**
 * Iniciar actualización automática
 */
function startAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    refreshInterval = setInterval(async () => {
        await loadAndRenderPrinters();
    }, REFRESH_INTERVAL);
    
    console.log(`🔄 Auto-refresh iniciado (cada ${REFRESH_INTERVAL / 1000}s)`);
}

/**
 * Detener actualización automática
 */
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        console.log('⏸️ Auto-refresh detenido');
    }
}

/**
 * Reiniciar actualización automática
 */
function restartAutoRefresh() {
    stopAutoRefresh();
    startAutoRefresh();
}

// ============================================
// VISIBILIDAD DE LA PÁGINA
// ============================================

/**
 * Manejar cambios de visibilidad de la página
 */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Página oculta - reducir frecuencia de actualización
        console.log('👁️ Página oculta, pausando auto-refresh');
        stopAutoRefresh();
    } else {
        // Página visible - reanudar actualización
        console.log('👁️ Página visible, reanudando auto-refresh');
        startAutoRefresh();
        // Cargar inmediatamente al volver
        loadAndRenderPrinters();
    }
});

// ============================================
// EXPONER API PÚBLICA
// ============================================

/**
 * API pública para debugging y extensiones
 */
window.TecMedHub = {
    version: '2.0.0',
    loadPrinters: loadAndRenderPrinters,
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh,
    getRefreshInterval: () => REFRESH_INTERVAL
};

// ============================================
// INICIO DE LA APLICACIÓN
// ============================================

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    // DOM ya está listo
    initApp();
}

// ============================================
// MANEJO DE CIERRE
// ============================================

/**
 * Limpieza al cerrar la página
 */
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    console.log('👋 TecMedHub cerrando...');
});

// ============================================
// EXPORT (para testing)
// ============================================

export {
    initApp,
    loadAndRenderPrinters,
    startAutoRefresh,
    stopAutoRefresh,
    restartAutoRefresh
};