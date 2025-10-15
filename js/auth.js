// ============================================
// AUTENTICACIÓN - Sistema de login/logout
// ============================================

import { 
    PIN_CORRECT, 
    AUTH_STORAGE_KEY, 
    DOM_IDS,
    UI_TEXTS 
} from './config.js';

// Estado de autenticación
let isAuthenticated = false;

// ============================================
// INICIALIZACIÓN
// ============================================

/**
 * Inicializar sistema de autenticación
 */
export function initAuth() {
    checkSavedAuth();
    setupAuthEventListeners();
    updateAuthUI();
}

/**
 * Verificar si hay autenticación guardada
 */
function checkSavedAuth() {
    const savedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (savedAuth === 'true') {
        isAuthenticated = true;
    }
}

/**
 * Configurar event listeners de autenticación
 */
function setupAuthEventListeners() {
    // Botón de login
    document.getElementById(DOM_IDS.LOGIN_BTN).addEventListener('click', showLoginModal);
    
    // Botón de logout
    document.getElementById(DOM_IDS.LOGOUT_BTN).addEventListener('click', logout);
    
    // Submit PIN
    document.getElementById(DOM_IDS.SUBMIT_PIN).addEventListener('click', login);
    
    // Cerrar modal
    document.getElementById(DOM_IDS.CLOSE_MODAL).addEventListener('click', hideLoginModal);
    
    // Enter en el input de PIN
    document.getElementById(DOM_IDS.PIN_INPUT).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            login();
        }
    });
}

// ============================================
// FUNCIONES PÚBLICAS
// ============================================

/**
 * Verificar si el usuario está autenticado
 */
export function isUserAuthenticated() {
    return isAuthenticated;
}

/**
 * Mostrar modal de login
 */
export function showLoginModal() {
    const modal = document.getElementById(DOM_IDS.LOGIN_MODAL);
    const pinInput = document.getElementById(DOM_IDS.PIN_INPUT);
    const errorMsg = document.getElementById(DOM_IDS.LOGIN_ERROR);
    
    modal.classList.add('active');
    pinInput.value = '';
    pinInput.focus();
    errorMsg.textContent = '';
}

/**
 * Ocultar modal de login
 */
export function hideLoginModal() {
    const modal = document.getElementById(DOM_IDS.LOGIN_MODAL);
    const pinInput = document.getElementById(DOM_IDS.PIN_INPUT);
    const errorMsg = document.getElementById(DOM_IDS.LOGIN_ERROR);
    
    modal.classList.remove('active');
    pinInput.value = '';
    errorMsg.textContent = '';
}

/**
 * Realizar login
 */
export function login() {
    const pinInput = document.getElementById(DOM_IDS.PIN_INPUT);
    const errorMsg = document.getElementById(DOM_IDS.LOGIN_ERROR);
    const pin = pinInput.value;
    
    if (pin === PIN_CORRECT) {
        isAuthenticated = true;
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        updateAuthUI();
        hideLoginModal();
        
        // Disparar evento personalizado para que otros módulos reaccionen
        document.dispatchEvent(new CustomEvent('authChanged', { 
            detail: { authenticated: true } 
        }));
        
        return true;
    } else {
        errorMsg.textContent = '❌ PIN INCORRECTO';
        pinInput.value = '';
        pinInput.focus();
        return false;
    }
}

/**
 * Realizar logout
 */
export function logout() {
    isAuthenticated = false;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    updateAuthUI();
    
    // Disparar evento personalizado
    document.dispatchEvent(new CustomEvent('authChanged', { 
        detail: { authenticated: false } 
    }));
}

/**
 * Actualizar UI según estado de autenticación
 */
export function updateAuthUI() {
    const userStatus = document.getElementById(DOM_IDS.USER_STATUS);
    const loginBtn = document.getElementById(DOM_IDS.LOGIN_BTN);
    const logoutBtn = document.getElementById(DOM_IDS.LOGOUT_BTN);
    const uploadBtn = document.getElementById(DOM_IDS.UPLOAD_FILE_BTN);
    
    if (isAuthenticated) {
        userStatus.textContent = UI_TEXTS.ADMIN_MODE;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        uploadBtn.style.display = 'inline-block';
    } else {
        userStatus.textContent = UI_TEXTS.VISITOR_MODE;
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        uploadBtn.style.display = 'none';
    }
}

/**
 * Requerir autenticación (helper para otros módulos)
 */
export function requireAuth() {
    if (!isAuthenticated) {
        alert(UI_TEXTS.LOGIN_REQUIRED);
        showLoginModal();
        return false;
    }
    return true;
}

// Export default
export default {
    initAuth,
    isUserAuthenticated,
    showLoginModal,
    hideLoginModal,
    login,
    logout,
    updateAuthUI,
    requireAuth
};