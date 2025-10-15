// ============================================
// MODALS - Gestión de ventanas modales
// ============================================

import { DOM_IDS, CSS_CLASSES, FILE_TABS } from './config.js';

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar sistema de modales
 */
export function initModals() {
    setupModalEventListeners();
}

/**
 * Configurar event listeners de modales
 */
function setupModalEventListeners() {
    // Modal de archivos
    document.getElementById(DOM_IDS.CLOSE_FILE_MODAL).addEventListener('click', hideFileModal);
    
    // Tabs de archivos
    document.querySelectorAll('.file-tab').forEach(tab => {
        tab.addEventListener('click', () => switchFileTab(tab.dataset.tab));
    });
    
    // Modal de notas
    document.getElementById(DOM_IDS.CLOSE_NOTES_MODAL).addEventListener('click', hideNotesModal);
    
    // Modal de logs
    document.getElementById(DOM_IDS.CLOSE_LOGS_MODAL).addEventListener('click', hideLogsModal);
    
    // Cerrar modales al hacer click fuera
    setupClickOutside();
}

/**
 * Configurar cierre de modales al hacer click fuera
 */
function setupClickOutside() {
    const modals = [
        DOM_IDS.FILE_MODAL,
        DOM_IDS.NOTES_MODAL,
        DOM_IDS.LOGS_MODAL
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
                }
            });
        }
    });
}

// ============================================
// MODAL DE ARCHIVOS
// ============================================

/**
 * Mostrar modal de archivos
 */
export function showFileModal() {
    const modal = document.getElementById(DOM_IDS.FILE_MODAL);
    modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);
}

/**
 * Ocultar modal de archivos
 */
export function hideFileModal() {
    const modal = document.getElementById(DOM_IDS.FILE_MODAL);
    modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
    
    // Resetear input de archivo
    const fileInput = document.getElementById(DOM_IDS.FILE_INPUT);
    if (fileInput) {
        fileInput.value = '';
    }
    
    // Disparar evento de cierre
    document.dispatchEvent(new CustomEvent('fileModalClosed'));
}

/**
 * Cambiar tab de archivos
 */
export function switchFileTab(tab) {
    // Actualizar tabs
    document.querySelectorAll('.file-tab').forEach(t => {
        t.classList.toggle(CSS_CLASSES.FILE_TAB_ACTIVE, t.dataset.tab === tab);
    });
    
    // Actualizar contenido
    document.querySelectorAll('.file-list-content').forEach(content => {
        const contentId = content.id;
        const shouldShow =
            (tab === FILE_TABS.SERVER && contentId === DOM_IDS.FILE_LIST_SERVER) ||
            (tab === FILE_TABS.PRINTER && contentId === DOM_IDS.FILE_LIST_PRINTER) ||
            (tab === FILE_TABS.UPLOAD && contentId === DOM_IDS.FILE_UPLOAD_AREA);
        content.classList.toggle(CSS_CLASSES.FILE_LIST_ACTIVE, shouldShow);
    });
    
    // Disparar evento de cambio de tab
    document.dispatchEvent(new CustomEvent('fileTabChanged', { 
        detail: { tab } 
    }));
}

/**
 * Mostrar/ocultar progreso de subida
 */
export function showUploadProgress() {
    const progress = document.getElementById(DOM_IDS.UPLOAD_PROGRESS);
    if (progress) {
        progress.style.display = 'block';
    }
}

export function hideUploadProgress() {
    const progress = document.getElementById(DOM_IDS.UPLOAD_PROGRESS);
    if (progress) {
        progress.style.display = 'none';
    }
}

/**
 * Actualizar barra de progreso
 */
export function updateUploadProgress(percent) {
    const progressBar = document.getElementById(DOM_IDS.UPLOAD_PROGRESS_BAR);
    const progressText = document.getElementById(DOM_IDS.UPLOAD_PROGRESS_TEXT);
    
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    
    if (progressText) {
        progressText.textContent = `${percent}%`;
    }
}

/**
 * Resetear progreso de subida
 */
export function resetUploadProgress() {
    updateUploadProgress(0);
    hideUploadProgress();
}

// ============================================
// MODAL DE NOTAS
// ============================================

let currentNotesCallback = null;

/**
 * Mostrar modal de notas
 */
