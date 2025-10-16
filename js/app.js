/**
 * PrinterHub - Application Initialization
 * Archivo principal de inicialización
 */

class App {
  constructor() {
    this.initialized = false;
    this.currentPage = null;
  }

  /**
   * Inicializar aplicación
   */
  async init() {
    if (this.initialized) return;

    Utils.log('🚀 Initializing PrinterHub...');

    // Detectar página actual
    this.detectCurrentPage();

    // Inicializar según la página
    await this.initializePage();

    // Configurar eventos globales
    this.setupGlobalEvents();

    this.initialized = true;
    Utils.log('✅ PrinterHub initialized successfully');
  }

  /**
   * Detectar página actual
   */
  detectCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';

    if (filename === 'login.html' || filename === 'register.html') {
      this.currentPage = 'auth';
    } else if (filename === 'dashboard.html' || filename === 'index.html' || filename === '') {
      this.currentPage = 'dashboard';
    } else if (filename === 'admin.html') {
      this.currentPage = 'admin';
    } else if (filename === 'files.html') {
      this.currentPage = 'files';
    } else if (filename === 'statistics.html') {
      this.currentPage = 'statistics';
    } else {
      this.currentPage = 'unknown';
    }

    Utils.log(`Current page: ${this.currentPage}`);
  }

  /**
   * Inicializar según página
   */
  async initializePage() {
    switch (this.currentPage) {
      case 'auth':
        await this.initAuthPage();
        break;

      case 'dashboard':
        await this.initDashboardPage();
        break;

      case 'admin':
        await this.initAdminPage();
        break;

      case 'files':
        await this.initFilesPage();
        break;

      case 'statistics':
        await this.initStatisticsPage();
        break;
    }
  }

  /**
   * Inicializar página de autenticación
   */
  async initAuthPage() {
    Utils.log('Initializing auth page...');

    // Si ya está autenticado, redirigir
    if (Auth.isLoggedIn()) {
      Auth.redirectByRole();
      return;
    }

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin(loginForm);
      });

      // Toggle password visibility
      const togglePassword = document.querySelector('.toggle-password');
      if (togglePassword) {
        togglePassword.addEventListener('click', () => {
          const input = document.getElementById('password');
          const icon = togglePassword.textContent;
          
          if (input.type === 'password') {
            input.type = 'text';
            togglePassword.textContent = '🙈';
          } else {
            input.type = 'password';
            togglePassword.textContent = '👁️';
          }
        });
      }
    }

    // Register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister(registerForm);
      });

      // Password strength
      const passwordInput = registerForm.querySelector('#password');
      if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
          this.updatePasswordStrength(e.target.value);
        });
      }
    }
  }

  /**
   * Handle login
   */
  async handleLogin(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // Deshabilitar botón
    submitBtn.disabled = true;
    submitBtn.textContent = 'Iniciando sesión...';

    try {
      const username = form.querySelector('#username').value;
      const password = form.querySelector('#password').value;
      const rememberMe = form.querySelector('#remember-me')?.checked || false;

      // Validar
      const errors = Auth.validateLoginForm(username, password);
      if (errors.length > 0) {
        Notifications.error(errors[0]);
        return;
      }

      // Login
      const result = await Auth.login(username, password, rememberMe);

      if (result.success) {
        Notifications.success(`¡Bienvenido, ${result.user.username}!`);
        
        // Pequeño delay para mostrar la notificación
        await Utils.sleep(500);
        
        // Redirigir según rol
        Auth.redirectByRole();
      } else {
        Notifications.error(result.error);
      }
    } catch (error) {
      Notifications.error('Error al iniciar sesión');
      Utils.error('Login error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Handle register
   */
  async handleRegister(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando...';

    try {
      const username = form.querySelector('#username').value;
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;
      const confirmPassword = form.querySelector('#confirm-password').value;

      // Validar
      const errors = Auth.validateRegisterForm(username, email, password, confirmPassword);
      if (errors.length > 0) {
        Notifications.error(errors[0]);
        return;
      }

      // Registrar
      const result = await Auth.register(username, email, password);

      if (result.success) {
        Notifications.success('¡Registro exitoso! Ahora puedes iniciar sesión.');
        
        await Utils.sleep(1000);
        
        window.location.href = CONFIG.BASE_PATH + '/pages/login.html';
      } else {
        Notifications.error(result.error);
      }
    } catch (error) {
      Notifications.error('Error al registrarse');
      Utils.error('Register error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Actualizar indicador de fuerza de contraseña
   */
  updatePasswordStrength(password) {
    const indicator = document.getElementById('password-strength');
    if (!indicator) return;

    const { strength, score } = Utils.getPasswordStrength(password);
    
    indicator.className = `password-strength ${strength}`;
    indicator.style.display = password ? 'block' : 'none';
    
    const texts = {
      weak: 'Débil',
      medium: 'Media',
      strong: 'Fuerte'
    };
    
    indicator.textContent = texts[strength] || '';
  }

  /**
   * Inicializar página del dashboard
   */
  async initDashboardPage() {
    Utils.log('Initializing dashboard page...');

    // Verificar autenticación
    const isAuthenticated = await Auth.requireAuth();
    if (!isAuthenticated) return;

    // Inicializar UI de autenticación
    Auth.initAuthUI();

    // Inicializar gestor de impresoras
    if (window.printersManager) {
      await printersManager.init();
    } else {
      window.printersManager = new PrintersManager();
      await printersManager.init();
    }

    // Cargar estadísticas rápidas si hay contenedor
    const statsContainer = document.getElementById('stats-cards');
    if (statsContainer) {
      const statsManager = new StatisticsManager();
      await statsManager.init();
    }
  }

  /**
   * Inicializar página de admin
   */
  async initAdminPage() {
    Utils.log('Initializing admin page...');

    // Verificar que sea admin
    const isAdmin = await Auth.requireAdmin();
    if (!isAdmin) return;

    // Inicializar UI de autenticación
    Auth.initAuthUI();

    // Inicializar gestor de admin
    if (window.adminManager) {
      await adminManager.init();
    } else {
      window.adminManager = new AdminManager();
      await adminManager.init();
    }
  }

  /**
   * Inicializar página de archivos
   */
  async initFilesPage() {
    Utils.log('Initializing files page...');

    // Verificar autenticación
    const isAuthenticated = await Auth.requireAuth();
    if (!isAuthenticated) return;

    // Inicializar UI de autenticación
    Auth.initAuthUI();

    // Inicializar gestor de archivos
    if (window.filesManager) {
      await filesManager.init();
    } else {
      window.filesManager = new FilesManager();
      await filesManager.init();
    }
  }

  /**
   * Inicializar página de estadísticas
   */
  async initStatisticsPage() {
    Utils.log('Initializing statistics page...');

    // Verificar autenticación
    const isAuthenticated = await Auth.requireAuth();
    if (!isAuthenticated) return;

    // Inicializar UI de autenticación
    Auth.initAuthUI();

    // Inicializar gestor de estadísticas
    const statsManager = new StatisticsManager();
    await statsManager.init();
    
    // Cargar todos los reportes
    await statsManager.loadUsageReport();
    await statsManager.loadJobsHistory();
  }

  /**
   * Configurar eventos globales
   */
  setupGlobalEvents() {
    // Verificar conexión
    window.addEventListener('online', () => {
      Notifications.success('Conexión restaurada');
    });

    window.addEventListener('offline', () => {
      Notifications.warning('Sin conexión a internet');
    });

    // Antes de cerrar/recargar la página
    window.addEventListener('beforeunload', (e) => {
      // Si hay una impresión en curso, advertir
      if (this.currentPage === 'dashboard' && window.printersManager) {
        const printing = printersManager.printers.some(p => p.status === 'printing');
        if (printing) {
          e.preventDefault();
          e.returnValue = '';
        }
      }
    });

    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K = Búsqueda rápida
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('printer-search') || 
                           document.getElementById('files-search');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Ctrl/Cmd + R = Refrescar
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        if (this.currentPage === 'dashboard' && window.printersManager) {
          e.preventDefault();
          printersManager.loadPrinters();
          Notifications.success('Actualizado');
        }
      }
    });

    // FAB (Floating Action Button) si existe
    const fab = document.querySelector('.fab');
    if (fab) {
      fab.addEventListener('click', () => {
        if (this.currentPage === 'dashboard') {
          // Abrir modal de subir archivo o similar
          document.getElementById('file-upload-input')?.click();
        }
      });
    }
  }

  /**
   * Mostrar página de error
   */
  showError(message) {
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: var(--spacing-xl); text-align: center;">
        <div>
          <div style="font-size: 4rem; margin-bottom: var(--spacing-lg);">😞</div>
          <h1 style="font-size: var(--font-size-2xl); margin-bottom: var(--spacing-md);">¡Oops!</h1>
          <p style="color: var(--text-secondary); margin-bottom: var(--spacing-xl);">${message}</p>
          <button class="btn btn-primary" onclick="window.location.reload()">
            Recargar página
          </button>
        </div>
      </div>
    `;
  }
}

// Instancia global de la aplicación
const app = new App();

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
      Utils.error('App initialization error:', error);
      app.showError('Error al inicializar la aplicación');
    });
  });
} else {
  app.init().catch(error => {
    Utils.error('App initialization error:', error);
    app.showError('Error al inicializar la aplicación');
  });
}

// Hacer app disponible globalmente
window.app = app;

// Debug helpers en modo desarrollo
if (CONFIG.DEBUG) {
  window.debug = {
    config: CONFIG,
    utils: Utils,
    auth: Auth,
    api: API,
    notifications: Notifications,
    app: app
  };
  
  console.log('🔧 Debug helpers available at window.debug');
  console.log('📝 Available commands:');
  console.log('  - debug.auth.getUser()');
  console.log('  - debug.notifications.success("Test")');
  console.log('  - debug.api.getPrinters()');
}

// Banner de consola
console.log('%c🖨️ PrinterHub', 'font-size: 24px; font-weight: bold; color: #9333ea;');
console.log('%cVersion 1.0.0', 'color: #888;');
console.log('%cMade with ❤️', 'color: #ec4899;');

if (CONFIG.DEBUG) {
  console.log('%c⚠️ DEBUG MODE ENABLED', 'background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px;');
}
