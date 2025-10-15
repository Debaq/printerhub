// ============================================
// PRINTERS - Lógica de impresoras
// ============================================

import {
    PRINTER_STATUS,
    STATUS_MESSAGES,
    TEMP_LIMITS,
    COMMANDS,
    CONFIRM_MESSAGES,
    DOM_IDS,
    UI_TEXTS
} from './config.js';

import {
    getPrinters,
    sendCommand,
    setSpeed as apiSetSpeed,
    saveNotes as apiSaveNotes
} from './api.js';

import { isUserAuthenticated, requireAuth } from './auth.js';
import { showNotesModal, hideNotesModal, getNotesValue, setupNotesSaveButton, showLogsModal } from './modals.js';
import { showFileSelector, renderPrinterFiles } from './files.js';

// Estado del módulo
let printers = [];
let completedPrints = new Set();
let tempCharts = {};
let currentNotesPrinterId = null;

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar módulo de impresoras
 */
export function initPrinters() {
    setupPrinterEventListeners();
}

/**
 * Configurar event listeners
 */
function setupPrinterEventListeners() {
    // Escuchar solicitudes de archivos de impresora
    document.addEventListener('requestPrinterFiles', (e) => {
        const { printerId } = e.detail;
        const printer = printers.find(p => p.id === printerId);
        if (printer) {
            renderPrinterFiles(printer.files || []);
        }
    });
    
    // Configurar botón de guardar notas
    setupNotesSaveButton(() => {
        handleSaveNotes();
    });
}

// ============================================
// CARGAR Y ACTUALIZAR
// ============================================

/**
 * Cargar impresoras desde el servidor
 */
export async function loadPrinters() {
    try {
        const response = await getPrinters();
        
        if (response.success) {
            // Detectar impresiones completadas
            response.printers.forEach(printer => {
                const wasCompleted = completedPrints.has(printer.id);
                const isCompleted = printer.last_completed && !wasCompleted;
                
                if (isCompleted) {
                    playCompletionSound();
                    showNotification(`✅ ${printer.name} completó la impresión!`);
                    completedPrints.add(printer.id);
                }
            });
            
            printers = response.printers;
            return printers;
        }
    } catch (error) {
        console.error('Error cargando impresoras:', error);
    }
    
    return [];
}

/**
 * Obtener lista de impresoras
 */
export function getPrintersList() {
    return printers;
}

/**
 * Obtener impresora por ID
 */
export function getPrinterById(printerId) {
    return printers.find(p => p.id === printerId);
}

// ============================================
// COMANDOS
// ============================================

/**
 * Enviar comando a impresora
 */
export async function sendPrinterCommand(printerId, command, extraData = {}) {
    if (!requireAuth()) {
        return;
    }
    
    // Confirmar comandos críticos
    if (CONFIRM_MESSAGES[command]) {
        if (!confirm(CONFIRM_MESSAGES[command])) {
            return;
        }
    }
    
    try {
        const response = await sendCommand(printerId, command, extraData);
        
        if (response.success) {
            alert(`✅ COMANDO ENVIADO: ${command.toUpperCase()}`);
            // Disparar evento para recargar
            document.dispatchEvent(new CustomEvent('reloadPrinters'));
        } else {
            alert(`❌ ERROR: ${response.message}`);
        }
    } catch (error) {
        console.error('Error enviando comando:', error);
        alert('❌ ERROR ENVIANDO COMANDO');
    }
}

/**
 * Cambiar velocidad de impresión
 */
export async function changeSpeed(printerId, speed) {
    if (!requireAuth()) {
        return;
    }
    
    try {
        const response = await apiSetSpeed(printerId, speed);
        
        if (response.success) {
            console.log(`✅ Velocidad ajustada a ${speed}%`);
        }
    } catch (error) {
        console.error('Error ajustando velocidad:', error);
    }
}

/**
 * Alternar ventilador
 */
export function toggleFan(printerId) {
    sendPrinterCommand(printerId, COMMANDS.TOGGLE_FAN);
}

// ============================================
// ARCHIVOS E IMPRESIÓN
// ============================================

/**
 * Mostrar selector de archivos para impresora
 */
export function showPrinterFileSelector(printerId) {
    if (!requireAuth()) {
        return;
    }
    
    const printer = getPrinterById(printerId);
    if (!printer) {
        alert(UI_TEXTS.PRINTER_NOT_FOUND);
        return;
    }
    
    showFileSelector(printerId, printer.token, false);
}

// ============================================
// NOTAS
// ============================================

/**
 * Mostrar modal de notas
 */
export function showPrinterNotes(printerId) {
    const printer = getPrinterById(printerId);
    if (!printer) {
        alert(UI_TEXTS.PRINTER_NOT_FOUND);
        return;
    }
    
    currentNotesPrinterId = printerId;
    showNotesModal(printer.notes || '');
}

/**
 * Guardar notas
 */
async function handleSaveNotes() {
    if (!currentNotesPrinterId) {
        return;
    }
    
    const notes = getNotesValue();
    
    try {
        const response = await apiSaveNotes(currentNotesPrinterId, notes);
        
        if (response.success) {
            alert('✅ NOTAS GUARDADAS');
            hideNotesModal();
            currentNotesPrinterId = null;
            
            // Recargar impresoras
            document.dispatchEvent(new CustomEvent('reloadPrinters'));
        } else {
            alert(`❌ ERROR: ${response.message}`);
        }
    } catch (error) {
        console.error('Error guardando notas:', error);
        alert('❌ ERROR GUARDANDO NOTAS');
    }
}

