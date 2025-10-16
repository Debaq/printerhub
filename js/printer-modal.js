/**
 * PrinterHub - Printer Modal
 * Modal detallado de control de impresora
 */

class PrinterModal {
  static currentPrinterId = null;
  static currentTab = 'control';
  static modalElement = null;
  static refreshInterval = null;

  /**
   * Abrir modal de impresora
   */
  static async open(printerId) {
    this.currentPrinterId = printerId;
    this.currentTab = 'control';

    // Cargar datos de la impresora
    const printer = await this.loadPrinterData(printerId);
    if (!printer) return;

    // Crear modal
    this.createModal(printer);

    // Iniciar auto-refresh
    this.startAutoRefresh();
  }

  /**
   * Cargar datos de la impresora
   */
  static async loadPrinterData(printerId) {
    try {
      const response = await API.getPrinter(printerId);
      if (response.success) {
        return response.printer;
      } else {
        Notifications.error('Error al cargar datos de la impresora');
        return null;
      }
    } catch (error) {
      Notifications.apiError(error);
      return null;
    }
  }

  /**
   * Crear modal
   */
  static createModal(printer) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-lg">
        ${this.renderHeader(printer)}
        ${this.renderTabs()}
        ${this.renderBody(printer)}
      </div>
    `;

    document.body.appendChild(backdrop);
    this.modalElement = backdrop;

    // Event listeners
    this.attachEventListeners();

    // Cerrar con ESC
    document.addEventListener('keydown', this.handleKeyPress);
  }

  /**
   * Renderizar header
   */
  static renderHeader(printer) {
    const status = printer.status || 'offline';
    const statusText = Utils.getStatusText(status);
    const statusIcon = Utils.getStatusIcon(status);

    return `
      <div class="modal-header">
        <div>
          <h2 class="modal-title">
            ${statusIcon} ${Utils.escapeHtml(printer.name)}
          </h2>
          <div class="modal-subtitle">
            <span class="badge badge-${Utils.getStatusClass(status)}">${statusText}</span>
            ${printer.uptime ? `<span style="color: var(--text-tertiary); margin-left: var(--spacing-sm);">Uptime: ${printer.uptime}</span>` : ''}
          </div>
        </div>
        <button class="modal-close" data-action="close">×</button>
      </div>
    `;
  }

  /**
   * Renderizar tabs
   */
  static renderTabs() {
    const tabs = [
      { id: 'control', label: '🎮 Control', icon: '🎮' },
      { id: 'files', label: '📁 Archivos', icon: '📁' },
      { id: 'history', label: '📜 Historial', icon: '📜' },
      { id: 'stats', label: '📊 Estadísticas', icon: '📊' },
      { id: 'logs', label: '📋 Logs', icon: '📋' }
    ];

    return `
      <div class="modal-tabs">
        ${tabs.map(tab => `
          <button 
            class="modal-tab ${tab.id === this.currentTab ? 'active' : ''}" 
            data-tab="${tab.id}"
          >
            ${tab.icon} ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  /**
   * Renderizar body
   */
  static renderBody(printer) {
    return `
      <div class="modal-body">
        <div class="modal-tab-content ${this.currentTab === 'control' ? 'active' : ''}" data-tab-content="control">
          ${this.renderControlTab(printer)}
        </div>
        <div class="modal-tab-content ${this.currentTab === 'files' ? 'active' : ''}" data-tab-content="files">
          ${this.renderFilesTab(printer)}
        </div>
        <div class="modal-tab-content ${this.currentTab === 'history' ? 'active' : ''}" data-tab-content="history">
          ${this.renderHistoryTab(printer)}
        </div>
        <div class="modal-tab-content ${this.currentTab === 'stats' ? 'active' : ''}" data-tab-content="stats">
          ${this.renderStatsTab(printer)}
        </div>
        <div class="modal-tab-content ${this.currentTab === 'logs' ? 'active' : ''}" data-tab-content="logs">
          ${this.renderLogsTab(printer)}
        </div>
      </div>
    `;
  }

  /**
   * Tab de Control
   */
  static renderControlTab(printer) {
    const status = printer.status || 'offline';
    const isPrinting = status === 'printing' || status === 'paused';

    return `
      ${isPrinting ? this.renderProgressSection(printer) : ''}
      
      <div class="modal-section">
        <h3 class="modal-section-title">🌡️ Temperaturas</h3>
        <div class="modal-section-content">
          ${this.renderTemperatureControls(printer)}
        </div>
      </div>

      <div class="modal-section">
        <h3 class="modal-section-title">⚡ Controles Rápidos</h3>
        <div class="modal-section-content">
          ${this.renderQuickControls(printer)}
        </div>
      </div>

      <div class="modal-section">
        <h3 class="modal-section-title">🎯 Control Manual</h3>
        <div class="modal-section-content">
          ${this.renderManualControls(printer)}
        </div>
      </div>

      ${Auth.isAdmin() || isPrinting ? `
        <div class="modal-section">
          <h3 class="modal-section-title">💬 Gcode Personalizado</h3>
          <div class="modal-section-content">
            ${this.renderCustomGcodeSection()}
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Sección de progreso
   */
  static renderProgressSection(printer) {
    const progress = printer.progress || 0;
    const currentFile = printer.current_file || '';
    const timeRemaining = printer.time_remaining || 0;

    return `
      <div class="modal-section" style="background: var(--bg-secondary);">
        <h3 class="modal-section-title">📊 Progreso de Impresión</h3>
        <div class="modal-section-content">
          <div style="margin-bottom: var(--spacing-md);">
            <div style="display: flex; justify-content: space-between; margin-bottom: var(--spacing-sm);">
              <strong>${Utils.escapeHtml(currentFile)}</strong>
              <strong style="color: var(--primary-light);">${progress}%</strong>
            </div>
            <div class="progress">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          </div>
          ${timeRemaining > 0 ? `
            <div style="color: var(--text-secondary);">
              ⏱️ Tiempo restante: ${Utils.formatTime(timeRemaining)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Controles de temperatura
   */
  static renderTemperatureControls(printer) {
    return `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-lg);">
        <div>
          <div class="modal-slider">
            <div class="modal-slider-label">
              <span>🔥 Hotend</span>
              <span class="modal-slider-value" id="hotend-value">${Math.round(printer.temp_hotend || 0)}°C</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="300" 
              value="${printer.temp_hotend_target || 0}"
              id="hotend-slider"
              data-control="hotend"
            >
            <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: var(--spacing-xs);">
              <span>0°C</span>
              <span>Target: ${Math.round(printer.temp_hotend_target || 0)}°C</span>
              <span>300°C</span>
            </div>
          </div>
        </div>
        <div>
          <div class="modal-slider">
            <div class="modal-slider-label">
              <span>🛏️ Cama</span>
              <span class="modal-slider-value" id="bed-value">${Math.round(printer.temp_bed || 0)}°C</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="120" 
              value="${printer.temp_bed_target || 0}"
              id="bed-slider"
              data-control="bed"
            >
            <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: var(--spacing-xs);">
              <span>0°C</span>
              <span>Target: ${Math.round(printer.temp_bed_target || 0)}°C</span>
              <span>120°C</span>
            </div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" data-action="set-temp" style="margin-top: var(--spacing-md);">
        Aplicar Temperaturas
      </button>
    `;
  }

  /**
   * Controles rápidos
   */
  static renderQuickControls(printer) {
    const status = printer.status || 'offline';
    const isPrinting = status === 'printing';
    const isPaused = status === 'paused';

    return `
      <div class="modal-controls">
        ${isPrinting ? `
          <button class="modal-control-btn" data-action="pause">
            <div class="modal-control-icon">⏸️</div>
            <div class="modal-control-label">Pausar</div>
          </button>
        ` : ''}
        ${isPaused ? `
          <button class="modal-control-btn" data-action="resume">
            <div class="modal-control-icon">▶️</div>
            <div class="modal-control-label">Reanudar</div>
          </button>
        ` : ''}
        ${isPrinting || isPaused ? `
          <button class="modal-control-btn" data-action="cancel">
            <div class="modal-control-icon">❌</div>
            <div class="modal-control-label">Cancelar</div>
          </button>
        ` : ''}
        <button class="modal-control-btn" data-action="home-all">
          <div class="modal-control-icon">🏠</div>
          <div class="modal-control-label">Home All</div>
        </button>
        <button class="modal-control-btn" data-action="emergency">
          <div class="modal-control-icon">🚨</div>
          <div class="modal-control-label">Emergencia</div>
        </button>
      </div>
    `;
  }

  /**
   * Controles manuales
   */
  static renderManualControls(printer) {
    return `
      <div style="display: grid; gap: var(--spacing-lg);">
        <div>
          <label class="form-label">Home por Eje</label>
          <div style="display: flex; gap: var(--spacing-sm);">
            <button class="btn btn-sm btn-outline" data-action="home-x">Home X</button>
            <button class="btn btn-sm btn-outline" data-action="home-y">Home Y</button>
            <button class="btn btn-sm btn-outline" data-action="home-z">Home Z</button>
          </div>
        </div>
        <div>
          <label class="form-label" for="speed-slider">Velocidad de Impresión</label>
          <div class="modal-slider">
            <div class="modal-slider-label">
              <span>Velocidad</span>
              <span class="modal-slider-value" id="speed-value">${printer.print_speed || 100}%</span>
            </div>
            <input 
              type="range" 
              min="10" 
              max="200" 
              value="${printer.print_speed || 100}"
              id="speed-slider"
            >
          </div>
          <button class="btn btn-primary btn-sm" data-action="set-speed" style="margin-top: var(--spacing-sm);">
            Aplicar Velocidad
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Sección de Gcode personalizado
   */
  static renderCustomGcodeSection() {
    return `
      <div class="form-group">
        <label class="form-label" for="custom-gcode">Comando Gcode</label>
        <textarea 
          id="custom-gcode" 
          class="form-control" 
          rows="3" 
          placeholder="G28 ; Home all axes&#10;M104 S200 ; Set hotend temp"
          style="font-family: var(--font-mono);"
        ></textarea>
      </div>
      <button class="btn btn-warning" data-action="send-gcode">
        📤 Enviar Gcode
      </button>
    `;
  }

  /**
   * Tab de Archivos
   */
  static renderFilesTab(printer) {
    return `
      <div class="modal-section">
        <h3 class="modal-section-title">📤 Subir Archivo</h3>
        <div class="modal-section-content">
          <input type="file" id="file-upload" accept=".gcode,.gco,.g" class="form-control">
          <button class="btn btn-primary" data-action="upload-file" style="margin-top: var(--spacing-md);">
            Subir Archivo
          </button>
        </div>
      </div>
      <div class="modal-section">
        <h3 class="modal-section-title">📁 Archivos Disponibles</h3>
        <div id="files-list">
          <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-tertiary);">
            Cargando archivos...
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Tab de Historial
   */
  static renderHistoryTab(printer) {
    return `
      <div id="command-history">
        <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-tertiary);">
          Cargando historial...
        </div>
      </div>
    `;
  }

  /**
   * Tab de Estadísticas
   */
  static renderStatsTab(printer) {
    return `
      <div id="printer-stats">
        <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-tertiary);">
          Cargando estadísticas...
        </div>
      </div>
    `;
  }

  /**
   * Tab de Logs
   */
  static renderLogsTab(printer) {
    return `
      <div id="printer-logs">
        <div style="text-align: center; padding: var(--spacing-xl); color: var(--text-tertiary);">
          Cargando logs...
        </div>
      </div>
    `;
  }

  /**
   * Adjuntar event listeners
   */
  static attachEventListeners() {
    const modal = this.modalElement;
    if (!modal) return;

    // Cerrar modal
    const closeBtn = modal.querySelector('[data-action="close"]');
    closeBtn?.addEventListener('click', () => this.close());

    // Cerrar al hacer click fuera del modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });

    // Tabs
    const tabs = modal.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // Sliders de temperatura
    const hotendSlider = modal.querySelector('#hotend-slider');
    const bedSlider = modal.querySelector('#bed-slider');
    
    hotendSlider?.addEventListener('input', (e) => {
      const value = document.getElementById('hotend-value');
      if (value) value.textContent = `${e.target.value}°C`;
    });

    bedSlider?.addEventListener('input', (e) => {
      const value = document.getElementById('bed-value');
      if (value) value.textContent = `${e.target.value}°C`;
    });

    // Slider de velocidad
    const speedSlider = modal.querySelector('#speed-slider');
    speedSlider?.addEventListener('input', (e) => {
      const value = document.getElementById('speed-value');
      if (value) value.textContent = `${e.target.value}%`;
    });

    // Acciones
    const actionBtns = modal.querySelectorAll('[data-action]');
    actionBtns.forEach(btn => {
      if (btn.dataset.action === 'close') return; // Ya manejado
      
      btn.addEventListener('click', async () => {
        await this.handleAction(btn.dataset.action);
      });
    });
  }

  /**
   * Cambiar tab
   */
  static switchTab(tabId) {
    this.currentTab = tabId;

    // Actualizar tabs
    const tabs = this.modalElement.querySelectorAll('.modal-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Actualizar contenido
    const contents = this.modalElement.querySelectorAll('.modal-tab-content');
    contents.forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabId);
    });

    // Cargar contenido del tab si es necesario
    this.loadTabContent(tabId);
  }

  /**
   * Cargar contenido de tab
   */
  static async loadTabContent(tabId) {
    switch (tabId) {
      case 'files':
        await this.loadFiles();
        break;
      case 'history':
        await this.loadHistory();
        break;
      case 'stats':
        await this.loadStats();
        break;
      case 'logs':
        await this.loadLogs();
        break;
    }
  }

  /**
   * Cargar archivos
   */
  static async loadFiles() {
    const container = this.modalElement.querySelector('#files-list');
    if (!container) return;

    try {
      const response = await API.getFiles({ printer_id: this.currentPrinterId });
      
      if (response.success && response.files?.length > 0) {
        container.innerHTML = `
          <div class="modal-list">
            ${response.files.map(file => `
              <div class="modal-list-item">
                <div class="modal-list-item-content">
                  <div class="modal-list-item-title">${Utils.escapeHtml(file.original_name || file.filename)}</div>
                  <div class="modal-list-item-subtitle">
                    ${Utils.formatBytes(file.size_bytes)} • ${Utils.formatDate(file.uploaded_at)}
                  </div>
                </div>
                <div class="modal-list-item-actions">
                  <button class="btn btn-sm btn-primary" data-action="send-to-print" data-file-id="${file.id}">
                    🖨️ Imprimir
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
        
        // Adjuntar listeners
        const sendBtns = container.querySelectorAll('[data-action="send-to-print"]');
        sendBtns.forEach(btn => {
          btn.addEventListener('click', async () => {
            await this.sendFileToPrint(btn.dataset.fileId);
          });
        });
      } else {
        container.innerHTML = `
          <div class="modal-empty">
            <div class="modal-empty-icon">📁</div>
            <div class="modal-empty-title">Sin archivos</div>
            <div class="modal-empty-message">No hay archivos disponibles para esta impresora</div>
          </div>
        `;
      }
    } catch (error) {
      container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error al cargar archivos</div>`;
    }
  }

  /**
   * Cargar historial
   */
  static async loadHistory() {
    const container = this.modalElement.querySelector('#command-history');
    if (!container) return;

    try {
      const response = await API.getCommandHistory(this.currentPrinterId);
      
      if (response.success && response.commands?.length > 0) {
        container.innerHTML = `
          <div class="modal-list">
            ${response.commands.map(cmd => `
              <div class="modal-list-item">
                <div class="modal-list-item-content">
                  <div class="modal-list-item-title" style="font-family: var(--font-mono);">${Utils.escapeHtml(cmd.command)}</div>
                  <div class="modal-list-item-subtitle">
                    ${Utils.formatDate(cmd.created_at, true)} • 
                    <span class="badge badge-${cmd.status === 'completed' ? 'success' : 'warning'}">${cmd.status}</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="modal-empty">
            <div class="modal-empty-icon">📜</div>
            <div class="modal-empty-title">Sin historial</div>
          </div>
        `;
      }
    } catch (error) {
      container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error al cargar historial</div>`;
    }
  }

  /**
   * Cargar estadísticas
   */
  static async loadStats() {
    const container = this.modalElement.querySelector('#printer-stats');
    if (!container) return;

    try {
      const response = await API.getPrinterStats(this.currentPrinterId, '30d');
      
      if (response.success) {
        const stats = response.stats;
        container.innerHTML = `
          <div class="admin-stats">
            <div class="stat-card">
              <div class="stat-card-icon">✅</div>
              <div class="stat-card-value">${stats.jobs_completed || 0}</div>
              <div class="stat-card-label">Trabajos Completados</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon">⏱️</div>
              <div class="stat-card-value">${Utils.formatTime(stats.total_print_time || 0)}</div>
              <div class="stat-card-label">Tiempo Total</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-icon">🎯</div>
              <div class="stat-card-value">${Math.round(stats.success_rate || 0)}%</div>
              <div class="stat-card-label">Tasa de Éxito</div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error al cargar estadísticas</div>`;
    }
  }

  /**
   * Cargar logs
   */
  static async loadLogs() {
    const container = this.modalElement.querySelector('#printer-logs');
    if (!container) return;

    try {
      const response = await API.getActionsLog({ printer_id: this.currentPrinterId });
      
      if (response.success && response.logs?.length > 0) {
        container.innerHTML = `
          <div class="modal-list">
            ${response.logs.map(log => `
              <div class="modal-list-item">
                <div class="modal-list-item-content">
                  <div class="modal-list-item-title">${Utils.escapeHtml(log.action)} - ${Utils.escapeHtml(log.description)}</div>
                  <div class="modal-list-item-subtitle">
                    ${log.user_username} • ${Utils.formatDate(log.created_at, true)}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="modal-empty">
            <div class="modal-empty-icon">📋</div>
            <div class="modal-empty-title">Sin logs</div>
          </div>
        `;
      }
    } catch (error) {
      container.innerHTML = `<div style="color: var(--danger); text-align: center;">Error al cargar logs</div>`;
    }
  }

  /**
   * Manejar acciones
   */
  static async handleAction(action) {
    try {
      switch (action) {
        case 'pause':
          await API.pausePrint(this.currentPrinterId);
          Notifications.actionSuccess('pause');
          await this.refresh();
          break;

        case 'resume':
          await API.resumePrint(this.currentPrinterId);
          Notifications.actionSuccess('resume');
          await this.refresh();
          break;

        case 'cancel':
          if (await Notifications.confirm('¿Cancelar la impresión actual?')) {
            await API.cancelPrint(this.currentPrinterId);
            Notifications.actionSuccess('cancel');
            await this.refresh();
          }
          break;

        case 'emergency':
          if (await Notifications.confirm('¿Ejecutar parada de emergencia?', '¡Advertencia!')) {
            await API.emergencyStop(this.currentPrinterId);
            Notifications.warning('Parada de emergencia ejecutada');
            await this.refresh();
          }
          break;

        case 'home-all':
          await API.homeAxes(this.currentPrinterId, 'all');
          Notifications.success('Home ejecutado');
          break;

        case 'home-x':
          await API.homeAxes(this.currentPrinterId, 'X');
          Notifications.success('Home X ejecutado');
          break;

        case 'home-y':
          await API.homeAxes(this.currentPrinterId, 'Y');
          Notifications.success('Home Y ejecutado');
          break;

        case 'home-z':
          await API.homeAxes(this.currentPrinterId, 'Z');
          Notifications.success('Home Z ejecutado');
          break;

        case 'set-temp':
          await this.setTemperatures();
          break;

        case 'set-speed':
          await this.setSpeed();
          break;

        case 'send-gcode':
          await this.sendCustomGcode();
          break;

        case 'upload-file':
          await this.uploadFile();
          break;
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Establecer temperaturas
   */
  static async setTemperatures() {
    const hotend = this.modalElement.querySelector('#hotend-slider')?.value;
    const bed = this.modalElement.querySelector('#bed-slider')?.value;

    await API.setTemperature(this.currentPrinterId, hotend, bed);
    Notifications.success('Temperaturas configuradas');
  }

  /**
   * Establecer velocidad
   */
  static async setSpeed() {
    const speed = this.modalElement.querySelector('#speed-slider')?.value;
    
    await API.setSpeed(this.currentPrinterId, speed);
    Notifications.success('Velocidad configurada');
  }

  /**
   * Enviar Gcode personalizado
   */
  static async sendCustomGcode() {
    const textarea = this.modalElement.querySelector('#custom-gcode');
    const gcode = textarea?.value.trim();

    if (!gcode) {
      Notifications.warning('Ingresa un comando Gcode');
      return;
    }

    await API.sendCustomGcode(this.currentPrinterId, gcode);
    Notifications.success('Gcode enviado');
    textarea.value = '';
  }

  /**
   * Subir archivo
   */
  static async uploadFile() {
    const input = this.modalElement.querySelector('#file-upload');
    const file = input?.files[0];

    if (!file) {
      Notifications.warning('Selecciona un archivo');
      return;
    }

    if (!Utils.isValidFileType(file.name)) {
      Notifications.error('Tipo de archivo no válido');
      return;
    }

    const loadingId = Notifications.loading('Subiendo archivo...');

    try {
      await API.uploadFile(file, false, this.currentPrinterId);
      Notifications.remove(loadingId);
      Notifications.actionSuccess('upload');
      input.value = '';
      await this.loadFiles();
    } catch (error) {
      Notifications.remove(loadingId);
      throw error;
    }
  }

  /**
   * Enviar archivo a imprimir
   */
  static async sendFileToPrint(fileId) {
    if (await Notifications.confirm('¿Enviar este archivo a imprimir?')) {
      await API.sendToPrinter(fileId, this.currentPrinterId);
      Notifications.success('Archivo enviado a imprimir');
    }
  }

  /**
   * Refrescar datos del modal
   */
  static async refresh() {
    const printer = await this.loadPrinterData(this.currentPrinterId);
    if (!printer) return;

    // Re-renderizar solo el body
    const modalBody = this.modalElement.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = this.renderBody(printer).match(/<div class="modal-body">([\s\S]*)<\/div>/)[1];
      this.attachEventListeners();
    }

    // Actualizar header
    const modalHeader = this.modalElement.querySelector('.modal-header');
    if (modalHeader) {
      modalHeader.innerHTML = this.renderHeader(printer).match(/<div class="modal-header">([\s\S]*)<\/div>/)[1];
      
      const closeBtn = modalHeader.querySelector('[data-action="close"]');
      closeBtn?.addEventListener('click', () => this.close());
    }
  }

  /**
   * Iniciar auto-refresh
   */
  static startAutoRefresh() {
    if (this.refreshInterval) return;

    this.refreshInterval = setInterval(async () => {
      if (this.currentTab === 'control') {
        await this.refresh();
      }
    }, CONFIG.REFRESH_INTERVAL);
  }

  /**
   * Detener auto-refresh
   */
  static stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Manejar teclas
   */
  static handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      PrinterModal.close();
    }
  };

  /**
   * Cerrar modal
   */
  static close() {
    this.stopAutoRefresh();
    
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }

    document.removeEventListener('keydown', this.handleKeyPress);
    
    this.currentPrinterId = null;
    this.currentTab = 'control';
  }
}

// Hacer disponible globalmente
window.PrinterModal = PrinterModal;

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 PrinterModal loaded');
}
