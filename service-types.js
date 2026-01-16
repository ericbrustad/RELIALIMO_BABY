import {
  loadServiceTypes,
  upsertServiceTypes,
  deleteServiceTypeById,
  normalizeServiceType,
  generateServiceTypeCode,
  getActiveServiceTypes,
  SERVICE_TYPES_STORAGE_KEY
} from './service-types-store.js';
import { loadPolicies, POLICIES_STORAGE_KEY } from './policies-store.js';


class ServiceTypesPage {
  constructor() {
    this.serviceTypes = [];
    this.policies = [];
    this.selectedId = null;

    this.cacheEls();
    this.bindEvents();
    this.init();
  }

  cacheEls() {
    this.tableBody = document.getElementById('serviceTypesTableBody');
    this.addBtn = document.getElementById('addServiceTypeBtn');
    this.quickSelect = document.getElementById('serviceTypeQuickSelect');
    this.editSelectedBtn = document.getElementById('editSelectedBtn');

    this.modal = document.getElementById('serviceTypeModal');
    this.modalTitle = document.getElementById('serviceTypeModalTitle');
    this.modalError = document.getElementById('serviceTypeModalError');

    this.stName = document.getElementById('stName');
    this.stCode = document.getElementById('stCode');
    this.stPricingType = document.getElementById('stPricingType');
    this.stCustomLabel = document.getElementById('stCustomLabel');
    this.stAgreement = document.getElementById('stAgreement');
    this.stDefaultSettings = document.getElementById('stDefaultSettings');
    this.stSortOrder = document.getElementById('stSortOrder');
    this.stActive = document.getElementById('stActive');

    this.saveBtn = document.getElementById('saveServiceTypeBtn');
    this.deleteBtn = document.getElementById('deleteServiceTypeBtn');
  }

  bindEvents() {
    if (this.addBtn) {
      this.addBtn.addEventListener('click', () => this.openCreateModal());
    }

    // Quick select dropdown
    if (this.quickSelect) {
      this.quickSelect.addEventListener('change', () => this.handleQuickSelect());
    }
    if (this.editSelectedBtn) {
      this.editSelectedBtn.addEventListener('click', () => {
        if (this.quickSelect?.value) {
          this.openEditModal(this.quickSelect.value);
        }
      });
    }

    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Clicking outside content closes
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }

    // Auto-generate code when empty
    if (this.stName && this.stCode) {
      this.stName.addEventListener('input', () => {
        if (this.selectedId) return; // editing: don't auto-overwrite
        if (this.stCode.value.trim()) return;
        this.stCode.value = generateServiceTypeCode(this.stName.value);
      });
    }

    // Save
    if (this.saveBtn) {
      this.saveBtn.addEventListener('click', () => this.saveFromModal());
    }

    // Delete
    if (this.deleteBtn) {
      this.deleteBtn.addEventListener('click', () => this.deleteSelected());
    }

    // Pricing type multi-select
    this.setupPricingTypeSelector();

