// ============================================
// FILES - Gestión de archivos
// ============================================

import { 
    DOM_IDS, 
    CSS_CLASSES, 
    FILE_CONFIG,
    FILE_TABS,
    UI_TEXTS 
} from './config.js';

import { 
    getServerFiles, 
    uploadFile, 
    startPrint,
    startPrintLocal
} from './api.js';

import { 
    showFileModal,
    hideFileModal,
    switchFileTab,
    showUploadProgress,
    hideUploadProgress,
    updateUploadProgress,
    resetUploadProgress
} from './modals.js';

// Estado del módulo
let selectedPrinter = null;
let selectedPrinterToken = null;
let availableFiles = [];

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar sistema de archivos
 */
export function initFiles() {
    setupFileEventListeners();
}

/**
 * Configurar event listeners de archivos
 */
function setupFileEventListeners() {
    // Botón de subir archivo
    document.getElementById(DOM_IDS.UPLOAD_FILE_BTN).addEventListener('click', () => {
        showFileSelector(null, true);
    });
    
    // Upload zone
    const uploadZone = document.getElementById(DOM_IDS.UPLOAD_ZONE);
    const fileInput = document.getElementById(DOM_IDS.FILE_INPUT);
    
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add(CSS_CLASSES.DRAG_OVER);
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove(CSS_CLASSES.DRAG_OVER);
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove(CSS_CLASSES.DRAG_OVER);
        if (e.dataTransfer.files.length) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFileUpload(e.target.files[0]);
        }
    });
    
    // Escuchar evento de cierre de modal
    document.addEventListener('fileModalClosed', () => {
        selectedPrinter = null;
        selectedPrinterToken = null;
    });
}

// ============================================
// SELECTOR DE ARCHIVOS
// ============================================

/**
 * Mostrar selector de archivos
 */
export async function showFileSelector(printerId, printerToken, uploadOnly = false) {
    selectedPrinter = printerId;
    selectedPrinterToken = printerToken;
    
    try {
        // Cargar archivos del servidor para esta impresora
        const response = await getServerFiles(printerToken);
        
        if (response.success) {
            availableFiles = response.files;
            renderFileList(FILE_TABS.SERVER);
            
            if (printerId) {
                // Cargar archivos locales de la impresora
                loadPrinterFiles(printerId);
            }
            
            showFileModal();
            
            if (uploadOnly) {
                switchFileTab(FILE_TABS.UPLOAD);
            }
        } else {
            alert('❌ ' + response.message);
        }
    } catch (error) {
        console.error('Error cargando archivos:', error);
        alert('❌ ERROR CARGANDO ARCHIVOS');
    }
}

/**
 * Renderizar lista de archivos del servidor
 */
function renderFileList(type) {
    const fileList = document.getElementById(DOM_IDS.FILE_LIST_SERVER);
    fileList.innerHTML = '';
    
    if (availableFiles.length === 0) {
        fileList.innerHTML = `<div style="text-align: center; color: #9D4EDD; padding: 20px;">${UI_TEXTS.NO_FILES}</div>`;
        return;
    }
    
    availableFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>📄 ${file.name}</span>
            <span style="color: #9D4EDD; font-size: 0.4rem;">${file.size || ''}</span>
        `;
        fileItem.addEventListener('click', () => selectFile(file.name, false));
        fileList.appendChild(fileItem);
    });
}

/**
 * Cargar archivos locales de la impresora
 */
function loadPrinterFiles(printerId) {
    const printerFileList = document.getElementById(DOM_IDS.FILE_LIST_PRINTER);
    printerFileList.innerHTML = `<div style="text-align: center; color: #9D4EDD; padding: 20px;">${UI_TEXTS.LOADING_FILES}</div>`;
    
    // Disparar evento para que el módulo de impresoras proporcione los archivos
    document.dispatchEvent(new CustomEvent('requestPrinterFiles', {
        detail: { printerId }
    }));
}

/**
 * Renderizar archivos locales de la impresora
 */
export function renderPrinterFiles(files) {
    const printerFileList = document.getElementById(DOM_IDS.FILE_LIST_PRINTER);
    printerFileList.innerHTML = '';
    
    if (!files || files.length === 0) {
        printerFileList.innerHTML = `<div style="text-align: center; color: #9D4EDD; padding: 20px;">${UI_TEXTS.NO_LOCAL_FILES}</div>`;
        return;
    }
    
    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>📄 ${file.name}</span>
            <span style="color: #9D4EDD; font-size: 0.4rem;">${file.size || ''}</span>
        `;
        fileItem.addEventListener('click', () => selectFile(file.name, true));
        printerFileList.appendChild(fileItem);
    });
}

