/**
 * PrinterHub - API Client
 * Cliente para interactuar con la API REST
 */

class API {
  /**
   * Realizar petición HTTP genérica
   */
  static async request(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    
    // Headers por defecto
    const headers = {
      ...options.headers
    };
    
    // Agregar token de sesión si existe
    const token = Auth.getToken();
    if (token) {
      headers['X-Session-Token'] = token;
    }
    
    // Si hay body y no es FormData, convertir a JSON
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    
    // Configuración de la petición
    const config = {
      method: options.method || 'GET',
      headers,
      ...options
    };
    
    Utils.log(`API Request: ${config.method} ${url}`);
    
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      Utils.log(`API Response:`, data);
      
      // Si la sesión expiró, redirigir a login
      if (data.error && data.error.includes('sesión')) {
        Auth.logout();
        window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
        throw new Error('Sesión expirada');
      }
      
      return data;
      
    } catch (error) {
      Utils.error('API Error:', error);
      
      // Si no hay conexión
      if (!Utils.isOnline()) {
        throw new Error('Sin conexión a internet');
      }
      
      throw error;
    }
  }

  /**
   * GET request
   */
  static async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * POST request
   */
  static async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    });
  }

  /**
   * PUT request
   */
  static async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    });
  }

  /**
   * DELETE request
   */
  static async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Upload file (multipart/form-data)
   */
  static async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData
      // No establecer Content-Type, el navegador lo hace automáticamente para FormData
    });
  }

  // ==================== AUTH ENDPOINTS ====================

  /**
   * Login
   */
  static async login(username, password, rememberMe = false) {
    return this.post('/auth.php?action=login', {
      username,
      password,
      remember_me: rememberMe
    });
  }

  /**
   * Register
   */
  static async register(username, email, password) {
    return this.post('/auth.php?action=register', {
      username,
      email,
      password
    });
  }

  /**
   * Logout
   */
  static async logout() {
    return this.post('/auth.php?action=logout');
  }

  /**
   * Check session
   */
  static async checkSession() {
    return this.get('/auth.php?action=check_session');
  }

  // ==================== PRINTERS ENDPOINTS ====================

  /**
   * Listar impresoras
   */
  static async getPrinters() {
    return this.get('/printers.php?action=list');
  }

  /**
   * Obtener detalles de impresora
   */
  static async getPrinter(id) {
    return this.get(`/printers.php?action=get&id=${id}`);
  }

  /**
   * Crear impresora (admin)
   */
  static async createPrinter(data) {
    return this.post('/printers.php?action=create', data);
  }

  /**
   * Actualizar impresora (admin)
   */
  static async updatePrinter(id, data) {
    return this.post('/printers.php?action=update', { id, ...data });
  }

  /**
   * Eliminar impresora (admin)
   */
  static async deletePrinter(id) {
    return this.post('/printers.php?action=delete', { id });
  }

  /**
   * Actualizar notas de impresora
   */
  static async updatePrinterNotes(id, notes) {
    return this.post('/printers.php?action=update_notes', { id, notes });
  }

  /**
   * Actualizar tags de impresora
   */
  static async updatePrinterTags(id, tags) {
    return this.post('/printers.php?action=update_tags', { id, tags });
  }

  // ==================== COMMANDS ENDPOINTS ====================

  /**
   * Pausar impresión
   */
  static async pausePrint(printerId) {
    return this.post('/commands.php?action=pause', { printer_id: printerId });
  }

  /**
   * Reanudar impresión
   */
  static async resumePrint(printerId) {
    return this.post('/commands.php?action=resume', { printer_id: printerId });
  }

  /**
   * Cancelar impresión
   */
  static async cancelPrint(printerId) {
    return this.post('/commands.php?action=cancel', { printer_id: printerId });
  }

  /**
   * Parada de emergencia
   */
  static async emergencyStop(printerId) {
    return this.post('/commands.php?action=emergency_stop', { printer_id: printerId });
  }

  /**
   * Home de ejes
   */
  static async homeAxes(printerId, axes = 'all') {
    return this.post('/commands.php?action=home', { printer_id: printerId, axes });
  }

  /**
   * Configurar temperaturas
   */
  static async setTemperature(printerId, hotend = null, bed = null) {
    return this.post('/commands.php?action=heat', {
      printer_id: printerId,
      hotend_temp: hotend,
      bed_temp: bed
    });
  }

  /**
   * Configurar velocidad
   */
  static async setSpeed(printerId, speed) {
    return this.post('/commands.php?action=set_speed', {
      printer_id: printerId,
      speed
    });
  }

  /**
   * Enviar gcode personalizado
   */
  static async sendCustomGcode(printerId, gcode) {
    return this.post('/commands.php?action=custom_gcode', {
      printer_id: printerId,
      gcode
    });
  }

  /**
   * Obtener historial de comandos
   */
  static async getCommandHistory(printerId, limit = 50) {
    return this.get(`/commands.php?action=history&printer_id=${printerId}&limit=${limit}`);
  }

  /**
   * Obtener log de auditoría
   */
  static async getActionsLog(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/commands.php?action=actions_log&${params}`);
  }

  // ==================== FILES ENDPOINTS ====================

  /**
   * Subir archivo
   */
  static async uploadFile(file, isPrivate = false, printerId = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('is_private', isPrivate ? '1' : '0');
    if (printerId) {
      formData.append('printer_id', printerId);
    }
    
    return this.upload('/files.php?action=upload', formData);
  }

  /**
   * Listar archivos
   */
  static async getFiles(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/files.php?action=list&${params}`);
  }

  /**
   * Eliminar archivo
   */
  static async deleteFile(fileId) {
    return this.post('/files.php?action=delete', { id: fileId });
  }

  /**
   * Enviar archivo a impresora
   */
  static async sendToPrinter(fileId, printerId, isPrivate = false) {
    return this.post('/files.php?action=send_to_printer', {
      file_id: fileId,
      printer_id: printerId,
      is_private: isPrivate ? 1 : 0
    });
  }

  /**
   * Cambiar privacidad de archivo
   */
  static async setFilePrivacy(fileId, isPrivate) {
    return this.post('/files.php?action=set_privacy', {
      id: fileId,
      is_private: isPrivate ? 1 : 0
    });
  }

  /**
   * Obtener URL de descarga de archivo
   */
  static getFileDownloadUrl(fileId) {
    const token = Auth.getToken();
    return `${CONFIG.API_URL}/files.php?action=download&id=${fileId}&token=${token}`;
  }

  // ==================== STATISTICS ENDPOINTS ====================

  /**
   * Obtener resumen general
   */
  static async getOverview() {
    return this.get('/statistics.php?action=overview');
  }

  /**
   * Obtener estadísticas de impresora
   */
  static async getPrinterStats(printerId, period = '30d') {
    return this.get(`/statistics.php?action=printer_stats&id=${printerId}&period=${period}`);
  }

  /**
   * Obtener reporte de uso
   */
  static async getUsageReport(period = '30d') {
    return this.get(`/statistics.php?action=usage_report&period=${period}`);
  }

  /**
   * Obtener historial de trabajos
   */
  static async getJobsHistory(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/statistics.php?action=jobs_history&${params}`);
  }

  /**
   * Obtener uso de filamento
   */
  static async getFilamentUsage(period = '30d') {
    return this.get(`/statistics.php?action=filament_usage&period=${period}`);
  }

  // ==================== USERS ENDPOINTS (ADMIN) ====================

  /**
   * Listar usuarios
   */
  static async getUsers(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.get(`/users.php?action=list&${params}`);
  }

  /**
   * Obtener usuario
   */
  static async getUser(userId) {
    return this.get(`/users.php?action=get&id=${userId}`);
  }

  /**
   * Crear usuario
   */
  static async createUser(data) {
    return this.post('/users.php?action=create', data);
  }

  /**
   * Actualizar usuario
   */
  static async updateUser(userId, data) {
    return this.post('/users.php?action=update', { id: userId, ...data });
  }

  /**
   * Eliminar usuario
   */
  static async deleteUser(userId) {
    return this.post('/users.php?action=delete', { id: userId });
  }

  /**
   * Bloquear/Desbloquear usuario
   */
  static async toggleUserBlock(userId, block = true) {
    return this.post('/users.php?action=block', {
      id: userId,
      block: block ? 1 : 0
    });
  }

  /**
   * Asignar impresoras a usuario
   */
  static async assignPrinters(userId, printerIds) {
    return this.post('/users.php?action=assign_printers', {
      user_id: userId,
      printer_ids: printerIds
    });
  }

  // ==================== GROUPS ENDPOINTS (ADMIN) ====================

  /**
   * Listar grupos
   */
  static async getGroups() {
    return this.get('/groups.php?action=list');
  }

  /**
   * Obtener grupo
   */
  static async getGroup(groupId) {
    return this.get(`/groups.php?action=get&id=${groupId}`);
  }

  /**
   * Crear grupo
   */
  static async createGroup(data) {
    return this.post('/groups.php?action=create', data);
  }

  /**
   * Actualizar grupo
   */
  static async updateGroup(groupId, data) {
    return this.post('/groups.php?action=update', { id: groupId, ...data });
  }

  /**
   * Eliminar grupo
   */
  static async deleteGroup(groupId) {
    return this.post('/groups.php?action=delete', { id: groupId });
  }

  /**
   * Agregar usuarios a grupo
   */
  static async addUsersToGroup(groupId, userIds) {
    return this.post('/groups.php?action=add_users', {
      group_id: groupId,
      user_ids: userIds
    });
  }

  /**
   * Remover usuario de grupo
   */
  static async removeUserFromGroup(groupId, userId) {
    return this.post('/groups.php?action=remove_user', {
      group_id: groupId,
      user_id: userId
    });
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 API Client loaded');
}
