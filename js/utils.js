/**
 * PrinterHub - Utilities
 * Funciones de utilidad generales
 */

const Utils = {
  /**
   * Formatear bytes a tamaño legible
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  /**
   * Formatear temperatura
   */
  formatTemp(temp, showUnit = true) {
    if (temp === null || temp === undefined) return '--';
    return `${Math.round(temp)}${showUnit ? '°C' : ''}`;
  },

  /**
   * Formatear tiempo en segundos a formato legible
   */
  formatTime(seconds) {
    if (!seconds || seconds < 0) return '--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  },

  /**
   * Formatear timestamp a fecha legible
   */
  formatDate(timestamp, includeTime = false) {
    if (!timestamp) return '--';
    
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // Si es hoy
    if (days === 0) {
      if (hours === 0) {
        if (minutes === 0) {
          return 'Ahora';
        }
        return `Hace ${minutes} min`;
      }
      return `Hace ${hours}h`;
    }
    
    // Si es ayer
    if (days === 1) {
      return includeTime ? `Ayer ${this.formatTimeOnly(date)}` : 'Ayer';
    }
    
    // Fecha completa
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    if (includeTime) {
      return `${day}/${month}/${year} ${this.formatTimeOnly(date)}`;
    }
    
    return `${day}/${month}/${year}`;
  },

  /**
   * Formatear solo la hora
   */
  formatTimeOnly(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * Calcular tiempo relativo
   */
  timeAgo(timestamp) {
    if (!timestamp) return '--';
    
    const now = Date.now();
    const date = timestamp * 1000;
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
    
    return this.formatDate(timestamp);
  },

  /**
   * Validar email
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Validar password
   */
  isValidPassword(password) {
    return password && password.length >= CONFIG.MIN_PASSWORD_LENGTH;
  },

  /**
   * Calcular fuerza de password
   */
  getPasswordStrength(password) {
    if (!password) return { strength: 'weak', score: 0 };
    
    let score = 0;
    
    // Longitud
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // Contiene números
    if (/\d/.test(password)) score++;
    
    // Contiene minúsculas
    if (/[a-z]/.test(password)) score++;
    
    // Contiene mayúsculas
    if (/[A-Z]/.test(password)) score++;
    
    // Contiene caracteres especiales
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) return { strength: 'weak', score };
    if (score <= 4) return { strength: 'medium', score };
    return { strength: 'strong', score };
  },

  /**
   * Validar nombre de usuario
   */
  isValidUsername(username) {
    return username && username.length >= CONFIG.MIN_USERNAME_LENGTH && /^[a-zA-Z0-9_-]+$/.test(username);
  },

  /**
   * Escapar HTML
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  },

  /**
   * Truncar texto
   */
  truncate(text, maxLength = 50) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  },

  /**
   * Debounce function
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Copiar al portapapeles
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  },

  /**
   * Generar ID único
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Obtener parámetro de URL
   */
  getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  },

  /**
   * Verificar si el navegador está online
   */
  isOnline() {
    return navigator.onLine;
  },

  /**
   * Verificar si es móvil
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  /**
   * Scrollear a un elemento
   */
  scrollTo(element, behavior = 'smooth') {
    if (typeof element === 'string') {
      element = document.querySelector(element);
    }
    if (element) {
      element.scrollIntoView({ behavior, block: 'start' });
    }
  },

  /**
   * Formatear porcentaje
   */
  formatPercent(value, decimals = 0) {
    if (value === null || value === undefined) return '--';
    return `${Number(value).toFixed(decimals)}%`;
  },

  /**
   * Clamp (limitar valor entre min y max)
   */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Obtener icono para estado de impresora
   */
  getStatusIcon(status) {
    return CONFIG.STATUS_ICONS[status] || '❓';
  },

  /**
   * Obtener clase CSS para estado
   */
  getStatusClass(status) {
    return CONFIG.STATUS_COLORS[status] || 'gray';
  },

  /**
   * Obtener texto para estado
   */
  getStatusText(status) {
    const texts = {
      idle: 'En espera',
      printing: 'Imprimiendo',
      paused: 'Pausado',
      offline: 'Desconectado',
      error: 'Error',
      complete: 'Completado'
    };
    return texts[status] || status;
  },

  /**
   * Validar extensión de archivo
   */
  isValidFileType(filename) {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return CONFIG.ALLOWED_FILE_TYPES.includes(ext);
  },

  /**
   * Formatear velocidad
   */
  formatSpeed(speed) {
    if (!speed) return '--';
    return `${Math.round(speed)}%`;
  },

  /**
   * Sleep/delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Crear elemento DOM desde HTML string
   */
  createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  },

  /**
   * Log de debug (solo si DEBUG está activado)
   */
  log(...args) {
    if (CONFIG.DEBUG) {
      console.log('[PrinterHub]', ...args);
    }
  },

  /**
   * Log de error
   */
  error(...args) {
    console.error('[PrinterHub Error]', ...args);
  },

  /**
   * Log de warning
   */
  warn(...args) {
    console.warn('[PrinterHub Warning]', ...args);
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 Utils loaded');
}
