// Estado global
let isAuthenticated = false;
let printers = [];
let selectedPrinter = null;
let availableFiles = [];
let searchTerm = '';
let filters = { printing: true, idle: true, offline: true };
let viewMode = 'expanded'; // 'expanded' o 'compact'
let tempCharts = {}; // Almacena gráficos de temperatura
let completedPrints = new Set(); // Rastrear impresiones completadas para notificaciones

// Constantes
const API_URL = 'api.php';
const API_FILES_URL = 'api_files.php';  // 👈 AGREGAR ESTA LÍNEA
const REFRESH_INTERVAL = 100;
const PIN_CORRECT = '123456'; // Cambiar esto en producción

// Mensajes divertidos según estado
const STATUS_MESSAGES = {
    printing: [
        //'💅 SERVING PLASTIC REALNESS',
        //'✨ DERRITIENDO PLÁSTICO CON ESTILO',
        //'🔥 CALENTANDO EL DRAMA',
        //'⚡ SLAY QUEEN, IMPRIMIENDO',
        '🌈 FABRICANDO MAGIA'
    ],
    idle: [
        //'😴 DURMIENDO PLÁCIDAMENTE',
        //'💤 EN MODO SIESTA',
        //'🛋️ ESPERANDO ÓRDENES',
        '✌️ LISTA PARA LA ACCIÓN'//,
        //'🎮 STANDBY MODE'
    ],
    error: [
        //'🚨 ALGO SALIÓ MAL BESTIE',
        '⚠️ HOUSTON TENEMOS PROBLEMA'//,
        //'💔 ERROR CRÍTICO',
        //'🔴 SITUACIÓN COMPLICADA',
        //'😱 PÁNICO EN EL LAB'
    ],
    offline: [
        //'📡 CONEXIÓN PERDIDA EN EL ÉTER',
        //'👻 FANTASMA EN EL SISTEMA',
        //'🌙 SEÑAL DESAPARECIDA',
        //'💀 SIN SEÑALES DE VIDA',
        '🔌 DESCONECTADA DEL MATRIX'
    ]
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    loadPrinters();
    setInterval(loadPrinters, REFRESH_INTERVAL);
});

// Verificar autenticación guardada
function checkAuth() {
    const savedAuth = localStorage.getItem('tecmedhub_auth');
    if (savedAuth === 'true') {
        isAuthenticated = true;
        updateAuthUI();
    }
}

// Configurar eventos
function setupEventListeners() {
    // Auth
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('submit-pin').addEventListener('click', login);
    document.getElementById('close-modal').addEventListener('click', hideLoginModal);
    document.getElementById('pin-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });

        // File modal
        document.getElementById('close-file-modal').addEventListener('click', hideFileModal);

        // File tabs
        document.querySelectorAll('.file-tab').forEach(tab => {
            tab.addEventListener('click', () => switchFileTab(tab.dataset.tab));
        });

        // Upload
        document.getElementById('upload-file-btn').addEventListener('click', () => showFileSelector(null, true));
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('file-input');

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('drag-over');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('drag-over');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileUpload(e.target.files[0]);
            }
        });

        // Notes modal
        document.getElementById('close-notes-modal').addEventListener('click', hideNotesModal);
        document.getElementById('save-notes').addEventListener('click', saveNotes);

        // Logs modal
        document.getElementById('close-logs-modal').addEventListener('click', hideLogsModal);

        // Search
        document.getElementById('search-input').addEventListener('input', (e) => {
            searchTerm = e.target.value.toLowerCase();
            renderPrinters();
        });

        // Filters
        document.getElementById('filter-printing').addEventListener('change', (e) => {
            filters.printing = e.target.checked;
            renderPrinters();
        });
        document.getElementById('filter-idle').addEventListener('change', (e) => {
            filters.idle = e.target.checked;
            renderPrinters();
        });
        document.getElementById('filter-offline').addEventListener('change', (e) => {
            filters.offline = e.target.checked;
            renderPrinters();
        });

        // View mode
        document.getElementById('compact-view').addEventListener('click', () => setViewMode('compact'));
        document.getElementById('expanded-view').addEventListener('click', () => setViewMode('expanded'));
}