// ============================================
// LOGS
// ============================================

/**
 * Mostrar logs de impresora
 */
export function showPrinterLogs(printerId) {
    const printer = getPrinterById(printerId);
    if (!printer) {
        alert(UI_TEXTS.PRINTER_NOT_FOUND);
        return;
    }
    
    // En producción, cargar logs reales
    showLogsModal();
}

// ============================================
// UTILIDADES
// ============================================

/**
 * Verificar temperatura y devolver clase de alerta
 */
export function checkTemperature(hotend, bed) {
    if (hotend > TEMP_LIMITS.HOTEND_DANGER || bed > TEMP_LIMITS.BED_DANGER) {
        return 'temp-danger';
    }
    if (hotend > TEMP_LIMITS.HOTEND_WARNING || bed > TEMP_LIMITS.BED_WARNING) {
        return 'temp-warning';
    }
    return null;
}

/**
 * Obtener clase CSS según temperatura
 */
export function getTempClass(temp, max) {
    if (temp > max * 1.1) return 'danger';
    if (temp > max) return 'warning';
    return '';
}

/**
 * Formatear tiempo en minutos a string legible
 */
export function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

/**
 * Obtener mensaje aleatorio según estado
 */
export function getRandomMessage(status) {
    const messages = STATUS_MESSAGES[status] || STATUS_MESSAGES.idle;
    return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Determinar sección para impresora
 */
export function getSectionForPrinter(printer) {
    if (printer.status === PRINTER_STATUS.OFFLINE) return 'offline';
    if (printer.status === PRINTER_STATUS.PRINTING) return 'printing';
    return 'idle';
}

/**
 * Inicializar gráfico de temperatura
 */
export function initTempChart(printerId, printer) {
    const chartElement = document.getElementById(`chart-${printerId}`);
    if (!chartElement) return;
    
    // Almacenar historial de temperaturas
    if (!tempCharts[printerId]) {
        tempCharts[printerId] = {
            hotend: [],
            bed: []
        };
    }
    
    // Agregar nuevos valores
    tempCharts[printerId].hotend.push(printer.temp_hotend || 0);
    tempCharts[printerId].bed.push(printer.temp_bed || 0);
    
    // Mantener solo últimos 20 valores
    if (tempCharts[printerId].hotend.length > 20) {
        tempCharts[printerId].hotend.shift();
        tempCharts[printerId].bed.shift();
    }
    
    // Dibujar gráfico simple
    const maxTemp = 300;
    const hotendPercent = (tempCharts[printerId].hotend[tempCharts[printerId].hotend.length - 1] / maxTemp) * 100;
    const bedPercent = (tempCharts[printerId].bed[tempCharts[printerId].bed.length - 1] / maxTemp) * 100;
    
    chartElement.innerHTML = `
        <div style="padding: 5px; font-size: 0.4rem;">
            <div style="display: flex; align-items: center; margin-bottom: 5px;">
                <span style="color: #FF006E; margin-right: 10px;">HOTEND:</span>
                <div style="flex: 1; height: 8px; background: #0d001a; border: 1px solid #FF006E;">
                    <div style="height: 100%; width: ${hotendPercent}%; background: linear-gradient(90deg, #FF006E, #B026FF);"></div>
                </div>
            </div>
            <div style="display: flex; align-items: center;">
                <span style="color: #4CC9F0; margin-right: 10px;">CAMA:</span>
                <div style="flex: 1; height: 8px; background: #0d001a; border: 1px solid #4CC9F0;">
                    <div style="height: 100%; width: ${bedPercent}%; background: linear-gradient(90deg, #4CC9F0, #00F5FF);"></div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// NOTIFICACIONES
// ============================================

/**
 * Reproducir sonido de completado
 */
function playCompletionSound() {
    try {
        const audio = document.getElementById(DOM_IDS.COMPLETION_SOUND);
        if (audio) {
            audio.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
        }
    } catch (error) {
        console.log('Audio no disponible');
    }
}

/**
 * Mostrar notificación del navegador
 */
function showNotification(message) {
    // Usar notificaciones del navegador si están disponibles
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TecMedHub', {
            body: message,
            icon: 'logo.png'
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('TecMedHub', {
                    body: message,
                    icon: 'logo.png'
                });
            }
        });
    }
    
    console.log('🔔', message);
}

// ============================================
// EXPONER FUNCIONES GLOBALES
// ============================================

// Hacer funciones accesibles globalmente para onclick
window.sendCommand = sendPrinterCommand;
window.changeSpeed = changeSpeed;
window.toggleFan = toggleFan;
window.showFileSelector = showPrinterFileSelector;
window.showNotes = showPrinterNotes;
window.showLogs = showPrinterLogs;

// Export default
export default {
    initPrinters,
    loadPrinters,
    getPrintersList,
    getPrinterById,
    sendPrinterCommand,
    changeSpeed,
    toggleFan,
    showPrinterFileSelector,
    showPrinterNotes,
    showPrinterLogs,
    checkTemperature,
    getTempClass,
    formatTime,
    getRandomMessage,
    getSectionForPrinter,
    initTempChart
};