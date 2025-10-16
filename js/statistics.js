/**
 * PrinterHub - Statistics Manager
 * Gestión y visualización de estadísticas
 */

class StatisticsManager {
  constructor() {
    this.currentPeriod = '30d';
    this.data = null;
  }

  /**
   * Inicializar
   */
  async init() {
    await this.loadOverview();
    this.setupEventListeners();
    
    Utils.log('StatisticsManager initialized');
  }

  /**
   * Cargar resumen general
   */
  async loadOverview() {
    try {
      const response = await API.getOverview();
      
      if (response.success) {
        this.data = response.stats;
        this.renderOverview();
      } else {
        Notifications.error('Error al cargar estadísticas');
      }
    } catch (error) {
      Utils.error('Error loading statistics:', error);
      Notifications.error('Error de conexión al cargar estadísticas');
    }
  }

  /**
   * Renderizar resumen general
   */
  renderOverview() {
    if (!this.data) return;

    // Stats Cards
    const statsContainer = document.getElementById('stats-cards');
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-title">Impresoras</div>
            <div class="stat-card-icon">🖨️</div>
          </div>
          <div class="stat-card-value">${this.data.total_printers || 0}</div>
          <div class="stat-card-label">Activas</div>
          ${this.data.printers_printing > 0 ? `
            <div class="stat-card-trend up">
              ⬆ ${this.data.printers_printing} imprimiendo
            </div>
          ` : ''}
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-title">Trabajos</div>
            <div class="stat-card-icon">✅</div>
          </div>
          <div class="stat-card-value">${this.data.jobs_completed || 0}</div>
          <div class="stat-card-label">Completados</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-title">Tiempo</div>
            <div class="stat-card-icon">⏱️</div>
          </div>
          <div class="stat-card-value">${this.formatHours(this.data.total_print_time || 0)}</div>
          <div class="stat-card-label">Horas totales</div>
        </div>

        <div class="stat-card">
          <div class="stat-card-header">
            <div class="stat-card-title">Éxito</div>
            <div class="stat-card-icon">🎯</div>
          </div>
          <div class="stat-card-value">${Math.round(this.data.success_rate || 0)}%</div>
          <div class="stat-card-label">Tasa de éxito</div>
          ${this.data.success_rate >= 90 ? `
            <div class="stat-card-trend up">
              ⬆ Excelente
            </div>
          ` : ''}
        </div>
      `;
    }

    // Top Printers
    this.renderTopPrinters();
  }

  /**
   * Renderizar top impresoras
   */
  renderTopPrinters() {
    if (!this.data?.top_printers) return;

    const container = document.getElementById('top-printers');
    if (!container) return;

    if (this.data.top_printers.length === 0) {
      container.innerHTML = `
        <div class="modal-empty">
          <div class="modal-empty-icon">🖨️</div>
          <div class="modal-empty-title">Sin datos</div>
          <div class="modal-empty-message">No hay suficientes datos para mostrar</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="modal-list">
        ${this.data.top_printers.map((printer, index) => `
          <div class="modal-list-item">
            <div style="font-size: var(--font-size-2xl); margin-right: var(--spacing-md);">
              ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
            </div>
            <div class="modal-list-item-content">
              <div class="modal-list-item-title">${Utils.escapeHtml(printer.name)}</div>
              <div class="modal-list-item-subtitle">
                ${printer.jobs_count} trabajos • 
                ${printer.completed} completados • 
                ${Math.round((printer.completed / printer.jobs_count) * 100)}% éxito
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--primary-light);">
                ${printer.jobs_count}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">
                trabajos
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Cargar reporte de uso
   */
  async loadUsageReport(period = '30d') {
    try {
      const response = await API.getUsageReport(period);
      
      if (response.success) {
        this.renderUsageReport(response.report);
      }
    } catch (error) {
      Utils.error('Error loading usage report:', error);
    }
  }

  /**
   * Renderizar reporte de uso
   */
  renderUsageReport(report) {
    const container = document.getElementById('usage-report');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📊 Reporte de Uso - ${this.getPeriodText(this.currentPeriod)}</h3>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--spacing-lg);">
            <div>
              <div style="color: var(--text-tertiary); font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">
                Total Impresiones
              </div>
              <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--text-primary);">
                ${report.total_prints || 0}
              </div>
            </div>
            <div>
              <div style="color: var(--text-tertiary); font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">
                Tiempo Total
              </div>
              <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--text-primary);">
                ${this.formatHours(report.total_time || 0)}h
              </div>
            </div>
            <div>
              <div style="color: var(--text-tertiary); font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">
                Filamento Usado
              </div>
              <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--text-primary);">
                ${((report.filament_used || 0) / 1000).toFixed(1)} kg
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Cargar historial de trabajos
   */
  async loadJobsHistory(filters = {}) {
    try {
      const response = await API.getJobsHistory(filters);
      
      if (response.success) {
        this.renderJobsHistory(response.jobs);
      }
    } catch (error) {
      Utils.error('Error loading jobs history:', error);
    }
  }

  /**
   * Renderizar historial de trabajos
   */
  renderJobsHistory(jobs) {
    const container = document.getElementById('jobs-history');
    if (!container) return;

    if (!jobs || jobs.length === 0) {
      container.innerHTML = `
        <div class="modal-empty">
          <div class="modal-empty-icon">📜</div>
          <div class="modal-empty-title">Sin historial</div>
          <div class="modal-empty-message">No hay trabajos registrados</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Impresora</th>
              <th>Archivo</th>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Duración</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${jobs.map(job => `
              <tr>
                <td>${Utils.escapeHtml(job.printer_name)}</td>
                <td>${Utils.escapeHtml(job.file_name)}</td>
                <td>${Utils.escapeHtml(job.user_username || 'Sistema')}</td>
                <td>
                  <span class="badge badge-${this.getJobStatusClass(job.status)}">
                    ${this.getJobStatusText(job.status)}
                  </span>
                </td>
                <td>${Utils.formatTime(job.duration || 0)}</td>
                <td>${Utils.formatDate(job.started_at, true)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Configurar event listeners
   */
  setupEventListeners() {
    // Selector de período
    const periodSelect = document.getElementById('stats-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', async (e) => {
        this.currentPeriod = e.target.value;
        await this.loadUsageReport(this.currentPeriod);
      });
    }

    // Botón de refrescar
    const refreshBtn = document.getElementById('refresh-stats');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await this.loadOverview();
        Notifications.success('Estadísticas actualizadas');
      });
    }
  }

  /**
   * Formatear horas
   */
  formatHours(seconds) {
    const hours = Math.floor(seconds / 3600);
    return hours.toFixed(1);
  }

  /**
   * Obtener texto del período
   */
  getPeriodText(period) {
    return CONFIG.STATS_PERIODS[period] || period;
  }

  /**
   * Obtener clase para estado de trabajo
   */
  getJobStatusClass(status) {
    const classes = {
      completed: 'success',
      failed: 'danger',
      cancelled: 'warning',
      in_progress: 'info'
    };
    return classes[status] || 'gray';
  }

  /**
   * Obtener texto para estado de trabajo
   */
  getJobStatusText(status) {
    const texts = {
      completed: 'Completado',
      failed: 'Fallido',
      cancelled: 'Cancelado',
      in_progress: 'En Progreso'
    };
    return texts[status] || status;
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 StatisticsManager loaded');
}