// Cargar impresoras desde el servidor
async function loadPrinters() {
    try {
        const response = await fetch(`${API_URL}?action=get_printers`);
        const data = await response.json();

        if (data.success) {
            // Detectar impresiones completadas
            data.printers.forEach(printer => {
                const wasCompleted = completedPrints.has(printer.id);
                const isCompleted = printer.last_completed && !wasCompleted;

                if (isCompleted) {
                    playCompletionSound();
                    showNotification(`✅ ${printer.name} completó la impresión!`);
                    completedPrints.add(printer.id);
                }
            });

            printers = data.printers;
            renderPrinters();
        }
    } catch (error) {
        console.error('Error cargando impresoras:', error);
    }
}

// Renderizar tarjetas de impresoras
function renderPrinters() {
    const sections = {
        printing: document.querySelector('[data-section="printing"]'),
        idle: document.querySelector('[data-section="idle"]'),
        offline: document.querySelector('[data-section="offline"]')
    };

    // Limpiar secciones
    Object.values(sections).forEach(section => section.innerHTML = '');

    if (printers.length === 0) {
        sections.idle.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #9D4EDD; padding: 50px;">🔍 NO HAY IMPRESORAS CONECTADAS</div>';
        return;
    }

    // Ordenar por token para mantener orden consistente
    const sortedPrinters = [...printers].sort((a, b) => a.token.localeCompare(b.token));

    sortedPrinters.forEach(printer => {
        // Aplicar filtros
        if (!applyFilters(printer)) return;

        const section = getSectionForPrinter(printer);
        if (section && sections[section]) {
            const card = createPrinterCard(printer);
            sections[section].appendChild(card);
        }
    });

    // Ocultar secciones vacías
    Object.entries(sections).forEach(([key, section]) => {
        const sectionElement = document.getElementById(`section-${key}`);
        if (section.children.length === 0) {
            sectionElement.style.display = 'none';
        } else {
            sectionElement.style.display = 'block';
        }
    });
}

// Aplicar filtros de búsqueda y checkboxes
function applyFilters(printer) {
    // Filtro de búsqueda
    if (searchTerm && !printer.name.toLowerCase().includes(searchTerm)) {
        return false;
    }

    // Filtros de estado
    const section = getSectionForPrinter(printer);
    if (section === 'printing' && !filters.printing) return false;
    if (section === 'idle' && !filters.idle) return false;
    if (section === 'offline' && !filters.offline) return false;

    return true;
}

// Determinar sección para impresora
function getSectionForPrinter(printer) {
    if (printer.status === 'offline') return 'offline';
    if (printer.status === 'printing') return 'printing';
    return 'idle'; // idle, error, etc.
}

