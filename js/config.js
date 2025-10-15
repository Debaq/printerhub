// ============================================
// CONFIGURACIÓN GLOBAL - TecMedHub
// ============================================

// URLs de API
export const API_URL = 'api.php';
export const API_FILES_URL = 'api_files.php';

// Intervalos de tiempo (en milisegundos)
export const REFRESH_INTERVAL = 5000; // 5 segundos
export const CAMERA_INTERVAL = 30000; // 30 segundos

// Autenticación
export const PIN_CORRECT = '123456'; // ⚠️ CAMBIAR EN PRODUCCIÓN
export const AUTH_STORAGE_KEY = 'tecmedhub_auth';

// Modos de vista
export const VIEW_MODES = {
    COMPACT: 'compact',
    EXPANDED: 'expanded'
};

// Estados de impresora
export const PRINTER_STATUS = {
    PRINTING: 'printing',
    IDLE: 'idle',
    ERROR: 'error',
    OFFLINE: 'offline'
};

// Filtros por defecto
export const DEFAULT_FILTERS = {
    printing: true,
    idle: true,
    offline: true
};

// Mensajes según estado
export const STATUS_MESSAGES = {
    printing: [
        '🌈 FABRICANDO MAGIA'
    ],
    idle: [
        '✌️ LISTA PARA LA ACCIÓN'
    ],
    error: [
        '⚠️ HOUSTON TENEMOS PROBLEMA'
    ],
    offline: [
        '🔌 DESCONECTADA DEL MATRIX'
    ]
};

// Límites de temperatura
export const TEMP_LIMITS = {
    HOTEND_WARNING: 260,
    HOTEND_DANGER: 280,
    BED_WARNING: 100,
    BED_DANGER: 120
};

// Configuración de archivos
export const FILE_CONFIG = {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_EXTENSIONS: ['.gcode'],
    UPLOAD_CHUNK_SIZE: 8192
};

// Tabs de archivos
export const FILE_TABS = {
    SERVER: 'server',
    PRINTER: 'printer',
    UPLOAD: 'upload'
};

// IDs de elementos DOM (para referencia rápida)
export const DOM_IDS = {
    // Secciones
    SECTION_PRINTING: 'section-printing',
    SECTION_IDLE: 'section-idle',
    SECTION_OFFLINE: 'section-offline',
    
    // Auth
    USER_STATUS: 'user-status',
    LOGIN_BTN: 'login-btn',
    LOGOUT_BTN: 'logout-btn',
    LOGIN_MODAL: 'login-modal',
    PIN_INPUT: 'pin-input',
    SUBMIT_PIN: 'submit-pin',
    CLOSE_MODAL: 'close-modal',
    LOGIN_ERROR: 'login-error',
    
    // Búsqueda y filtros
    SEARCH_INPUT: 'search-input',
    FILTER_PRINTING: 'filter-printing',
    FILTER_IDLE: 'filter-idle',
    FILTER_OFFLINE: 'filter-offline',
    
    // Vistas
    COMPACT_VIEW: 'compact-view',
    EXPANDED_VIEW: 'expanded-view',
    UPLOAD_FILE_BTN: 'upload-file-btn',
    
    // Modal de archivos
    FILE_MODAL: 'file-modal',
    CLOSE_FILE_MODAL: 'close-file-modal',
    FILE_LIST_SERVER: 'file-list-server',
    FILE_LIST_PRINTER: 'file-list-printer',
    FILE_UPLOAD_AREA: 'file-upload-area',
    UPLOAD_ZONE: 'upload-zone',
    FILE_INPUT: 'file-input',
    UPLOAD_PROGRESS: 'upload-progress',
    UPLOAD_PROGRESS_BAR: 'upload-progress-bar',
    UPLOAD_PROGRESS_TEXT: 'upload-progress-text',
    
    // Modal de notas
    NOTES_MODAL: 'notes-modal',
    NOTES_INPUT: 'notes-input',
    SAVE_NOTES: 'save-notes',
    CLOSE_NOTES_MODAL: 'close-notes-modal',
    
    // Modal de logs
    LOGS_MODAL: 'logs-modal',
    LOGS_CONTENT: 'logs-content',
    CLOSE_LOGS_MODAL: 'close-logs-modal',
    
    // Sonido
    COMPLETION_SOUND: 'completion-sound'
};