/**
 * Seleccionar archivo para imprimir
 */
async function selectFile(fileName, isLocal) {
    if (!selectedPrinter) {
        alert(UI_TEXTS.PRINTER_NOT_FOUND);
        return;
    }
    
    const action = isLocal ? 'archivo local' : 'descargando desde servidor';
    const confirmed = confirm(`🖨️ ¿Iniciar impresión de ${fileName}?\n(${action})`);
    
    if (!confirmed) return;
    
    try {
        let response;
        
        if (isLocal) {
            response = await startPrintLocal(selectedPrinter, fileName);
        } else {
            response = await startPrint(selectedPrinter, fileName);
        }
        
        if (response.success) {
            const msg = isLocal ?
                `✅ IMPRESIÓN INICIADA (LOCAL): ${fileName}` :
                `✅ IMPRESIÓN INICIADA (DESCARGANDO): ${fileName}`;
            alert(msg);
            hideFileModal();
            
            // Disparar evento para recargar impresoras
            document.dispatchEvent(new CustomEvent('reloadPrinters'));
        } else {
            alert(`❌ ERROR: ${response.message}`);
        }
    } catch (error) {
        console.error('Error iniciando impresión:', error);
        alert('❌ ERROR ENVIANDO COMANDO');
    }
}

// ============================================
// SUBIDA DE ARCHIVOS
// ============================================

/**
 * Manejar subida de archivo
 */
async function handleFileUpload(file) {
    // Validar extensión
    if (!file.name.toLowerCase().endsWith('.gcode')) {
        alert('❌ SOLO SE PERMITEN ARCHIVOS .GCODE');
        return;
    }
    
    // Validar tamaño
    if (file.size > FILE_CONFIG.MAX_SIZE) {
        alert('❌ ARCHIVO DEMASIADO GRANDE (MÁXIMO 100MB)');
        return;
    }
    
    // Verificar que hay impresora seleccionada o token
    if (!selectedPrinterToken) {
        alert('❌ SELECCIONA UNA IMPRESORA PRIMERO');
        return;
    }
    
    showUploadProgress();
    
    try {
        const response = await uploadFile(file, selectedPrinterToken, (percent) => {
            updateUploadProgress(percent);
        });
        
        if (response.success) {
            setTimeout(() => {
                resetUploadProgress();
                alert('✅ ARCHIVO SUBIDO: ' + file.name);
                
                if (selectedPrinter) {
                    // Si hay impresora seleccionada, preguntar si imprimir
                    const print = confirm('¿Deseas imprimir este archivo ahora?');
                    if (print) {
                        selectFile(response.file.name, false);
                    } else {
                        hideFileModal();
                    }
                } else {
                    hideFileModal();
                }
            }, 500);
        } else {
            alert('❌ ' + response.message);
            resetUploadProgress();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ ERROR SUBIENDO ARCHIVO');
        resetUploadProgress();
    }
}

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

/**
 * Obtener impresora seleccionada
 */
export function getSelectedPrinter() {
    return selectedPrinter;
}

/**
 * Obtener token de impresora seleccionada
 */
export function getSelectedPrinterToken() {
    return selectedPrinterToken;
}

/**
 * Limpiar selección
 */
export function clearSelection() {
    selectedPrinter = null;
    selectedPrinterToken = null;
}

// Export default
export default {
    initFiles,
    showFileSelector,
    renderPrinterFiles,
    getSelectedPrinter,
    getSelectedPrinterToken,
    clearSelection
};