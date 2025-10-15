// ============================================
// API - Comunicación con el servidor
// ============================================

import { API_URL, API_FILES_URL } from './config.js';

// ============================================
// IMPRESORAS
// ============================================

/**
 * Obtener lista de todas las impresoras
 */
export async function getPrinters() {
    try {
        const response = await fetch(`${API_URL}?action=get_printers`);
        const data = await response.json();
        
        if (data.success) {
            return {
                success: true,
                printers: data.printers
            };
        } else {
            return {
                success: false,
                message: data.message
            };
        }
    } catch (error) {
        console.error('Error obteniendo impresoras:', error);
        return {
            success: false,
            message: 'Error de conexión',
            error
        };
    }
}

/**
 * Obtener impresora por token
 */
export async function getPrinterByToken(token) {
    try {
        const response = await fetch(`${API_URL}?action=get_printer_by_token&token=${token}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error obteniendo impresora:', error);
        return { success: false, error };
    }
}

/**
 * Guardar notas de impresora
 */
export async function saveNotes(printerId, notes) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_notes',
                printer_id: printerId,
                notes: notes
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error guardando notas:', error);
        return { success: false, error };
    }
}

/**
 * Actualizar estado de la cama
 */
export async function updateBedStatus(printerId, bedStatus) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_bed_status',
                printer_id: printerId,
                bed_status: bedStatus
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error actualizando estado de cama:', error);
        return { success: false, error };
    }
}

/**
 * Agregar tag a impresora
 */
export async function addTag(printerId, tag) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'add_tag',
                printer_id: printerId,
                tag: tag
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error agregando tag:', error);
        return { success: false, error };
    }
}

/**
 * Remover tag de impresora
 */
export async function removeTag(printerId, tag) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'remove_tag',
                printer_id: printerId,
                tag: tag
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error removiendo tag:', error);
        return { success: false, error };
    }
}

// ============================================
// COMANDOS
// ============================================

/**
 * Enviar comando a impresora
 */
export async function sendCommand(printerId, command, extraData = {}) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: command,
                printer_id: printerId,
                ...extraData
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error enviando comando:', error);
        return { success: false, error };
    }
}

/**
 * Cambiar velocidad de impresión
 */
export async function setSpeed(printerId, speed) {
    return sendCommand(printerId, 'set_speed', { speed });
}

/**
 * Iniciar impresión desde archivo del servidor
 */
export async function startPrint(printerId, fileName) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'print',
                printer_id: printerId,
                file: fileName
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error iniciando impresión:', error);
        return { success: false, error };
    }
}

/**
 * Iniciar impresión desde archivo local de la impresora
 */
export async function startPrintLocal(printerId, fileName) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'print_local',
                printer_id: printerId,
                file: fileName
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error iniciando impresión local:', error);
        return { success: false, error };
    }
}

// ============================================
// ARCHIVOS
// ============================================

/**
 * Obtener lista de archivos del servidor
 */
export async function getServerFiles(printerToken = '') {
    try {
        let url = `${API_FILES_URL}?action=list_files`;
        
        if (printerToken) {
            url += `&printer_token=${printerToken}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error obteniendo archivos del servidor:', error);
        return { success: false, error };
    }
}

/**
 * Obtener información de un archivo
 */
export async function getFileInfo(fileName) {
    try {
        const response = await fetch(`${API_FILES_URL}?action=get_file_info&file=${fileName}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error obteniendo info de archivo:', error);
        return { success: false, error };
    }
}

/**
 * Subir archivo al servidor
 */
export async function uploadFile(file, printerToken, onProgress = null) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('printer_token', printerToken);
        formData.append('uploaded_by', 'admin');
        
        const xhr = new XMLHttpRequest();
        
        // Progreso de subida
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent);
                }
            });
        }
        
        // Completado
        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            } else {
                reject(new Error(`HTTP ${xhr.status}`));
            }
        });
        
        // Error
        xhr.addEventListener('error', () => {
            reject(new Error('Error de red'));
        });
        
        xhr.open('POST', `${API_FILES_URL}?action=upload_file`);
        xhr.send(formData);
    });
}

/**
 * Eliminar archivo del servidor
 */
export async function deleteFile(fileName) {
    try {
        const response = await fetch(API_FILES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete_file',
                file: fileName
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error eliminando archivo:', error);
        return { success: false, error };
    }
}

/**
 * Descargar archivo del servidor
 */
export function downloadFileUrl(fileName, printerToken = '') {
    let url = `${API_FILES_URL}?action=download_file&file=${fileName}`;
    
    if (printerToken) {
        url += `&printer_token=${printerToken}`;
    }
    
    return url;
}

/**
 * Marcar archivo como descargado
 */
export async function markFileDownloaded(fileName, printerToken) {
    try {
        const response = await fetch(API_FILES_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'mark_downloaded',
                file: fileName,
                printer_token: printerToken
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error marcando archivo como descargado:', error);
        return { success: false, error };
    }
}

// Export default con todas las funciones
export default {
    getPrinters,
    getPrinterByToken,
    saveNotes,
    updateBedStatus,
    addTag,
    removeTag,
    sendCommand,
    setSpeed,
    startPrint,
    startPrintLocal,
    getServerFiles,
    getFileInfo,
    uploadFile,
    deleteFile,
    downloadFileUrl,
    markFileDownloaded
};