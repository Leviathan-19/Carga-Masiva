/**
 * Salesforce User Bulk Creator - Popup Logic
 * Gestiona la carga de archivos CSV/JSON, la comunicación con la pestaña activa y los reportes.
 */

let loadedRecords = [];
let isRunning = false;
let shouldStop = false;
let successRecords = [];
let failedRecords = [];
let activeTabId = null;

// Elementos del DOM del Popup
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const fileStats = document.getElementById('fileStats');
const totalRecordsEl = document.getElementById('totalRecords');
const fileTypeEl = document.getElementById('fileType');
const delayInput = document.getElementById('delayInput');
const uncheckNotifyPass = document.getElementById('uncheckNotifyPass');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');
const countSuccessEl = document.getElementById('countSuccess');
const countErrorEl = document.getElementById('countError');
const logConsole = document.getElementById('logConsole');
const btnClearLog = document.getElementById('btnClearLog');
const btnDownloadErrors = document.getElementById('btnDownloadErrors');
const btnDownloadSuccess = document.getElementById('btnDownloadSuccess');

// --- Logger para el Popup ---
function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${time}] ${msg}`;
  logConsole.appendChild(entry);
  logConsole.scrollTop = logConsole.scrollHeight;
}

btnClearLog.addEventListener('click', () => {
  logConsole.innerHTML = '';
});

// --- Manejo de Drag & Drop y Archivo ---
dropZone.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add('hover');
  });
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove('hover');
  });
});

dropZone.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    handleFile(files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

function handleFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension !== 'csv' && extension !== 'json') {
    log('Formato de archivo no soportado. Usa .csv o .json', 'error');
    return;
  }

  fileNameDisplay.textContent = file.name;
  fileTypeEl.textContent = extension.toUpperCase();

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const content = evt.target.result;
      if (extension === 'json') {
        loadedRecords = parseJSON(content);
      } else {
        loadedRecords = parseCSV(content);
      }

      totalRecordsEl.textContent = loadedRecords.length;
      fileStats.classList.remove('hidden');

      if (loadedRecords.length > 0) {
        btnStart.disabled = false;
        log(`Se cargaron ${loadedRecords.length} registros desde ${file.name}`, 'success');
      } else {
        btnStart.disabled = true;
        log('El archivo no contiene registros válidos.', 'warn');
      }
    } catch (err) {
      log(`Error al procesar el archivo: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// --- Normalizador de Claves (Mapeo Inteligente) ---
function normalizeKey(key) {
  const clean = key.trim().toLowerCase().replace(/[\s_\-\.\/]/g, '');
  const aliasMap = {
    firstname: 'FirstName',
    nombre: 'FirstName',
    lastname: 'LastName',
    apellido: 'LastName',
    apellidos: 'LastName',
    alias: 'Alias',
    email: 'Email',
    correo: 'Email',
    username: 'Username',
    usuario: 'Username',
    nickname: 'Nickname',
    apodo: 'Nickname',
    role: 'Role',
    rol: 'Role',
    userlicense: 'UserLicense',
    license: 'UserLicense',
    licencia: 'UserLicense',
    profile: 'Profile',
    perfil: 'Profile',
    title: 'Title',
    cargo: 'Title',
    company: 'Company',
    companyname: 'Company',
    empresa: 'Company',
    department: 'Department',
    departamento: 'Department',
    division: 'Division',
    phone: 'Phone',
    telefono: 'Phone',
    mobile: 'Mobile',
    mobilephone: 'Mobile',
    celular: 'Mobile',
    arearesolutora: 'AreaResolutora',
    administracionoperativa: 'AdministracionOperativa',
    iddeusuario: 'PropietarioOrigen',
    idusuario: 'PropietarioOrigen',
    conjuntosdepermisos: 'Profile',
    licencias: 'UserLicense',
    permisos: 'Permisos',
    propietariodeorigen: 'PropietarioOrigen',
    iddepropietariodeorigen: 'PropietarioOrigen',
    idpropietariodeorigen: 'PropietarioOrigen',
    propietarioorigen: 'PropietarioOrigen',
    propietario: 'PropietarioOrigen',
    timezone: 'TimeZone',
    locale: 'Locale',
    language: 'Language',
    idioma: 'Language',
    emailencoding: 'EmailEncoding',
    sendpassword: 'SendPassword'
  };

  return aliasMap[clean] || key.trim();
}

