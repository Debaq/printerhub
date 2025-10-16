/**
 * PrinterHub - Files Manager
 * Gestión de archivos gcode
 */

class FilesManager {
  constructor() {
    this.files = [];
    this.filteredFiles = [];
    this.currentFilter = {};
    this.container = null;
  }

  /**
   * Inicializar
   */
  async init(containerId = 'files-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      Utils.error('Files container not found');
      return;
    }

    await this.loadFiles();
    this.setupEventListeners();

    Utils.log('FilesManager initialized');
  }

  /**
   * Cargar archivos
   */
  async loadFiles(filters = {}) {
    try {
      const response = await API.getFiles(filters);
      
      if (response.success) {
        this.files = response.files || [];
        this.filteredFiles = this.files;
        this.render();
      } else {
        Notifications.error('Error al cargar archivos');
      }
    } catch (error) {
      Utils.error('Error loading files:', error);
      Notifications.error('Error de conexión al cargar archivos');
    }
  }

  /**
   * Renderizar archivos
   */
  render() {
    if (!this.container) return;

    if (this.filteredFiles.length === 0) {
      this.container.innerHTML = this.renderEmpty();
      return;
    }

    this.container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Tamaño</th>
              <th>Subido por</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredFiles.map(file => this.renderFileRow(file)).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.attachListeners();
  }

  /**
   * Renderizar fila de archivo
   */
  renderFileRow(file) {
    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
            <span style="font-size: var(--font-size-lg);">📄</span>
            <div>
              <div style="font-weight: var(--font-weight-medium); color: var(--text-primary);">
                ${Utils.escapeHtml(file.original_name || file.filename)}
              </div>
              ${file.checksum_md5 ? `
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary); font-family: var(--font-mono);">
                  MD5: ${file.checksum_md5.substring(0, 8)}...
                </div>
              ` : ''}
            </div>
          </div>
        </td>
        <td>${Utils.formatBytes(file.size_bytes)}</td>
        <td>${file.uploaded_by || 'Sistema'}</td>
        <td>${Utils.formatDate(file.uploaded_at, true)}</td>
        <td>
          <span class="badge badge-${file.is_private ? 'warning' : 'info'}">
            ${file.is_private ? '🔒 Privado' : '🌐 Público'}
          </span>
          ${file.downloaded ? `<span class="badge badge-success">✅ Descargado</span>` : ''}
        </td>
        <td>
          <div style="display: flex; gap: var(--spacing-xs);">
            <button 
              class="btn btn-sm btn-primary" 
              data-action="send-to-print" 
              data-file-id="${file.id}"
              title="Enviar a imprimir"
            >
              🖨️
            </button>
            <button 
              class="btn btn-sm btn-ghost" 
              data-action="download" 
              data-file-id="${file.id}"
              title="Descargar"
            >
              ⬇️
            </button>
            ${Auth.canPrintPrivate() ? `
              <button 
                class="btn btn-sm btn-ghost" 
                data-action="toggle-privacy" 
                data-file-id="${file.id}"
                data-is-private="${file.is_private}"
                title="Cambiar privacidad"
              >
                ${file.is_private ? '🔓' : '🔒'}
              </button>
            ` : ''}
            ${Auth.isAdmin() || file.can_delete ? `
              <button 
                class="btn btn-sm btn-danger" 
                data-action="delete" 
                data-file-id="${file.id}"
                title="Eliminar"
              >
                🗑️
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * Renderizar estado vacío
   */
  renderEmpty() {
    return `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">📁</div>
        <h3 class="dashboard-empty-title">No hay archivos</h3>
        <p class="dashboard-empty-message">Sube tu primer archivo para comenzar</p>
        <button class="btn btn-primary" onclick="document.getElementById('file-upload-input').click()">
          📤 Subir Archivo
        </button>
      </div>
    `;
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Botón de subir archivo
    const uploadBtn = document.getElementById('upload-file-btn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        document.getElementById('file-upload-input')?.click();
      });
    }

    // Input de archivo
    const fileInput = document.getElementById('file-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.uploadFile(file);
          fileInput.value = ''; // Reset input
        }
      });
    }

    // Filtros
    const filterInputs = document.querySelectorAll('[data-filter]');
    filterInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.applyFilters();
      });
    });

    // Búsqueda
    const searchInput = document.getElementById('files-search');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        this.currentFilter.search = e.target.value.trim();
        this.applyFilters();
      }, 300));
    }
  }

  /**
   * Adjuntar listeners a las filas
   */
  attachListeners() {
    const actionBtns = this.container.querySelectorAll('[data-action]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const fileId = btn.dataset.fileId;
        
        await this.handleAction(action, fileId, btn);
      });
    });
  }

  /**
   * Manejar acciones
   */
  async handleAction(action, fileId, btn) {
    try {
      switch (action) {
        case 'send-to-print':
          await this.sendToPrint(fileId);
          break;

        case 'download':
          this.downloadFile(fileId);
          break;

        case 'toggle-privacy':
          await this.togglePrivacy(fileId, btn.dataset.isPrivate === '1');
          break;

        case 'delete':
          await this.deleteFile(fileId);
          break;
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Subir archivo
   */
  async uploadFile(file) {
    // Validar tipo de archivo
    if (!Utils.isValidFileType(file.name)) {
      Notifications.error('Tipo de archivo no válido. Solo se permiten archivos .gcode, .gco, .g');
      return;
    }

    // Validar tamaño
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      Notifications.error(`El archivo es demasiado grande. Máximo: ${Utils.formatBytes(CONFIG.MAX_FILE_SIZE)}`);
      return;
    }

    // Preguntar si es privado (si tiene permisos)
    let isPrivate = false;
    if (Auth.canPrintPrivate()) {
      isPrivate = await Notifications.confirm(
        '¿Deseas que este archivo sea privado?',
        'Privacidad del archivo',
        'Privado',
        'Público'
      );
    }

    const loadingId = Notifications.loading(`Subiendo ${file.name}...`);

    try {
      const response = await API.uploadFile(file, isPrivate);
      
      Notifications.remove(loadingId);
      
      if (response.success) {
        Notifications.actionSuccess('upload');
        await this.loadFiles();
      } else {
        Notifications.error(response.message || 'Error al subir archivo');
      }
    } catch (error) {
      Notifications.remove(loadingId);
      throw error;
    }
  }

  /**
   * Enviar a imprimir
   */
  async sendToPrint(fileId) {
    // Modal para seleccionar impresora
    const printers = await this.getAvailablePrinters();
    
    if (printers.length === 0) {
      Notifications.warning('No hay impresoras disponibles');
      return;
    }

    // Crear modal de selección
    const modalHtml = `
      <div class="modal-body">
        <p style="margin-bottom: var(--spacing-lg); color: var(--text-secondary);">
          Selecciona la impresora donde deseas enviar este archivo:
        </p>
        <select id="printer-select" class="form-control">
          ${printers.map(p => `
            <option value="${p.id}">${Utils.escapeHtml(p.name)} - ${Utils.getStatusText(p.status)}</option>
          `).join('')}
        </select>
        ${Auth.canPrintPrivate() ? `
          <div class="form-checkbox" style="margin-top: var(--spacing-md);">
            <input type="checkbox" id="private-print">
            <label for="private-print">Impresión privada</label>
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="cancel">Cancelar</button>
        <button class="btn btn-primary" data-action="confirm">Enviar a Imprimir</button>
      </div>
    `;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal modal-sm"><div class="modal-header"><h2 class="modal-title">Enviar a Imprimir</h2></div>${modalHtml}</div>`;
    document.body.appendChild(backdrop);

    const modal = backdrop.querySelector('.modal');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');

    confirmBtn.addEventListener('click', async () => {
      const printerId = modal.querySelector('#printer-select').value;
      const isPrivate = modal.querySelector('#private-print')?.checked || false;
      
      document.body.removeChild(backdrop);
      
      const loadingId = Notifications.loading('Enviando archivo a imprimir...');
      
      try {
        await API.sendToPrinter(fileId, printerId, isPrivate);
        Notifications.remove(loadingId);
        Notifications.success('Archivo enviado a imprimir');
      } catch (error) {
        Notifications.remove(loadingId);
        Notifications.apiError(error);
      }
    });

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(backdrop);
    });
  }

  /**
   * Obtener impresoras disponibles
   */
  async getAvailablePrinters() {
    try {
      const response = await API.getPrinters();
      if (response.success) {
        return response.printers || [];
      }
    } catch (error) {
      Utils.error('Error getting printers:', error);
    }
    return [];
  }

  /**
   * Descargar archivo
   */
  downloadFile(fileId) {
    const url = API.getFileDownloadUrl(fileId);
    window.open(url, '_blank');
  }

  /**
   * Cambiar privacidad
   */
  async togglePrivacy(fileId, currentPrivacy) {
    const newPrivacy = !currentPrivacy;
    
    await API.setFilePrivacy(fileId, newPrivacy);
    Notifications.success(`Archivo marcado como ${newPrivacy ? 'privado' : 'público'}`);
    
    await this.loadFiles();
  }

  /**
   * Eliminar archivo
   */
  async deleteFile(fileId) {
    if (await Notifications.confirm('¿Eliminar este archivo?', '¿Estás seguro?')) {
      await API.deleteFile(fileId);
      Notifications.actionSuccess('delete');
      await this.loadFiles();
    }
  }

  /**
   * Aplicar filtros
   */
  applyFilters() {
    this.filteredFiles = this.files.filter(file => {
      // Filtro por búsqueda
      if (this.currentFilter.search) {
        const search = this.currentFilter.search.toLowerCase();
        const name = (file.original_name || file.filename).toLowerCase();
        
        if (!name.includes(search)) {
          return false;
        }
      }

      // Otros filtros...
      
      return true;
    });

    this.render();
  }

  /**
   * Destruir
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 FilesManager loaded');
}