    // Storage updates (if another window changes service types)
    window.addEventListener('storage', (e) => {
      if (e.key === SERVICE_TYPES_STORAGE_KEY || e.key === POLICIES_STORAGE_KEY) {
        this.init(true);
      }
    });
  }

  async init(silent = false) {
    if (!silent) {
      this.showInlineLoading();
    }

    try {
      this.serviceTypes = await loadServiceTypes({ includeInactive: true, preferRemote: true });
    } catch {
      this.serviceTypes = [];
    }
    if (!Array.isArray(this.serviceTypes)) this.serviceTypes = [];

    // Load Policies/Agreements for the Agreement dropdown
    try {
      this.policies = await loadPolicies({ includeInactive: true, preferRemote: true });
    } catch {
      this.policies = [];
    }
    this.populateAgreementOptions();
    this.populateQuickSelect();
    this.serviceTypes.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    this.render();

    if (!silent) {
      this.hideInlineLoading();
    }

    this.broadcastUpdate();
  }

  showInlineLoading() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = `<tr><td colspan="8" style="padding:16px; color:#666;">Loading service types...</td></tr>`;
  }

  hideInlineLoading() {
    // render() already replaced the content
  }

  render() {
    if (!this.tableBody) return;
    if (!this.serviceTypes.length) {
      this.tableBody.innerHTML = `<tr><td colspan="8" style="padding:16px; color:#666;">No service types found.</td></tr>`;
      return;
    }

    const rows = this.serviceTypes.map((st) => this.renderRow(st)).join('');
    this.tableBody.innerHTML = rows;

    // Wire row events
    this.tableBody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget?.dataset?.id;
        if (id) this.openEditModal(id);
      });
    });

    this.tableBody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget?.dataset?.id;
        if (id) this.confirmDelete(id);
      });
    });

    this.tableBody.querySelectorAll('[data-action="toggle-active"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (e) => {
        const id = e.currentTarget?.dataset?.id;
        const active = e.currentTarget?.checked === true;
        if (id) this.toggleActive(id, active);
      });
    });
  }

  /**
   * Populate the quick select dropdown with all service types
   */
  populateQuickSelect() {
    if (!this.quickSelect) return;
    
    const currentValue = this.quickSelect.value;
    this.quickSelect.innerHTML = '<option value="">-- All Service Types --</option>';
    
    // Group by active/inactive
    const active = this.serviceTypes.filter(st => st.active !== false);
    const inactive = this.serviceTypes.filter(st => st.active === false);
    
    // Add active service types
    active.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st.id;
      // Show multiple pricing types if available
      const pricingLabel = this.prettyPricingType(st.pricing_types || st.pricing_type);
      opt.textContent = `${st.name || st.code} (${pricingLabel})`;
      this.quickSelect.appendChild(opt);
    });
    
    // Add separator and inactive if any
    if (inactive.length > 0) {
      const sep = document.createElement('option');
      sep.disabled = true;
      sep.textContent = '── Inactive ──';
      this.quickSelect.appendChild(sep);
      
      inactive.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st.id;
        opt.textContent = `${st.name || st.code} (inactive)`;
        opt.style.color = '#999';
        this.quickSelect.appendChild(opt);
      });
    }
    
    // Restore selection if still valid
    if (currentValue) {
      this.quickSelect.value = currentValue;
    }
  }

  /**
   * Handle quick select dropdown change
   */
  handleQuickSelect() {
    const selectedId = this.quickSelect?.value;
    
    // Show/hide edit button
    if (this.editSelectedBtn) {
      this.editSelectedBtn.style.display = selectedId ? 'inline-block' : 'none';
    }
    
    // Highlight the selected row in the table
    this.tableBody?.querySelectorAll('tr').forEach(row => {
      row.classList.remove('highlighted');
    });
    
    if (selectedId) {
      const row = this.tableBody?.querySelector(`[data-id="${selectedId}"]`)?.closest('tr');
      if (row) {
        row.classList.add('highlighted');
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  renderRow(st) {
    const safe = normalizeServiceType(st);
    // Show multiple pricing types if available, otherwise fallback to single
    const pricingLabel = this.prettyPricingType(safe.pricing_types || safe.pricing_type);
    const defaultCol = safe.default_settings ? this.escapeHtml(String(safe.default_settings)) : '';
    const agreementLabel = safe.agreement ? this.escapeHtml(this.getAgreementLabel(safe.agreement)) : '';
    return `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" data-action="toggle-active" data-id="${this.escapeAttr(safe.id)}" ${safe.active ? 'checked' : ''} />
        </td>
        <td>
          <a href="#" class="service-link" data-action="edit" data-id="${this.escapeAttr(safe.id)}">${this.escapeHtml(safe.name || '(unnamed)')}</a>
        </td>
        <td>${this.escapeHtml(safe.code || '')}</td>
        <td>${this.escapeHtml(pricingLabel)}</td>
        <td>${this.escapeHtml(safe.custom_label || '')}</td>
        <td>${agreementLabel}</td>
        <td>${defaultCol}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small" data-action="edit" data-id="${this.escapeAttr(safe.id)}">Edit</button>
            <button class="btn-small" data-action="delete" data-id="${this.escapeAttr(safe.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  // Policies/Agreements
  // - Service Types store `agreement` as either:
  //   - a policy UUID (preferred)
  //   - a legacy free-text name (older data)
  findPolicyByIdOrName(value) {
    const v = (value || '').toString().trim();
    if (!v) return null;
    const list = Array.isArray(this.policies) ? this.policies : [];
    const byId = list.find((p) => p && p.id === v);
    if (byId) return byId;
    const lower = v.toLowerCase();
    return list.find((p) => (p?.name || '').toString().trim().toLowerCase() === lower) || null;
  }

  getAgreementLabel(value) {
    const p = this.findPolicyByIdOrName(value);
    if (!p) return (value || '').toString();
    return p.active === false ? `${p.name} (Inactive)` : (p.name || '').toString();
  }

  coerceAgreementToPolicyId(value) {
    const v = (value || '').toString().trim();
    if (!v) return '';
    const p = this.findPolicyByIdOrName(v);
    return p?.id || v;
  }

  populateAgreementOptions() {
    if (!(this.stAgreement instanceof HTMLSelectElement)) {
      return;
    }

    // Preserve current selection if possible
    let currentValue = (this.stAgreement.value || '').toString().trim();

    // If the stored value is a legacy policy name, upgrade it to the policy id
    currentValue = this.coerceAgreementToPolicyId(currentValue);

    const policies = Array.isArray(this.policies) ? this.policies.slice() : [];
    policies.sort((a, b) => {
      const ao = Number(a?.sort_order) || 0;
      const bo = Number(b?.sort_order) || 0;
      if (ao !== bo) return ao - bo;
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });

    // Rebuild options
    this.stAgreement.innerHTML = '';
    this.stAgreement.add(new Option('-- No Agreement --', ''));

    // Active first, then inactive
    const active = policies.filter((p) => p && p.active !== false);
    const inactive = policies.filter((p) => p && p.active === false);

    active.forEach((p) => {
      if (!p?.id) return;
      this.stAgreement.add(new Option(p.name || p.id, p.id));
    });

    if (inactive.length) {
      // Visual separator
      this.stAgreement.add(new Option('──────────', '__sep__'));
      inactive.forEach((p) => {
        if (!p?.id) return;
        this.stAgreement.add(new Option(`${p.name || p.id} (Inactive)`, p.id));
      });
    }

    // Restore selection (or keep legacy value)
    if (currentValue) {
      const exists = Array.from(this.stAgreement.options).some((o) => o.value === currentValue);
      if (!exists) {
        this.stAgreement.add(new Option(`Legacy: ${currentValue}`, currentValue));
      }
      this.stAgreement.value = currentValue;
    }

    // Prevent selecting the separator
    this.stAgreement.addEventListener('change', () => {
      if (this.stAgreement.value === '__sep__') this.stAgreement.value = '';
    }, { once: true });
  }

  prettyPricingType(value) {
    // Handle array of pricing types
    if (Array.isArray(value)) {
      return value.map(v => this.prettyPricingType(v)).join(', ');
    }
    const v = (value || '').toString().toUpperCase();
    if (v === 'HOURS') return 'Hours';
    if (v === 'DISTANCE') return 'Distance';
    if (v === 'PASSENGER') return 'Passenger';
    if (v === 'FIXED') return 'Fixed';
    if (v === 'HYBRID') return 'Hybrid';
    return v || '—';
  }

  /**
   * Setup pricing type multi-select checkbox behavior
   */
  setupPricingTypeSelector() {
    const selectAll = document.getElementById('pricingSelectAll');
    const checkboxes = document.querySelectorAll('input[name="pricingType"]');
    
    if (selectAll) {
      selectAll.addEventListener('change', () => {
        checkboxes.forEach(cb => {
          cb.checked = selectAll.checked;
        });
        this.syncPricingTypeToSelect();
      });
    }
    
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        // Update select all state
        const allChecked = Array.from(checkboxes).every(c => c.checked);
        const someChecked = Array.from(checkboxes).some(c => c.checked);
        if (selectAll) {
          selectAll.checked = allChecked;
          selectAll.indeterminate = someChecked && !allChecked;
        }
        this.syncPricingTypeToSelect();
      });
    });
  }

  /**
   * Sync checkbox selections to the hidden select for compatibility
   */
  syncPricingTypeToSelect() {
    const checkboxes = document.querySelectorAll('input[name="pricingType"]:checked');
    const values = Array.from(checkboxes).map(cb => cb.value);
    // Store first value in select for backwards compatibility
    if (this.stPricingType) {
      this.stPricingType.value = values[0] || 'DISTANCE';
    }
  }

  /**
   * Get selected pricing types from checkboxes
   */
  getSelectedPricingTypes() {
    const checkboxes = document.querySelectorAll('input[name="pricingType"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  /**
   * Set pricing type checkboxes from value (string or array)
   */
  setPricingTypeCheckboxes(value) {
    const selectAll = document.getElementById('pricingSelectAll');
    const checkboxes = document.querySelectorAll('input[name="pricingType"]');
    
    // Convert to array
    let types = [];
    if (Array.isArray(value)) {
      types = value.map(v => v.toString().toUpperCase());
    } else if (value) {
      types = [value.toString().toUpperCase()];
    } else {
      types = ['DISTANCE']; // Default
    }
    
    // Set checkboxes
    checkboxes.forEach(cb => {
      cb.checked = types.includes(cb.value);
    });
    
    // Update select all state
    if (selectAll) {
      const allChecked = Array.from(checkboxes).every(c => c.checked);
      const someChecked = Array.from(checkboxes).some(c => c.checked);
      selectAll.checked = allChecked;
      selectAll.indeterminate = someChecked && !allChecked;
    }
  }

  openCreateModal() {
    this.selectedId = null;
    this.modalTitle.textContent = 'Add Service Type';
    this.deleteBtn.style.display = 'none';
    this.clearError();

    this.stName.value = '';
    this.stCode.value = '';
    this.setPricingTypeCheckboxes(['DISTANCE']); // Default to distance
    this.stCustomLabel.value = '';
    this.stAgreement.value = '';
    this.stDefaultSettings.value = '';
    this.stSortOrder.value = '0';
    this.stActive.checked = true;

    this.openModal();
  }

  openEditModal(id) {
    const st = this.serviceTypes.find((x) => x.id === id);
    if (!st) return;

    this.selectedId = id;
    this.modalTitle.textContent = 'Edit Service Type';
    this.deleteBtn.style.display = 'inline-block';
    this.clearError();

    this.stName.value = st.name || '';
    this.stCode.value = st.code || '';
    // Support both single pricing_type and array pricing_types
    this.setPricingTypeCheckboxes(st.pricing_types || st.pricing_type || 'DISTANCE');
    this.stCustomLabel.value = st.custom_label || '';
    this.stAgreement.value = st.agreement || '';
    this.stDefaultSettings.value = st.default_settings || '';
    this.stSortOrder.value = String(Number.isFinite(st.sort_order) ? st.sort_order : 0);
    this.stActive.checked = st.active !== false;

    this.openModal();
  }

  openModal() {
    this.populateAgreementOptions();

    if (!this.modal) return;
    this.modal.classList.add('active');
    this.modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.stName?.focus?.(), 50);
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.classList.remove('active');
    this.modal.setAttribute('aria-hidden', 'true');
  }

  showError(msg) {
    if (!this.modalError) return;
    this.modalError.textContent = msg;
    this.modalError.style.display = 'block';
  }

  clearError() {
    if (!this.modalError) return;
    this.modalError.textContent = '';
    this.modalError.style.display = 'none';
  }

  validateModal() {
    const name = (this.stName.value || '').trim();
    const code = (this.stCode.value || '').trim();

    if (!name) return 'Name is required.';
    if (!code) return 'Code is required.';
    if (!/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/.test(code) && code.length > 1) {
      return 'Code must be lowercase letters/numbers with dashes (no spaces).';
    }

    // Enforce unique code (case-insensitive)
    const normalizedCode = code.toLowerCase();
    const conflict = this.serviceTypes.find((s) => (s.code || '').toLowerCase() === normalizedCode && s.id !== this.selectedId);
    if (conflict) return `Code "${code}" is already in use. Choose another.`;

    return null;
  }

  async saveFromModal() {
    const error = this.validateModal();
    if (error) {
      this.showError(error);
      return;
    }
    this.clearError();

    // Get selected pricing types from checkboxes
    const selectedPricingTypes = this.getSelectedPricingTypes();
    if (selectedPricingTypes.length === 0) {
      this.showError('Please select at least one pricing type.');
      return;
    }

    const base = {
      id: this.selectedId || undefined,
      name: (this.stName.value || '').trim(),
      code: (this.stCode.value || '').trim(),
      // Store as array for multi-select support
      pricing_types: selectedPricingTypes,
      // Keep single pricing_type for backwards compatibility
      pricing_type: selectedPricingTypes[0] || 'DISTANCE',
      custom_label: (this.stCustomLabel.value || '').trim(),
      // Store agreement as policy id when possible (still supports legacy free-text)
      agreement: this.coerceAgreementToPolicyId((this.stAgreement.value || '').trim()),
      default_settings: (this.stDefaultSettings.value || '').trim(),
      sort_order: Number(this.stSortOrder.value || 0),
      active: this.stActive.checked
    };

    let updated = [...this.serviceTypes];
    if (this.selectedId) {
      updated = updated.map((st) => st.id === this.selectedId ? normalizeServiceType({ ...st, ...base, id: this.selectedId }) : st);
    } else {
      updated.push(normalizeServiceType(base));
    }

    // Persist
    this.serviceTypes = await upsertServiceTypes(updated, { preferRemote: true });
    this.serviceTypes.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    this.render();
    this.closeModal();
    this.broadcastUpdate();
  }

  async toggleActive(id, active) {
    const updated = this.serviceTypes.map((st) => st.id === id ? normalizeServiceType({ ...st, active }) : st);
    this.serviceTypes = await upsertServiceTypes(updated, { preferRemote: true });
    this.serviceTypes.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    this.render();
    this.broadcastUpdate();
  }

  confirmDelete(id) {
    const st = this.serviceTypes.find((x) => x.id === id);
    const name = st?.name || 'this service type';
    if (!confirm(`Delete "${name}"?\n\nThis only removes the service type definition.\nVehicle types may still reference its code until you update them.`)) {
      // Re-render to restore checkbox state in case user clicked row delete after toggle
      this.render();
      return;
    }
    this.deleteById(id);
  }

  async deleteSelected() {
    if (!this.selectedId) return;
    this.confirmDelete(this.selectedId);
    this.closeModal();
  }

  async deleteById(id) {
    await deleteServiceTypeById(id, { preferRemote: true });
    this.serviceTypes = this.serviceTypes.filter((st) => st.id !== id);
    this.render();
    this.broadcastUpdate();
  }

  broadcastUpdate() {
    // Tell parent frame to refresh service-type dependent dropdowns
    try {
      const active = getActiveServiceTypes(this.serviceTypes);
      window.parent?.postMessage?.({ action: 'serviceTypesUpdated', payload: active }, '*');
    } catch { /* ignore */ }
    // Same-window event already emitted by the store via localStorage write.
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeAttr(text) {
    return this.escapeHtml(text).replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ServiceTypesPage();
});
