/**
 * PrinterHub - Printers Manager
 * Gestión y visualización de impresoras
 */

class PrintersManager {
  constructor() {
    this.printers = [];
    this.filteredPrinters = [];
    this.refreshInterval = null;
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.currentView = localStorage.getItem(CONFIG.VIEW_MODE_KEY) || 'grid';
    this.isRefreshing = false;
    this.container = null;
  }

  /**
   * Inicializar
   */
  async init(containerId = 'printers-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      Utils.error('Printers container not found');
      return;
    }

    // Cargar impresoras
    await this.loadPrinters();

    // Iniciar auto-refresh
    this.startAutoRefresh();

    // Configurar event listeners
    this.setupEventListeners();

    // Configurar visibilidad de página para pausar refresh
    this.setupVisibilityChange();

    Utils.log('PrintersManager initialized');
  }

  /**
   * Cargar impresoras desde la API
   */
  async loadPrinters() {
    try {
      const response = await API.getPrinters();
      
      if (response.success) {
        this.printers = response.printers || [];
        this.applyFilters();
        this.render();
        this.updateRefreshIndicator();
      } else {
        Notifications.error('Error al cargar impresoras');
      }
    } catch (error) {
      Utils.error('Error loading printers:', error);
      Notifications.error('Error de conexión al cargar impresoras');
    }
  }

  /**
   * Renderizar impresoras
   */
  render() {
    if (!this.container) return;

    // Si no hay impresoras
    if (this.filteredPrinters.length === 0) {
      this.container.innerHTML = this.renderEmpty();
      return;
    }

    // Renderizar según vista
    if (this.currentView === 'grid') {
      this.container.className = 'printers-grid';
      this.container.innerHTML = this.filteredPrinters
        .map(printer => this.renderPrinterCard(printer))
        .join('');
    } else {
      this.container.className = 'printers-list';
      this.container.innerHTML = this.filteredPrinters
        .map(printer => this.renderPrinterListItem(printer))
        .join('');
    }

    // Agregar event listeners a las cards
    this.attachCardListeners();
  }

  /**
   * Renderizar tarjeta de impresora
   */
  renderPrinterCard(printer) {
    const status = printer.status || 'offline';
    const progress = printer.progress || 0;
    const currentFile = printer.current_file || '';
    const tempHotend = printer.temp_hotend || 0;
    const tempBed = printer.temp_bed || 0;
    const tempHotendTarget = printer.temp_hotend_target || 0;
    const tempBedTarget = printer.temp_bed_target || 0;
    const timeRemaining = printer.time_remaining || 0;
    const image = printer.image || '';
    const tags = printer.tags ? JSON.parse(printer.tags) : [];

    const statusClass = Utils.getStatusClass(status);
    const statusIcon = Utils.getStatusIcon(status);
    const statusText = Utils.getStatusText(status);

    return `
      <div class="printer-card ${status}" data-printer-id="${printer.id}">
        <div class="printer-image">
          ${image ? `<img src="${image}" alt="${printer.name}">` : '<div class="printer-image-placeholder">🖨️</div>'}
          <div class="printer-image-overlay"></div>
          <div class="printer-status-badge ${status}">
            <span class="printer-status-dot"></span>
            ${statusText}
          </div>
        </div>
        
        <div class="printer-content">
          <div class="printer-header">
            <div>
              <h3 class="printer-name">${Utils.escapeHtml(printer.name)}</h3>
              ${printer.model ? `<p class="printer-model">${Utils.escapeHtml(printer.model)}</p>` : ''}
            </div>
            <div class="printer-actions">
              <button class="printer-action-btn" data-action="refresh" title="Actualizar">
                🔄
              </button>
            </div>
          </div>

          ${status === 'printing' || status === 'paused' ? `
            <div class="printer-progress">
              <div class="printer-progress-header">
                <span class="printer-current-file" title="${Utils.escapeHtml(currentFile)}">
                  ${Utils.escapeHtml(Utils.truncate(currentFile, 25))}
                </span>
                <span class="printer-progress-value">${progress}%</span>
              </div>
              <div class="printer-progress-bar">
                <div class="printer-progress-fill" style="width: ${progress}%"></div>
              </div>
              ${timeRemaining > 0 ? `
                <div class="printer-time-remaining">
                  <span class="printer-time-remaining-icon">⏱️</span>
                  <span>${Utils.formatTime(timeRemaining)} restante</span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="printer-temps">
            <div class="printer-temp ${tempHotend > 0 && tempHotend < tempHotendTarget ? 'heating' : ''}">
              <div class="printer-temp-label">🔥 Hotend</div>
              <div class="printer-temp-value">
                ${Utils.formatTemp(tempHotend)}
                <span class="unit">°C</span>
              </div>
              ${tempHotendTarget > 0 ? `<div class="printer-temp-target">Target: ${Utils.formatTemp(tempHotendTarget)}</div>` : ''}
            </div>
            <div class="printer-temp ${tempBed > 0 && tempBed < tempBedTarget ? 'heating' : ''}">
              <div class="printer-temp-label">🛏️ Cama</div>
              <div class="printer-temp-value">
                ${Utils.formatTemp(tempBed)}
                <span class="unit">°C</span>
              </div>
              ${tempBedTarget > 0 ? `<div class="printer-temp-target">Target: ${Utils.formatTemp(tempBedTarget)}</div>` : ''}
            </div>
          </div>

          ${tags.length > 0 ? `
            <div class="printer-tags">
              ${tags.map(tag => `<span class="printer-tag">${Utils.escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          ${status === 'printing' || status === 'paused' ? `
            <div class="printer-footer">
              ${status === 'printing' ? `
                <button class="printer-control-btn pause" data-action="pause">
                  ⏸️ Pausar
                </button>
              ` : `
                <button class="printer-control-btn resume" data-action="resume">
                  ▶️ Reanudar
                </button>
              `}
              <button class="printer-control-btn cancel" data-action="cancel">
                ❌ Cancelar
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Renderizar item de lista
   */
  renderPrinterListItem(printer) {
    // Similar a renderPrinterCard pero con layout horizontal
    return this.renderPrinterCard(printer); // Por ahora usar el mismo
  }

  /**
   * Renderizar estado vacío
   */
  renderEmpty() {
    let message = 'No se encontraron impresoras';
    let icon = '🔍';

    if (this.printers.length === 0) {
      message = 'No hay impresoras registradas';
      icon = '🖨️';
    } else if (this.currentSearch) {
      message = `No se encontraron impresoras con "${this.currentSearch}"`;
    } else if (this.currentFilter !== 'all') {
      message = `No hay impresoras con estado "${Utils.getStatusText(this.currentFilter)}"`;
    }

    return `
      <div class="dashboard-empty">
        <div class="dashboard-empty-icon">${icon}</div>
        <h3 class="dashboard-empty-title">Sin resultados</h3>
        <p class="dashboard-empty-message">${message}</p>
        ${this.currentFilter !== 'all' || this.currentSearch ? `
          <button class="btn btn-primary" onclick="printersManager.clearFilters()">
            Limpiar filtros
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Aplicar filtros
   */
  applyFilters() {
    this.filteredPrinters = this.printers.filter(printer => {
      // Filtro por estado
      if (this.currentFilter !== 'all' && printer.status !== this.currentFilter) {
        return false;
      }

      // Filtro por búsqueda
      if (this.currentSearch) {
        const search = this.currentSearch.toLowerCase();
        const name = (printer.name || '').toLowerCase();
        const tags = printer.tags ? JSON.parse(printer.tags) : [];
        const tagsText = tags.join(' ').toLowerCase();
        
        if (!name.includes(search) && !tagsText.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Filtros de estado
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentFilter = chip.dataset.filter;
        
        // Actualizar UI
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        this.applyFilters();
        this.render();
      });
    });

    // Búsqueda
    const searchInput = document.getElementById('printer-search');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        this.currentSearch = e.target.value.trim();
        this.applyFilters();
        this.render();
      }, 300));
    }

    // Cambiar vista
    const viewBtns = document.querySelectorAll('.view-mode-btn');
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.currentView = btn.dataset.view;
        localStorage.setItem(CONFIG.VIEW_MODE_KEY, this.currentView);
        
        // Actualizar UI
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.render();
      });
    });
  }

  /**
   * Adjuntar listeners a las cards
   */
  attachCardListeners() {
    // Click en card para abrir modal
    const cards = this.container.querySelectorAll('.printer-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // Ignorar si se clickeó un botón
        if (e.target.closest('button')) return;
        
        const printerId = card.dataset.printerId;
        this.openPrinterModal(printerId);
      });
    });

    // Botones de control
    const controlBtns = this.container.querySelectorAll('[data-action]');
    controlBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const card = btn.closest('.printer-card');
        const printerId = card.dataset.printerId;
        
        await this.handleAction(action, printerId);
      });
    });
  }

  /**
   * Manejar acciones
   */
  async handleAction(action, printerId) {
    const printer = this.printers.find(p => p.id == printerId);
    if (!printer) return;

    try {
      switch (action) {
        case 'pause':
          if (await Notifications.confirm(`¿Pausar impresión en ${printer.name}?`)) {
            await API.pausePrint(printerId);
            Notifications.actionSuccess('pause');
            await this.loadPrinters();
          }
          break;

        case 'resume':
          await API.resumePrint(printerId);
          Notifications.actionSuccess('resume');
          await this.loadPrinters();
          break;

        case 'cancel':
          if (await Notifications.confirm(`¿Cancelar impresión en ${printer.name}?`, '¿Estás seguro?')) {
            await API.cancelPrint(printerId);
            Notifications.actionSuccess('cancel');
            await this.loadPrinters();
          }
          break;

        case 'refresh':
          await this.loadPrinters();
          Notifications.success('Actualizado');
          break;
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Abrir modal de impresora
   */
  openPrinterModal(printerId) {
    if (window.PrinterModal) {
      PrinterModal.open(printerId);
    } else {
      Utils.warn('PrinterModal not loaded');
    }
  }

  /**
   * Iniciar auto-refresh
   */
  startAutoRefresh() {
    if (this.refreshInterval) return;

    this.refreshInterval = setInterval(async () => {
      if (!this.isRefreshing && document.visibilityState === 'visible') {
        this.isRefreshing = true;
        await this.loadPrinters();
        this.isRefreshing = false;
      }
    }, CONFIG.REFRESH_INTERVAL);

    Utils.log('Auto-refresh started');
  }

  /**
   * Detener auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      Utils.log('Auto-refresh stopped');
    }
  }

  /**
   * Actualizar indicador de refresh
   */
  updateRefreshIndicator() {
    const indicator = document.querySelector('.refresh-indicator');
    if (indicator) {
      const time = new Date().toLocaleTimeString('es-CL', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      indicator.innerHTML = `
        <span class="refresh-indicator-dot"></span>
        <span>Actualizado ${time}</span>
      `;
    }
  }

  /**
   * Configurar pausa de refresh cuando la pestaña no está visible
   */
  setupVisibilityChange() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Recargar cuando la pestaña vuelve a estar visible
        this.loadPrinters();
      }
    });
  }

  /**
   * Limpiar filtros
   */
  clearFilters() {
    this.currentFilter = 'all';
    this.currentSearch = '';
    
    // Limpiar UI
    const searchInput = document.getElementById('printer-search');
    if (searchInput) searchInput.value = '';
    
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.filter === 'all');
    });
    
    this.applyFilters();
    this.render();
  }

  /**
   * Destruir (limpiar)
   */
  destroy() {
    this.stopAutoRefresh();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 PrintersManager loaded');
}
