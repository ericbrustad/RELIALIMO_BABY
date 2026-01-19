(function initializeEmailSettings() {
  if (typeof window === 'undefined') return;
  if (window.__RELIALIMO_EMAIL_SETTINGS_INITIALIZED__) {
    console.warn('[EmailSettings] Duplicate load detected, skipping.');
    return;
  }
  window.__RELIALIMO_EMAIL_SETTINGS_INITIALIZED__ = true;

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

// Account/Customer tags
const accountTags = [
  '#ACCT_NUMBER#',
  '#ACCT_FIRST_NAME#',
  '#ACCT_LAST_NAME#',
  '#ACCT_FULL_NAME#',
  '#ACCT_EMAIL#',
  '#ACCT_PHONE#',
  '#ACCT_COMPANY#',
  '#BOOKING_LINK#',
  '#CURRENT_YEAR#'
];

// Default system templates that are pre-seeded
const DEFAULT_TEMPLATES = [
  {
    id: 'account-welcome',
    name: 'Account Welcome Email',
    subject: 'Welcome to #COMP_NAME#!',
    category: 'account',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); padding: 25px 40px; text-align: center;">
              <h1 style="margin: 0; color: #1a237e; font-size: 28px; font-weight: 700;">🎉 Welcome to the Family!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">Dear <strong>#ACCT_FIRST_NAME#</strong>,</p>
              <p style="font-size: 16px; color: #555; line-height: 1.8; margin: 0 0 25px 0;">Thank you for choosing <strong>#COMP_NAME#</strong> for your transportation needs! We're thrilled to have you as a valued customer.</p>
              <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 10px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1565c0; font-size: 18px;">📋 Your Account Details</h3>
                <p style="margin: 5px 0; color: #333;"><strong>Account Number:</strong> #ACCT_NUMBER#</p>
                <p style="margin: 5px 0; color: #333;"><strong>Name:</strong> #ACCT_FULL_NAME#</p>
                <p style="margin: 5px 0; color: #333;"><strong>Email:</strong> #ACCT_EMAIL#</p>
              </div>
              <h3 style="color: #1565c0; margin: 30px 0 15px 0; font-size: 18px;">✨ What We Offer</h3>
              <ul style="color: #555; line-height: 2; font-size: 15px; padding-left: 20px;">
                <li>🚗 Professional, licensed chauffeurs</li>
                <li>🌟 Premium fleet of luxury vehicles</li>
                <li>⏰ Punctual and reliable service, 24/7</li>
                <li>📱 Easy online booking and real-time updates</li>
              </ul>
              <div style="text-align: center; margin: 35px 0;">
                <a href="#BOOKING_LINK#" style="display: inline-block; background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #1a237e; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: 700; font-size: 16px;">📅 Book Your First Ride</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #263238; padding: 30px 40px; border-radius: 0 0 12px 12px; color: #90a4ae; font-size: 14px;">
              <strong style="color: #ffffff;">#COMP_NAME#</strong><br>📞 #COMP_PHONE# | ✉️ #COMP_EMAIL#<br>© #CURRENT_YEAR#
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'reservation-confirmation-billing',
    name: 'Reservation Confirmation (With Price)',
    subject: 'Confirmation #TRIP_CONFNUM# - Your Reservation Details',
    category: 'reservation',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">✅ Reservation Confirmed</h1>
              <p style="margin: 10px 0 0 0; color: #c8e6c9;">Confirmation #: <strong style="color: #ffffff;">#TRIP_CONFNUM#</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 40px;">
              <p style="font-size: 17px; color: #333;">Dear <strong>#TRIP_PAX_NAME#</strong>,</p>
              <p style="font-size: 15px; color: #555; line-height: 1.7;">Thank you for booking with <strong>#COMP_NAME#</strong>! Please review your reservation details below for accuracy.</p>
              <div style="background: #f8f9fa; border-left: 4px solid #1976d2; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1976d2;">🚗 Trip Details</h3>
                <p style="margin: 8px 0;"><strong>📅 Date:</strong> #TRIP_DATE#</p>
                <p style="margin: 8px 0;"><strong>⏰ Time:</strong> #TRIP_TIME#</p>
                <p style="margin: 8px 0;"><strong>📍 Pickup:</strong> #TRIP_PICKUP#</p>
                <p style="margin: 8px 0;"><strong>🎯 Drop-off:</strong> #TRIP_DROPOFF#</p>
                <p style="margin: 8px 0;"><strong>🚘 Vehicle:</strong> #TRIP_VEHICLE_TYPE#</p>
              </div>
              <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #f57c00;">💰 Pricing Summary</h3>
                <p style="margin: 5px 0;"><strong>Base Fare:</strong> #TRIP_RATES_BASE_TOTAL#</p>
                <p style="margin: 5px 0;"><strong>Gratuity:</strong> #TRIP_RATES_GRATUITIES_TOTAL#</p>
                <p style="margin: 5px 0;"><strong>Taxes & Fees:</strong> #TRIP_RATES_TAXES_TOTAL#</p>
                <hr style="border: none; border-top: 2px solid #f57c00; margin: 15px 0;">
                <p style="margin: 0; font-size: 20px; color: #e65100;"><strong>TOTAL: #TRIP_RATES_TOTAL#</strong></p>
              </div>
              <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #2e7d32; font-weight: 600;">📋 Please verify all details are correct</p>
                <p style="margin: 10px 0 0 0; color: #555;">Contact us at <strong>#COMP_PHONE#</strong> for any changes</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #263238; padding: 25px 40px; border-radius: 0 0 12px 12px; color: #90a4ae; font-size: 13px;">
              <strong style="color: #ffffff;">#COMP_NAME#</strong> | 📞 #COMP_PHONE# | ✉️ #COMP_EMAIL#
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'reservation-confirmation-passenger',
    name: 'Reservation Confirmation (No Price)',
    subject: 'Confirmation #TRIP_CONFNUM# - Your Upcoming Trip',
    category: 'reservation',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px;">✅ Your Trip is Confirmed!</h1>
              <p style="margin: 10px 0 0 0; color: #c8e6c9;">Confirmation #: <strong style="color: #ffffff;">#TRIP_CONFNUM#</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 40px;">
              <p style="font-size: 17px; color: #333;">Dear <strong>#TRIP_PAX_NAME#</strong>,</p>
              <p style="font-size: 15px; color: #555; line-height: 1.7;">Your reservation with <strong>#COMP_NAME#</strong> is confirmed! Please review your trip details below.</p>
              <div style="background: #f8f9fa; border-left: 4px solid #1976d2; border-radius: 8px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1976d2;">🚗 Your Trip Details</h3>
                <p style="margin: 8px 0;"><strong>📅 Date:</strong> #TRIP_DATE#</p>
                <p style="margin: 8px 0;"><strong>⏰ Pickup Time:</strong> #TRIP_TIME#</p>
                <p style="margin: 8px 0;"><strong>📍 Pickup Location:</strong> #TRIP_PICKUP#</p>
                <p style="margin: 8px 0;"><strong>🎯 Destination:</strong> #TRIP_DROPOFF#</p>
                <p style="margin: 8px 0;"><strong>🚘 Vehicle Type:</strong> #TRIP_VEHICLE_TYPE#</p>
              </div>
              <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="margin: 0 0 10px 0; color: #1565c0;">📌 Important Reminders</h4>
                <ul style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                  <li>Please be ready 5-10 minutes before pickup time</li>
                  <li>Your driver will contact you when arriving</li>
                  <li>Look for a #TRIP_VEHICLE_TYPE#</li>
                </ul>
              </div>
              <div style="background: #fff3e0; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #e65100; font-weight: 600;">Need to make changes?</p>
                <p style="margin: 0; color: #555;">Contact us at <strong>#COMP_PHONE#</strong><br>Reference: <strong>#TRIP_CONFNUM#</strong></p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #263238; padding: 25px 40px; border-radius: 0 0 12px 12px; color: #90a4ae; font-size: 13px;">
              <strong style="color: #ffffff;">#COMP_NAME#</strong> | 📞 #COMP_PHONE# | ✉️ #COMP_EMAIL#
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    updatedAt: new Date().toISOString()
  },
  {
    id: 'driver-portal-welcome',
    name: 'Driver Portal Welcome',
    subject: 'Welcome to ReliaLimo™ Driver Portal',
    category: 'driver',
    isSystem: true,
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
  if (tripSelect) {
    tripTags.forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag; opt.textContent = tag; tripSelect.appendChild(opt);
    });
    tripSelect.addEventListener('change', () => insertTag(tripSelect.value));
  }

  const rateSelect = $('rateTagSelect');
  if (rateSelect) {
    rateTags.forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag; opt.textContent = tag; rateSelect.appendChild(opt);
    });
    rateSelect.addEventListener('change', () => insertTag(rateSelect.value));
  }
  
  const driverSelect = $('driverTagSelect');
  if (driverSelect) {
    driverTags.forEach(tag => {
      const opt = document.createElement('option');
      opt.value = tag; opt.textContent = tag; driverSelect.appendChild(opt);
    });
    driverSelect.addEventListener('change', () => insertTag(driverSelect.value));
  }
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
    // Build rules summary
    const rules = tpl.sendRules || {};
    const triggers = (rules.triggers || ['manual']).join(', ');
    const channels = (rules.channels || ['email']).map(c => c === 'email' ? '📧' : '📱').join(' ');
    const enabled = rules.enabled !== false ? '✅' : '❌';
    
    const row = document.createElement('div');
    row.className = 'template-row';
    row.innerHTML = `
      <div class="meta">
        <strong>${tpl.name}</strong>
        <span style="color:#607d8b; font-size:12px;">${tpl.subject || 'No subject'}</span>
        <div style="font-size: 11px; color: #888; margin-top: 4px;">
          ${enabled} ${channels} | Triggers: ${triggers}
        </div>
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

// Get current send rules from the UI
function getSendRules() {
  return {
    triggers: Array.from(document.querySelectorAll('.send-rule-checkbox:checked')).map(cb => cb.value),
    recipients: Array.from(document.querySelectorAll('.recipient-checkbox:checked')).map(cb => cb.value),
    channels: Array.from(document.querySelectorAll('.channel-checkbox:checked')).map(cb => cb.value),
    conditions: Array.from(document.querySelectorAll('.condition-checkbox:checked')).map(cb => cb.value),
    timing: $('reminderTiming')?.value || 'immediate',
    enabled: $('ruleEnabled')?.checked ?? true
  };
}

// Set send rules in the UI
function setSendRules(rules) {
  if (!rules) {
    // Default rules
    rules = {
      triggers: ['manual'],
      recipients: ['billing'],
      channels: ['email'],
      conditions: [],
      timing: 'immediate',
      enabled: true
    };
  }
  
  // Clear all checkboxes first
  document.querySelectorAll('.send-rule-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.recipient-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.channel-checkbox').forEach(cb => cb.checked = false);
  document.querySelectorAll('.condition-checkbox').forEach(cb => cb.checked = false);
  
  // Set triggers
  (rules.triggers || ['manual']).forEach(val => {
    const cb = document.querySelector(`.send-rule-checkbox[value="${val}"]`);
    if (cb) cb.checked = true;
  });
  
  // Set recipients
  (rules.recipients || ['billing']).forEach(val => {
    const cb = document.querySelector(`.recipient-checkbox[value="${val}"]`);
    if (cb) cb.checked = true;
  });
  
  // Set channels
  (rules.channels || ['email']).forEach(val => {
    const cb = document.querySelector(`.channel-checkbox[value="${val}"]`);
    if (cb) cb.checked = true;
  });
  
  // Set conditions
  (rules.conditions || []).forEach(val => {
    const cb = document.querySelector(`.condition-checkbox[value="${val}"]`);
    if (cb) cb.checked = true;
  });
  
  // Set timing
  if ($('reminderTiming')) $('reminderTiming').value = rules.timing || 'immediate';
  
  // Set enabled
  if ($('ruleEnabled')) $('ruleEnabled').checked = rules.enabled !== false;
}

function saveTemplate() {
  const name = $('templateNameInput').value.trim();
  if (!name) { alert('Enter a template name.'); return; }
  const subject = $('subjectInput').value.trim();
  const html = $('templateEditor').innerHTML;
  const sendRules = getSendRules();

  const templates = loadTemplates();
  const existingIdx = templates.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
  const record = {
    id: existingIdx >= 0 ? templates[existingIdx].id : crypto.randomUUID(),
    name,
    subject,
    html,
    sendRules,
    updatedAt: new Date().toISOString()
  };
  if (existingIdx >= 0) templates[existingIdx] = record; else templates.push(record);
  saveTemplates(templates);
  renderTemplateList();
  alert('Template saved with send rules.');
}

function loadTemplate(id) {
  const templates = loadTemplates();
  const tpl = templates.find(t => t.id === id);
  if (!tpl) return;
  $('templateNameInput').value = tpl.name;
  $('subjectInput').value = tpl.subject || '';
  $('templateEditor').innerHTML = tpl.html || '';
  
  // Load send rules
  setSendRules(tpl.sendRules);
  
  // Highlight the loaded template
  console.log('📧 Loaded template:', tpl.name, 'with rules:', tpl.sendRules);
}

function deleteTemplate(id) {
  let templates = loadTemplates();
  templates = templates.filter(t => t.id !== id);
  saveTemplates(templates);
  renderTemplateList();
}

function renderTagReference() {
  const tripList = $('tripTagList');
  if (tripList) {
    tripTags.forEach(tag => {
      const li = document.createElement('li');
      li.textContent = tag;
      tripList.appendChild(li);
    });
  }
  const rateList = $('rateTagList');
  if (rateList) {
    rateTags.forEach(tag => {
      const li = document.createElement('li');
      li.textContent = tag;
      rateList.appendChild(li);
    });
  }
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

// =====================================================
// IMAGE UPLOAD TO SUPABASE STORAGE
// =====================================================
const ImageUploader = {
  BUCKET_NAME: 'images',
  savedSelection: null,

  async init() {
    const insertBtn = $('insertImageBtn');
    const modal = $('imageUploadModal');
    const closeBtn = $('closeImageModal');
    const dropZone = $('imageDropZone');
    const fileInput = $('imageUploadInput');
    const urlInput = $('imageUrlInput');
    const insertUrlBtn = $('insertUrlImageBtn');

    if (!insertBtn || !modal) return;

    // Open modal
    insertBtn.addEventListener('click', () => {
      this.saveSelection();
      modal.style.display = 'flex';
    });

    // Close modal
    closeBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    // Drop zone click
    dropZone?.addEventListener('click', () => fileInput?.click());

    // File input change
    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) await this.uploadFile(file);
    });

    // Drag and drop
    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#4caf50';
      dropZone.style.background = '#e8f5e9';
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#1a237e';
      dropZone.style.background = 'transparent';
    });

    dropZone?.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#1a237e';
      dropZone.style.background = 'transparent';
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        await this.uploadFile(file);
      }
    });

    // Insert from URL
    insertUrlBtn?.addEventListener('click', () => {
      const url = urlInput?.value?.trim();
      if (url) {
        this.insertImage(url);
        modal.style.display = 'none';
        urlInput.value = '';
      }
    });
  },

  saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      this.savedSelection = selection.getRangeAt(0).cloneRange();
    }
  },

  restoreSelection() {
    if (this.savedSelection) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.savedSelection);
    }
  },

  getSelectedWidth() {
    const radios = document.querySelectorAll('input[name="imageWidth"]');
    for (const radio of radios) {
      if (radio.checked) return radio.value;
    }
    return '200';
  },

  async uploadFile(file) {
    const progress = $('uploadProgress');
    const progressBar = $('uploadProgressBar');
    const statusText = $('uploadStatusText');
    const modal = $('imageUploadModal');

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    // Show progress
    progress.style.display = 'block';
    progressBar.style.width = '10%';
    statusText.textContent = 'Preparing upload...';

    try {
      // Get Supabase credentials
      const { getSupabaseCredentials } = await import('./supabase-config.js');
      const { url: supabaseUrl, anonKey } = getSupabaseCredentials();

      // Get auth token
      let authToken = anonKey;
      if (window.__reliaGetValidSession) {
        const session = await window.__reliaGetValidSession();
        if (session?.access_token) authToken = session.access_token;
      } else if (localStorage.getItem('supabase_access_token')) {
        authToken = localStorage.getItem('supabase_access_token');
      }

      progressBar.style.width = '30%';
      statusText.textContent = 'Uploading to storage...';

      // Generate unique filename
      const ext = file.name.split('.').pop();
      const fileName = `email-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      // Upload to Supabase Storage
      const uploadUrl = `${supabaseUrl}/storage/v1/object/${this.BUCKET_NAME}/${fileName}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': anonKey,
          'Content-Type': file.type,
          'x-upsert': 'true'
        },
        body: file
      });

      progressBar.style.width = '70%';

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Upload failed: ${response.status}`);
      }

      progressBar.style.width = '90%';
      statusText.textContent = 'Generating public URL...';

      // Get public URL
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${this.BUCKET_NAME}/${fileName}`;

      progressBar.style.width = '100%';
      statusText.textContent = '✓ Upload complete!';

      // Insert image into editor
      setTimeout(() => {
        this.insertImage(publicUrl);
        modal.style.display = 'none';
        progress.style.display = 'none';
        progressBar.style.width = '0%';
      }, 500);

    } catch (error) {
      console.error('Image upload error:', error);
      statusText.textContent = `❌ Error: ${error.message}`;
      progressBar.style.background = '#c62828';
      
      setTimeout(() => {
        progress.style.display = 'none';
        progressBar.style.width = '0%';
        progressBar.style.background = 'linear-gradient(90deg, #1a237e, #0d47a1)';
      }, 3000);
    }
  },

  insertImage(url) {
    const editor = $('templateEditor');
    if (!editor) return;

    const width = this.getSelectedWidth();
    const widthStyle = width === 'auto' ? '' : (width === '100%' ? 'width: 100%;' : `width: ${width}px;`);
    
    const imgHtml = `<img src="${url}" alt="Email image" style="${widthStyle} max-width: 100%; height: auto; display: block; margin: 10px 0;">`;

    // Try to restore selection and insert at cursor
    this.restoreSelection();
    editor.focus();
    
    // Use execCommand for insertion (works in contenteditable)
    document.execCommand('insertHTML', false, imgHtml);
  }
};

function initEmailSettings() {
  // Only run if we're on the email settings page
  if (!$('saveSettingsBtn') && !$('saveTemplateBtn')) {
    return;
  }
  
  loadSettings();
  initTagSelects();
  setupToolbar();
  renderTagReference();
  renderTemplateList();
  
  // Initialize image uploader
  ImageUploader.init();

  const saveSettingsBtn = $('saveSettingsBtn');
  const saveTemplateBtn = $('saveTemplateBtn');
  const testSendBtn = $('testSendBtn');
  
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
  if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', saveTemplate);
  if (testSendBtn) testSendBtn.addEventListener('click', testSendLocal);
}

document.addEventListener('DOMContentLoaded', initEmailSettings);

})();
