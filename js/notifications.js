/**
 * PrinterHub - Notifications System
 * Sistema de notificaciones toast
 */

class Notifications {
  static container = null;

  /**
   * Inicializar contenedor de notificaciones
   */
  static init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Mostrar notificación genérica
   */
  static show(message, type = 'info', duration = CONFIG.TOAST_DURATION, title = null) {
    this.init();

    const id = Utils.generateId();
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('data-toast-id', id);

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${Utils.escapeHtml(title)}</div>` : ''}
        <div class="toast-message">${Utils.escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Cerrar">×</button>
    `;

    // Event listener para cerrar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this.remove(id);
    });

    // Agregar al contenedor
    this.container.appendChild(toast);

    // Auto-remover después del duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  /**
   * Remover notificación
   */
  static remove(id) {
    const toast = this.container?.querySelector(`[data-toast-id="${id}"]`);
    if (toast) {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }
  }

  /**
   * Limpiar todas las notificaciones
   */
  static clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Notificación de éxito
   */
  static success(message, title = null) {
    return this.show(message, 'success', CONFIG.TOAST_DURATION, title);
  }

  /**
   * Notificación de error
   */
  static error(message, title = null) {
    return this.show(message, 'error', CONFIG.TOAST_DURATION_LONG, title);
  }

  /**
   * Notificación de advertencia
   */
  static warning(message, title = null) {
    return this.show(message, 'warning', CONFIG.TOAST_DURATION, title);
  }

  /**
   * Notificación de información
   */
  static info(message, title = null) {
    return this.show(message, 'info', CONFIG.TOAST_DURATION, title);
  }

  /**
   * Notificación persistente (no se cierra automáticamente)
   */
  static persistent(message, type = 'info', title = null) {
    return this.show(message, type, 0, title);
  }

  /**
   * Notificación de carga/progreso
   */
  static loading(message = 'Cargando...') {
    const id = Utils.generateId();
    this.init();

    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.setAttribute('data-toast-id', id);

    toast.innerHTML = `
      <div class="spinner spinner-sm"></div>
      <div class="toast-content">
        <div class="toast-message">${Utils.escapeHtml(message)}</div>
      </div>
    `;

    this.container.appendChild(toast);

    return id;
  }

  /**
   * Actualizar notificación existente
   */
  static update(id, message, type = null) {
    const toast = this.container?.querySelector(`[data-toast-id="${id}"]`);
    if (toast) {
      const messageEl = toast.querySelector('.toast-message');
      if (messageEl) {
        messageEl.textContent = message;
      }
      
      if (type) {
        toast.className = `toast toast-${type}`;
      }
    }
  }

  /**
   * Confirmar acción (devuelve Promise)
   */
  static async confirm(message, title = '¿Estás seguro?', confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
      const modal = Modal.confirm({
        title,
        message,
        icon: 'warning',
        confirmText,
        cancelText,
        onConfirm: () => {
          resolve(true);
        },
        onCancel: () => {
          resolve(false);
        }
      });
    });
  }

  /**
   * Prompt para input
   */
  static async prompt(message, title = 'Ingresa un valor', placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      const modalHtml = `
        <div class="modal-body">
          <p style="margin-bottom: var(--spacing-lg); color: var(--text-secondary);">
            ${Utils.escapeHtml(message)}
          </p>
          <input 
            type="text" 
            class="form-control" 
            placeholder="${Utils.escapeHtml(placeholder)}"
            value="${Utils.escapeHtml(defaultValue)}"
            id="prompt-input"
          >
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-action="cancel">Cancelar</button>
          <button class="btn btn-primary" data-action="confirm">Aceptar</button>
        </div>
      `;

      const modal = Modal.create({
        title,
        content: modalHtml,
        size: 'sm',
        onOpen: (modalEl) => {
          const input = modalEl.querySelector('#prompt-input');
          const confirmBtn = modalEl.querySelector('[data-action="confirm"]');
          const cancelBtn = modalEl.querySelector('[data-action="cancel"]');

          input.focus();

          confirmBtn.addEventListener('click', () => {
            const value = input.value.trim();
            Modal.close();
            resolve(value || null);
          });

          cancelBtn.addEventListener('click', () => {
            Modal.close();
            resolve(null);
          });

          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              const value = input.value.trim();
              Modal.close();
              resolve(value || null);
            }
          });
        }
      });
    });
  }

  /**
   * Mostrar error de API
   */
  static apiError(error) {
    let message = 'Ha ocurrido un error inesperado';
    
    if (typeof error === 'string') {
      message = error;
    } else if (error?.message) {
      message = error.message;
    } else if (error?.error) {
      message = error.error;
    }
    
    this.error(message, 'Error');
  }

  /**
   * Mostrar confirmación de acción exitosa
   */
  static actionSuccess(action) {
    const messages = {
      create: 'Creado exitosamente',
      update: 'Actualizado exitosamente',
      delete: 'Eliminado exitosamente',
      save: 'Guardado exitosamente',
      upload: 'Subido exitosamente',
      send: 'Enviado exitosamente',
      cancel: 'Cancelado exitosamente',
      pause: 'Pausado exitosamente',
      resume: 'Reanudado exitosamente'
    };
    
    this.success(messages[action] || 'Acción completada exitosamente');
  }
}

// CSS para animación de slideOutRight (agregar si no existe)
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 Notifications loaded');
  
  // Exponer para testing
  window.Notifications = Notifications;
}
