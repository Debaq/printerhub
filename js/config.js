/**
 * PrinterHub - Configuration
 * Configuración global de la aplicación
 */

const CONFIG = {
  // URL base de la API
  API_URL: '/api',
  
  // Intervalos de actualización (en milisegundos)
  REFRESH_INTERVAL: 5000, // 5 segundos
  REFRESH_INTERVAL_FAST: 2000, // 2 segundos (para impresiones activas)
  REFRESH_INTERVAL_SLOW: 10000, // 10 segundos (para idle)
  
  // LocalStorage keys
  SESSION_TOKEN_KEY: 'printerhub_token',
  USER_KEY: 'printerhub_user',
  REMEMBER_ME_KEY: 'printerhub_remember',
  THEME_KEY: 'printerhub_theme',
  VIEW_MODE_KEY: 'printerhub_view_mode',
  
  // Configuración de sesión
  SESSION_CHECK_INTERVAL: 60000, // 1 minuto
  
  // Configuración de archivos
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  ALLOWED_FILE_TYPES: ['.gcode', '.gco', '.g'],
  
  // Configuración de notificaciones
  TOAST_DURATION: 5000, // 5 segundos
  TOAST_DURATION_SHORT: 3000, // 3 segundos
  TOAST_DURATION_LONG: 7000, // 7 segundos
  
  // Estados de impresora
  PRINTER_STATUS: {
    IDLE: 'idle',
    PRINTING: 'printing',
    PAUSED: 'paused',
    OFFLINE: 'offline',
    ERROR: 'error',
    COMPLETE: 'complete'
  },
  
  // Iconos para estados
  STATUS_ICONS: {
    idle: '⚡',
    printing: '🖨️',
    paused: '⏸️',
    offline: '⚠️',
    error: '❌',
    complete: '✅'
  },
  
  // Colores para estados (CSS variables)
  STATUS_COLORS: {
    idle: 'info',
    printing: 'success',
    paused: 'warning',
    offline: 'gray',
    error: 'danger',
    complete: 'success'
  },
  
  // Roles de usuario
  USER_ROLES: {
    ADMIN: 'admin',
    USER: 'user'
  },
  
  // Periodos para estadísticas
  STATS_PERIODS: {
    '7d': '7 días',
    '30d': '30 días',
    '90d': '90 días',
    'all': 'Todo'
  },
  
  // Configuración de paginación
  ITEMS_PER_PAGE: 20,
  
  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 segundos
  
  // Validaciones
  MIN_PASSWORD_LENGTH: 6,
  MIN_USERNAME_LENGTH: 3,
  
  // Formatos
  DATE_FORMAT: 'DD/MM/YYYY',
  TIME_FORMAT: 'HH:mm:ss',
  DATETIME_FORMAT: 'DD/MM/YYYY HH:mm',
  
  // Debugging
  DEBUG: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  
  // Feature flags
  FEATURES: {
    DARK_MODE: true,
    NOTIFICATIONS: true,
    STATISTICS: true,
    FILE_UPLOAD: true,
    ADVANCED_CONTROLS: true
  }
};

// Hacer CONFIG inmutable
Object.freeze(CONFIG);
Object.freeze(CONFIG.PRINTER_STATUS);
Object.freeze(CONFIG.STATUS_ICONS);
Object.freeze(CONFIG.STATUS_COLORS);
Object.freeze(CONFIG.USER_ROLES);
Object.freeze(CONFIG.STATS_PERIODS);
Object.freeze(CONFIG.FEATURES);

// Export para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

// Debug log
if (CONFIG.DEBUG) {
  console.log('🔧 PrinterHub Config loaded:', CONFIG);
}