export function showNotesModal(currentNotes = '', onSave = null) {
    const modal = document.getElementById(DOM_IDS.NOTES_MODAL);
    const input = document.getElementById(DOM_IDS.NOTES_INPUT);
    
    input.value = currentNotes;
    modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);
    input.focus();
    
    currentNotesCallback = onSave;
}

/**
 * Ocultar modal de notas
 */
export function hideNotesModal() {
    const modal = document.getElementById(DOM_IDS.NOTES_MODAL);
    modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
    currentNotesCallback = null;
}

/**
 * Obtener notas actuales del modal
 */
export function getNotesValue() {
    const input = document.getElementById(DOM_IDS.NOTES_INPUT);
    return input ? input.value : '';
}

/**
 * Obtener callback de guardado de notas
 */
export function getNotesCallback() {
    return currentNotesCallback;
}

/**
 * Configurar botón de guardar notas
 */
export function setupNotesSaveButton(callback) {
    const saveBtn = document.getElementById(DOM_IDS.SAVE_NOTES);
    if (saveBtn) {
        // Remover listeners anteriores
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        // Agregar nuevo listener
        newBtn.addEventListener('click', callback);
    }
}

// ============================================
// MODAL DE LOGS
// ============================================

/**
 * Mostrar modal de logs
 */
export function showLogsModal(logsContent = '') {
    const modal = document.getElementById(DOM_IDS.LOGS_MODAL);
    const content = document.getElementById(DOM_IDS.LOGS_CONTENT);
    
    if (content) {
        if (logsContent) {
            content.innerHTML = logsContent;
        } else {
            // Logs de ejemplo si no se proporcionan
            content.innerHTML = `
                <div class="log-entry">2025-10-06 14:23:45 - Iniciando impresión...</div>
                <div class="log-entry">2025-10-06 14:23:50 - Calentando hotend a 210°C</div>
                <div class="log-entry">2025-10-06 14:24:15 - Calentando cama a 60°C</div>
                <div class="log-entry warning">2025-10-06 14:24:20 - Advertencia: Temperatura fluctuante</div>
                <div class="log-entry">2025-10-06 14:25:00 - Iniciando homing</div>
                <div class="log-entry">2025-10-06 14:25:30 - Comenzando impresión</div>
            `;
        }
    }
    
    modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);
}

/**
 * Ocultar modal de logs
 */
export function hideLogsModal() {
    const modal = document.getElementById(DOM_IDS.LOGS_MODAL);
    modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
}

/**
 * Agregar entrada de log
 */
export function addLogEntry(message, type = 'info') {
    const content = document.getElementById(DOM_IDS.LOGS_CONTENT);
    if (content) {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `${new Date().toLocaleString()} - ${message}`;
        content.appendChild(entry);
        
        // Scroll al final
        content.scrollTop = content.scrollHeight;
    }
}

/**
 * Limpiar logs
 */
export function clearLogs() {
    const content = document.getElementById(DOM_IDS.LOGS_CONTENT);
    if (content) {
        content.innerHTML = '';
    }
}

// ============================================
// UTILIDADES GENERALES
// ============================================

/**
 * Verificar si algún modal está abierto
 */
export function isAnyModalOpen() {
    const modals = [
        DOM_IDS.FILE_MODAL,
        DOM_IDS.NOTES_MODAL,
        DOM_IDS.LOGS_MODAL,
        DOM_IDS.LOGIN_MODAL
    ];
    
    return modals.some(modalId => {
        const modal = document.getElementById(modalId);
        return modal && modal.classList.contains(CSS_CLASSES.MODAL_ACTIVE);
    });
}

/**
 * Cerrar todos los modales
 */
export function closeAllModals() {
    hideFileModal();
    hideNotesModal();
    hideLogsModal();
}

// Export default
export default {
    initModals,
    showFileModal,
    hideFileModal,
    switchFileTab,
    showUploadProgress,
    hideUploadProgress,
    updateUploadProgress,
    resetUploadProgress,
    showNotesModal,
    hideNotesModal,
    getNotesValue,
    getNotesCallback,
    setupNotesSaveButton,
    showLogsModal,
    hideLogsModal,
    addLogEntry,
    clearLogs,
    isAnyModalOpen,
    closeAllModals
};