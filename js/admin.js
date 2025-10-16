/**
 * PrinterHub - Admin Manager
 * Gestión del panel de administración
 */

class AdminManager {
  constructor() {
    this.currentTab = 'users';
    this.users = [];
    this.printers = [];
    this.groups = [];
  }

  /**
   * Inicializar
   */
  async init() {
    this.setupTabs();
    await this.loadTabContent(this.currentTab);
    
    Utils.log('AdminManager initialized');
  }

  /**
   * Configurar tabs
   */
  setupTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        const tabId = tab.dataset.tab;
        await this.switchTab(tabId);
      });
    });
  }

  /**
   * Cambiar tab
   */
  async switchTab(tabId) {
    this.currentTab = tabId;

    // Actualizar UI de tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabId);
    });

    // Cargar contenido
    await this.loadTabContent(tabId);
  }

  /**
   * Cargar contenido del tab
   */
  async loadTabContent(tabId) {
    switch (tabId) {
      case 'users':
        await this.loadUsers();
        break;
      case 'printers':
        await this.loadPrinters();
        break;
      case 'groups':
        await this.loadGroups();
        break;
      case 'stats':
        await this.loadAdminStats();
        break;
      case 'logs':
        await this.loadLogs();
        break;
    }
  }

  // ==================== USUARIOS ====================

  /**
   * Cargar usuarios
   */
  async loadUsers() {
    try {
      const response = await API.getUsers();
      
      if (response.success) {
        this.users = response.users || [];
        this.renderUsers();
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Renderizar usuarios
   */
  renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;

    if (this.users.length === 0) {
      container.innerHTML = `
        <div class="dashboard-empty">
          <div class="dashboard-empty-icon">👥</div>
          <h3 class="dashboard-empty-title">No hay usuarios</h3>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Impresoras</th>
              <th>Estado</th>
              <th>Último acceso</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${this.users.map(user => this.renderUserRow(user)).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.attachUserListeners();
  }

  /**
   * Renderizar fila de usuario
   */
  renderUserRow(user) {
    return `
      <tr>
        <td>
          <div class="admin-table-user">
            <div class="admin-table-avatar">
              ${user.username.substring(0, 2).toUpperCase()}
            </div>
            <div class="admin-table-user-info">
              <div class="admin-table-user-name">${Utils.escapeHtml(user.username)}</div>
              <div class="admin-table-user-email">${Utils.escapeHtml(user.email)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-${user.role === 'admin' ? 'primary' : 'info'}">
            ${user.role === 'admin' ? '👑 Admin' : '👤 Usuario'}
          </span>
          ${user.can_print_private ? '<span class="badge badge-warning">🔒 Privado</span>' : ''}
        </td>
        <td>${user.printers_count || 0} impresoras</td>
        <td>
          <span class="badge badge-${user.is_blocked ? 'danger' : 'success'}">
            ${user.is_blocked ? '🚫 Bloqueado' : '✅ Activo'}
          </span>
        </td>
        <td>${user.last_login ? Utils.formatDate(user.last_login, true) : 'Nunca'}</td>
        <td>
          <div class="admin-table-actions">
            <button 
              class="admin-table-action-btn" 
              data-action="edit-user" 
              data-user-id="${user.id}"
              title="Editar"
            >
              ✏️
            </button>
            <button 
              class="admin-table-action-btn" 
              data-action="assign-printers" 
              data-user-id="${user.id}"
              title="Asignar impresoras"
            >
              🖨️
            </button>
            <button 
              class="admin-table-action-btn ${user.is_blocked ? '' : 'danger'}" 
              data-action="toggle-block" 
              data-user-id="${user.id}"
              data-blocked="${user.is_blocked}"
              title="${user.is_blocked ? 'Desbloquear' : 'Bloquear'}"
            >
              ${user.is_blocked ? '🔓' : '🔒'}
            </button>
            ${user.id !== 1 ? `
              <button 
                class="admin-table-action-btn danger" 
                data-action="delete-user" 
                data-user-id="${user.id}"
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
   * Adjuntar listeners de usuarios
   */
  attachUserListeners() {
    const actionBtns = document.querySelectorAll('#users-list [data-action]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const userId = btn.dataset.userId;
        
        await this.handleUserAction(action, userId, btn);
      });
    });

    // Botón crear usuario
    const createBtn = document.getElementById('create-user-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateUserModal());
    }
  }

  /**
   * Manejar acciones de usuario
   */
  async handleUserAction(action, userId, btn) {
    try {
      switch (action) {
        case 'edit-user':
          await this.showEditUserModal(userId);
          break;

        case 'assign-printers':
          await this.showAssignPrintersModal(userId);
          break;

        case 'toggle-block':
          const isBlocked = btn.dataset.blocked === '1';
          if (await Notifications.confirm(`¿${isBlocked ? 'Desbloquear' : 'Bloquear'} este usuario?`)) {
            await API.toggleUserBlock(userId, !isBlocked);
            Notifications.success(`Usuario ${isBlocked ? 'desbloqueado' : 'bloqueado'}`);
            await this.loadUsers();
          }
          break;

        case 'delete-user':
          if (await Notifications.confirm('¿Eliminar este usuario?', '¡Advertencia!')) {
            await API.deleteUser(userId);
            Notifications.actionSuccess('delete');
            await this.loadUsers();
          }
          break;
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Modal crear usuario
   */
  showCreateUserModal() {
    const modalHtml = `
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre de usuario</label>
          <input type="text" id="username" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" id="email" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña</label>
          <input type="password" id="password" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Rol</label>
          <select id="role" class="form-control">
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div class="form-checkbox">
          <input type="checkbox" id="can-print-private">
          <label for="can-print-private">Puede hacer impresiones privadas</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="cancel">Cancelar</button>
        <button class="btn btn-primary" data-action="confirm">Crear Usuario</button>
      </div>
    `;

    this.showModal('Crear Usuario', modalHtml, async (modal) => {
      const data = {
        username: modal.querySelector('#username').value,
        email: modal.querySelector('#email').value,
        password: modal.querySelector('#password').value,
        role: modal.querySelector('#role').value,
        can_print_private: modal.querySelector('#can-print-private').checked ? 1 : 0
      };

      await API.createUser(data);
      Notifications.actionSuccess('create');
      await this.loadUsers();
    });
  }

  // ==================== IMPRESORAS ====================

  /**
   * Cargar impresoras (admin)
   */
  async loadPrinters() {
    try {
      const response = await API.getPrinters();
      
      if (response.success) {
        this.printers = response.printers || [];
        this.renderPrinters();
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Renderizar impresoras
   */
  renderPrinters() {
    const container = document.getElementById('printers-admin-list');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-cards-grid">
        ${this.printers.map(printer => `
          <div class="admin-card">
            <div class="admin-card-header">
              <div>
                <h3 class="admin-card-title">${Utils.escapeHtml(printer.name)}</h3>
                <p class="admin-card-subtitle">Token: ${printer.token}</p>
              </div>
              <div class="admin-card-actions">
                <button 
                  class="btn btn-sm btn-ghost" 
                  data-action="edit-printer" 
                  data-printer-id="${printer.id}"
                >
                  ✏️
                </button>
                <button 
                  class="btn btn-sm btn-danger" 
                  data-action="delete-printer" 
                  data-printer-id="${printer.id}"
                >
                  🗑️
                </button>
              </div>
            </div>
            <div class="admin-card-body">
              <div>
                <span class="badge badge-${Utils.getStatusClass(printer.status)}">
                  ${Utils.getStatusText(printer.status)}
                </span>
                ${printer.is_public ? '<span class="badge badge-info">🌐 Público</span>' : '<span class="badge badge-warning">🔒 Privado</span>'}
                ${printer.is_blocked ? '<span class="badge badge-danger">🚫 Bloqueado</span>' : ''}
              </div>
              <div style="margin-top: var(--spacing-md); color: var(--text-tertiary); font-size: var(--font-size-sm);">
                Última actividad: ${printer.last_seen ? Utils.timeAgo(printer.last_seen) : 'Nunca'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.attachPrinterListeners();
  }

  /**
   * Adjuntar listeners de impresoras
   */
  attachPrinterListeners() {
    const actionBtns = document.querySelectorAll('#printers-admin-list [data-action]');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const printerId = btn.dataset.printerId;
        
        await this.handlePrinterAction(action, printerId);
      });
    });

    // Botón crear impresora
    const createBtn = document.getElementById('create-printer-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreatePrinterModal());
    }
  }

  /**
   * Manejar acciones de impresora
   */
  async handlePrinterAction(action, printerId) {
    try {
      switch (action) {
        case 'edit-printer':
          await this.showEditPrinterModal(printerId);
          break;

        case 'delete-printer':
          if (await Notifications.confirm('¿Eliminar esta impresora?', '¡Advertencia!')) {
            await API.deletePrinter(printerId);
            Notifications.actionSuccess('delete');
            await this.loadPrinters();
          }
          break;
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Modal crear impresora
   */
  showCreatePrinterModal() {
    const modalHtml = `
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" id="name" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label">Token</label>
          <input type="text" id="token" class="form-control" required>
          <p class="form-help">Token único para identificar la impresora</p>
        </div>
        <div class="form-checkbox">
          <input type="checkbox" id="is-public" checked>
          <label for="is-public">Visible públicamente</label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" data-action="cancel">Cancelar</button>
        <button class="btn btn-primary" data-action="confirm">Crear Impresora</button>
      </div>
    `;

    this.showModal('Crear Impresora', modalHtml, async (modal) => {
      const data = {
        name: modal.querySelector('#name').value,
        token: modal.querySelector('#token').value,
        is_public: modal.querySelector('#is-public').checked ? 1 : 0
      };

      await API.createPrinter(data);
      Notifications.actionSuccess('create');
      await this.loadPrinters();
    });
  }

  // ==================== GRUPOS ====================

  /**
   * Cargar grupos
   */
  async loadGroups() {
    try {
      const response = await API.getGroups();
      
      if (response.success) {
        this.groups = response.groups || [];
        this.renderGroups();
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Renderizar grupos
   */
  renderGroups() {
    const container = document.getElementById('groups-list');
    if (!container) return;

    if (this.groups.length === 0) {
      container.innerHTML = `
        <div class="dashboard-empty">
          <div class="dashboard-empty-icon">👥</div>
          <h3 class="dashboard-empty-title">No hay grupos</h3>
          <button class="btn btn-primary" id="create-group-btn">Crear Grupo</button>
        </div>
      `;
      
      document.getElementById('create-group-btn')?.addEventListener('click', () => {
        this.showCreateGroupModal();
      });
      
      return;
    }

    container.innerHTML = `
      <div class="admin-cards-grid">
        ${this.groups.map(group => `
          <div class="admin-card">
            <div class="admin-card-header">
              <div>
                <h3 class="admin-card-title">${Utils.escapeHtml(group.name)}</h3>
                <p class="admin-card-subtitle">${Utils.escapeHtml(group.description || '')}</p>
              </div>
            </div>
            <div class="admin-card-body">
              <div style="color: var(--text-secondary);">
                ${group.members_count || 0} miembros
              </div>
            </div>
            <div class="admin-card-footer">
              <button class="btn btn-sm btn-outline" data-action="edit-group" data-group-id="${group.id}">
                Editar
              </button>
              <button class="btn btn-sm btn-danger" data-action="delete-group" data-group-id="${group.id}">
                Eliminar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ==================== STATS Y LOGS ====================

  /**
   * Cargar estadísticas de admin
   */
  async loadAdminStats() {
    const statsManager = new StatisticsManager();
    await statsManager.init();
  }

  /**
   * Cargar logs
   */
  async loadLogs() {
    try {
      const response = await API.getActionsLog({ limit: 100 });
      
      if (response.success) {
        this.renderLogs(response.logs || []);
      }
    } catch (error) {
      Notifications.apiError(error);
    }
  }

  /**
   * Renderizar logs
   */
  renderLogs(logs) {
    const container = document.getElementById('logs-list');
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div class="dashboard-empty">
          <div class="dashboard-empty-icon">📋</div>
          <h3 class="dashboard-empty-title">Sin logs</h3>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-container">
        <table class="logs-table">
          <thead>
            <tr>
              <th>Fecha/Hora</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Descripción</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            ${logs.map(log => `
              <tr>
                <td class="log-timestamp">${Utils.formatDate(log.created_at, true)}</td>
                <td class="log-user">${Utils.escapeHtml(log.user_username || 'Sistema')}</td>
                <td><span class="log-action ${log.action.toLowerCase()}">${Utils.escapeHtml(log.action)}</span></td>
                <td class="log-description">${Utils.escapeHtml(log.description)}</td>
                <td class="log-ip">${log.ip_address || '--'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ==================== UTILIDADES ====================

  /**
   * Mostrar modal genérico
   */
  showModal(title, content, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" data-action="close">×</button>
        </div>
        ${content}
      </div>
    `;

    document.body.appendChild(backdrop);

    const modal = backdrop.querySelector('.modal');
    const confirmBtn = modal.querySelector('[data-action="confirm"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const closeBtn = modal.querySelector('[data-action="close"]');

    const close = () => {
      document.body.removeChild(backdrop);
    };

    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        try {
          await onConfirm(modal);
          close();
        } catch (error) {
          Notifications.apiError(error);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', close);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 AdminManager loaded');
}