// Crear tarjeta individual
function createPrinterCard(printer) {
    const card = document.createElement('div');
    card.className = `printer-card ${printer.status === 'offline' ? 'offline' : ''}`;
    card.dataset.printerId = printer.id;

    // Alertas de temperatura
    const tempWarning = checkTemperature(printer.temp_hotend, printer.temp_bed);
    if (tempWarning) card.classList.add(tempWarning);

    const funnyMessage = getRandomMessage(printer.status);
    const progressPercent = printer.progress || 0;

    card.innerHTML = `
    <div class="printer-header">
    <div class="printer-title-area">
    <div class="printer-name">${printer.name}</div>
    <div class="printer-tags">
    ${printer.tags ? printer.tags.map(tag => `<span class="tag">${tag}</span>`).join('') : ''}
    </div>
    </div>
    <div class="status-badge status-${printer.status}">${printer.status.toUpperCase()}</div>
    </div>

    <div class="printer-image">
    ${printer.image ? `<img src="${printer.image}" alt="Preview">` : '<div class="no-image">📷 SIN IMAGEN</div>'}
    </div>

    <div class="printer-info">
    <div class="info-line">
    <span class="info-label">ESTADO:</span>
    <span class="info-value">${funnyMessage}</span>
    </div>
    ${printer.current_file ? `
        <div class="info-line">
        <span class="info-label">ARCHIVO:</span>
        <span class="info-value">${printer.current_file}</span>
        </div>
        ` : ''}
        ${printer.time_remaining ? `
            <div class="info-line">
            <span class="info-label">TIEMPO REST:</span>
            <span class="info-value">${formatTime(printer.time_remaining)}</span>
            </div>
            ` : ''}
            <div class="info-line">
            <span class="info-label">TEMP HOTEND:</span>
            <span class="info-value ${getTempClass(printer.temp_hotend, 250)}">${printer.temp_hotend || 0}°C</span>
            </div>
            <div class="info-line">
            <span class="info-label">TEMP CAMA:</span>
            <span class="info-value ${getTempClass(printer.temp_bed, 100)}">${printer.temp_bed || 0}°C</span>
            </div>
            ${printer.print_speed ? `
                <div class="info-line">
                <span class="info-label">VELOCIDAD:</span>
                <span class="info-value">${printer.print_speed}%</span>
                </div>
                ` : ''}
                ${printer.last_completed ? `
                    <div class="info-line">
                    <span class="info-label">ÚLTIMO TRABAJO:</span>
                    <span class="info-value">${printer.last_completed}</span>
                    </div>
                    ` : ''}
                    ${printer.bed_status ? `
                        <div class="info-line">
                        <span class="info-label">ESTADO CAMA:</span>
                        <span class="info-value">${printer.bed_status}</span>
                        </div>
                        ` : ''}
                        ${printer.uptime ? `
                            <div class="info-line">
                            <span class="info-label">UPTIME:</span>
                            <span class="info-value">${printer.uptime}</span>
                            </div>
                            ` : ''}
                            ${printer.status === 'printing' ? `
                                <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                                <div class="progress-text">${progressPercent}%</div>
                                </div>
                                ` : ''}
                                ${printer.filament ? `
                                    <div class="filament-info ${!printer.filament.remaining || printer.filament.remaining < 10 ? 'empty' : ''}">
                                    <div class="info-line">
                                    <span class="info-label">FILAMENTO:</span>
                                    <span class="info-value">${printer.filament.material || 'N/A'} - ${printer.filament.color || 'N/A'}</span>
                                    </div>
                                    ${printer.filament.remaining !== undefined ? `
                                        <div class="info-line">
                                        <span class="info-label">RESTANTE:</span>
                                        <span class="info-value">${printer.filament.remaining}%</span>
                                        </div>
                                        ` : ''}
                                        </div>
                                        ` : ''}
                                        </div>

                                        <div class="temp-chart" id="chart-${printer.id}"></div>

                                        ${isAuthenticated && printer.status !== 'offline' ? `
                                            <div class="printer-controls">
                                            <button class="btn-action" onclick="sendCommand('${printer.id}', 'home')">🏠 HOME</button>
                                            <button class="btn-action" onclick="sendCommand('${printer.id}', 'heat')">🔥 CALENTAR</button>
                                            <button class="btn-action" onclick="showFileSelector('${printer.id}')">📄 IMPRIMIR</button>
                                            <button class="btn-action" onclick="sendCommand('${printer.id}', '${printer.status === 'printing' ? 'pause' : 'resume'}')">
                                            ${printer.status === 'printing' ? '⏸️ PAUSAR' : '▶️ REANUDAR'}
                                            </button>
                                            <button class="btn-action small" onclick="toggleFan('${printer.id}')">💨 FAN</button>
                                            <button class="btn-action small" onclick="sendCommand('${printer.id}', 'reboot')">🔄 REBOOT</button>
                                            <button class="btn-action small btn-secondary" onclick="showNotes('${printer.id}')">📝 NOTAS</button>
                                            <button class="btn-action small btn-secondary" onclick="showLogs('${printer.id}')">📜 LOGS</button>
                                            ${printer.status === 'printing' ? `
                                                <div class="speed-control" style="grid-column: 1 / -1;">
                                                <label>⚡ VELOCIDAD:</label>
                                                <input type="range" min="50" max="200" value="${printer.print_speed || 100}"
                                                onchange="changeSpeed('${printer.id}', this.value)">
                                                <span class="speed-value">${printer.print_speed || 100}%</span>
                                                </div>
                                                ` : ''}
                                                <button class="btn-action btn-emergency" onclick="sendCommand('${printer.id}', 'emergency_stop')">🚨 STOP EMERGENCIA</button>
                                                </div>
                                                ` : ''}
                                                `;

                                                // Inicializar gráfico de temperatura después de agregar al DOM
                                                setTimeout(() => initTempChart(printer.id, printer), 100);

                                                return card;
}

