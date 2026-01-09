const STORAGE_SETTINGS_KEY = 'emailSettingsConfig';
const STORAGE_TEMPLATES_KEY = 'emailTemplates';

const tripTags = [
  '#COMP_NAME#',
  '#TRIP_CONFNUM#',
  '#TRIP_PAX_NAME#',
  '#TRIP_DATE#',
  '#TRIP_TIME#',
  '#TRIP_PICKUP#',
  '#TRIP_DROPOFF#',
  '#TRIP_DRIVER1_FNAME#',
  '#TRIP_VEHICLE_TYPE#',
  '#TRIP_BC_EMAIL1#'
];

const rateTags = [
  '#TRIP_RATES_TOTAL#',
  '#TRIP_RATES_TOTALDUE#',
  '#TRIP_RATES_SUMMARY#',
  '#TRIP_RATES_ITEMIZED#',
  '#TRIP_RATES_GROUPED#',
  '#TRIP_RATES_BASE_TOTAL#',
  '#TRIP_RATES_GRATUITIES_TOTAL#',
  '#TRIP_RATES_TAXES_TOTAL#',
  '#TRIP_RATES_SURCHARGES_TOTAL#',
  '#TRIP_RATES_DISCOUNTS_TOTAL#'
];

const driverTags = [
  '#DRIVER_FNAME#',
  '#DRIVER_LNAME#',
  '#DRIVER_FULLNAME#',
  '#DRIVER_EMAIL#',
  '#DRIVER_PHONE#',
  '#DRIVER_PORTAL_LINK#'
];