// --- Parsers ---
function parseJSON(content) {
  const parsed = JSON.parse(content);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map(item => {
    const normalized = {};
    for (const [k, v] of Object.entries(item)) {
      normalized[normalizeKey(k)] = v;
    }
    return normalized;
  });
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Detectar delimitador (, o ;)
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  // Parser básico de líneas CSV respetando comillas
  function parseCSVLine(text) {
    const regex = new RegExp(`(?:${delimiter}|\\r?\\n|^)(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter}\\r\\n]*))`, 'gi');
    const result = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      if (val !== undefined) result.push(val.trim());
    }
    return result;
  }

  const rawHeaders = parseCSVLine(headerLine);
  const headers = rawHeaders.map(h => normalizeKey(h));

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && !values[0])) continue;

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] || '';
    });

    if (record.LastName || record.Email || record.Username) {
      records.push(record);
    }
  }

  return records;
}

// --- Inyección y Verificación de la Pestaña Activa ---
async function ensureContentScriptInjected() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error('No se encontró una pestaña activa.');
  }
  activeTabId = tab.id;

  try {
    const response = await chrome.tabs.sendMessage(activeTabId, { action: 'PING' });
    if (response && response.ready) {
      return response;
    }
  } catch (e) {
    // Si no responde, inyectar el script manualmente
    log('Inyectando automatizador en la pestaña activa...', 'info');
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ['content.js']
    });
    await new Promise(r => setTimeout(r, 400));
    return await chrome.tabs.sendMessage(activeTabId, { action: 'PING' });
  }
}

// --- Control del Proceso de Carga ---
btnStart.addEventListener('click', async () => {
  if (isRunning) return;

  try {
    log('Verificando conexión con Salesforce...', 'info');
    const pingStatus = await ensureContentScriptInjected();

    if (!pingStatus.hasForm) {
      log('ATENCIÓN: Abre la pantalla de "New User" en Salesforce antes de iniciar.', 'warn');
      alert('Por favor navega a la pantalla de creación de usuarios (Setup > Users > New User) en Salesforce antes de presionar Iniciar.');
      return;
    }

    isRunning = true;
    shouldStop = false;
    btnStart.disabled = true;
    btnStop.disabled = false;
    fileInput.disabled = true;
    successRecords = [];
    failedRecords = [];
    btnDownloadSuccess.disabled = true;
    btnDownloadErrors.disabled = true;

    log(`Iniciando creación de ${loadedRecords.length} usuarios...`, 'info');

    const options = {
      delay: parseInt(delayInput.value, 10) || 250,
      uncheckNotifyPass: uncheckNotifyPass.checked
    };

    let processed = 0;
    for (let i = 0; i < loadedRecords.length; i++) {
      if (shouldStop) {
        log('Proceso detenido por el usuario.', 'warn');
        break;
      }

      const record = loadedRecords[i];
      const identifier = `${record.FirstName || ''} ${record.LastName} (${record.Username || record.Email})`;
      log(`[${i + 1}/${loadedRecords.length}] Creando: ${identifier}...`, 'info');

      try {
        const response = await chrome.tabs.sendMessage(activeTabId, {
          action: 'CREATE_USER',
          record,
          options
        });

        if (response && response.success) {
          log(`✔ Éxito al crear: ${identifier}`, 'success');
          successRecords.push({ ...record, processedAt: new Date().toISOString() });
        } else {
          const err = response ? response.error : 'Sin respuesta del navegador';
          log(`✖ Error en ${identifier}: ${err}`, 'error');
          failedRecords.push({ ...record, errorReason: err, processedAt: new Date().toISOString() });
        }
      } catch (callErr) {
        log(`✖ Error de comunicación: ${callErr.message}`, 'error');
        failedRecords.push({ ...record, errorReason: callErr.message, processedAt: new Date().toISOString() });
      }

      processed++;
      updateProgress(processed, loadedRecords.length);
      // Breve pausa entre usuarios
      await new Promise(r => setTimeout(r, 600));
    }

    log(`Proceso completado. Exitosos: ${successRecords.length} | Fallidos: ${failedRecords.length}`, 'info');
  } catch (err) {
    log(`Error fatal: ${err.message}`, 'error');
  } finally {
    isRunning = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    fileInput.disabled = false;
    if (successRecords.length > 0) btnDownloadSuccess.disabled = false;
    if (failedRecords.length > 0) btnDownloadErrors.disabled = false;
  }
});

btnStop.addEventListener('click', () => {
  shouldStop = true;
  log('Solicitando detener el proceso...', 'warn');
});

function updateProgress(current, total) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  progressBarFill.style.width = `${percent}%`;
  progressText.textContent = `${current} / ${total} procesados (${percent}%)`;
  countSuccessEl.textContent = successRecords.length;
  countErrorEl.textContent = failedRecords.length;
}

// --- Exportación de Reportes CSV ---
function exportToCSV(filename, rows) {
  if (!rows || rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

btnDownloadSuccess.addEventListener('click', () => {
  exportToCSV('usuarios_creados_exitosamente.csv', successRecords);
});

btnDownloadErrors.addEventListener('click', () => {
  exportToCSV('usuarios_fallidos.csv', failedRecords);
});