// Selectores de grid por sección
export const GRID_SELECTORS = {
    printing: '[data-section="printing"]',
    idle: '[data-section="idle"]',
    offline: '[data-section="offline"]'
};

// Clases CSS
export const CSS_CLASSES = {
    MODAL_ACTIVE: 'active',
    COMPACT_MODE: 'compact-mode',
    PRINTER_CARD: 'printer-card',
    PRINTER_OFFLINE: 'offline',
    TEMP_WARNING: 'temp-warning',
    TEMP_DANGER: 'temp-danger',
    FILE_TAB_ACTIVE: 'active',
    FILE_LIST_ACTIVE: 'active',
    DRAG_OVER: 'drag-over',
    BTN_VIEW_ACTIVE: 'active'
};

// Comandos disponibles
export const COMMANDS = {
    HOME: 'home',
    HEAT: 'heat',
    PAUSE: 'pause',
    RESUME: 'resume',
    EMERGENCY_STOP: 'emergency_stop',
    REBOOT: 'reboot',
    TOGGLE_FAN: 'toggle_fan',
    SET_SPEED: 'set_speed',
    PRINT: 'print',
    PRINT_LOCAL: 'print_local'
};

// Mensajes de confirmación
export const CONFIRM_MESSAGES = {
    [COMMANDS.EMERGENCY_STOP]: '🚨 ¿SEGURO QUE QUIERES HACER STOP DE EMERGENCIA?',
    [COMMANDS.HEAT]: '🔥 ¿CALENTAR EXTRUSOR?',
    [COMMANDS.REBOOT]: '🔄 ¿REINICIAR LA IMPRESORA?'
};

// Textos de UI
export const UI_TEXTS = {
    VISITOR_MODE: '👀 MODO VISITANTE',
    ADMIN_MODE: '👑 MODO ADMIN',
    NO_PRINTERS: '🔍 NO HAY IMPRESORAS CONECTADAS',
    NO_FILES: '📂 NO HAY ARCHIVOS DISPONIBLES',
    NO_LOCAL_FILES: '📂 NO HAY ARCHIVOS EN LA IMPRESORA',
    LOADING_FILES: '📄 CARGANDO ARCHIVOS LOCALES...',
    PRINTER_NOT_FOUND: '❌ IMPRESORA NO ENCONTRADA',
    NO_IMAGE: '📷 SIN IMAGEN',
    LOGIN_REQUIRED: '🔒 NECESITAS ESTAR LOGUEADO',
    UNAUTHORIZED: 'No autorizado para descargar este archivo'
};

// Configuración de notificaciones
export const NOTIFICATION_CONFIG = {
    PERMISSION: 'granted',
    ICON: 'logo.png',
    TITLE: 'TecMedHub'
};

// Export del objeto de configuración completo
export default {
    API_URL,
    API_FILES_URL,
    REFRESH_INTERVAL,
    CAMERA_INTERVAL,
    PIN_CORRECT,
    AUTH_STORAGE_KEY,
    VIEW_MODES,
    PRINTER_STATUS,
    DEFAULT_FILTERS,
    STATUS_MESSAGES,
    TEMP_LIMITS,
    FILE_CONFIG,
    FILE_TABS,
    DOM_IDS,
    GRID_SELECTORS,
    CSS_CLASSES,
    COMMANDS,
    CONFIRM_MESSAGES,
    UI_TEXTS,
    NOTIFICATION_CONFIG
};