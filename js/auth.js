/**
 * PrinterHub - Authentication
 * Sistema de autenticación y gestión de sesión
 */

class Auth {
  /**
   * Obtener token de sesión
   */
  static getToken() {
    return localStorage.getItem(CONFIG.SESSION_TOKEN_KEY);
  }

  /**
   * Guardar token de sesión
   */
  static setToken(token) {
    localStorage.setItem(CONFIG.SESSION_TOKEN_KEY, token);
  }

  /**
   * Eliminar token de sesión
   */
  static clearToken() {
    localStorage.removeItem(CONFIG.SESSION_TOKEN_KEY);
  }

  /**
   * Obtener datos del usuario actual
   */
  static getUser() {
    const userJson = localStorage.getItem(CONFIG.USER_KEY);
    if (!userJson) return null;
    
    try {
      return JSON.parse(userJson);
    } catch (e) {
      Utils.error('Error parsing user data:', e);
      return null;
    }
  }

  /**
   * Guardar datos del usuario
   */
  static setUser(user) {
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  }

  /**
   * Eliminar datos del usuario
   */
  static clearUser() {
    localStorage.removeItem(CONFIG.USER_KEY);
  }

  /**
   * Verificar si hay sesión activa
   */
  static isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  }

  /**
   * Verificar si el usuario es administrador
   */
  static isAdmin() {
    const user = this.getUser();
    return user && user.role === CONFIG.USER_ROLES.ADMIN;
  }

  /**
   * Verificar si el usuario puede hacer impresiones privadas
   */
  static canPrintPrivate() {
    const user = this.getUser();
    return user && (user.role === CONFIG.USER_ROLES.ADMIN || user.can_print_private === 1);
  }

  /**
   * Obtener nombre del usuario actual
   */
  static getUsername() {
    const user = this.getUser();
    return user ? user.username : null;
  }

  /**
   * Obtener iniciales del usuario para avatar
   */
  static getUserInitials() {
    const user = this.getUser();
    if (!user || !user.username) return '?';
    
    const parts = user.username.split(/[\s_-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  }

  /**
   * Login
   */
  static async login(username, password, rememberMe = false) {
    try {
      const response = await API.login(username, password, rememberMe);
      
      if (response.success) {
        // Guardar token y usuario
        this.setToken(response.session.token);
        this.setUser(response.user);
        
        // Guardar preferencia de "recordarme"
        if (rememberMe) {
          localStorage.setItem(CONFIG.REMEMBER_ME_KEY, 'true');
        }
        
        Utils.log('Login successful:', response.user.username);
        return { success: true, user: response.user };
      } else {
        return { success: false, error: response.message || 'Error al iniciar sesión' };
      }
    } catch (error) {
      Utils.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  /**
   * Register
   */
  static async register(username, email, password) {
    try {
      const response = await API.register(username, email, password);
      
      if (response.success) {
        Utils.log('Registration successful:', response.user.username);
        return { success: true, user: response.user };
      } else {
        return { success: false, error: response.message || 'Error al registrarse' };
      }
    } catch (error) {
      Utils.error('Registration error:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }

  /**
   * Logout
   */
  static async logout() {
    try {
      // Intentar logout en el servidor
      await API.logout();
    } catch (error) {
      Utils.warn('Logout API error:', error);
    }
    
    // Limpiar datos locales
    this.clearToken();
    this.clearUser();
    localStorage.removeItem(CONFIG.REMEMBER_ME_KEY);
    
    Utils.log('Logout successful');
    
    // Redirigir a login
    window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
  }

  /**
   * Verificar sesión válida
   */
  static async checkSession() {
    if (!this.isLoggedIn()) {
      return false;
    }
    
    try {
      const response = await API.checkSession();
      
      if (response.success) {
        // Actualizar datos del usuario por si cambiaron
        this.setUser(response.user);
        return true;
      } else {
        // Sesión inválida
        this.clearToken();
        this.clearUser();
        return false;
      }
    } catch (error) {
      Utils.error('Check session error:', error);
      return false;
    }
  }

  /**
   * Proteger página (requiere autenticación)
   */
  static async requireAuth() {
    if (!this.isLoggedIn()) {
      Utils.log('Not logged in, redirecting to login');
      window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
      return false;
    }
    
    // Verificar sesión en el servidor
    const isValid = await this.checkSession();
    if (!isValid) {
      Utils.log('Invalid session, redirecting to login');
      window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
      return false;
    }
    
    return true;
  }

  /**
   * Proteger página de admin (requiere rol de administrador)
   */
  static async requireAdmin() {
    const isAuthenticated = await this.requireAuth();
    if (!isAuthenticated) return false;
    
    if (!this.isAdmin()) {
      Utils.log('Not admin, redirecting to dashboard');
      window.location.href = CONFIG.BASE_PATH + '/pages/dashboard.html';
      return false;
    }
    
    return true;
  }

  /**
   * Redirigir según rol
   */
  static redirectByRole() {
    if (this.isAdmin()) {
      window.location.href = CONFIG.BASE_PATH + '/pages/admin.html';
    } else {
      window.location.href = CONFIG.BASE_PATH + '/pages/dashboard.html';
    }
  }

  /**
   * Inicializar verificación periódica de sesión
   */
  static initSessionCheck() {
    // Verificar sesión cada minuto
    setInterval(async () => {
      if (this.isLoggedIn()) {
        const isValid = await this.checkSession();
        if (!isValid) {
          Notifications.error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          setTimeout(() => {
            window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
          }, 2000);
        }
      }
    }, CONFIG.SESSION_CHECK_INTERVAL);
  }

  /**
   * Inicializar UI de autenticación (mostrar usuario en navbar)
   */
  static initAuthUI() {
    const user = this.getUser();
    if (!user) return;
    
    // Actualizar avatar
    const avatarEl = document.querySelector('.navbar-avatar');
    if (avatarEl) {
      avatarEl.textContent = this.getUserInitials();
    }
    
    // Actualizar username
    const usernameEl = document.querySelector('.navbar-username');
    if (usernameEl) {
      usernameEl.textContent = user.username;
    }
    
    // Mostrar/ocultar botón de admin
    if (this.isAdmin()) {
      const adminBtns = document.querySelectorAll('.admin-only');
      adminBtns.forEach(btn => btn.classList.remove('hidden'));
    }
    
    // Configurar botón de logout
    const logoutBtns = document.querySelectorAll('[data-action="logout"]');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });
  }

  /**
   * Validar formulario de login
   */
  static validateLoginForm(username, password) {
    const errors = [];
    
    if (!username || username.trim().length === 0) {
      errors.push('El nombre de usuario es requerido');
    }
    
    if (!password || password.length === 0) {
      errors.push('La contraseña es requerida');
    }
    
    return errors;
  }

  /**
   * Validar formulario de registro
   */
  static validateRegisterForm(username, email, password, confirmPassword) {
    const errors = [];
    
    // Username
    if (!username || username.trim().length === 0) {
      errors.push('El nombre de usuario es requerido');
    } else if (!Utils.isValidUsername(username)) {
      errors.push(`El nombre de usuario debe tener al menos ${CONFIG.MIN_USERNAME_LENGTH} caracteres y solo puede contener letras, números, guiones y guiones bajos`);
    }
    
    // Email
    if (!email || email.trim().length === 0) {
      errors.push('El email es requerido');
    } else if (!Utils.isValidEmail(email)) {
      errors.push('El email no es válido');
    }
    
    // Password
    if (!password || password.length === 0) {
      errors.push('La contraseña es requerida');
    } else if (!Utils.isValidPassword(password)) {
      errors.push(`La contraseña debe tener al menos ${CONFIG.MIN_PASSWORD_LENGTH} caracteres`);
    }
    
    // Confirm password
    if (password !== confirmPassword) {
      errors.push('Las contraseñas no coinciden');
    }
    
    return errors;
  }

  /**
   * Obtener información del usuario formateada para mostrar
   */
  static getUserInfo() {
    const user = this.getUser();
    if (!user) return null;
    
    return {
      username: user.username,
      email: user.email,
      role: user.role,
      roleText: user.role === CONFIG.USER_ROLES.ADMIN ? 'Administrador' : 'Usuario',
      canPrintPrivate: user.can_print_private === 1,
      initials: this.getUserInitials()
    };
  }
}

// Inicializar verificación de sesión cuando se carga la página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isLoggedIn()) {
      Auth.initSessionCheck();
    }
  });
} else {
  if (Auth.isLoggedIn()) {
    Auth.initSessionCheck();
  }
}

// Debug
if (CONFIG.DEBUG) {
  console.log('🔧 Auth loaded');
  if (Auth.isLoggedIn()) {
    console.log('👤 Current user:', Auth.getUser());
  }
}