// Inicializar gráfico de temperatura simple
function initTempChart(printerId, printer) {
    const chartElement = document.getElementById(`chart-${printerId}`);
    if (!chartElement) return;

    // Almacenar historial de temperaturas (simulado por ahora)
    if (!tempCharts[printerId]) {
        tempCharts[printerId] = {
            hotend: [],
            bed: []
        };
    }

    // Agregar nuevos valores
    tempCharts[printerId].hotend.push(printer.temp_hotend || 0);
    tempCharts[printerId].bed.push(printer.temp_bed || 0);

    // Mantener solo últimos 20 valores
    if (tempCharts[printerId].hotend.length > 20) {
        tempCharts[printerId].hotend.shift();
        tempCharts[printerId].bed.shift();
    }

    // Dibujar gráfico simple con ASCII art (placeholder)
    const maxTemp = 300;
    const hotendPercent = (tempCharts[printerId].hotend[tempCharts[printerId].hotend.length - 1] / maxTemp) * 100;
    const bedPercent = (tempCharts[printerId].bed[tempCharts[printerId].bed.length - 1] / maxTemp) * 100;

    chartElement.innerHTML = `
    <div style="padding: 5px; font-size: 0.4rem;">
    <div style="display: flex; align-items: center; margin-bottom: 5px;">
    <span style="color: #FF006E; margin-right: 10px;">HOTEND:</span>
    <div style="flex: 1; height: 8px; background: #0d001a; border: 1px solid #FF006E;">
    <div style="height: 100%; width: ${hotendPercent}%; background: linear-gradient(90deg, #FF006E, #B026FF);"></div>
    </div>
    </div>
    <div style="display: flex; align-items: center;">
    <span style="color: #4CC9F0; margin-right: 10px;">CAMA:</span>
    <div style="flex: 1; height: 8px; background: #0d001a; border: 1px solid #4CC9F0;">
    <div style="height: 100%; width: ${bedPercent}%; background: linear-gradient(90deg, #4CC9F0, #00F5FF);"></div>
    </div>
    </div>
    </div>
    `;
}

// Verificar temperatura y devolver clase de alerta
function checkTemperature(hotend, bed) {
    if (hotend > 280 || bed > 120) return 'temp-danger';
    if (hotend > 260 || bed > 100) return 'temp-warning';
    return null;
}

// Clase CSS según temperatura
function getTempClass(temp, max) {
    if (temp > max * 1.1) return 'danger';
    if (temp > max) return 'warning';
    return '';
}

// Formatear tiempo
function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

// Obtener mensaje aleatorio según estado
function getRandomMessage(status) {
    const messages = STATUS_MESSAGES[status] || STATUS_MESSAGES.idle;
    return messages[Math.floor(Math.random() * messages.length)];
}

// Cambiar modo de vista
function setViewMode(mode) {
    viewMode = mode;
    document.body.classList.toggle('compact-mode', mode === 'compact');
    document.getElementById('compact-view').classList.toggle('active', mode === 'compact');
    document.getElementById('expanded-view').classList.toggle('active', mode === 'expanded');
}

