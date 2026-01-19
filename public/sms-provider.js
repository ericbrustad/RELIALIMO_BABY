const STORAGE_KEY = 'smsProviders';

class SMSProviderManager {
  constructor() {
    this.providers = this.loadProviders();
    this.cacheDom();
    this.setupEvents();
    this.renderProviders();
  }

  cacheDom() {
    this.modal = document.getElementById('providerModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.providerNameInput = document.getElementById('providerNameInput');
    this.accountSidInput = document.getElementById('accountSidInput');
    this.authTokenInput = document.getElementById('authTokenInput');
    this.apiKeySidInput = document.getElementById('apiKeySidInput');
    this.apiKeySecretInput = document.getElementById('apiKeySecretInput');
    this.messagingServiceSidInput = document.getElementById('messagingServiceSidInput');
    this.fromNumberInput = document.getElementById('fromNumberInput');
    this.statusCallbackInput = document.getElementById('statusCallbackInput');
    this.requestDeliveryReceiptsInput = document.getElementById('requestDeliveryReceiptsInput');
    this.useTwilioApiKeyInput = document.getElementById('useTwilioApiKeyInput');
    this.setDefaultInput = document.getElementById('setDefaultInput');
    this.testToInput = document.getElementById('testToInput');
    this.testBodyInput = document.getElementById('testBodyInput');
    this.testStatus = document.getElementById('testStatus');
    this.saveProviderBtn = document.getElementById('saveProviderBtn');
    this.sendTestBtn = document.getElementById('sendTestBtn');
    this.providersTableBody = document.getElementById('providersTableBody');
    this.tableWrapper = document.querySelector('.sms-providers-table-wrapper');
    this.emptyState = document.getElementById('emptyState');
  }

  loadProviders() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Seed with Twilio defaults from env if available
    const env = window.ENV || {};
    return [
      {
        id: 'twilio',
        name: 'Twilio',
        type: 'twilio',
        accountSid: env.TWILIO_ACCOUNT_SID || '',
        authToken: env.TWILIO_AUTH_TOKEN || '',
        apiKeySid: env.TWILIO_API_KEY_SID || '',
        apiKeySecret: env.TWILIO_API_KEY_SECRET || '',
        messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID || '',
        fromNumber: env.TWILIO_FROM || '',
        statusCallbackUrl: '',
        requestDeliveryReceipts: true,
        useApiKey: !!env.TWILIO_API_KEY_SECRET,
        isDefault: true,
      }
    ];
  }

