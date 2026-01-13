// Company Resources Module - Integrated into My Office
// Full CRUD system for Drivers, Airlines, Airports, Fleet, etc.

export class CompanyResourcesManager {
  constructor() {
    this.currentSection = 'drivers';
    this.editingId = null;
    this.showAll = false;
    this.container = null;
    this.els = {};
    this.syncWarningShown = false;
    this.realTimeSyncEnabled = true;
    this.lastSyncCheck = Date.now();
  }

  /**
   * Initialize the Company Resources module
   * Should be called when the Company Resources tab is activated
   */
  init(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.error('Company Resources container not found:', containerSelector);
      return;
    }
    console.log('Company Resources container found:', this.container);

    this.buildUI();
    console.log('UI built');
    
    this.cacheElements();
    console.log('Elements cached:', this.els);
    
    // Verify critical elements exist
    if (!this.els.centerTitle) {
      console.error('Critical element centerTitle not found after caching');
      return;
    }
    
    this.setupEventListeners();
    console.log('Event listeners set up');
    
    this.switchSection('drivers');
    console.log('Switched to drivers section');
  }

  buildUI() {
    this.container.innerHTML = `
      <div class="company-resources-container">
        <!-- Left: Navigation -->
        <div class="cr-left-panel" id="crLeftPanel">
          <button class="cr-left-btn active" data-section="drivers">Drivers</button>
          <button class="cr-left-btn" data-section="affiliates">Affiliates</button>
          <button class="cr-left-btn" data-section="agents">Agents</button>
          <button class="cr-left-btn" data-section="vehicle-types">Vehicle Types</button>
          <button class="cr-left-btn" data-section="fleet">Fleet</button>
          <button class="cr-left-btn" data-section="airports">Airports</button>
          <button class="cr-left-btn" data-section="airlines">Airlines</button>
          <button class="cr-left-btn" data-section="fbo">Private Airlines (FBO)</button>
          <button class="cr-left-btn" data-section="seaports">Seaports</button>
          <button class="cr-left-btn" data-section="poi">Points of Interest</button>
        </div>

        <!-- Center: List -->
        <div class="cr-center-panel">
          <div class="cr-center-header">
            <div class="cr-center-title" id="crCenterTitle">Drivers</div>
            <label class="cr-show-all">
              <input type="checkbox" id="crShowAll" />
              <span>Show All</span>
            </label>
          </div>
          <div class="cr-list-wrapper">
            <select class="cr-listbox" id="crListbox" size="20"></select>
            <div class="cr-table-wrapper" id="crTableWrapper">
              <table class="cr-table">
                <thead id="crTableHead"></thead>
                <tbody id="crTableBody"></tbody>
              </table>
            </div>
          </div>
          <div class="cr-center-footer">
            <button class="cr-btn" id="crEditBtn">EDIT</button>
            <button class="cr-btn" id="crDeleteBtn">DELETE</button>
          </div>
        </div>

        <!-- Right: Form -->
        <div class="cr-right-panel">
          <div class="cr-form-header" id="crFormHeader">Add New Driver</div>
          <div class="cr-form-content" id="crFormContent"></div>
          <div class="cr-form-footer">
            <button class="cr-btn" id="crAddNewBtn">ADD NEW</button>
            <button class="cr-btn" id="crSaveBtn" style="display: none;">SAVE</button>
            <button class="cr-btn" id="crCancelBtn" style="display: none;">CANCEL</button>
          </div>
        </div>
      </div>
    `;
  }

  cacheElements() {
    this.els = {
      leftBtns: Array.from(this.container.querySelectorAll('.cr-left-btn')),
      centerTitle: this.container.querySelector('#crCenterTitle'),
      showAll: this.container.querySelector('#crShowAll'),
      listbox: this.container.querySelector('#crListbox'),
      tableWrapper: this.container.querySelector('#crTableWrapper'),
      tableHead: this.container.querySelector('#crTableHead'),
      tableBody: this.container.querySelector('#crTableBody'),
      formHeader: this.container.querySelector('#crFormHeader'),
      formContent: this.container.querySelector('#crFormContent'),
      editBtn: this.container.querySelector('#crEditBtn'),
      deleteBtn: this.container.querySelector('#crDeleteBtn'),
      addNewBtn: this.container.querySelector('#crAddNewBtn'),
      saveBtn: this.container.querySelector('#crSaveBtn'),
      cancelBtn: this.container.querySelector('#crCancelBtn'),
    };
  }

  setupEventListeners() {
    // Left navigation
    this.els.leftBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        this.switchSection(section);
      });
    });

    // Center buttons
    this.els.editBtn.addEventListener('click', () => this.startEdit());
    this.els.deleteBtn.addEventListener('click', () => this.doDelete());
    this.els.showAll.addEventListener('change', () => this.handleShowAll());

    // Right buttons
    this.els.addNewBtn.addEventListener('click', () => this.doAdd());
    this.els.saveBtn.addEventListener('click', () => this.doSave());
    this.els.cancelBtn.addEventListener('click', () => this.startAdd());

    // Listbox selection
    this.els.listbox.addEventListener('change', () => {
      this.els.tableBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
    });
  }

  switchSection(sectionKey) {
    this.currentSection = sectionKey;
    this.editingId = null;
    this.showAll = false;
    this.els.showAll.checked = false;

    // Update left nav active state
    this.els.leftBtns.forEach(btn => btn.classList.remove('active'));
    this.container.querySelector(`[data-section="${sectionKey}"]`).classList.add('active');

    // Render center and right
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
    
    // Perform real-time sync check when switching sections
    if (this.realTimeSyncEnabled) {\n      this.performRealTimeSync();\n    }\n  }

  renderCenter() {
    const config = this.getSectionConfig(this.currentSection);
    const isTable = config.listType === 'table';
    const isContainer = config.listType === 'container';

    this.els.centerTitle.textContent = config.title;
    this.els.listbox.style.display = (isTable || isContainer) ? 'none' : 'block';
    this.els.tableWrapper.style.display = (isTable || isContainer) ? 'block' : 'none';

    const items = this.loadItems();

    if (isTable) {
      this.renderTable(config, items);
    } else if (isContainer) {
      this.renderContainer(config, items);
    } else {
      this.renderListbox(config, items);
    }

    // Update button label
    this.els.editBtn.textContent = `EDIT ${config.title.split(' ')[0].toUpperCase()}`;
  }

  renderListbox(config, items) {
    this.els.listbox.innerHTML = '';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = config.listLabel(item);
      this.els.listbox.appendChild(opt);
    });
  }

  renderTable(config, items) {
    const cols = config.tableColumns || ['name'];

    // Build header
    this.els.tableHead.innerHTML = '';
    const headerRow = document.createElement('tr');
    cols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = this.humanizeLabel(col);
      headerRow.appendChild(th);
    });
    this.els.tableHead.appendChild(headerRow);

    // Build body
    this.els.tableBody.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('tr');
      row.dataset.id = item.id;
      cols.forEach(col => {
        const td = document.createElement('td');
        
        // Special handling for fleet assignments
        if (this.currentSection === 'fleet' && (col === 'driver' || col === 'type' || col === 'affiliate')) {
          td.textContent = this.getDisplayNameForAssignment(col, item[col]);
        } else {
          td.textContent = item[col] || '';
        }
        
        row.appendChild(td);
      });
      row.addEventListener('click', () => {
        this.els.tableBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
        row.classList.add('selected');
        this.els.tableBody.dataset.selectedId = item.id;
      });
      this.els.tableBody.appendChild(row);
    });
  }

  getDisplayNameForAssignment(fieldType, assignmentId) {
    if (!assignmentId) return 'Unassigned';
    
    let sourceData = [];
    if (fieldType === 'driver') {
      sourceData = this.loadItemsFromSource('drivers');
      const driver = sourceData.find(d => d.id === assignmentId);
      return driver ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim() : 'Unknown Driver';
    } else if (fieldType === 'type') {
      sourceData = this.loadItemsFromSource('vehicle-types');
      const vType = sourceData.find(vt => vt.id === assignmentId);
      return vType ? vType.name : 'Unknown Type';
    } else if (fieldType === 'affiliate') {
      sourceData = this.loadItemsFromSource('affiliates');
      const affiliate = sourceData.find(a => a.id === assignmentId);
      return affiliate ? affiliate.name : 'Unknown Affiliate';
    }
    
    return assignmentId;
  }

  renderContainer(config, items) {
    const cols = config.tableColumns || ['name'];
    
    // Create grid container instead of table
    this.els.tableHead.innerHTML = '';
    this.els.tableBody.innerHTML = '';
    
    const containerDiv = document.createElement('div');
    containerDiv.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; padding: 12px;';
    
    items.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 6px; padding: 16px; background: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);';
      card.dataset.id = item.id;
      
      let content = '';
      
      // Special formatting for airports to show more information in each cell
      if (this.currentSection === 'airports') {
        content = `
          <div style="font-size: 14px; font-weight: bold; color: #333; margin-bottom: 8px;">
            ${item.code || 'N/A'} - ${item.name || 'Unnamed Airport'}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
            <strong>Location:</strong> ${item.city || ''}, ${item.state || ''} ${item.zip || ''}
          </div>
          ${item.address ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;"><strong>Address:</strong> ${item.address}</div>` : ''}
          ${item.country && item.country !== 'United States' ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;"><strong>Country:</strong> ${item.country}</div>` : ''}
          ${item.latitude && item.longitude ? `<div style="font-size: 11px; color: #888; margin-top: 8px;">Coordinates: ${item.latitude}, ${item.longitude}</div>` : ''}
        `;
      } else {
        // Default formatting for other resource types
        cols.forEach(col => {
          content += `<div style="font-size: 12px; margin-bottom: 4px;"><strong>${this.humanizeLabel(col)}:</strong> ${item[col] || ''}</div>`;
        });
      }
      
      card.innerHTML = content;
      
      card.addEventListener('click', () => {
        containerDiv.querySelectorAll('div[data-id]').forEach(c => {
          c.style.background = '#fff';
          c.style.borderColor = '#d0d0d0';
          c.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        card.style.background = '#e3f2fd';
        card.style.borderColor = '#2196f3';
        card.style.boxShadow = '0 4px 8px rgba(33, 150, 243, 0.2)';
        this.els.tableBody.dataset.selectedId = item.id;
      });
      
      card.addEventListener('mouseover', () => {
        if (card.dataset.id !== this.els.tableBody.dataset.selectedId) {
          card.style.background = '#f9f9f9';
          card.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      });
      
      card.addEventListener('mouseout', () => {
        if (card.dataset.id !== this.els.tableBody.dataset.selectedId) {
          card.style.background = '#fff';
          card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      });
      
      containerDiv.appendChild(card);
    });
    
    this.els.tableBody.appendChild(containerDiv);
  }

  renderForm(item) {
    const config = this.getSectionConfig(this.currentSection);
    this.els.formHeader.textContent = config.formTitle(this.editingId ? 'edit' : 'add');
    this.els.formContent.innerHTML = '';

    config.blocks.forEach(block => {
      const blockEl = document.createElement('div');
      blockEl.className = 'cr-block';

      const headerEl = document.createElement('div');
      headerEl.className = 'cr-block-header';
      headerEl.textContent = block.head;
      blockEl.appendChild(headerEl);

      const bodyEl = document.createElement('div');
      bodyEl.className = 'cr-block-body';

      const gridEl = document.createElement('div');
      gridEl.className = `cr-grid-${block.columns || 2}`;

      block.fields.forEach(field => {
        const val = item?.[field.id] ?? config.defaults?.[field.id];
        gridEl.appendChild(this.createFieldEl(field, val));
      });

      bodyEl.appendChild(gridEl);
      blockEl.appendChild(bodyEl);
      this.els.formContent.appendChild(blockEl);
    });
  }

  createFieldEl(field, value) {
    const wrap = document.createElement('div');
    wrap.className = 'cr-field' + (field.span ? ` cr-span-${field.span}` : '');

    if (field.type === 'checkbox') {
      const checkLine = document.createElement('div');
      checkLine.className = 'cr-checkbox-line';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = `field_${field.id}`;
      input.checked = value === true;
      const label = document.createElement('label');
      label.htmlFor = `field_${field.id}`;
      label.textContent = field.label;
      checkLine.appendChild(input);
      checkLine.appendChild(label);
      wrap.appendChild(checkLine);
    } else {
      const label = document.createElement('label');
      label.textContent = field.label;
      wrap.appendChild(label);

      let input;
      if (field.type === 'textarea') {
        input = document.createElement('textarea');
      } else if (field.type === 'select') {
        input = document.createElement('select');
        
        if (field.dataSource) {
          // Populate from data source (drivers, vehicle-types, affiliates)
          this.populateSelectField(input, field.dataSource, value);
          
          // Add change listener for sync validation
          input.addEventListener('change', () => {
            this.validateSyncChange(field.id, input.value);
          });
        } else {
          // Use static options
          const opts = field.options || [];
          opts.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt;
            input.appendChild(option);
          });
        }
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
      }

      input.id = `field_${field.id}`;
      input.value = value || '';
      wrap.appendChild(input);
    }

    return wrap;
  }

  humanizeLabel(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

import { fetchVehicleTypes, upsertVehicleType, deleteVehicleType } from './api-service.js';

  getSectionConfig(section) {
    const configs = {
      drivers: {
        title: 'Drivers',
        listType: 'table',
        tableColumns: ['first_name', 'last_name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Driver' : 'Add New Driver',
        listLabel: (x) => `${x.first_name || ''} ${x.last_name || ''}`.trim(),
        blocks: [
          {
            head: 'Driver Information',
            columns: 2,
            fields: [
              { id: 'first_name', label: 'First Name', type: 'text' },
              { id: 'last_name', label: 'Last Name', type: 'text' },
              { id: 'phone', label: 'Phone', type: 'tel' },
            ],
          },
        ],
        defaults: {},
        storageKey: 'cr_drivers',
      },
      affiliates: {
        title: 'Affiliates',
        listType: 'table',
        tableColumns: ['name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Affiliate' : 'Add New Affiliate',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Affiliate Info', columns: 2, fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'phone', label: 'Phone', type: 'tel' }] }],
        defaults: {},
        storageKey: 'cr_affiliates',
      },
      agents: {
        title: 'Agents',
        listType: 'table',
        tableColumns: ['name', 'phone'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Agent' : 'Add New Agent',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Agent Info', columns: 2, fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'phone', label: 'Phone', type: 'tel' }] }],
        defaults: {},
        storageKey: 'cr_agents',
      },
      'vehicle-types': {
        title: 'Vehicle Types',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Vehicle Type' : 'Add New Vehicle Type',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Vehicle Type', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_vehicle_types',
      },
      fleet: {
        title: 'Fleet',
        listType: 'table',
        tableColumns: ['plate', 'type', 'driver', 'affiliate'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Vehicle' : 'Add New Vehicle',
        listLabel: (x) => `${x.plate || 'No Plate'} - ${x.type || 'No Type'} (${x.driver || 'Unassigned'})`,
        blocks: [
          { 
            head: 'Vehicle Information', 
            columns: 2, 
            fields: [
              { id: 'plate', label: 'License Plate', type: 'text' }, 
              { id: 'vin', label: 'VIN', type: 'text' },
              { id: 'year', label: 'Year', type: 'number' },
              { id: 'make', label: 'Make', type: 'text' },
              { id: 'model', label: 'Model', type: 'text' },
              { id: 'color', label: 'Color', type: 'text' }
            ] 
          },
          {
            head: 'Assignments',
            columns: 1,
            fields: [
              { id: 'type', label: 'Vehicle Type', type: 'select', dataSource: 'vehicle-types' },
              { id: 'driver', label: 'Assigned Driver', type: 'select', dataSource: 'drivers' },
              { id: 'affiliate', label: 'Affiliate', type: 'select', dataSource: 'affiliates' }
            ]
          }
        ],
        defaults: {},
        storageKey: 'cr_fleet',
        syncFields: ['type', 'driver', 'affiliate'], // Fields that require sync validation
      },
      airports: {
        title: 'Airports',
        listType: 'container',
        tableColumns: ['code', 'name', 'city', 'state'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Airport' : 'Add New Airport',
        listLabel: (x) => `${x.code || ''} - ${x.name || ''} (${x.city || ''}, ${x.state || ''})`,
        blocks: [
          { 
            head: 'Airport Information', 
            columns: 2, 
            fields: [
              { id: 'code', label: 'Airport Code', type: 'text' }, 
              { id: 'name', label: 'Airport Name', type: 'text' },
              { id: 'city', label: 'City', type: 'text' },
              { id: 'state', label: 'State', type: 'text' },
              { id: 'country', label: 'Country', type: 'text' },
              { id: 'address', label: 'Address', type: 'text' },
              { id: 'zip', label: 'ZIP Code', type: 'text' },
              { id: 'latitude', label: 'Latitude', type: 'text' },
              { id: 'longitude', label: 'Longitude', type: 'text' }
            ] 
          }
        ],
        defaults: { country: 'United States' },
        storageKey: 'cr_airports',
      },
      airlines: {
        title: 'Airlines',
        listType: 'container',
        tableColumns: ['code', 'name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Airline' : 'Add New Airline',
        listLabel: (x) => `${x.code || ''} - ${x.name || ''}`,
        blocks: [{ head: 'Airline', columns: 2, fields: [{ id: 'code', label: 'Code', type: 'text' }, { id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_airlines',
      },
      fbo: {
        title: 'Private Airlines (FBO)',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit FBO' : 'Add New FBO',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'FBO', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_fbo',
      },
      seaports: {
        title: 'Seaports',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit Seaport' : 'Add New Seaport',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'Seaport', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_seaports',
      },
      poi: {
        title: 'Points of Interest',
        listType: 'table',
        tableColumns: ['name'],
        formTitle: (mode) => mode === 'edit' ? 'Edit POI' : 'Add New POI',
        listLabel: (x) => x.name || '',
        blocks: [{ head: 'POI', columns: 1, fields: [{ id: 'name', label: 'Name', type: 'text' }] }],
        defaults: {},
        storageKey: 'cr_poi',
      },
    };
    return configs[section] || configs.drivers;
  }

  startEdit() {
    const selectedId = this.els.tableBody.dataset.selectedId;
    if (!selectedId) {
      alert('Please select an item to edit');
      return;
    }
    this.editingId = selectedId;
    const items = this.loadItems();
    const item = items.find(i => i.id === selectedId);
    if (item) {
      this.renderForm(item);
      this.setFormMode('edit');
    }
  }

  async doDelete() {
    const selectedId = this.els.tableBody.dataset.selectedId || this.editingId;
    if (!selectedId) {
      alert('Please select an item to delete');
      return;
    }
    if (!confirm('Delete this item?')) return;
    
    // Special handling: vehicle-types -> delete via API when available
    if (this.currentSection === 'vehicle-types') {
      try {
        if (window.myOffice && window.myOffice.apiReady) {
          await deleteVehicleType(selectedId);
          // Remove from in-memory cache and re-render
          this.vehicleTypesCache = (this.vehicleTypesCache || []).filter(v => v.id !== selectedId);
          this.renderCenter();
          this.refreshAllSelectFields();
        } else {
          console.warn('[CompanyResources] API not ready; deleting vehicle type locally as fallback');
          let items = this.loadItems();
          items = items.filter(i => i.id !== selectedId);
          this.saveItems(items);
        }
      } catch (err) {
        console.error('[CompanyResources] Failed to delete vehicle type via API:', err);
        this._showErrorBanner && this._showErrorBanner('Failed to delete vehicle type', err);
      }

      this.editingId = null;
      this.els.tableBody.dataset.selectedId = null;
      this.renderCenter();
      this.setFormMode('add');
      this.renderForm(null);
      return;
    }
    
    let items = this.loadItems();
    const itemToDelete = items.find(i => i.id === selectedId);
    items = items.filter(i => i.id !== selectedId);
    this.saveItems(items);
    
    // Special handling for airports: also remove from office.Airports structure
    if (this.currentSection === 'airports' && window.office && window.office.Airports && itemToDelete && itemToDelete.code) {
      window.office.Airports.delete(itemToDelete.code);
      console.log(`Removed airport ${itemToDelete.code} from office.Airports`);
    }
    
    this.editingId = null;
    this.els.tableBody.dataset.selectedId = null;
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
  }

  doAdd() {
    this.setFormMode('add');
  }

  async doSave() {
    const config = this.getSectionConfig(this.currentSection);
    const newItem = { id: this.editingId || this.uid() };
    config.blocks.forEach(block => {
      block.fields.forEach(field => {
        const el = document.getElementById(`field_${field.id}`);
        if (el) {
          newItem[field.id] = field.type === 'checkbox' ? el.checked : el.value;
        }
      });
    });

    // Special handling: vehicle-types -> use API when available (do NOT persist locally)
    if (this.currentSection === 'vehicle-types') {
      try {
        if (window.myOffice && window.myOffice.apiReady) {
          const saved = await upsertVehicleType(newItem);
          // Update in-memory cache and re-render
          this.vehicleTypesCache = Array.isArray(this.vehicleTypesCache) ? this.vehicleTypesCache.slice() : [];
          const existingIdx = this.vehicleTypesCache.findIndex(v => v.id === (saved && saved.id));
          if (existingIdx >= 0) this.vehicleTypesCache[existingIdx] = saved;
          else this.vehicleTypesCache.push(saved);
          this.renderCenter();
          this.refreshAllSelectFields();
        } else {
          console.warn('[CompanyResources] API not ready; saving vehicle types locally as fallback');
          let items = this.loadItems();
          if (this.editingId) {
            const idx = items.findIndex(i => i.id === this.editingId);
            if (idx >= 0) items[idx] = newItem;
          } else {
            items.push(newItem);
          }
          this.saveItems(items);
        }
      } catch (err) {
        console.error('[CompanyResources] Failed to save vehicle type via API:', err);
        this._showErrorBanner && this._showErrorBanner('Failed to save vehicle type', err);
      }

      this.editingId = null;
      this.renderCenter();
      this.setFormMode('add');
      this.renderForm(null);
      this.showSyncNotification('saved');
      return;
    }

    // Default (non-vehicle-types) behavior: local storage
    let items = this.loadItems();
    if (this.editingId) {
      const idx = items.findIndex(i => i.id === this.editingId);
      if (idx >= 0) items[idx] = newItem;
    } else {
      items.push(newItem);
    }
    this.saveItems(items);
    
    // Special handling for fleet: sync to Supabase fleet_vehicles table
    if (this.currentSection === 'fleet') {
      try {
        await this.syncFleetVehicleToSupabase(newItem);
        console.log('✅ Fleet vehicle synced to Supabase:', newItem.id);
      } catch (err) {
        console.error('❌ Failed to sync fleet vehicle to Supabase:', err);
      }
    }
    
    // Special handling for airports: also save to office.Airports structure
    if (this.currentSection === 'airports' && window.myOffice && newItem.code) {
      window.myOffice.saveAirportToOffice(newItem);
    }
    
    // Trigger real-time sync for all sections
    this.performRealTimeSync();
    
    this.editingId = null;
    this.renderCenter();
    this.setFormMode('add');
    this.renderForm(null);
    
    // Show success notification
    this.showSyncNotification('saved');
  }

  handleShowAll() {
    this.showAll = this.els.showAll.checked;
    this.renderCenter();
  }

  setFormMode(mode) {
    const isAdd = mode === 'add';
    this.els.addNewBtn.style.display = isAdd ? 'block' : 'none';
    this.els.saveBtn.style.display = isAdd ? 'none' : 'block';
    this.els.cancelBtn.style.display = isAdd ? 'none' : 'block';
  }

  loadItems() {
    const config = this.getSectionConfig(this.currentSection);
    return JSON.parse(localStorage.getItem(config.storageKey) || '[]');
  }

  saveItems(items) {
    const config = this.getSectionConfig(this.currentSection);
    localStorage.setItem(config.storageKey, JSON.stringify(items));
  }

  uid() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  }

  /**
   * Sync a fleet vehicle to the Supabase fleet_vehicles table
   * Called on every create/edit of a fleet vehicle
   */
  async syncFleetVehicleToSupabase(fleetItem) {
    const SUPABASE_URL = window.ENV?.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('[CompanyResources] Supabase not configured, skipping fleet sync');
      return null;
    }
    
    // Get organization_id from company settings or use default
    let organizationId = window.ENV?.ORGANIZATION_ID || localStorage.getItem('relia_organization_id');
    if (!organizationId) {
      // Fallback: fetch from existing vehicle_types record
      try {
        const vtResp = await fetch(`${SUPABASE_URL}/rest/v1/vehicle_types?select=organization_id&limit=1`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const vtData = await vtResp.json();
        if (vtData?.[0]?.organization_id) {
          organizationId = vtData[0].organization_id;
          localStorage.setItem('relia_organization_id', organizationId);
        }
      } catch (e) {
        console.warn('[CompanyResources] Could not fetch organization_id:', e);
      }
    }
    
    if (!organizationId) {
      console.error('[CompanyResources] No organization_id available, cannot sync fleet vehicle');
      throw new Error('Missing organization_id for fleet vehicle sync');
    }
    
    // Valid status values per schema: 'AVAILABLE','IN_USE','MAINTENANCE','RETIRED','OUT_OF_SERVICE'
    const validStatuses = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED', 'OUT_OF_SERVICE'];
    const status = validStatuses.includes(fleetItem.status) ? fleetItem.status : 'AVAILABLE';
    
    // Map local fleet item fields to Supabase fleet_vehicles schema
    // Note: vehicle_type_id and affiliate_id have FK constraints - only include if valid UUID
    const isValidUUID = (val) => val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    
    const payload = {
      id: fleetItem.id,
      organization_id: organizationId,
      license_plate: fleetItem.plate || null,
      vin: fleetItem.vin || null,
      year: fleetItem.year ? parseInt(fleetItem.year, 10) : null,
      make: fleetItem.make || null,
      model: fleetItem.model || null,
      // Only include FK fields if they're valid UUIDs to avoid FK constraint violations
      vehicle_type_id: isValidUUID(fleetItem.type) ? fleetItem.type : null,
      assigned_driver_id: isValidUUID(fleetItem.driver) ? fleetItem.driver : null,
      affiliate_id: isValidUUID(fleetItem.affiliate) ? fleetItem.affiliate : null,
      status: status,
      updated_at: new Date().toISOString()
    };
    
    console.log('[CompanyResources] Syncing fleet vehicle to Supabase:', payload);
    
    // Upsert to Supabase (insert or update)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/fleet_vehicles?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CompanyResources] Fleet sync error:', response.status, errorText);
      throw new Error(`Fleet sync failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[CompanyResources] Fleet sync success:', result);
    return Array.isArray(result) ? result[0] : result;
  }

  /**
   * Sync ALL existing localStorage fleet vehicles to Supabase
   * Call this once to migrate existing data
   */
  async syncAllFleetVehiclesToSupabase() {
    const fleetItems = JSON.parse(localStorage.getItem('cr_fleet') || '[]');
    if (!fleetItems.length) {
      console.log('[CompanyResources] No local fleet vehicles to sync');
      return { synced: 0, failed: 0 };
    }
    
    console.log(`[CompanyResources] Syncing ${fleetItems.length} fleet vehicles to Supabase...`);
    let synced = 0;
    let failed = 0;
    
    for (const item of fleetItems) {
      try {
        await this.syncFleetVehicleToSupabase(item);
        synced++;
        console.log(`✅ Synced fleet vehicle: ${item.plate || item.id}`);
      } catch (err) {
        failed++;
        console.error(`❌ Failed to sync fleet vehicle ${item.plate || item.id}:`, err);
      }
    }
    
    console.log(`[CompanyResources] Fleet sync complete: ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  populateSelectField(selectEl, dataSource, selectedValue) {
    // Clear existing options
    selectEl.innerHTML = '<option value="">-- Select --</option>';
    
    // Load data from the specified source
    const sourceData = this.loadItemsFromSource(dataSource);
    
    sourceData.forEach(item => {
      const option = document.createElement('option');
      option.value = item.id;
      
      // Format display text based on data source
      if (dataSource === 'drivers') {
        option.textContent = `${item.first_name || ''} ${item.last_name || ''}`.trim() || `Driver ${item.id}`;
      } else if (dataSource === 'vehicle-types') {
        option.textContent = item.name || `Type ${item.id}`;
      } else if (dataSource === 'affiliates') {
        option.textContent = item.name || `Affiliate ${item.id}`;
      } else {
        option.textContent = item.name || item.label || item.id;
      }
      
      if (item.id === selectedValue) {
        option.selected = true;
      }
      
      selectEl.appendChild(option);
    });
  }

  loadItemsFromSource(dataSource) {
    const config = this.getSectionConfig(dataSource);

    // For vehicle-types, prefer remote API (no local persistence) when available
    if (dataSource === 'vehicle-types') {
      // If we have a cached copy from the API, return it immediately
      if (this.vehicleTypesCache && Array.isArray(this.vehicleTypesCache)) return this.vehicleTypesCache;

      // Kick off remote load if API is ready
      try {
        if (window.myOffice && window.myOffice.apiReady) {
          // Prefer reading from the base table for authenticated users; fall back to view if table read fails (RLS/permissions)
          (async () => {
            try {
              // Try table-first (requires authenticated privileges)
              const remoteTable = await fetchVehicleTypesTable({ includeInactive: true });
              if (Array.isArray(remoteTable)) {
                this.vehicleTypesCache = remoteTable;
                if (typeof this.renderCenter === 'function') this.renderCenter();
                if (typeof this.refreshAllSelectFields === 'function') this.refreshAllSelectFields();
                return;
              }
            } catch (errTable) {
              // Table read failed (likely RLS/permissions) - try public view
              try {
                const remoteView = await fetchVehicleTypes({ includeInactive: true });
                if (Array.isArray(remoteView)) {
                  this.vehicleTypesCache = remoteView;
                  if (typeof this.renderCenter === 'function') this.renderCenter();
                  if (typeof this.refreshAllSelectFields === 'function') this.refreshAllSelectFields();
                  return;
                }
              } catch (errView) {
                console.warn('[CompanyResources] Failed to load vehicle types from view after table failed:', errView);
              }

              console.warn('[CompanyResources] Failed to load vehicle types from table (likely permission/RLS issue):', errTable);
            }

            // If both approaches failed, fallback to local storage if present
            try {
              const existing = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
              this.vehicleTypesCache = Array.isArray(existing) ? existing : [];
            } catch (e) {
              this.vehicleTypesCache = [];
            }

            if (typeof this.renderCenter === 'function') this.renderCenter();
            if (typeof this.refreshAllSelectFields === 'function') this.refreshAllSelectFields();
          })();
    }

    return JSON.parse(localStorage.getItem(config.storageKey) || '[]');
  }

  validateSyncChange(fieldId, newValue) {
    if (!this.realTimeSyncEnabled) return;
    
    const config = this.getSectionConfig(this.currentSection);
    if (!config.syncFields || !config.syncFields.includes(fieldId)) return;
    
    // Show warning for sync-sensitive changes
    if (!this.syncWarningShown) {
      this.showSyncWarning(fieldId, newValue);
      this.syncWarningShown = true;
      
      // Reset warning flag after 5 seconds
      setTimeout(() => {
        this.syncWarningShown = false;
      }, 5000);
    }
    
    // Trigger real-time sync validation
    this.performRealTimeSync();
  }

  showSyncWarning(fieldId, newValue) {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'sync-warning-notification';
    warningDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      max-width: 350px;
      font-size: 14px;
      color: #856404;
    `;
    
    warningDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #d63031;">⚠️ Sync Update Warning</div>
      <div style="margin-bottom: 12px;">
        Changing <strong>${this.humanizeLabel(fieldId)}</strong> will update related records in Drivers, Vehicle Types, and Affiliates sections.
      </div>
      <div style="font-size: 12px; color: #636e72;">
        All sections will sync automatically. This ensures data consistency across the system.
      </div>
      <button onclick="this.parentElement.remove()" style="
        margin-top: 12px;
        background: #2d3436;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">Understood</button>
    `;
    
    // Remove existing warning if present
    const existing = document.getElementById('sync-warning-notification');
    if (existing) existing.remove();
    
    document.body.appendChild(warningDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (document.getElementById('sync-warning-notification')) {
        warningDiv.remove();
      }
    }, 10000);
  }

  performRealTimeSync() {
    // Prevent too frequent sync operations
    const now = Date.now();
    if (now - this.lastSyncCheck < 1000) return; // Debounce to 1 second
    this.lastSyncCheck = now;
    
    // Update all dependent dropdowns
    this.refreshAllSelectFields();
    
    // Update fleet assignments that reference changed data
    this.syncFleetAssignments();
    
    console.log('Real-time sync performed for Drivers, Vehicle Types, Affiliates, and Fleet');
  }

  refreshAllSelectFields() {
    // Refresh all select fields in the current form
    const form = this.els.formContent;
    if (!form) return;
    
    const selects = form.querySelectorAll('select[id^="field_"]');
    selects.forEach(select => {
      const fieldId = select.id.replace('field_', '');
      const field = this.findFieldById(fieldId);
      
      if (field && field.dataSource) {
        const currentValue = select.value;
        this.populateSelectField(select, field.dataSource, currentValue);
      }
    });
  }

  findFieldById(fieldId) {
    const config = this.getSectionConfig(this.currentSection);
    for (const block of config.blocks) {
      const field = block.fields.find(f => f.id === fieldId);
      if (field) return field;
    }
    return null;
  }

  syncFleetAssignments() {
    // Update fleet records to ensure all assignments are valid
    const fleetData = JSON.parse(localStorage.getItem('cr_fleet') || '[]');
    const driversData = JSON.parse(localStorage.getItem('cr_drivers') || '[]');
    const vehicleTypesData = JSON.parse(localStorage.getItem('cr_vehicle_types') || '[]');
    const affiliatesData = JSON.parse(localStorage.getItem('cr_affiliates') || '[]');
    
    const driverIds = new Set(driversData.map(d => d.id));
    const vehicleTypeIds = new Set(vehicleTypesData.map(vt => vt.id));
    const affiliateIds = new Set(affiliatesData.map(a => a.id));
    
    let syncUpdates = 0;
    
    fleetData.forEach(vehicle => {
      let updated = false;
      
      // Validate driver assignment
      if (vehicle.driver && !driverIds.has(vehicle.driver)) {
        vehicle.driver = '';
        updated = true;
        syncUpdates++;
      }
      
      // Validate vehicle type assignment
      if (vehicle.type && !vehicleTypeIds.has(vehicle.type)) {
        vehicle.type = '';
        updated = true;
        syncUpdates++;
      }
      
      // Validate affiliate assignment
      if (vehicle.affiliate && !affiliateIds.has(vehicle.affiliate)) {
        vehicle.affiliate = '';
        updated = true;
        syncUpdates++;
      }
    });
    
    if (syncUpdates > 0) {
      localStorage.setItem('cr_fleet', JSON.stringify(fleetData));
      console.log(`Synchronized ${syncUpdates} fleet assignments`);
      
      // Refresh the display if we're currently viewing fleet
      if (this.currentSection === 'fleet') {
        this.renderCenter();
      }
    }
  }

  showSyncNotification(action) {
    const notification = document.createElement('div');
    notification.id = 'sync-success-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10000;
      font-size: 14px;
      color: #155724;
      max-width: 300px;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">✅ Sync Complete</div>
      <div style="font-size: 12px;">
        ${this.getSectionConfig(this.currentSection).title} ${action}. All related sections synchronized.
      </div>
    `;
    
    // Remove existing notification
    const existing = document.getElementById('sync-success-notification');
    if (existing) existing.remove();
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (document.getElementById('sync-success-notification')) {
        notification.remove();
      }
    }, 3000);
  }

  showSyncNotification(action) {
    const notification = document.createElement('div');
    notification.id = 'sync-success-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 6px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10000;
      font-size: 14px;
      color: #155724;
      max-width: 300px;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">✅ Sync Complete</div>
      <div style="font-size: 12px;">
        ${this.getSectionConfig(this.currentSection).title} ${action}. All related sections synchronized.
      </div>
    `;
    
    // Remove existing notification
    const existing = document.getElementById('sync-success-notification');
    if (existing) existing.remove();
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (document.getElementById('sync-success-notification')) {
        notification.remove();
      }
    }, 3000);
  }
}