// Mostrar modal de login
function showLoginModal() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('pin-input').focus();
    document.getElementById('login-error').textContent = '';
}

// Ocultar modal de login
function hideLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
    document.getElementById('pin-input').value = '';
    document.getElementById('login-error').textContent = '';
}

// Login
function login() {
    const pin = document.getElementById('pin-input').value;

    if (pin === PIN_CORRECT) {
        isAuthenticated = true;
        localStorage.setItem('tecmedhub_auth', 'true');
        updateAuthUI();
        hideLoginModal();
        renderPrinters();
    } else {
        document.getElementById('login-error').textContent = '❌ PIN INCORRECTO';
    }
}

// Logout
function logout() {
    isAuthenticated = false;
    localStorage.removeItem('tecmedhub_auth');
    updateAuthUI();
    renderPrinters();
}

// Actualizar UI de autenticación
function updateAuthUI() {
    const userStatus = document.getElementById('user-status');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const uploadBtn = document.getElementById('upload-file-btn');

    if (isAuthenticated) {
        userStatus.textContent = '👑 MODO ADMIN';
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        uploadBtn.style.display = 'inline-block';
    } else {
        userStatus.textContent = '👀 MODO VISITANTE';
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        uploadBtn.style.display = 'none';
    }
}

// Mostrar selector de archivos
async function showFileSelector(printerId, uploadOnly = false) {
    selectedPrinter = printerId;

    try {
        const response = await fetch(`${API_URL}?action=get_files`);
        const data = await response.json();

        if (data.success) {
            availableFiles = data.files;
            renderFileList('server');

            if (printerId) {
                // Cargar archivos de la impresora específica
                loadPrinterFiles(printerId);
            }

            document.getElementById('file-modal').classList.add('active');

            if (uploadOnly) {
                switchFileTab('upload');
            }
        }
    } catch (error) {
        console.error('Error cargando archivos:', error);
        alert('❌ ERROR CARGANDO ARCHIVOS');
    }
}

// Cargar archivos locales de la impresora
// Reemplazar loadPrinterFiles (línea ~380 aprox)
async function loadPrinterFiles(printerId) {
    const printerFileList = document.getElementById('file-list-printer');
    printerFileList.innerHTML = '<div style="text-align: center; color: #9D4EDD; padding: 20px;">🔄 CARGANDO ARCHIVOS LOCALES...</div>';

    try {
        // Buscar la impresora
        const printer = printers.find(p => p.id === printerId);

        if (!printer) {
            printerFileList.innerHTML = '<div style="text-align: center; color: #FF006E;">❌ IMPRESORA NO ENCONTRADA</div>';
            return;
        }

        // Obtener archivos locales de la impresora
        const printerFiles = printer.files || [];

        if (printerFiles.length === 0) {
            printerFileList.innerHTML = '<div style="text-align: center; color: #9D4EDD;">📂 NO HAY ARCHIVOS EN LA IMPRESORA</div>';
            return;
        }

        // Renderizar archivos
        printerFileList.innerHTML = '';
        printerFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
            <span>📄 ${file.name}</span>
            <span style="color: #9D4EDD; font-size: 0.4rem;">${file.size || ''}</span>
            `;
            fileItem.addEventListener('click', () => selectFile(file.name, true));
            printerFileList.appendChild(fileItem);
        });

    } catch (error) {
        console.error('Error cargando archivos de impresora:', error);
        printerFileList.innerHTML = '<div style="text-align: center; color: #FF006E;">❌ ERROR CARGANDO ARCHIVOS</div>';
    }
}


// Cambiar tab de archivos
function switchFileTab(tab) {
    document.querySelectorAll('.file-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });

    document.querySelectorAll('.file-list-content').forEach(content => {
        const contentId = content.id;
        const shouldShow =
        (tab === 'server' && contentId === 'file-list-server') ||
        (tab === 'printer' && contentId === 'file-list-printer') ||
        (tab === 'upload' && contentId === 'file-upload-area');
        content.classList.toggle('active', shouldShow);
    });
}

// Renderizar lista de archivos
function renderFileList(type) {
    const fileList = document.getElementById(`file-list-${type}`);
    fileList.innerHTML = '';

    if (availableFiles.length === 0) {
        fileList.innerHTML = '<div style="text-align: center; color: #9D4EDD;">📂 NO HAY ARCHIVOS DISPONIBLES</div>';
        return;
    }

    availableFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
        <span>📄 ${file.name}</span>
        <span style="color: #9D4EDD; font-size: 0.4rem;">${file.size || ''}</span>
        `;
        fileItem.addEventListener('click', () => selectFile(file.name));
        fileList.appendChild(fileItem);
    });
}

