/**
 * Salesforce User Bulk Creator - Content Script
 * Mapeo optimizado con los selectores exactos del HTML de Salesforce (DEVmig).
 */

(function () {
  if (window.__sfBulkCreatorInjected) return;
  window.__sfBulkCreatorInjected = true;

  console.log('[SF-Bulk] Content script cargado y listo.');

  // Helper para buscar el contexto DOM (soporta iFrames de Salesforce Lightning)
  function getDocumentContext() {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (
          iframe.contentDocument &&
          iframe.contentDocument.querySelector('input#name_lastName, input[name="name_lastName"], input[name="save_new"]')
        ) {
          return iframe.contentDocument;
        }
      } catch (e) {
        // Ignorar iframes con restricciones de origen cruzado
      }
    }
    return document;
  }

  // Diccionario exacto obtenido del HTML de tu organización
  const SELECTOR_MAP = {
    // Obligatorios
    LastName: ['name_lastName', 'LastName'],
    Alias: ['Alias', 'alias'],
    Email: ['Email', 'email'],
    Username: ['Username', 'username'],
    Nickname: ['CommunityNickname', 'Nickname'],
    Role: ['role', 'Role'],
    UserLicense: ['user_license_id'],
    Profile: ['Profile'],
    TimeZone: ['TimeZoneSidKey', 'timezoneselect'],
    Locale: ['localeselect', 'Locale'],
    Language: ['LanguageLocaleKey', 'Language'],
    EmailEncoding: ['EmailEncodingKey'],
    ReceiveApprovalsEmails: ['receiveApprovalsEmails'],

    // Opcionales
    FirstName: ['name_firstName', 'FirstName'],
    Title: ['Title', 'title'],
    Company: ['CompanyName', 'Company'], // En tu HTML es CompanyName
    Department: ['Department', 'department'],
    Division: ['Division', 'division'],
    Phone: ['Phone', 'phone'],
    Extension: ['Extension', 'extension'],
    Fax: ['Fax', 'fax'],
    Mobile: ['MobilePhone', 'Mobile'], // En tu HTML es MobilePhone
    EmployeeNumber: ['EmployeeNumber'],
    FederationId: ['FederationIdentifier'],
    Street: ['Addressstreet'],
    Zip: ['Addresszip'],
    City: ['Addresscity'],
    State: ['Addressstate'],
    Country: ['Addresscountry'],
    DelegatedApprover: ['DelegatedApprover'],
    Manager: ['Manager'],

    // Campos Personalizados detectados en tu org
    PropietarioOrigen: ['00NhO000000Grmj', 'PropietarioOrigen', 'IdPropietarioOrigen'],
    AreaResolutora: ['00NhS0000011HuH'],
    AdministracionOperativa: ['00NhS0000011Hsf'],

    // Checkboxes
    SendPassword: ['new_password', 'generate_new_password'], // En tu HTML es new_password
    MarketingUser: ['UserPermissions_0'],
    OfflineUser: ['UserPermissions_1'],
    KnowledgeUser: ['UserPermissions_8'],
    FlowUser: ['UserPermissions_9'],
    ServiceCloudUser: ['UserPermissions_10']
  };

  // Buscar elemento por ID o Name
  function findField(ctx, fieldKey, preferredTag = 'input') {
    const ids = SELECTOR_MAP[fieldKey] || [fieldKey];
    for (const id of ids) {
      const el = ctx.querySelector(`${preferredTag}#${id}, ${preferredTag}[name="${id}"], #${id}`);
      if (el) return el;
    }
    return null;
  }

  // Asignar valor a un input de texto y disparar eventos para que Salesforce lo reconozca
  function setInputValue(el, value) {
    if (!el || value === undefined || value === null) return;
    el.focus();
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // Asignar valor a un checkbox
  function setCheckboxValue(el, checked) {
    if (!el) return;
    el.checked = Boolean(checked);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Seleccionar opción en un <select> por texto visible o por valor
  function setSelectValue(selectEl, desiredText) {
    if (!selectEl || !desiredText) return false;
    const search = String(desiredText).trim().toLowerCase();

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

  const delay = (ms) => new Promise((res) => setTimeout(res, ms));

  // Rellenar formulario y guardar con Save & New
  async function fillUserForm(record, options = {}) {
    const ctx = getDocumentContext();
    const fieldDelay = options.delay || 200;

    // Verificar presencia del formulario
    const lastNameInput = findField(ctx, 'LastName', 'input');
    if (!lastNameInput) {
      return {
        success: false,
        error: 'No se encontró el formulario de New User en la pestaña activa.'
      };
    }

    // 1. First Name y Last Name
    if (record.FirstName) {
      setInputValue(findField(ctx, 'FirstName', 'input'), record.FirstName);
      await delay(fieldDelay);
    }
    setInputValue(lastNameInput, record.LastName);
    await delay(fieldDelay);

    // 2. Alias (máximo 8 caracteres obligatorios)
    let aliasVal = record.Alias;
    if (!aliasVal && record.Email) {
      aliasVal = record.Email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    } else if (!aliasVal && record.LastName) {
      aliasVal = record.LastName.replace(/[^a-zA-Z0-9]/g, '');
    }
    if (aliasVal && aliasVal.length > 8) aliasVal = aliasVal.substring(0, 8);
    setInputValue(findField(ctx, 'Alias', 'input'), aliasVal);
    await delay(fieldDelay);

    // 3. Email
    setInputValue(findField(ctx, 'Email', 'input'), record.Email);
    await delay(fieldDelay);

    // 4. Username (formato correo, único globalmente)
    let usernameVal = record.Username;
    if (!usernameVal && record.Email) {
      usernameVal = record.Email.toLowerCase().endsWith('.devmig') 
        ? record.Email 
        : `${record.Email}.devmig`;
    }
    setInputValue(findField(ctx, 'Username', 'input'), usernameVal || record.Email);
    await delay(fieldDelay);

    // 5. Nickname (apodo para comunidades)
    let nicknameVal = record.Nickname;
    if (!nicknameVal && record.Email) {
      nicknameVal = record.Email.split('@')[0] + '_dev';
    }
    setInputValue(findField(ctx, 'Nickname', 'input'), nicknameVal || aliasVal);
    await delay(fieldDelay);

    // 6. Role (si se especifica en el dataset)
    if (record.Role) {
      setSelectValue(findField(ctx, 'Role', 'select'), record.Role);
      await delay(fieldDelay);
    }

    // 7. User License y Profile (cascada dependiente)
    if (record.UserLicense) {
      const licenseAliases = {
        core: 'Salesforce',
        'sales-enterprise': 'Salesforce',
        'sales_enterprise': 'Salesforce'
      };
      const cleanLic = String(record.UserLicense).toLowerCase().trim();
      const targetLicense = licenseAliases[cleanLic] || record.UserLicense;

      const licenseSelect = findField(ctx, 'UserLicense', 'select');
      if (licenseSelect) {
        setSelectValue(licenseSelect, targetLicense);
        // Salesforce reconstruye el select de Profile por AJAX
        await delay(fieldDelay + 700);
      }
    }

    if (record.Profile) {
      const profileAliases = {
        superadministrador: 'System Administrator',
        'administrador del sistema': 'System Administrator',
        'equipo de ventas': 'Standard User',
        'jefe de agencias': 'Standard User'
      };
      const cleanProf = String(record.Profile).toLowerCase().trim();
      const targetProfile = profileAliases[cleanProf] || record.Profile;

      const profileSelect = findField(ctx, 'Profile', 'select');
      if (profileSelect) {
        setSelectValue(profileSelect, targetProfile);
        await delay(fieldDelay);
      }
    }

    // 8. Campos opcionales de organización y contacto
    if (record.Title) setInputValue(findField(ctx, 'Title', 'input'), record.Title);
    if (record.Company) setInputValue(findField(ctx, 'Company', 'input'), record.Company);
    if (record.Department) setInputValue(findField(ctx, 'Department', 'input'), record.Department);
    if (record.Division) setInputValue(findField(ctx, 'Division', 'input'), record.Division);
    if (record.Phone) setInputValue(findField(ctx, 'Phone', 'input'), record.Phone);
    if (record.Mobile) setInputValue(findField(ctx, 'Mobile', 'input'), record.Mobile);
    if (record.Extension) setInputValue(findField(ctx, 'Extension', 'input'), record.Extension);
    if (record.EmployeeNumber) setInputValue(findField(ctx, 'EmployeeNumber', 'input'), record.EmployeeNumber);
    if (record.FederationId) setInputValue(findField(ctx, 'FederationId', 'input'), record.FederationId);

    // 9. Dirección
    if (record.Street) setInputValue(findField(ctx, 'Street', 'textarea'), record.Street);
    if (record.City) setInputValue(findField(ctx, 'City', 'input'), record.City);
    if (record.State) setInputValue(findField(ctx, 'State', 'input'), record.State);
    if (record.Zip) setInputValue(findField(ctx, 'Zip', 'input'), record.Zip);
    if (record.Country) setInputValue(findField(ctx, 'Country', 'input'), record.Country);

    // 10. Campos Personalizados (Propietario de Origen, Area Resolutora, Administración Operativa)
    if (record.PropietarioOrigen || record['Id de propietario de origen']) {
      setInputValue(findField(ctx, 'PropietarioOrigen', 'input'), record.PropietarioOrigen || record['Id de propietario de origen']);
      await delay(fieldDelay);
    }
    if (record.AreaResolutora) {
      setSelectValue(findField(ctx, 'AreaResolutora', 'select'), record.AreaResolutora);
      await delay(fieldDelay);
    }
    if (record.AdministracionOperativa !== undefined) {
      const isTrue = String(record.AdministracionOperativa).toLowerCase() === 'true' || record.AdministracionOperativa === '1';
      setCheckboxValue(findField(ctx, 'AdministracionOperativa', 'input'), isTrue);
    }

    // 11. Localización (solo si se especifica; si no, conserva el default del formulario)
    if (record.TimeZone) setSelectValue(findField(ctx, 'TimeZone', 'select'), record.TimeZone);
    if (record.Locale) setSelectValue(findField(ctx, 'Locale', 'select'), record.Locale);
    if (record.Language) setSelectValue(findField(ctx, 'Language', 'select'), record.Language);
    if (record.EmailEncoding) setSelectValue(findField(ctx, 'EmailEncoding', 'select'), record.EmailEncoding);

    // 12. Checkbox: Generate new password and notify user immediately
    const newPassCheckbox = findField(ctx, 'SendPassword', 'input');
    if (newPassCheckbox) {
      if (options.uncheckNotifyPass) {
        setCheckboxValue(newPassCheckbox, false);
      } else if (record.SendPassword !== undefined) {
        const check = String(record.SendPassword).toLowerCase() === 'true' || record.SendPassword === '1';
        setCheckboxValue(newPassCheckbox, check);
      }
    }

    await delay(300);

    // 13. Clic en "Save & New"
    const saveNewBtn = ctx.querySelector('input[name="save_new"]');
    if (!saveNewBtn) {
      return {
        success: false,
        error: 'No se encontró el botón input[name="save_new"].'
      };
    }

    saveNewBtn.click();

    // 14. Esperar resultado de guardado
    const result = await waitForSaveResult(ctx);
    return result;
  }

  // Monitorea si Salesforce guardó correctamente o arrojó error
  function waitForSaveResult(ctx, maxWaitMs = 15000) {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const interval = setInterval(() => {
        const currentCtx = getDocumentContext();

        // Detectar mensajes de error de Salesforce (bloque errorDiv_ep o .errorMsg)
        const errorSummary = currentCtx.querySelector('#errorDiv_ep, .pbError');
        if (errorSummary && errorSummary.style.display !== 'none' && errorSummary.textContent.trim().length > 0) {
          // Extraer los errores específicos
          const errorDetails = Array.from(currentCtx.querySelectorAll('.errorMsg'))
            .map((e) => e.textContent.trim())
            .filter((t) => t.length > 0)
            .join(' | ');

          const errorMsg = errorDetails || errorSummary.textContent.trim().replace(/\s+/g, ' ');
          clearInterval(interval);
          return resolve({ success: false, error: errorMsg });
        }

        // Si el formulario se limpió ("Save & New" recargó un formulario vacío)
        const lastNameInput = findField(currentCtx, 'LastName', 'input');
        if (lastNameInput && lastNameInput.value === '') {
          clearInterval(interval);
          return resolve({ success: true });
        }

        // Timeout
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve({
            success: false,
            error: 'Timeout esperando confirmación de guardado.'
          });
        }
      }, 500);
    });
  }

  // Receptor de mensajes desde popup.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const ctx = getDocumentContext();
    const hasForm = !!findField(ctx, 'LastName', 'input');

    if (request.action === 'PING') {
      if (hasForm) {
        sendResponse({ ready: true, hasForm: true, url: window.location.href });
        return true;
      }
      return false;
    }

    if (request.action === 'CREATE_USER') {
      if (hasForm) {
        fillUserForm(request.record, request.options)
          .then((result) => sendResponse(result))
          .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
      }
      return false;
    }
  });
})();
