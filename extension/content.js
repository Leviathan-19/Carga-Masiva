/**
 * Salesforce User Bulk Creator - Content Script
 * Se inyecta en la pestaña de Salesforce para interactuar directamente con el DOM.
 */

(function () {
  // Evitar inyecciones duplicadas
  if (window.__sfBulkCreatorInjected) return;
  window.__sfBulkCreatorInjected = true;

  console.log('[SF-Bulk] Content script inicializado.');

  // Helper para buscar elementos dentro del documento o dentro de iframes (Lightning Classic Frame)
  function getDocumentContext() {
    // Si estamos en Lightning, la pantalla clásica /005/e suele estar dentro de un iframe
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.contentDocument && iframe.contentDocument.querySelector('input#name_lastName, input[name="name_lastName"], input[name="save_new"]')) {
          return iframe.contentDocument;
        }
      } catch (e) {
        // Ignorar iframes de otros dominios protegidos por CORS
      }
    }
    return document;
  }

  // Helper para encontrar inputs por ID, Name o coincidencia de Label
  function findField(ctx, fieldName, type = 'input') {
    // 1. Mapeo directo por ID estándar de Salesforce
    const directIds = {
      FirstName: ['name_firstName', 'FirstName'],
      LastName: ['name_lastName', 'LastName'],
      Alias: ['Alias', 'alias'],
      Email: ['Email', 'email'],
      Username: ['Username', 'username'],
      Nickname: ['CommunityNickname', 'Nickname'],
      Title: ['Title', 'title'],
      Company: ['Company', 'company'],
      Department: ['Department', 'department'],
      Division: ['Division', 'division'],
      UserLicense: ['user_license_id'],
      Profile: ['Profile', 'profile'],
      Role: ['user_role_id', 'Role'],
      TimeZone: ['timezoneselect', 'TimeZone'],
      Locale: ['localeselect', 'Locale'],
      Language: ['languageselect', 'Language'],
      EmailEncoding: ['EmailEncodingKey'],
      SendPassword: ['generate_new_password']
    };

    const ids = directIds[fieldName] || [fieldName];
    for (const id of ids) {
      const el = ctx.querySelector(`${type}#${id}, ${type}[name="${id}"]`);
      if (el) return el;
    }

    // 2. Búsqueda por texto en <label>
    const labels = ctx.querySelectorAll('label');
    for (const label of labels) {
      const labelText = label.textContent.trim().toLowerCase();
      if (labelText.includes(fieldName.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = ctx.getElementById(forId);
          if (el) return el;
        }
        const child = label.querySelector(type);
        if (child) return child;
      }
    }

    return null;
  }

  // Establecer valor y disparar eventos para que Salesforce reaccione
  function setInputValue(el, value) {
    if (!el) return;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Seleccionar opción en un <select> por texto visible o valor
  function setSelectValue(selectEl, desiredText) {
    if (!selectEl || !desiredText) return false;
    const search = desiredText.trim().toLowerCase();
    
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optText = opt.text.trim().toLowerCase();
      const optVal = opt.value.trim().toLowerCase();

      if (optText === search || optVal === search || optText.includes(search)) {
        selectEl.selectedIndex = i;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Espera sutil
  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  // Procesar un único usuario en la pantalla
  async function fillUserForm(record, options = {}) {
    const ctx = getDocumentContext();
    const fieldDelay = options.delay || 200;

    // Verificar que estamos en la pantalla de New User
    const lastNameInput = findField(ctx, 'LastName');
    if (!lastNameInput) {
      return {
        success: false,
        error: 'No se detectó el formulario de New User en la pestaña activa de Salesforce.'
      };
    }

    // 1. First Name y Last Name
    if (record.FirstName) {
      setInputValue(findField(ctx, 'FirstName'), record.FirstName);
      await delay(fieldDelay);
    }
    setInputValue(lastNameInput, record.LastName);
    await delay(fieldDelay);

    // 2. Alias (máximo 8 caracteres en Salesforce)
    const aliasVal = (record.Alias || record.LastName.substring(0, 8)).substring(0, 8);
    setInputValue(findField(ctx, 'Alias'), aliasVal);
    await delay(fieldDelay);

    // 3. Email
    setInputValue(findField(ctx, 'Email'), record.Email);
    await delay(fieldDelay);

    // 4. Username (formato de correo)
    setInputValue(findField(ctx, 'Username'), record.Username || record.Email);
    await delay(fieldDelay);

    // 5. Nickname
    const nicknameVal = record.Nickname || aliasVal;
    setInputValue(findField(ctx, 'Nickname'), nicknameVal);
    await delay(fieldDelay);

    // 6. Campos opcionales de organización
    if (record.Title) setInputValue(findField(ctx, 'Title'), record.Title);
    if (record.Company) setInputValue(findField(ctx, 'Company'), record.Company);
    if (record.Department) setInputValue(findField(ctx, 'Department'), record.Department);
    if (record.Division) setInputValue(findField(ctx, 'Division'), record.Division);

    // 7. Role
    if (record.Role) {
      setSelectValue(findField(ctx, 'Role', 'select'), record.Role);
      await delay(fieldDelay);
    }

    // 8. User License y Profile (Dependencia dinámica)
    if (record.UserLicense) {
      const licenseSelect = findField(ctx, 'UserLicense', 'select');
      if (licenseSelect) {
        setSelectValue(licenseSelect, record.UserLicense);
        // Esperar a que Salesforce actualice el select de Profile
        await delay(fieldDelay + 500);
      }
    }

    if (record.Profile) {
      const profileSelect = findField(ctx, 'Profile', 'select');
      if (profileSelect) {
        setSelectValue(profileSelect, record.Profile);
        await delay(fieldDelay);
      }
    }

    // 9. Configuración de Localización
    if (record.TimeZone) setSelectValue(findField(ctx, 'TimeZone', 'select'), record.TimeZone);
    if (record.Locale) setSelectValue(findField(ctx, 'Locale', 'select'), record.Locale);
    if (record.Language) setSelectValue(findField(ctx, 'Language', 'select'), record.Language);
    if (record.EmailEncoding) setSelectValue(findField(ctx, 'EmailEncoding', 'select'), record.EmailEncoding);

    // 10. Checkbox de notificación de contraseña
    const sendPassCheckbox = findField(ctx, 'SendPassword');
    if (sendPassCheckbox) {
      const shouldCheck = record.SendPassword === true || record.SendPassword === 'true';
      if (options.uncheckNotifyPass) {
        sendPassCheckbox.checked = false;
      } else {
        sendPassCheckbox.checked = shouldCheck;
      }
      sendPassCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await delay(300);

    // 11. Presionar "Save & New"
    const saveNewBtn = ctx.querySelector('input[name="save_new"], button[name="save_new"], input[value="Save & New"], input[value="Guardar y nuevo"]');
    if (!saveNewBtn) {
      return {
        success: false,
        error: 'No se encontró el botón "Save & New" en la interfaz.'
      };
    }

    saveNewBtn.click();

    // 12. Monitorear resultado (Éxito o Error)
    const result = await waitForSaveResult(ctx);
    return result;
  }

  // Esperar a que Salesforce guarde y verifique si hubo error o si limpió el formulario
  function waitForSaveResult(ctx, maxWaitMs = 12000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const interval = setInterval(() => {
        // Verificar si la página sigue existiendo o si estamos en contexto
        const currentCtx = getDocumentContext();

        // 1. Detectar si hay mensajes de error visibles de Salesforce
        const errorBoxes = currentCtx.querySelectorAll('.errorMsg, .message.errorM3, div[id*="error"]');
        for (const err of errorBoxes) {
          const text = err.textContent.trim();
          if (text && text.length > 3 && !text.includes('script')) {
            clearInterval(interval);
            return resolve({
              success: false,
              error: `Error Salesforce: ${text.replace(/\s+/g, ' ')}`
            });
          }
        }

        // 2. Detectar si el formulario se limpió ("Save & New" exitoso)
        const lastNameEl = findField(currentCtx, 'LastName');
        if (lastNameEl && lastNameEl.value === '') {
          clearInterval(interval);
          return resolve({ success: true });
        }

        // 3. Timeout de seguridad
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve({
            success: false,
            error: 'Tiempo de espera agotado al guardar el usuario.'
          });
        }
      }, 500);
    });
  }

  // Escuchar mensajes provenientes del popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'PING') {
      const ctx = getDocumentContext();
      const hasForm = !!findField(ctx, 'LastName');
      sendResponse({ ready: true, hasForm, url: window.location.href });
      return true;
    }

    if (request.action === 'CREATE_USER') {
      fillUserForm(request.record, request.options)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true; // Asíncrono
    }
  });

})();