// Manejar subida de archivo
async function handleFileUpload(file) {
    if (!file.name.endsWith('.gcode')) {
        alert('❌ SOLO SE PERMITEN ARCHIVOS .GCODE');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const progressContainer = document.getElementById('upload-progress');

    progressContainer.style.display = 'block';

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressBar.style.width = percent + '%';
                progressText.textContent = percent + '%';
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    setTimeout(() => {
                        progressContainer.style.display = 'none';
                        progressBar.style.width = '0%';
                        alert('✅ ARCHIVO SUBIDO: ' + file.name);

                        if (selectedPrinter) {
                            selectFile(file.name);
                        } else {
                            hideFileModal();
                        }
                    }, 500);
                } else {
                    alert('❌ ' + data.message);
                    progressContainer.style.display = 'none';
                }
            }
        });

        xhr.addEventListener('error', () => {
            alert('❌ ERROR EN LA SUBIDA');
            progressContainer.style.display = 'none';
        });

        xhr.open('POST', API_FILES_URL + '?action=upload_file');
        xhr.send(formData);

    } catch (error) {
        console.error('Error:', error);
        alert('❌ ERROR SUBIENDO ARCHIVO');
        progressContainer.style.display = 'none';
    }
}

// Modificar showFileSelector (línea ~350 aprox)
async function showFileSelector(printerId, uploadOnly = false) {
    selectedPrinter = printerId;

    try {
        const response = await fetch(`${API_FILES_URL}?action=list_files`);
        const data = await response.json();

        if (data.success) {
            availableFiles = data.files;
            renderFileList('server');

            if (printerId) {
                // Cargar archivos de la impresora específica
                loadPrinterFiles(printerId);
            }

            document.getElementById('file-modal').classList.add('active');

            if (uploadOnly) {
                switchFileTab('upload');
            }
        }
    } catch (error) {
        console.error('Error cargando archivos:', error);
        alert('❌ ERROR CARGANDO ARCHIVOS');
    }
}


// Modificar selectFile para saber si es archivo local o del servidor
async function selectFile(fileName, isLocal = false) {
    if (!selectedPrinter) {
        alert('❌ NO HAY IMPRESORA SELECCIONADA');
        return;
    }

    // Si es archivo local, no necesita descarga
    const action = isLocal ? 'print_local' : 'print';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: action,
                printer_id: selectedPrinter,
                file: fileName
            })
        });

        const data = await response.json();

        if (data.success) {
            const msg = isLocal ?
            `✅ IMPRESIÓN INICIADA (LOCAL): ${fileName}` :
            `✅ IMPRESIÓN INICIADA (DESCARGANDO): ${fileName}`;
            alert(msg);
            hideFileModal();
            loadPrinters();
        } else {
            alert(`❌ ERROR: ${data.message}`);
        }
    } catch (error) {
        console.error('Error iniciando impresión:', error);
        alert('❌ ERROR ENVIANDO COMANDO');
    }
}

// Ocultar modal de archivos
function hideFileModal() {
    document.getElementById('file-modal').classList.remove('active');
    selectedPrinter = null;
    document.getElementById('file-input').value = '';
}