  saveProviders() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.providers));
  }

  setupEvents() {
    document.querySelectorAll('.settings-nav-subitem').forEach(item => {
      item.addEventListener('click', (e) => {
        const href = item.getAttribute('href');
        if (href && href !== '#' && !href.includes('.html')) {
          e.preventDefault();
          alert(`Navigation to "${item.textContent.trim()}" is under construction`);
        }
      });
    });

    const addBtn = document.querySelector('.btn-add-new');
    addBtn?.addEventListener('click', () => this.openModal());

    document.getElementById('closeModalBtn')?.addEventListener('click', () => this.closeModal());

    this.saveProviderBtn?.addEventListener('click', () => this.handleSave());
    this.sendTestBtn?.addEventListener('click', () => this.handleTestSend());

    window.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
  }

  setDefaultProvider(providerId) {
    this.providers.forEach(p => { p.isDefault = p.id === providerId; });
    this.saveProviders();
    this.renderProviders();
  }

  checkEmptyState() {
    if (this.providers.length === 0) {
      this.tableWrapper.style.display = 'none';
      this.emptyState.style.display = 'block';
    } else {
      this.tableWrapper.style.display = 'block';
      this.emptyState.style.display = 'none';
    }
  }

  renderProviders() {
    this.providersTableBody.innerHTML = '';
    this.providers.forEach(provider => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="radio-cell">
          <input type="radio" name="defaultProvider" value="${provider.id}" ${provider.isDefault ? 'checked' : ''} />
        </td>
        <td class="provider-name">${provider.name}</td>
        <td class="actions-cell">
          <a href="#" class="action-link" data-action="edit" data-id="${provider.id}">Edit</a>
          <a href="#" class="action-link delete-link" data-action="delete" data-id="${provider.id}">Delete</a>
        </td>
      `;
      this.providersTableBody.appendChild(row);
    });

    this.providersTableBody.querySelectorAll('input[name="defaultProvider"]').forEach(radio => {
      radio.addEventListener('change', (e) => this.setDefaultProvider(e.target.value));
    });

    this.providersTableBody.querySelectorAll('[data-action="edit"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal(link.dataset.id);
      });
    });

    this.providersTableBody.querySelectorAll('[data-action="delete"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.deleteProvider(link.dataset.id);
      });
    });

    this.checkEmptyState();
  }

  openModal(providerId = null) {
    const provider = providerId ? this.providers.find(p => p.id === providerId) : null;
    this.editingId = provider ? provider.id : null;
    this.modalTitle.textContent = provider ? 'Edit SMS Provider' : 'Add SMS Provider';
    this.providerNameInput.value = provider?.name || 'Twilio';
    this.accountSidInput.value = provider?.accountSid || '';
    this.authTokenInput.value = provider?.authToken || '';
    this.apiKeySidInput.value = provider?.apiKeySid || '';
    this.apiKeySecretInput.value = provider?.apiKeySecret || '';
    this.messagingServiceSidInput.value = provider?.messagingServiceSid || '';
    this.fromNumberInput.value = provider?.fromNumber || '';
    this.statusCallbackInput.value = provider?.statusCallbackUrl || '';
    this.requestDeliveryReceiptsInput.checked = provider?.requestDeliveryReceipts ?? true;
    this.useTwilioApiKeyInput.checked = provider?.useApiKey ?? false;
    this.setDefaultInput.checked = provider?.isDefault ?? this.providers.length === 0;
    this.testStatus.textContent = '';
    this.modal.style.display = 'block';
  }

  closeModal() {
    this.modal.style.display = 'none';
  }

  handleSave() {
    const payload = {
      id: (this.providerNameInput.value || 'twilio').toLowerCase().replace(/\s+/g, '-'),
      name: this.providerNameInput.value || 'Twilio',
      type: 'twilio',
      accountSid: this.accountSidInput.value.trim(),
      authToken: this.authTokenInput.value.trim(),
      apiKeySid: this.apiKeySidInput.value.trim(),
      apiKeySecret: this.apiKeySecretInput.value.trim(),
      messagingServiceSid: this.messagingServiceSidInput.value.trim(),
      fromNumber: this.fromNumberInput.value.trim(),
      statusCallbackUrl: this.statusCallbackInput.value.trim(),
      requestDeliveryReceipts: !!this.requestDeliveryReceiptsInput.checked,
      useApiKey: !!this.useTwilioApiKeyInput.checked,
      isDefault: !!this.setDefaultInput.checked,
    };

    if (!payload.accountSid || !(payload.authToken || (payload.apiKeySid && payload.apiKeySecret))) {
      alert('Account SID and Auth Token (or API Key SID/Secret) are required.');
      return;
    }

    if (payload.isDefault) {
      this.providers.forEach(p => p.isDefault = false);
    }

    if (this.editingId) {
      const idx = this.providers.findIndex(p => p.id === this.editingId);
      if (idx >= 0) this.providers[idx] = { ...this.providers[idx], ...payload };
    } else {
      this.providers.push(payload);
    }

    this.saveProviders();
    this.renderProviders();
    this.closeModal();
  }

  deleteProvider(providerId) {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return;
    if (!confirm(`Delete SMS provider "${provider.name}"?`)) return;
    this.providers = this.providers.filter(p => p.id !== providerId);
    if (this.providers.length && !this.providers.some(p => p.isDefault)) {
      this.providers[0].isDefault = true;
    }
    this.saveProviders();
    this.renderProviders();
  }

  async handleTestSend() {
    this.testStatus.textContent = '';
    const provider = this.editingId ? this.providers.find(p => p.id === this.editingId) : null;
    const accountSid = this.accountSidInput.value.trim();
    const authToken = this.authTokenInput.value.trim();
    const apiKeySid = this.apiKeySidInput.value.trim();
    const apiKeySecret = this.apiKeySecretInput.value.trim();
    const useApiKey = this.useTwilioApiKeyInput.checked;
    const messagingServiceSid = this.messagingServiceSidInput.value.trim();
    const fromNumber = this.fromNumberInput.value.trim();
    const to = this.testToInput.value.trim();
    const body = this.testBodyInput.value.trim() || 'Test message from RELIALIMO';

    if (!accountSid || !(authToken || (apiKeySid && apiKeySecret))) {
      alert('Provide Account SID and Auth Token (or API Key SID/Secret) to send a test.');
      return;
    }
    if (!to) { alert('Enter a destination number for the test.'); return; }
    if (!messagingServiceSid && !fromNumber) { alert('Provide a Messaging Service SID or From number.'); return; }

    this.sendTestBtn.disabled = true;
    this.sendTestBtn.textContent = 'Sending...';
    try {
      const auth = useApiKey ? `${apiKeySid}:${apiKeySecret}` : `${accountSid}:${authToken}`;
      const params = new URLSearchParams();
      params.append('To', to);
      params.append('Body', body);
      if (messagingServiceSid) params.append('MessagingServiceSid', messagingServiceSid);
      if (!messagingServiceSid && fromNumber) params.append('From', fromNumber);
      const statusCallback = this.statusCallbackInput.value.trim();
      if (statusCallback) params.append('StatusCallback', statusCallback);

      // Note: Twilio REST API may reject direct browser calls due to CORS. This attempts anyway for dev; fallback is to proxy via backend.
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(auth),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const json = await res.json();
      this.testStatus.textContent = `Sent. SID: ${json.sid}`;
      this.testStatus.style.color = '#2e7d32';
    } catch (e) {
      console.error('Twilio test send failed', e);
      this.testStatus.textContent = `Failed: ${e.message}. If CORS blocked, proxy via backend.`;
      this.testStatus.style.color = '#c62828';
    } finally {
      this.sendTestBtn.disabled = false;
      this.sendTestBtn.textContent = 'Send Test SMS';
    }
  }
}

let smsProviderManager;

function addNewProvider() {
  smsProviderManager.openModal();
}

function editProvider(event, providerId) {
  event.preventDefault();
  smsProviderManager.openModal(providerId);
}

function deleteProvider(event, providerId) {
  event.preventDefault();
  smsProviderManager.deleteProvider(providerId);
}

document.addEventListener('DOMContentLoaded', () => {
  smsProviderManager = new SMSProviderManager();
});