// Default system templates that are pre-seeded
const DEFAULT_TEMPLATES = [
  {
    id: 'driver-portal-welcome',
    name: 'Driver Portal Welcome',
    subject: 'Welcome to ReliaLimo™ Driver Portal',
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1976d2;">Welcome to ReliaLimo™, #DRIVER_FNAME#!</h2>
  
  <p>Here is your ReliaLimo™ Link for current, upcoming and offered Reservations:</p>
  
  <p style="margin: 20px 0;">
    <a href="#DRIVER_PORTAL_LINK#" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Access Your Driver Portal
    </a>
  </p>
  
  <p>Or copy and paste this link into your browser:</p>
  <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
    #DRIVER_PORTAL_LINK#
  </p>
  
  <p>From your portal you can:</p>
  <ul>
    <li>View your current and upcoming reservations</li>
    <li>Accept or decline offered trips</li>
    <li>Update your availability status</li>
    <li>Access trip details and navigation</li>
  </ul>
  
  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    This is an automated message from #COMP_NAME#. Please do not reply to this email.
  </p>
</div>`,
    category: 'driver',
    isSystem: true,
    updatedAt: new Date().toISOString()
  }
];

function $(id) { return document.getElementById(id); }

function loadSettings() {
  const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    $('fromNameInput').value = cfg.fromName || '';
    $('fromEmailInput').value = cfg.fromEmail || '';
    $('replyToInput').value = cfg.replyTo || '';
    $('smtpHostInput').value = cfg.smtpHost || '';
    $('smtpPortInput').value = cfg.smtpPort || '';
    $('smtpUserInput').value = cfg.smtpUser || '';
    $('smtpPassInput').value = cfg.smtpPass || '';
    $('tlsInput').checked = !!cfg.tls;
  } catch (e) {}
}

function saveSettings() {
  const cfg = {
    fromName: $('fromNameInput').value.trim(),
    fromEmail: $('fromEmailInput').value.trim(),
    replyTo: $('replyToInput').value.trim(),
    smtpHost: $('smtpHostInput').value.trim(),
    smtpPort: $('smtpPortInput').value.trim(),
    smtpUser: $('smtpUserInput').value.trim(),
    smtpPass: $('smtpPassInput').value,
    tls: $('tlsInput').checked
  };
  localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(cfg));
  alert('Email settings saved locally. Connect to your backend to send for real.');
}

function initTagSelects() {
  const tripSelect = $('tripTagSelect');
  tripTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag; opt.textContent = tag; tripSelect.appendChild(opt);
  });
  const rateSelect = $('rateTagSelect');
  rateTags.forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag; opt.textContent = tag; rateSelect.appendChild(opt);
  });
  
  // Add driver tags if select exists
  const driverSelect = $('driverTagSelect');
  if (driverSelect) {
    driverTags.forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag; opt.textContent = tag; driverSelect.appendChild(opt);
    });
    driverSelect.addEventListener('change', () => insertTag(driverSelect.value));
  }

  tripSelect.addEventListener('change', () => insertTag(tripSelect.value));
  rateSelect.addEventListener('change', () => insertTag(rateSelect.value));
}

function insertTag(tag) {
  if (!tag) return;
  const editor = $('templateEditor');
  editor.focus();
  document.execCommand('insertText', false, tag);
  $('tripTagSelect').value = '';
  $('rateTagSelect').value = '';
  const driverSelect = $('driverTagSelect');
  if (driverSelect) driverSelect.value = '';
}

function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (!cmd) return;
      document.execCommand(cmd, false, null);
    });
  });
}

function loadTemplates() {
  const raw = localStorage.getItem(STORAGE_TEMPLATES_KEY);
  let templates = [];
  if (raw) {
    try { templates = JSON.parse(raw); } catch (e) { templates = []; }
  }
  
  // Ensure default system templates exist
  let hasChanges = false;
  DEFAULT_TEMPLATES.forEach(defaultTpl => {
    const exists = templates.some(t => t.id === defaultTpl.id);
    if (!exists) {
      templates.unshift(defaultTpl); // Add at beginning
      hasChanges = true;
      console.log('📧 Seeded default template:', defaultTpl.name);
    }
  });
  
  if (hasChanges) {
    saveTemplates(templates);
  }
  
  return templates;
}

function saveTemplates(list) {
  localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(list));
}

function renderTemplateList() {
  const container = $('templateList');
  const templates = loadTemplates();
  container.innerHTML = '';
  if (!templates.length) {
    container.innerHTML = '<div class="hint">No templates saved yet.</div>';
    return;
  }
  templates.forEach(tpl => {
    const row = document.createElement('div');
    row.className = 'template-row';
    row.innerHTML = `
      <div class="meta">
        <strong>${tpl.name}</strong>
        <span style="color:#607d8b; font-size:12px;">${tpl.subject || 'No subject'}</span>
      </div>
      <div class="actions">
        <button class="btn small" data-action="load" data-id="${tpl.id}">Load</button>
        <button class="btn small" data-action="delete" data-id="${tpl.id}" style="background:#c62828; color:#fff;">Delete</button>
      </div>`;
    container.appendChild(row);
  });

  container.querySelectorAll('[data-action="load"]').forEach(btn => {
    btn.addEventListener('click', () => loadTemplate(btn.dataset.id));
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
  });
}

function saveTemplate() {
  const name = $('templateNameInput').value.trim();
  if (!name) { alert('Enter a template name.'); return; }
  const subject = $('subjectInput').value.trim();
  const html = $('templateEditor').innerHTML;

  const templates = loadTemplates();
  const existingIdx = templates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
  const record = {
    id: existingIdx >= 0 ? templates[existingIdx].id : crypto.randomUUID(),
    name,
    subject,
    html,
    updatedAt: new Date().toISOString()
  };
  if (existingIdx >= 0) templates[existingIdx] = record; else templates.push(record);
  saveTemplates(templates);
  renderTemplateList();
  alert('Template saved locally.');
}

function loadTemplate(id) {
  const templates = loadTemplates();
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  $('templateNameInput').value = tpl.name;
  $('subjectInput').value = tpl.subject || '';
  $('templateEditor').innerHTML = tpl.html || '';
}

function deleteTemplate(id) {
  let templates = loadTemplates();
  templates = templates.filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplateList();
}

function renderTagReference() {
  const tripList = $('tripTagList');
  tripTags.forEach(tag => {
    const li = document.createElement('li');
    li.textContent = tag;
    tripList.appendChild(li);
  });
  const rateList = $('rateTagList');
  rateTags.forEach(tag => {
    const li = document.createElement('li');
    li.textContent = tag;
    rateList.appendChild(li);
  });
}

function testSendLocal() {
  const to = prompt('Test send to email (this is local-only):');
  if (!to) return;
  alert(`This is a local-only preview. Wire backend SMTP/SendGrid/SES to actually send.\n\nTo: ${to}\nSubject: ${$('subjectInput').value || '(no subject)'}\nBody length: ${$('templateEditor').innerHTML.length} chars`);
}

// =====================================================
// EXPORTED EMAIL FUNCTIONS (for use by other modules)
// =====================================================

/**
 * Get a template by ID
 */
function getTemplateById(templateId) {
  const templates = loadTemplates();
  return templates.find(t => t.id === templateId) || null;
}

/**
 * Replace tags in template content with actual values
 */
function replaceTemplateTags(content, data) {
  if (!content) return '';
  
  let result = content;
  
  // Replace driver tags
  result = result.replace(/#DRIVER_FNAME#/g, data.driverFirstName || '');
  result = result.replace(/#DRIVER_LNAME#/g, data.driverLastName || '');
  result = result.replace(/#DRIVER_FULLNAME#/g, `${data.driverFirstName || ''} ${data.driverLastName || ''}`.trim());
  result = result.replace(/#DRIVER_EMAIL#/g, data.driverEmail || '');
  result = result.replace(/#DRIVER_PHONE#/g, data.driverPhone || '');
  result = result.replace(/#DRIVER_PORTAL_LINK#/g, data.driverPortalLink || '');
  
  // Replace company tags
  result = result.replace(/#COMP_NAME#/g, data.companyName || 'ReliaLimo™');
  
  return result;
}

/**
 * Generate driver portal link
 */
function generateDriverPortalLink(driverId, driverEmail) {
  const baseUrl = window.location.origin;
  // Create a simple token from driver ID and email for basic authentication
  const token = btoa(`${driverId}:${driverEmail}`);
  return `${baseUrl}/driver-portal.html?token=${token}`;
}

/**
 * Send Driver Portal Welcome email
 * This is called when a new driver is created
 */
async function sendDriverPortalWelcomeEmail(driver) {
  const template = getTemplateById('driver-portal-welcome');
  if (!template) {
    console.warn('⚠️ Driver Portal Welcome template not found');
    return { success: false, error: 'Template not found' };
  }
  
  if (!driver.email && !driver.contact_email) {
    console.warn('⚠️ Driver has no email address');
    return { success: false, error: 'No email address' };
  }
  
  const driverEmail = driver.email || driver.contact_email;
  const portalLink = generateDriverPortalLink(driver.id, driverEmail);
  
  // Get company name from settings
  const settingsRaw = localStorage.getItem(STORAGE_SETTINGS_KEY);
  const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
  
  const data = {
    driverFirstName: driver.first_name || '',
    driverLastName: driver.last_name || '',
    driverEmail: driverEmail,
    driverPhone: driver.cell_phone || driver.home_phone || '',
    driverPortalLink: portalLink,
    companyName: settings.fromName || 'ReliaLimo™'
  };
  
  const subject = replaceTemplateTags(template.subject, data);
  const body = replaceTemplateTags(template.html, data);
  
  console.log('📧 Sending Driver Portal Welcome email to:', driverEmail);
  console.log('📧 Portal Link:', portalLink);
  console.log('📧 Subject:', subject);
  
  // For now, this is a local-only implementation
  // In production, this would connect to an email service (SendGrid, SES, SMTP, etc.)
  
  // Store the pending email for reference
  const pendingEmails = JSON.parse(localStorage.getItem('pendingEmails') || '[]');
  pendingEmails.push({
    id: crypto.randomUUID(),
    to: driverEmail,
    subject: subject,
    body: body,
    templateId: template.id,
    driverId: driver.id,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });
  localStorage.setItem('pendingEmails', JSON.stringify(pendingEmails));
  
  return {
    success: true,
    to: driverEmail,
    subject: subject,
    portalLink: portalLink,
    message: 'Email queued for sending. Configure SMTP settings to send for real.'
  };
}

// Expose functions globally for use by other modules
window.EmailService = {
  getTemplateById,
  replaceTemplateTags,
  generateDriverPortalLink,
  sendDriverPortalWelcomeEmail,
  loadTemplates,
  saveTemplates,
  DEFAULT_TEMPLATES,
  driverTags
};

function initEmailSettings() {
  loadSettings();
  initTagSelects();
  setupToolbar();
  renderTagReference();
  renderTemplateList();

  $('saveSettingsBtn').addEventListener('click', saveSettings);
  $('saveTemplateBtn').addEventListener('click', saveTemplate);
  $('testSendBtn').addEventListener('click', testSendLocal);
}

document.addEventListener('DOMContentLoaded', initEmailSettings);