// Mostrar modal de notas
function showNotes(printerId) {
    selectedPrinter = printerId;
    const printer = printers.find(p => p.id === printerId);
    document.getElementById('notes-input').value = printer?.notes || '';
    document.getElementById('notes-modal').classList.add('active');
}

// Guardar notas
async function saveNotes() {
    const notes = document.getElementById('notes-input').value;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_notes',
                printer_id: selectedPrinter,
                notes: notes
            })
        });

        const data = await response.json();

        if (data.success) {
            alert('✅ NOTAS GUARDADAS');
            hideNotesModal();
            loadPrinters();
        }
    } catch (error) {
        console.error('Error guardando notas:', error);
        alert('❌ ERROR GUARDANDO NOTAS');
    }
}

// Ocultar modal de notas
function hideNotesModal() {
    document.getElementById('notes-modal').classList.remove('active');
    selectedPrinter = null;
}

// Mostrar logs
function showLogs(printerId) {
    const printer = printers.find(p => p.id === printerId);
    const logsContent = document.getElementById('logs-content');

    // En producción, cargar logs reales
    logsContent.innerHTML = `
    <div class="log-entry">2025-10-06 14:23:45 - Iniciando impresión...</div>
    <div class="log-entry">2025-10-06 14:23:50 - Calentando hotend a 210°C</div>
    <div class="log-entry">2025-10-06 14:24:15 - Calentando cama a 60°C</div>
    <div class="log-entry warning">2025-10-06 14:24:20 - Advertencia: Temperatura fluctuante</div>
    <div class="log-entry">2025-10-06 14:25:00 - Iniciando homing</div>
    <div class="log-entry">2025-10-06 14:25:30 - Comenzando impresión</div>
    `;

    document.getElementById('logs-modal').classList.add('active');
}

// Ocultar modal de logs
function hideLogsModal() {
    document.getElementById('logs-modal').classList.remove('active');
}

// Cambiar velocidad de impresión
async function changeSpeed(printerId, speed) {
    sendCommand(printerId, 'set_speed', { speed: speed });
}

// Toggle ventilador
async function toggleFan(printerId) {
    sendCommand(printerId, 'toggle_fan');
}

// Enviar comando a impresora
async function sendCommand(printerId, command, extraData = {}) {
    if (!isAuthenticated) {
        alert('🔒 NECESITAS ESTAR LOGUEADO');
        return;
    }

    const confirmMessages = {
        emergency_stop: '🚨 ¿SEGURO QUE QUIERES HACER STOP DE EMERGENCIA?',
        heat: '🔥 ¿CALENTAR EXTRUSOR?',
        reboot: '🔄 ¿REINICIAR LA IMPRESORA?'
    };

    if (confirmMessages[command]) {
        if (!confirm(confirmMessages[command])) return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: command,
                printer_id: printerId,
                ...extraData
            })
        });

        const data = await response.json();

        if (data.success) {
            alert(`✅ COMANDO ENVIADO: ${command.toUpperCase()}`);
            loadPrinters();
        } else {
            alert(`❌ ERROR: ${data.message}`);
        }
    } catch (error) {
        console.error('Error enviando comando:', error);
        alert('❌ ERROR ENVIANDO COMANDO');
    }
}

// Reproducir sonido de completado
function playCompletionSound() {
    try {
        const audio = document.getElementById('completion-sound');
        audio.play().catch(e => console.log('No se pudo reproducir el sonido:', e));
    } catch (error) {
        console.log('Audio no disponible');
    }
}

// Mostrar notificación
function showNotification(message) {
    // Usar notificaciones del navegador si están disponibles
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TecMedHub', {
            body: message,
            icon: 'logo.png'
        });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification('TecMedHub', {
                    body: message,
                    icon: 'logo.png'
                });
            }
        });
    }

    // Mostrar también en consola
    console.log('🔔', message);
}
