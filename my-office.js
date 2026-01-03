// Import API service
import { setupAPI, fetchDrivers, createDriver, updateDriver, deleteDriver, fetchAffiliates, createAffiliate, updateAffiliate, deleteAffiliate, fetchVehicleTypes, upsertVehicleType, deleteVehicleType, fetchActiveVehicles } from './api-service.js';
import { wireMainNav } from './navigation.js';

class MyOffice {
  constructor() {
    this.currentSection = 'contact-info';
    this.currentPrefTab = 'general';
    this.currentDriver = null;
    this.currentAffiliate = null;
    this.currentSystemSettingsPage = 'service-types';
    this.currentResource = 'drivers';
    this.companySettingsManager = new CompanySettingsManager();
    this.drivers = [];
    this.affiliates = [];
    this.vehicleTypeSeeds = this.buildVehicleTypeSeeds();
    this.vehicleTypeDrafts = {};
    this.activeVehicleTypeId = null;
    this.vehicleTypeSelectionInitialized = false;
    this.vehicleTabsLocked = true;
    this.apiReady = false;
    this.fleetRecords = [];
    this.activeFleetId = null;
    this.fleetSelectionBound = false;
    this.fleetStorageKey = 'cr_fleet';
    this.users = [
      {
        id: '1',
        displayName: 'Amanda Brustad (amanda)',
        roleLabel: 'admin (site-admin)',
        username: 'amanda.brustad',
        status: 'active',
        firstName: 'Amanda',
        lastName: 'Brustad',
        email: 'amanda@erixmm.com',
        phone: '(763) 226-8230',
        login: 'admin',
        password: '••••••••••',
        sms: '',
      },
      {
        id: '2',
        displayName: 'Tom Smith (tsmith)',
        roleLabel: 'support (mod/analyst/support)',
        username: 'tsmith',
        status: 'active',
        firstName: 'Tom',
        lastName: 'Smith',
        email: 'tom@relialimo.demo',
        phone: '(555) 100-2000',
        login: 'user',
        password: '••••••••••',
        sms: '',
      }
    ];
    this.selectedUserId = this.users[0]?.id || null;
    this.userInputs = {};
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupCustomFormsInteraction();
    this.setupListManagementSidebar();
    this.setupMagicLinkHelpers();
    this.setupDriversForm();
    this.setupAffiliatesForm();
    this.setupSystemUsers();
    this.setupCompanyInfoForm();
    this.setupAccountsCalendarPrefs();
    this.setupVehicleTypeSelection();
    this.setupVehicleTypeSave();
    this.setupVehicleTypeTitleSync();
    this.setupVehicleRatesSave();
    this.setupVehicleTypeCreateDelete();
    this.populatePassengerCapacityOptions();
    this.initializeFleetSection();
    this.updateVehicleTypeTabLockState();
    this.renderLoggedInEmail();
    this.checkURLParameters();
    // Initialize API
    this.initializeAPI();
  }

  async initializeAPI() {
    try {
      await setupAPI();
      this.apiReady = true;
      console.log('API initialized successfully');
      await this.loadDriversList();
      await this.loadVehicleTypesList();
    } catch (error) {
      console.error('Failed to initialize API:', error);
    }
  }

  checkURLParameters() {
    // Check if URL has a tab parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab) {
      // Switch to the requested tab
      this.switchTab(tab);
    }
    

  }

  setupEventListeners() {
    // Back button (removed from UI but keeping check)
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    // New Reservation button (moved to window-actions)
    const newResBtn = document.querySelector('.btn-new-reservation');
    if (newResBtn) {
      newResBtn.addEventListener('click', () => {
        window.location.href = 'reservation-form.html';
      });
    }

    // Main navigation
    document.querySelectorAll('.main-nav .nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const section = e.currentTarget?.dataset?.section;
        if (!section) {
          return;
        }

        if (section === 'office') {
          return;
        }

        window.parent.postMessage({
          action: 'switchSection',
          section
        }, '*');
      });
    });

    // View buttons (window-actions)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget?.dataset?.action;
        if (!action) {
          return;
        }

        if (action === 'user-view') {
          window.location.href = 'index.html?view=user';
        } else if (action === 'driver-view') {
          window.location.href = 'index.html?view=driver';
        } else if (action === 'reservations') {
          window.location.href = 'reservations-list.html';
        } else if (action === 'farm-out') {
          window.location.href = 'index.html?view=reservations';
        } else if (action === 'new-reservation') {
          window.location.href = 'reservation-form.html';
        }
      });
    });

    // System Settings sub-navigation
    const systemSettingsSubnav = document.getElementById('systemSettingsSubnav');
    if (systemSettingsSubnav) {
      systemSettingsSubnav.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.sidebar-subbtn') : null;
        if (!btn || !btn.dataset.systemSetting) return;
        this.navigateToSection('system-settings');
        this.navigateToSystemSettingsPage(btn.dataset.systemSetting);
      });
    }

    // Company Settings sidebar navigation (Contact Info, Company Prefs, System Users, etc.)
    const companySettingsGroup = document.getElementById('companySettingsGroup');
    if (companySettingsGroup) {
      companySettingsGroup.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.sidebar-btn') : null;
        if (btn && btn.dataset.section) {
          const section = btn.dataset.section;
          console.log('Navigating to company settings section:', section);
          this.navigateToSection(section);
        }
      });
    }

    // Top tabs navigation (event delegation keeps dataset intact even when clicking nested spans/icons)
    const windowTabsBar = document.querySelector('.window-tabs');
    if (windowTabsBar) {
      windowTabsBar.addEventListener('click', (e) => {
        const target = e.target;
        const button = target instanceof Element ? target.closest('.window-tab') : null;
        if (!button || button.disabled) {
          return;
        }
        const tabName = button.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });

      windowTabsBar.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') {
          return;
        }
        const target = e.target;
        const button = target instanceof Element ? target.closest('.window-tab') : null;
        if (!button || button.disabled) {
          return;
        }
        e.preventDefault();
        const tabName = button.dataset.tab;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    }

    // Main navigation
        wireMainNav();

    // Company Preferences sub-navigation
    document.querySelectorAll('.prefs-subnav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prefTab = e.currentTarget?.dataset?.pref;
        if (prefTab) {
          this.switchPrefTab(prefTab);
        }
      });
    });

    // Company Resources navigation (sidebar)
    const companyResourcesGroup = document.getElementById('companyResourcesGroup');
    if (companyResourcesGroup) {
      companyResourcesGroup.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.sidebar-btn') : null;
        if (btn && btn.dataset.resource) {
          const resource = btn.dataset.resource;
          console.log('Navigating to resource:', resource);
          this.navigateToResource(resource);
        }
      });
    }

    const updateAccountsCalendarPrefsBtn = document.getElementById('updateAccountsCalendarPrefsBtn');
    if (updateAccountsCalendarPrefsBtn) {
      updateAccountsCalendarPrefsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveAccountsCalendarPrefs();
      });
    }

    // Company Resources horizontal tab navigation
    const resourceTabsContainer = document.querySelector('.resource-tabs');
    if (resourceTabsContainer) {
      resourceTabsContainer.addEventListener('click', (e) => {
        const target = e.target;
        const tab = target instanceof Element ? target.closest('.resource-tab') : null;
        if (tab && tab.dataset.resource) {
          const resource = tab.dataset.resource;
          console.log('Tab navigating to resource:', resource);
          this.navigateToResource(resource);
        }
      });
    }

    // Rate Management navigation
    // Rate Management navigation removed (vertical tabs hidden)

    // Rate type tabs
    document.querySelectorAll('.rate-type-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const rateType = e.currentTarget?.dataset?.rateType;
        if (rateType) {
          this.switchRateTypeForm(rateType);
        }
      });
    });

    // Promo tabs
    document.querySelectorAll('.promo-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const promoTab = e.currentTarget?.dataset?.promoTab;
        if (promoTab) {
          this.switchPromoTab(promoTab);
        }
      });
    });

    // Custom Form tabs
    document.querySelectorAll('.custom-form-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const formTab = e.currentTarget?.dataset?.tab;
        if (formTab) {
          this.switchCustomFormTab(formTab);
        }
      });
    });

    // Custom Form category buttons in sidebar
    const customFormsGroup = document.getElementById('customFormsGroup');
    if (customFormsGroup) {
      customFormsGroup.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.sidebar-btn') : null;
        if (btn && btn.dataset.customFormCategory) {
          const category = btn.dataset.customFormCategory;
          console.log('Switching to custom form category:', category);
          this.switchCustomFormCategory(category);
        }
      });
    }

    // List Management sidebar navigation
    const listManagementGroup = document.getElementById('listManagementGroup');
    if (listManagementGroup) {
      listManagementGroup.addEventListener('click', (e) => {
        const target = e.target;
        const btn = target instanceof Element ? target.closest('.sidebar-btn') : null;
        if (btn && btn.dataset.listSection) {
          const section = btn.dataset.listSection;
          console.log('Navigating to list section:', section);
          this.navigateToListSection(section);
        }
      });
    }

    // System Users - User selection
    // System Users - Permission tree toggle
    document.querySelectorAll('.permission-parent').forEach(parent => {
      parent.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) {
          return;
        }

        if (target.classList.contains('toggle-icon') || target.tagName === 'SPAN') {
          const group = parent.closest('.permission-group');
          const children = group.querySelector('.permission-children');
          const icon = parent.querySelector('.toggle-icon');
          
          if (children.style.display === 'none') {
            children.style.display = 'block';
            icon.textContent = '▼';
          } else {
            children.style.display = 'none';
            icon.textContent = '►';
          }
        }
      });
    });

    // Parent checkbox logic
    document.querySelectorAll('.permission-parent input[type="checkbox"]').forEach(parentCheckbox => {
      parentCheckbox.addEventListener('change', (e) => {
        const checkbox = e.currentTarget;
        const group = checkbox.closest('.permission-group');
        const childCheckboxes = group.querySelectorAll('.permission-children input[type="checkbox"]');
        childCheckboxes.forEach(child => {
          child.checked = checkbox.checked;
        });
      });
    });

    // Policies - Policy selection
    document.querySelectorAll('.policy-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const policyId = e.currentTarget.dataset.policyId;
        this.selectPolicy(policyId);
      });
    });

    // Policies - Policy tab switching
    document.querySelectorAll('.policy-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const policyType = e.currentTarget?.dataset?.policyType;
        if (policyType) {
          this.switchPolicyTab(policyType);
        }
      });
    });

    // HTML Editor - Toolbar buttons
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.dataset.command;
        if (command) {
          this.executeEditorCommand(command);
        }
      });
    });

    // HTML Editor - Font size
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        const select = e.currentTarget;
        document.execCommand('fontSize', false, select.value);
      });
    }

    // HTML Editor - Font name
    const fontNameSelect = document.getElementById('fontNameSelect');
    if (fontNameSelect) {
      fontNameSelect.addEventListener('change', (e) => {
        const select = e.currentTarget;
        document.execCommand('fontName', false, select.value);
      });
    }

    // Policies Editor - Trip Tags Button
    const insertTripTagsBtn = document.getElementById('insertTripTagsBtn');
    if (insertTripTagsBtn) {
      insertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('htmlEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Policies Editor - Rate Tags Button
    const insertRateTagsBtn = document.getElementById('insertRateTagsBtn');
    if (insertRateTagsBtn) {
      insertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('htmlEditor');
        window.openRateTagSelector(editor);
      });
    }



    // Messaging & Template Settings - Main Tabs
    document.querySelectorAll('.messaging-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget?.dataset?.msgTab;
        if (tabName) {
          this.switchMessagingTab(tabName);
        }
      });
    });

    // Messaging & Template Settings - Subsections
    document.querySelectorAll('.messaging-nav-subitem').forEach(subitem => {
      subitem.addEventListener('click', (e) => {
        const subsection = e.currentTarget?.dataset?.subsection;
        if (subsection) {
          this.switchMessagingSubsection(subsection);
        }
      });
    });

    // Online Reservations - Tabs
    document.querySelectorAll('.online-res-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget?.dataset?.onlineresTab;
        if (tabName) {
          this.switchOnlineResTab(tabName);
        }
      });
    });

    // Configuration Type - Email/SMS Switch
    const configTypeSelect = document.getElementById('configurationTypeSelect');
    if (configTypeSelect) {
      configTypeSelect.addEventListener('change', (e) => {
        const select = e.currentTarget;
        this.switchConfigurationType(select.value);
      });
    }

    // ReadBack Editor - Trip Tags Button
    const readbackInsertTripTagsBtn = document.getElementById('readbackInsertTripTagsBtn');
    if (readbackInsertTripTagsBtn) {
      readbackInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('readbackEditor');
        window.openTripTagSelector(editor);
      });
    }

    // ReadBack Editor - Rate Tags Button
    const readbackInsertRateTagsBtn = document.getElementById('readbackInsertRateTagsBtn');
    if (readbackInsertRateTagsBtn) {
      readbackInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('readbackEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Custom Forms Editor - Trip Tags Button
    const customFormInsertTripTagsBtn = document.getElementById('customFormInsertTripTagsBtn');
    if (customFormInsertTripTagsBtn) {
      customFormInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('customFormsEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Custom Forms Editor - Rate Tags Button
    const customFormInsertRateTagsBtn = document.getElementById('customFormInsertRateTagsBtn');
    if (customFormInsertRateTagsBtn) {
      customFormInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('customFormsEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Invoice Trip Block Editor - Trip Tags Button
    const invoiceTripInsertTripTagsBtn = document.getElementById('invoiceTripInsertTripTagsBtn');
    if (invoiceTripInsertTripTagsBtn) {
      invoiceTripInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('invoiceTripEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Invoice Trip Block Editor - Rate Tags Button
    const invoiceTripInsertRateTagsBtn = document.getElementById('invoiceTripInsertRateTagsBtn');
    if (invoiceTripInsertRateTagsBtn) {
      invoiceTripInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('invoiceTripEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Additional Pax Block Editor - Trip Tags Button
    // Use a more generic selector that works with data-editor-target
    document.querySelectorAll('.trip-tags-btn[data-editor-target]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const editorId = btn.dataset.editorTarget;
        const editor = document.getElementById(editorId);
        if (editor) {
          window.openTripTagSelector(editor);
        }
      });
    });

    // Location Template Editors - Trip Tags Buttons (5 location types)
    document.querySelectorAll('.location-trip-tags-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const editorId = btn.dataset.editor;
        const editor = document.getElementById(editorId);
        if (editor) {
          window.openTripTagSelector(editor);
        }
      });
    });

    // Scheduled Email Editor - Trip Tags Button
    const scheduledEmailInsertTripTagsBtn = document.getElementById('scheduledEmailInsertTripTagsBtn');
    if (scheduledEmailInsertTripTagsBtn) {
      scheduledEmailInsertTripTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('scheduledEmailEditor');
        window.openTripTagSelector(editor);
      });
    }

    // Scheduled Email Editor - Rate Tags Button
    const scheduledEmailInsertRateTagsBtn = document.getElementById('scheduledEmailInsertRateTagsBtn');
    if (scheduledEmailInsertRateTagsBtn) {
      scheduledEmailInsertRateTagsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = document.getElementById('scheduledEmailEditor');
        window.openRateTagSelector(editor);
      });
    }

    // Vehicle Type Tabs
    document.querySelectorAll('.vehicle-type-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.currentTarget?.dataset?.vtypeTab;
        if (tabName) {
          this.switchVehicleTypeTab(tabName);
        }
      });
    });

    const vehicleTypeEditBtn = document.getElementById('vehicleTypeEditBtn');
    if (vehicleTypeEditBtn) {
      vehicleTypeEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.unlockVehicleTypeTabs();
        this.switchVehicleTypeTab('edit');
      });
    }

    const vehicleRatesSaveBtn = document.getElementById('vehicleRatesSaveBtn');
    if (vehicleRatesSaveBtn) {
      vehicleRatesSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveVehicleRates();
      });
    }

    const passengerRatesSaveBtn = document.getElementById('passengerRatesSaveBtn');
    if (passengerRatesSaveBtn) {
      passengerRatesSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveVehicleRates();
      });
    }

    const distanceRatesSaveBtn = document.getElementById('distanceRatesSaveBtn');
    if (distanceRatesSaveBtn) {
      distanceRatesSaveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.saveVehicleRates();
      });
    }

    window.addEventListener('storage', (event) => {
      if (event.key === 'supabase_session') {
        this.renderLoggedInEmail();
      }
    });

    // Rates Subtabs
    document.querySelectorAll('.rates-subtab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const rateType = e.currentTarget?.dataset?.rateType;
        if (rateType) {
          this.switchRateType(rateType);
        }
      });
    });

    // Company Logo Upload
    this.setupLogoUpload();
  }

  setupLogoUpload() {
    const logoFileInput = document.getElementById('logoFileInput');
    const logoChooseBtn = document.getElementById('logoChooseBtn');
    const logoUploadBtn = document.getElementById('logoUploadBtn');
    const logoFileName = document.getElementById('logoFileName');
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const logoDeleteBtn = document.getElementById('logoDeleteBtn');

    console.log('🖼️ setupLogoUpload - Elements found:', {
      logoFileInput: !!logoFileInput,
      logoChooseBtn: !!logoChooseBtn,
      logoUploadBtn: !!logoUploadBtn,
      logoFileName: !!logoFileName,
      logoPreviewImg: !!logoPreviewImg,
      logoDeleteBtn: !!logoDeleteBtn
    });

    // Store the selected file for upload
    this.selectedLogoFile = null;

    // Choose File button opens file picker
    if (logoChooseBtn && logoFileInput) {
      logoChooseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🖼️ Choose File clicked');
        logoFileInput.click();
      });
    } else {
      console.warn('⚠️ Logo choose button or file input not found');
    }

    // When file is selected, show filename and preview
    if (logoFileInput) {
      logoFileInput.addEventListener('change', (e) => {
        const input = e.currentTarget;
        const file = input.files && input.files[0];
        if (file) {
          // Validate file type
          if (!file.type.match(/^image\/(jpeg|png)$/)) {
            alert('Please select a JPG or PNG image file.');
            input.value = '';
            return;
          }

          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            alert('Image file size must be less than 5MB.');
            input.value = '';
            return;
          }

          this.selectedLogoFile = file;
          if (logoFileName) {
            logoFileName.textContent = file.name;
          }

          // Show preview
          const reader = new FileReader();
          reader.onload = (event) => {
            if (logoPreviewImg) {
              logoPreviewImg.src = event.target.result;
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Upload button saves the logo to localStorage immediately
    if (logoUploadBtn) {
      logoUploadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.selectedLogoFile) {
          // Capture file reference before async operation
          const fileToUpload = this.selectedLogoFile;
          const fileName = fileToUpload.name;
          const fileType = fileToUpload.type;
          
          // Read file and store as base64 in localStorage
          const reader = new FileReader();
          reader.onload = (event) => {
            const logoData = {
              name: fileName,
              type: fileType,
              data: event.target.result
            };
            localStorage.setItem('companyLogo', JSON.stringify(logoData));
            
            // Also update the companyInfo with logo_url
            try {
              const companyInfo = JSON.parse(localStorage.getItem('companyInfo') || '{}');
              companyInfo.logo_url = event.target.result;
              localStorage.setItem('companyInfo', JSON.stringify(companyInfo));
            } catch (err) {
              console.warn('Could not update companyInfo with logo:', err);
            }
            
            alert('✅ Logo uploaded and saved successfully!');
            this.selectedLogoFile = null;
          };
          reader.readAsDataURL(this.selectedLogoFile);
        } else {
          alert('Please choose a file first.');
        }
      });
    }

    // Delete logo
    if (logoDeleteBtn) {
      logoDeleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to delete the company logo?')) {
          localStorage.removeItem('companyLogo');
          this.selectedLogoFile = null;
          if (logoFileName) {
            logoFileName.textContent = 'No file chosen';
          }
          if (logoFileInput) {
            logoFileInput.value = '';
          }
          // Reset to default placeholder
          if (logoPreviewImg) {
            logoPreviewImg.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100' viewBox='0 0 200 100'%3E%3Crect fill='%23000' width='200' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23fff' font-family='Arial' font-size='24' font-weight='bold'%3EERIX%3C/text%3E%3C/svg%3E";
          }
          alert('Logo deleted.');
        }
      });
    }

    // Load existing logo on page load
    this.loadSavedLogo();
  }

  loadSavedLogo() {
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const logoFileName = document.getElementById('logoFileName');
    
    const savedLogo = localStorage.getItem('companyLogo');
    if (savedLogo) {
      try {
        const logoData = JSON.parse(savedLogo);
        if (logoPreviewImg && logoData.data) {
          logoPreviewImg.src = logoData.data;
        }
        if (logoFileName && logoData.name) {
          logoFileName.textContent = logoData.name;
        }
      } catch (e) {
        console.error('Error loading saved logo:', e);
      }
    }
  }

  // ===================================
  // COMPANY INFORMATION FORM
  // ===================================

  setupCompanyInfoForm() {
    // Load existing company info on page load
    this.loadCompanyInfo();

    // Save button handler
    const saveBtn = document.getElementById('saveCompanyInfoBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveCompanyInfo();
      });
    }
  }

  async loadCompanyInfo() {
    try {
      // First try to load from Supabase
      const apiModule = await import('./api-service.js');
      const { supabase } = await apiModule.setupAPI();
      
      if (supabase) {
        const { data: org, error } = await supabase
          .from('organizations')
          .select('*')
          .limit(1)
          .single();

        if (!error && org) {
          this.populateCompanyInfoForm(org);
          // Also cache in localStorage
          localStorage.setItem('companyInfo', JSON.stringify(org));
          console.log('✅ Company info loaded from Supabase');
          return;
        }
      }
    } catch (e) {
      console.warn('Could not load from Supabase, trying localStorage:', e.message);
    }

    // Fallback to localStorage
    const cached = localStorage.getItem('companyInfo');
    if (cached) {
      try {
        const info = JSON.parse(cached);
        this.populateCompanyInfoForm(info);
        console.log('✅ Company info loaded from localStorage');
      } catch (e) {
        console.error('Error parsing cached company info:', e);
      }
    }
  }

  populateCompanyInfoForm(info) {
    const fields = {
      'companyName': info.name || '',
      'companyStreetAddress': info.street_address || info.address || '',
      'companyStreetAddress2': info.street_address_2 || '',
      'companyCity': info.city || '',
      'companyState': info.state || '',
      'companyZipCode': info.postal_code || '',
      'companyEin': info.ein || '',
      'companyCountry': info.country || 'US',
      'companyPrimaryPhone': info.phone || '',
      'companySecondaryPhone': info.secondary_phone || '',
      'companyFax': info.fax || '',
      'companyGeneralEmail': info.general_email || info.email || '',
      'companyReservationEmail': info.reservation_email || '',
      'companyQuoteEmail': info.quote_email || '',
      'companyBillingEmail': info.billing_email || '',
      'companyWebsite': info.website || ''
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = value;
    }

    // Checkbox
    const showEinCheckbox = document.getElementById('companyShowEinOnDocs');
    if (showEinCheckbox) {
      showEinCheckbox.checked = info.show_ein_on_docs || false;
    }
  }

  async saveCompanyInfo() {
    const info = {
      name: document.getElementById('companyName')?.value?.trim() || '',
      street_address: document.getElementById('companyStreetAddress')?.value?.trim() || '',
      street_address_2: document.getElementById('companyStreetAddress2')?.value?.trim() || '',
      city: document.getElementById('companyCity')?.value?.trim() || '',
      state: document.getElementById('companyState')?.value?.trim() || '',
      postal_code: document.getElementById('companyZipCode')?.value?.trim() || '',
      country: document.getElementById('companyCountry')?.value?.trim() || 'US',
      ein: document.getElementById('companyEin')?.value?.trim() || '',
      show_ein_on_docs: document.getElementById('companyShowEinOnDocs')?.checked || false,
      phone: document.getElementById('companyPrimaryPhone')?.value?.trim() || '',
      secondary_phone: document.getElementById('companySecondaryPhone')?.value?.trim() || '',
      fax: document.getElementById('companyFax')?.value?.trim() || '',
      general_email: document.getElementById('companyGeneralEmail')?.value?.trim() || '',
      reservation_email: document.getElementById('companyReservationEmail')?.value?.trim() || '',
      quote_email: document.getElementById('companyQuoteEmail')?.value?.trim() || '',
      billing_email: document.getElementById('companyBillingEmail')?.value?.trim() || '',
      website: document.getElementById('companyWebsite')?.value?.trim() || '',
      // Also set email to general_email for backwards compatibility
      email: document.getElementById('companyGeneralEmail')?.value?.trim() || '',
      // Also set address to street_address for backwards compatibility
      address: document.getElementById('companyStreetAddress')?.value?.trim() || '',
      updated_at: new Date().toISOString()
    };

    if (!info.name) {
      alert('Company Name is required.');
      return;
    }

    // Save to localStorage immediately
    localStorage.setItem('companyInfo', JSON.stringify(info));

    // Try to save to Supabase
    try {
      const apiModule = await import('./api-service.js');
      const supabase = await apiModule.setupAPI();
      if (!supabase) throw new Error('Supabase client unavailable');

      if (typeof apiModule.ensureValidToken === 'function') {
        const tokenOk = await apiModule.ensureValidToken(supabase);
        if (!tokenOk) {
          alert('⚠️ Session expired. Saved locally. Please sign in again, then retry to sync.');
          return;
        }
      }

      const { data: existingRows, error: fetchError } = await supabase
        .from('organizations')
        .select('id')
        .limit(1);

      if (fetchError) throw fetchError;

      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      if (existing?.id) {
        const { error } = await supabase
          .from('organizations')
          .update(info)
          .eq('id', existing.id);

        if (error) throw error;
        console.log('✅ Company info updated in Supabase');
      } else {
        const { error } = await supabase
          .from('organizations')
          .insert([{ ...info, created_at: new Date().toISOString() }]);

        if (error) throw error;
        console.log('✅ Company info created in Supabase');
      }

      alert('✅ Company information saved locally and synced to cloud.');
      return;
    } catch (e) {
      console.error('Error saving to Supabase:', e);
      const needsLogin = /jwt expired/i.test(e?.message || '') || /expired/i.test(e?.message || '');
      if (needsLogin) {
        alert('⚠️ Saved locally. Session expired—please sign in again, then click save to sync.');
      } else {
        alert('⚠️ Saved locally. Could not sync to cloud: ' + (e?.message || e));
      }
      return;
    }
  }

  setupSystemUsers() {
    this.cacheUserInputs();
    this.renderUserList();
    this.bindUserButtons();
    if (this.selectedUserId) {
      this.selectUser(this.selectedUserId);
    }
  }

  cacheUserInputs() {
    this.userInputs = {
      username: document.getElementById('userUsername'),
      status: document.getElementById('userStatus'),
      firstName: document.getElementById('userFirstName'),
      lastName: document.getElementById('userLastName'),
      email: document.getElementById('userEmail'),
      phone: document.getElementById('userPhone'),
      login: document.getElementById('userLogin'),
      password: document.getElementById('userPassword'),
      sms: document.getElementById('userSms'),
    };
  }

  bindUserButtons() {
    const addUserBtn = document.getElementById('addUserBtn');
    const addUserFooterBtn = document.getElementById('addUserFooterBtn');
    const showAllUsersBtn = document.getElementById('showAllUsersBtn');
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    const saveUserBtn = document.getElementById('saveUserBtn');
    const cancelUserBtn = document.getElementById('cancelUserBtn');

    [addUserBtn, addUserFooterBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.createUser();
        });
      }
    });

    if (showAllUsersBtn) {
      showAllUsersBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.renderUserList();
        if (this.selectedUserId) {
          this.selectUser(this.selectedUserId);
        }
      });
    }

    if (deleteUserBtn) {
      deleteUserBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.deleteSelectedUser();
      });
    }

    if (saveUserBtn) {
      saveUserBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveSelectedUser();
      });
    }

    if (cancelUserBtn) {
      cancelUserBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.selectedUserId) {
          this.populateUserDetails(this.selectedUserId);
        }
      });
    }
  }

  renderUserList() {
    const list = document.querySelector('.users-list');
    if (!list) return;

    list.innerHTML = '';
    this.users.forEach(user => {
      const item = document.createElement('div');
      item.className = 'user-item';
      item.dataset.userId = user.id;
      if (user.id === this.selectedUserId) {
        item.classList.add('active');
      }

      const nameDiv = document.createElement('div');
      nameDiv.className = 'user-item-name';
      nameDiv.textContent = user.displayName;

      const roleDiv = document.createElement('div');
      roleDiv.className = 'user-item-role';
      roleDiv.textContent = user.roleLabel;

      item.appendChild(nameDiv);
      item.appendChild(roleDiv);
      item.addEventListener('click', () => this.selectUser(user.id));
      list.appendChild(item);
    });

    if (this.users.length === 0) {
      this.showUserEmptyState();
    }
  }

  navigateToSection(section) {
    // Update sidebar active state (only within Company Settings group)
    document.querySelectorAll('#companySettingsGroup .sidebar-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.section === section) {
        btn.classList.add('active');
      }
    });

    // Toggle System Settings sub-navigation visibility
    const systemSettingsSubnav = document.getElementById('systemSettingsSubnav');
    if (systemSettingsSubnav) {
      systemSettingsSubnav.style.display = section === 'system-settings' ? 'block' : 'none';
    }

    // Update content sections - hide all first
    document.querySelectorAll('.office-section').forEach(sec => {
      sec.classList.remove('active');
      sec.style.display = 'none';
    });

    // Reset rate-manager layout padding when leaving that view
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.classList.remove('rate-manager-active');
    }

    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block'; // Explicitly show this section
      this.currentSection = section;
      
      console.log('Showing section:', section, sectionElement);
      
      // Reinitialize drag-drop for newly visible editors
      if (window.reinitializeDragDrop) {
        window.reinitializeDragDrop();
      }

      // Reinitialize editor view switchers
      if (window.reinitializeEditorViewSwitchers) {
        window.reinitializeEditorViewSwitchers();
      }

      if (section === 'system-settings') {
        this.navigateToSystemSettingsPage(this.currentSystemSettingsPage || 'service-types');
      }
    } else {
      // If section doesn't exist yet, show placeholder
      console.error('Section not found:', `${section}-section`);
      alert(`${section} section is under construction`);
    }
  }

  navigateToSystemSettingsPage(page) {
    const pageMap = {
      'service-types': 'service-types.html',
      'partner-settings': null,
      'system-mapping': 'system-mapping.html',
      'data-reduction': null,
      'electronic-fax': null,
      'sms-provider': 'sms-provider.html',
      'email-settings': 'email-settings.html',
      'limoanywhere-pay': null,
      'digital-marketing': null,
      'appearance': 'appearance.html',
      'utilities': 'utilities.html?v=' + Date.now(),
      'test-checklist': 'full-site-test-checklist.html',
      'supabase-integration-test': 'test-supabase-integration.html',
    };

    const subnav = document.getElementById('systemSettingsSubnav');
    if (subnav) {
      subnav.querySelectorAll('.sidebar-subbtn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.systemSetting === page);
      });
    }

    let target = pageMap[page];
    if (!target) {
      const friendlyName = (page || 'System Setting').replace(/-/g, ' ');
      alert(`${friendlyName} page is under construction`);
      page = 'service-types';
      target = pageMap[page];

      if (subnav) {
        subnav.querySelectorAll('.sidebar-subbtn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.systemSetting === page);
        });
      }
    }

    this.currentSystemSettingsPage = page;

    const iframe = document.querySelector('#system-settings-section iframe');
    if (iframe && target) {
      iframe.src = target;
    }
  }



  switchTab(tabName) {
    if (!tabName) {
      return;
    }

    document.querySelectorAll('.window-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    const normalLayout = document.getElementById('normalLayout');
    const resourcesContainer = document.getElementById('companyResourcesContainer');
    const customFormsSection = document.getElementById('custom-forms-section');
    const sidebarGroups = {
      'company-settings': document.getElementById('companySettingsGroup'),
      'rate-management': document.getElementById('rateManagementGroup'),
      'list-management': document.getElementById('listManagementGroup'),
      'custom-forms': document.getElementById('customFormsGroup'),
    };

    if (normalLayout) normalLayout.style.display = 'none';
    if (resourcesContainer) resourcesContainer.style.display = 'none';
    if (customFormsSection) customFormsSection.style.display = 'none';

    Object.values(sidebarGroups).forEach(group => {
      if (group) group.style.display = 'none';
    });

    switch (tabName) {
      case 'company-settings':
        if (normalLayout) normalLayout.style.display = 'block';
        if (sidebarGroups['company-settings']) sidebarGroups['company-settings'].style.display = 'block';
        this.navigateToSection(this.currentSection || 'contact-info');
        break;
      case 'company-resources':
        if (resourcesContainer) resourcesContainer.style.display = 'block';
        this.navigateToResource(this.currentResource || 'drivers');
        break;
      case 'rate-management':
        if (normalLayout) normalLayout.style.display = 'block';
        if (sidebarGroups['rate-management']) sidebarGroups['rate-management'].style.display = 'block';
        this.navigateToRateSection('system-rate-manager');
        break;
      case 'list-management':
        if (normalLayout) normalLayout.style.display = 'block';
        if (sidebarGroups['list-management']) sidebarGroups['list-management'].style.display = 'block';
        this.navigateToListSection('payment-methods');
        break;
      case 'custom-forms':
        if (customFormsSection) customFormsSection.style.display = 'block';
        if (sidebarGroups['custom-forms']) sidebarGroups['custom-forms'].style.display = 'block';
        break;
      default:
        if (normalLayout) normalLayout.style.display = 'block';
        if (sidebarGroups['company-settings']) sidebarGroups['company-settings'].style.display = 'block';
        this.navigateToSection('contact-info');
        break;
    }

    if (window.reinitializeDragDrop) {
      window.reinitializeDragDrop();
    }

    if (window.reinitializeEditorViewSwitchers) {
      window.reinitializeEditorViewSwitchers();
    }

    this.currentTab = tabName;
  }

  switchPrefTab(prefTab) {
    // Update pref tab active state
    document.querySelectorAll('.prefs-subnav-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.pref === prefTab) {
        btn.classList.add('active');
      }
    });

    // Update content sections
    document.querySelectorAll('.prefs-content').forEach(content => {
      content.classList.remove('active');
    });

    const contentElement = document.getElementById(`${prefTab}-prefs`);
    if (contentElement) {
      contentElement.classList.add('active');
      this.currentPrefTab = prefTab;
    }
  }

  setupAccountsCalendarPrefs() {
    this.loadAccountsCalendarPrefs();
  }

  loadAccountsCalendarPrefs() {
    try {
      const settings = this.companySettingsManager?.getAllSettings?.() || {};
      const startInput = document.getElementById('confirmationNumberStart');
      const defaultStart = 100000;
      const storedStart = parseInt(settings.confirmationStartNumber, 10);
      const startValue = !isNaN(storedStart) && storedStart > 0 ? storedStart : defaultStart;

      if (startInput) {
        startInput.value = startValue;
        startInput.placeholder = startValue.toString();
      }

      const tickerCityInput = document.getElementById('tickerSearchCity');
      if (tickerCityInput) {
        tickerCityInput.value = settings.tickerSearchCity || '';
      }
    } catch (error) {
      console.error('Failed to load accounts/calendar prefs:', error);
    }
  }

  saveAccountsCalendarPrefs() {
    try {
      const startInput = document.getElementById('confirmationNumberStart');
      const rawStart = startInput?.value?.trim();
      let startValue = parseInt(rawStart, 10);
      const defaultStart = 100000;
      if (isNaN(startValue) || startValue <= 0) {
        startValue = defaultStart;
      }

      const existingSettings = this.companySettingsManager?.getAllSettings?.() || {};
      const existingLastUsedRaw = existingSettings.lastUsedConfirmationNumber;
      const existingLastUsed = parseInt(existingLastUsedRaw, 10);
      const normalizedLastUsed = isNaN(existingLastUsed) ? null : existingLastUsed;
      const adjustedLastUsed = Math.max(normalizedLastUsed ?? (startValue - 1), startValue - 1);

      const tickerCityInput = document.getElementById('tickerSearchCity');
      const tickerCity = tickerCityInput?.value?.trim() || '';

      this.companySettingsManager?.updateSettings({
        confirmationStartNumber: startValue,
        lastUsedConfirmationNumber: adjustedLastUsed,
        tickerSearchCity: tickerCity
      });

      alert('Company preferences updated.');
    } catch (error) {
      console.error('Failed to save accounts/calendar prefs:', error);
      alert('Could not save preferences. Please try again.');
    }
  }

  selectUser(userId) {
    const user = this.users.find(u => u.id === userId);
    this.selectedUserId = userId;

    if (!user) {
      this.showUserEmptyState();
      return;
    }

    // Update user list active state
    document.querySelectorAll('.user-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.userId === userId) {
        item.classList.add('active');
      }
    });

    this.populateUserDetails(userId);
  }

  populateUserDetails(userId) {
    const user = this.users.find(u => u.id === userId);
    const detailsContent = document.querySelector('.user-details-content');
    const emptyState = document.getElementById('userEmptyState');

    if (!user || !detailsContent || !emptyState) return;

    detailsContent.style.display = 'block';
    emptyState.style.display = 'none';

    const { username, status, firstName, lastName, email, phone, login, password, sms } = this.userInputs;

    if (username) username.value = user.username;
    if (status) status.value = user.status;
    if (firstName) firstName.value = user.firstName;
    if (lastName) lastName.value = user.lastName;
    if (email) email.value = user.email;
    if (phone) phone.value = user.phone;
    if (login) login.value = user.login;
    if (password) password.value = user.password;
    if (sms) sms.value = user.sms || '';
  }

  createUser() {
    const newId = `${Date.now()}`;
    const newUser = {
      id: newId,
      displayName: 'New User',
      roleLabel: 'role pending',
      username: '',
      status: 'active',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      login: 'user',
      password: '',
      sms: '',
    };

    this.users.push(newUser);
    this.selectedUserId = newId;
    this.renderUserList();
    this.populateUserDetails(newId);
  }

  saveSelectedUser() {
    if (!this.selectedUserId) return;
    const user = this.users.find(u => u.id === this.selectedUserId);
    if (!user) return;

    const { username, status, firstName, lastName, email, phone, login, password, sms } = this.userInputs;

    user.username = username?.value || '';
    user.status = status?.value || 'active';
    user.firstName = firstName?.value || '';
    user.lastName = lastName?.value || '';
    user.email = email?.value || '';
    user.phone = phone?.value || '';
    user.login = login?.value || 'user';
    user.password = password?.value || '';
    user.sms = sms?.value || '';
    user.displayName = user.firstName || user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : 'New User';
    user.displayName += user.username ? ` (${user.username})` : '';
    user.roleLabel = user.login === 'admin' ? 'admin' : user.login;

    this.renderUserList();
    this.selectUser(user.id);
  }

  deleteSelectedUser() {
    if (!this.selectedUserId) return;

    this.users = this.users.filter(u => u.id !== this.selectedUserId);
    if (this.users.length === 0) {
      this.selectedUserId = null;
      this.showUserEmptyState();
      this.renderUserList();
      return;
    }

    this.selectedUserId = this.users[0].id;
    this.renderUserList();
    this.selectUser(this.selectedUserId);
  }

  showUserEmptyState() {
    const detailsContent = document.querySelector('.user-details-content');
    const emptyState = document.getElementById('userEmptyState');

    if (detailsContent) {
      detailsContent.style.display = 'none';
    }

    if (emptyState) {
      emptyState.style.display = 'block';
    }
  }

  selectPolicy(policyId) {
    // Update policy list active state
    document.querySelectorAll('.policy-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.policyId === policyId) {
        item.classList.add('active');
      }
    });

    // In a real app, you would load the policy's data here
    console.log('Selected policy:', policyId);
  }

  switchPolicyTab(policyType) {
    // Update tab active state
    document.querySelectorAll('.policy-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.policyType === policyType) {
        tab.classList.add('active');
      }
    });

    console.log('Switched to policy type:', policyType);
  }

  executeEditorCommand(command) {
    const editor = document.getElementById('htmlEditor');
    
    if (command === 'createLink') {
      const url = prompt('Enter the URL:');
      if (url) {
        document.execCommand(command, false, url);
      }
    } else {
      document.execCommand(command, false, null);
    }
    
    // Return focus to editor
    editor.focus();
  }



  switchMessagingTab(tabName) {
    // Update tab active state
    document.querySelectorAll('.messaging-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.msgTab === tabName) {
        tab.classList.add('active');
      }
    });

    // Show/hide the left sidebar navigation based on tab
    const navPanel = document.getElementById('standardSettingsNav');
    const contentWrapper = document.querySelector('.messaging-content-wrapper');
    
    if (tabName === 'standard-settings') {
      // Show sidebar for Standard Settings
      if (navPanel) navPanel.style.display = 'flex';
      if (contentWrapper) contentWrapper.classList.remove('full-width');
    } else {
      // Hide sidebar for Email Res Manifest and Scheduled Messaging
      if (navPanel) navPanel.style.display = 'none';
      if (contentWrapper) contentWrapper.classList.add('full-width');
    }

    // Update tab content
    document.querySelectorAll('.messaging-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    let contentId = '';
    if (tabName === 'standard-settings') {
      contentId = 'standardSettingsContent';
    } else if (tabName === 'email-manifest') {
      contentId = 'emailManifestContent';
    } else if (tabName === 'scheduled-messaging') {
      contentId = 'scheduledMessagingContent';
    }

    const contentElement = document.getElementById(contentId);
    if (contentElement) {
      contentElement.classList.add('active');
    }
  }

  switchMessagingSubsection(subsection) {
    // Update subitem active state
    document.querySelectorAll('.messaging-nav-subitem').forEach(subitem => {
      subitem.classList.remove('active');
      if (subitem.dataset.subsection === subsection) {
        subitem.classList.add('active');
      }
    });

    // Update subsection content
    document.querySelectorAll('.messaging-subsection').forEach(content => {
      content.classList.remove('active');
    });

    let subsectionId = '';
    if (subsection === 'general') {
      subsectionId = 'generalSubsection';
    } else if (subsection === 'email-header') {
      subsectionId = 'emailHeaderSubsection';
    } else if (subsection === 'invoices') {
      subsectionId = 'invoicesSubsection';
    } else if (subsection === 'notifications') {
      subsectionId = 'notificationsSubsection';
    } else if (subsection === 'document-mapping') {
      subsectionId = 'documentMappingSubsection';
    } else if (subsection === 'sms') {
      subsectionId = 'smsSubsection';
    }

    const subsectionElement = document.getElementById(subsectionId);
    if (subsectionElement) {
      subsectionElement.classList.add('active');
    }
  }

  switchOnlineResTab(tabName) {
    // Update tab active state
    document.querySelectorAll('.online-res-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.onlineresTab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.online-res-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    let contentId = '';
    if (tabName === 'settings') {
      contentId = 'onlineResSettingsContent';
    } else if (tabName === 'website') {
      contentId = 'onlineResWebsiteContent';
    } else if (tabName === 'widgets') {
      contentId = 'onlineResWidgetsContent';
    } else if (tabName === 'design') {
      contentId = 'onlineResDesignContent';
    } else if (tabName === 'analytics') {
      contentId = 'onlineResAnalyticsContent';
    } else if (tabName === 'rules') {
      contentId = 'onlineResRulesContent';
    }

    const contentElement = document.getElementById(contentId);
    if (contentElement) {
      contentElement.classList.add('active');
    }
  }

  switchConfigurationType(type) {
    const emailLayout = document.getElementById('emailConfigLayout');
    const smsLayout = document.getElementById('smsConfigLayout');

    if (type === 'email') {
      if (emailLayout) emailLayout.style.display = 'grid';
      if (smsLayout) smsLayout.style.display = 'none';
    } else if (type === 'sms') {
      if (emailLayout) emailLayout.style.display = 'none';
      if (smsLayout) smsLayout.style.display = 'grid';
    } else if (type === 'both') {
      // Show both or handle as needed
      if (emailLayout) emailLayout.style.display = 'grid';
      if (smsLayout) smsLayout.style.display = 'none';
    }
  }

  navigateToResource(resource) {
    this.currentResource = resource || 'drivers';

    // Update resource navigation button active state
    const resourceButtons = document.querySelectorAll('#companyResourcesGroup .sidebar-btn');
    resourceButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.resource === resource) {
        btn.classList.add('active');
      }
    });

    // Update horizontal resource tabs
    document.querySelectorAll('.resource-tab').forEach(tab => {
      tab.style.borderBottomColor = 'transparent';
      tab.style.fontWeight = 'normal';
      if (tab.dataset.resource === resource) {
        tab.style.borderBottomColor = '#007bff';
        tab.style.fontWeight = '500';
      }
    });

    // Show the company resources container
    const resourcesContainer = document.getElementById('companyResourcesContainer');
    if (resourcesContainer) {
      resourcesContainer.style.display = 'block';
    }

    // Hide all resource sections within the container
    document.querySelectorAll('.resource-section').forEach(section => {
      section.style.display = 'none';
    });

    // Show the appropriate resource section
    let sectionId = '';
    if (resource === 'drivers') {
      sectionId = 'drivers-section';
    } else if (resource === 'affiliates') {
      sectionId = 'affiliates-section';
    } else if (resource === 'agents') {
      sectionId = 'agents-section';
    } else if (resource === 'vehicle-types') {
      sectionId = 'vehicle-types-section';
    } else if (resource === 'fleet') {
      sectionId = 'fleet-section';
    } else if (resource === 'airports') {
      sectionId = 'airports-section';
    } else if (resource === 'airlines') {
      sectionId = 'airlines-section';
    } else if (resource === 'fbo') {
      sectionId = 'fbo-section';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.style.display = 'block';
      
      // Load data for the section
      if (resource === 'affiliates') {
        this.loadAffiliatesList();
      } else if (resource === 'fleet') {
        this.renderFleetList();
      }
    } else {
      // Show placeholder for not-yet-implemented resources
      alert(`${resource} section is under construction`);
      // Keep showing drivers by default
      const driversSection = document.getElementById('drivers-section');
      if (driversSection) {
        driversSection.style.display = 'block';
      }
    }

    // Setup Fleet item selection
    this.setupFleetItemSelection();
    
    // Setup Airports item selection
    this.setupAirportsItemSelection();
    
    // Setup Airlines item selection
    this.setupAirlinesItemSelection();
    
    // Setup FBO item selection
    this.setupFBOItemSelection();

    // Listen for messages from parent window
    window.addEventListener('message', (event) => {
      if (event.data.action === 'navigateToSystemSettings') {
        // First switch to company-settings tab
        this.switchTab('company-settings');
        // Then navigate to system-settings section
        this.navigateToSection('system-settings');

        // Update the iframe src if specific page is requested
        if (event.data.page) {
          this.navigateToSystemSettingsPage(event.data.page);
        }
      }
    });
  }

  buildVehicleTypeSeeds() {
    const seeds = [
      {
        id: '1',
        name: "BLACK SUV (BLACKSUV) (20' PAX VAN)",
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '10',
        color_hex: '#000000',
        service_type: 'hourly',
        accessible: false,
        description: 'High-capacity black SUV configured for larger groups and event shuttles.'
      },
      {
        id: '2',
        name: 'BLACK SUV (BLACKSUV)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '6',
        luggage_capacity: '6',
        color_hex: '#1f2933',
        service_type: 'airport',
        accessible: false,
        description: 'Executive black SUV ideal for airport transfers and corporate travel.'
      },
      {
        id: '3',
        name: '6 Passenger SUV (6_SUV)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '6',
        luggage_capacity: '6',
        color_hex: '#2c3e50',
        service_type: 'airport',
        accessible: false,
        description: 'Six passenger SUV with premium seating and luggage space for business travelers.'
      },
      {
        id: '4',
        name: '7 Passenger Suv (7 PASSENGER SUV)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '7',
        luggage_capacity: '8',
        color_hex: '#3d4852',
        service_type: 'hourly',
        accessible: false,
        description: 'Seven passenger configuration perfect for family travel and roadshows.'
      },
      {
        id: '5',
        name: '30 Passenger Coach (30_PAX_COACH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '10',
        color_hex: '#4a5568',
        service_type: 'hourly',
        accessible: true,
        description: 'Mid-size coach with onboard amenities for group charters and corporate outings.'
      },
      {
        id: '6',
        name: 'Fifteen Passenger Sprinter Van (15PAXSPRCH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '8',
        color_hex: '#2d3748',
        service_type: 'airport',
        accessible: true,
        description: 'Sprinter van with perimeter seating and premium lighting for shuttle service.'
      },
      {
        id: '7',
        name: 'Ford Transit (13 PAX BUS)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '12',
        luggage_capacity: '8',
        color_hex: '#1a202c',
        service_type: 'hourly',
        accessible: true,
        description: 'Modern Ford Transit with configurable seating and luggage racks.'
      },
      {
        id: '8',
        name: 'Mercedes Sprinter- Perimeter Seating (SPRINTER_LIMO)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '6',
        color_hex: '#111827',
        service_type: 'hourly',
        accessible: false,
        description: 'Luxury Mercedes Sprinter with limo-style perimeter seating and media center.'
      },
      {
        id: '9',
        name: '14 passenger Mercedes Sprinter par seating (SPRINTER)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '6',
        color_hex: '#0f172a',
        service_type: 'airport',
        accessible: false,
        description: 'Passenger configured Sprinter ideal for hospitality and airport shuttle work.'
      },
      {
        id: '10',
        name: '14 Pax (BLACK_CAR)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '6',
        color_hex: '#1f2937',
        service_type: 'point',
        accessible: false,
        description: 'Stretch black car suited for VIP group transfers and special occasions.'
      },
      {
        id: '11',
        name: '23MidSize Coach (23MIDSIZE2COACH)',
        status: 'inactive',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '10',
        color_hex: '#2f3e4e',
        service_type: 'hourly',
        accessible: true,
        description: 'Mid-size coach reserved for seasonal charters and group events.'
      },
      {
        id: '12',
        name: '24MidSize Coach (25 MID SIZED COACH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '10',
        color_hex: '#374151',
        service_type: 'hourly',
        accessible: true,
        description: 'Comfort coach with reclining seats and onboard WiFi for tours.'
      },
      {
        id: '13',
        name: '40 PASSENGER COACH (40PAX COACH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '14',
        luggage_capacity: '10',
        color_hex: '#4b5563',
        service_type: 'hourly',
        accessible: true,
        description: 'Full-size coach supporting company outings and event transportation.'
      },
      {
        id: '14',
        name: 'Executive Sedan',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '4',
        luggage_capacity: '4',
        color_hex: '#000000',
        service_type: 'airport',
        accessible: false,
        description: 'Premium sedan for executive transfers and chauffeured service.'
      },
      {
        id: '15',
        name: 'Navigator (SUV_STRETCH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '8',
        luggage_capacity: '6',
        color_hex: '#101418',
        service_type: 'point',
        accessible: false,
        description: 'Stretch Navigator featuring leather seating and media controls.'
      },
      {
        id: '16',
        name: 'Sedan Stretch (S_STRETCH)',
        status: 'active',
        pricing_basis: 'hours',
        passenger_capacity: '8',
        luggage_capacity: '6',
        color_hex: '#1a202c',
        service_type: 'point',
        accessible: false,
        description: 'Classic stretch sedan for weddings, prom, and red carpet events.'
      }
    ];

    return seeds.reduce((acc, seed) => {
      acc[seed.id] = seed;
      return acc;
    }, {});
  }

  setupVehicleTypeSelection() {
    if (this.vehicleTypeSelectionInitialized) {
      return;
    }

    const list = document.getElementById('vehicleTypeList');
    if (!list) {
      return;
    }

    this.vehicleTypeSelectionInitialized = true;

    list.addEventListener('click', (event) => {
      const element = event.target instanceof Element ? event.target.closest('.vehicle-type-item') : null;
      if (!element || !element.dataset.vehicleId) {
        return;
      }

      const vehicleId = element.dataset.vehicleId;

      if (this.activeVehicleTypeId && this.activeVehicleTypeId !== vehicleId) {
        this.captureVehicleTypeForm(this.activeVehicleTypeId);
      }

      list.querySelectorAll('.vehicle-type-item').forEach(item => item.classList.remove('active'));
      element.classList.add('active');

      this.lockVehicleTypeTabs();
      this.populateVehicleTypeForm(vehicleId);
    });

    const initialItem = list.querySelector('.vehicle-type-item.active') || list.querySelector('.vehicle-type-item');
    if (initialItem && initialItem.dataset.vehicleId) {
      initialItem.classList.add('active');
      this.lockVehicleTypeTabs();
      this.populateVehicleTypeForm(initialItem.dataset.vehicleId);
    }
  }

  setupVehicleTypeSave() {
    const saveBtn = document.getElementById('vehicleTypeSaveBtn');
    if (!saveBtn) return;
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const vehicleId = this.activeVehicleTypeId;
      if (!vehicleId) return;
      const draft = this.captureVehicleTypeForm(vehicleId);
      this.persistVehicleTypeDraft(vehicleId, draft);

      try {
        if (!this.apiReady) throw new Error('API not ready');
        const saved = await upsertVehicleType(draft);
        if (saved?.id) {
          this.vehicleTypeSeeds[saved.id] = saved;
          this.vehicleTypeDrafts[saved.id] = saved;
          this.refreshVehicleTypeList(saved.id, saved.name);
        }
        alert('Vehicle Type saved to Supabase.');
      } catch (error) {
        console.error('Vehicle Type save failed, kept locally:', error);
        alert('Saved locally. Supabase save failed.');
      }
    });
  }

  setupVehicleTypeTitleSync() {
    const titleInput = document.querySelector('[data-vehicle-field="name"]');
    if (!titleInput) return;

    titleInput.addEventListener('input', () => {
      if (!this.activeVehicleTypeId) return;
      const name = titleInput.value.trim() || 'Untitled Vehicle Type';
      const list = document.getElementById('vehicleTypeList');
      const item = list ? list.querySelector(`.vehicle-type-item[data-vehicle-id="${this.activeVehicleTypeId}"]`) : null;
      if (item) {
        item.textContent = name;
      }
      if (this.vehicleTypeSeeds[this.activeVehicleTypeId]) {
        this.vehicleTypeSeeds[this.activeVehicleTypeId].name = name;
      }
      if (this.vehicleTypeDrafts[this.activeVehicleTypeId]) {
        this.vehicleTypeDrafts[this.activeVehicleTypeId].name = name;
      }
    });
  }

  setupVehicleTypeCreateDelete() {
    const addBtn = document.getElementById('vehicleTypeAddBtn');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = 'true';
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.createNewVehicleType();
      });
    }

    const deleteBtn = document.getElementById('vehicleTypeDeleteBtn');
    if (deleteBtn && !deleteBtn.dataset.bound) {
      deleteBtn.dataset.bound = 'true';
      deleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.handleVehicleTypeDelete();
      });
    }
  }

  populatePassengerCapacityOptions() {
    const select = document.querySelector('[data-vehicle-field="passenger_capacity"]');
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select capacity';
    select.appendChild(placeholder);

    for (let count = 2; count <= 55; count += 1) {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = String(count);
      select.appendChild(option);
    }

    if (previous && select.querySelector(`option[value="${previous}"]`)) {
      select.value = previous;
    } else {
      select.value = '2';
    }
  }

  setupVehicleRatesSave() {
    // Placeholder hook if future wiring is needed; listener is attached during setupEventListeners.
  }

  renderLoggedInEmail() {
    const label = document.getElementById('loggedInEmail');
    if (!label) return;

    let emailText = 'Not logged in';
    let hasEmail = false;
    try {
      const sessionRaw = localStorage.getItem('supabase_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        const possibleEmail = session?.user?.email || session?.email;
        if (possibleEmail) {
          emailText = `Signed in: ${possibleEmail}`;
          hasEmail = true;
        }
      }
    } catch (err) {
      console.warn('Unable to read supabase_session for email display', err);
    }

    label.textContent = emailText;
    label.style.color = hasEmail ? '#1f2937' : '#777';
  }

  populateVehicleTypeForm(vehicleId) {
    const container = document.getElementById('editVehicleTypeContent');
    if (!container) {
      return;
    }

    const data = this.getVehicleTypeData(vehicleId);
    this.activeVehicleTypeId = vehicleId;

    const titleInput = container.querySelector('[data-vehicle-field="name"]');
    if (titleInput) {
      // Always allow renaming when editing an existing vehicle type
      titleInput.readOnly = false;
      titleInput.disabled = false;
      titleInput.value = data.name || '';
    }

    const setSelectValue = (select, value, fallback) => {
      if (!select) {
        return;
      }
      const desired = value ?? fallback ?? '';
      select.value = desired;
      if (select.value !== desired) {
        const safe = fallback ?? select.options[0]?.value ?? '';
        select.value = safe;
      }
    };

    setSelectValue(container.querySelector('[data-vehicle-field="status"]'), data.status, 'active');
    setSelectValue(container.querySelector('[data-vehicle-field="pricing_basis"]'), data.pricing_basis, 'hours');
    setSelectValue(container.querySelector('[data-vehicle-field="passenger_capacity"]'), data.passenger_capacity, '2');
    setSelectValue(container.querySelector('[data-vehicle-field="luggage_capacity"]'), data.luggage_capacity, '6');
    setSelectValue(container.querySelector('[data-vehicle-field="service_type"]'), data.service_type, '');

    const colorInput = container.querySelector('[data-vehicle-field="color_hex"]');
    if (colorInput) {
      colorInput.value = data.color_hex || '';
    }

    const accessibleCheckbox = container.querySelector('[data-vehicle-field="accessible"]');
    if (accessibleCheckbox instanceof HTMLInputElement) {
      accessibleCheckbox.checked = Boolean(data.accessible);
    }

    const descriptionElement = container.querySelector('[data-vehicle-field="description"]');
    if (descriptionElement) {
      descriptionElement.innerHTML = data.description || '';
    }

    const headerPanel = container.closest('.resources-form-panel');
    const headerTitle = headerPanel?.querySelector('.resources-form-header h3');
    if (headerTitle) {
      headerTitle.textContent = 'Vehicle Type';
    }

    const primaryAction = container.querySelector('.form-actions .btn-primary');
    if (primaryAction) {
      primaryAction.textContent = 'Save Vehicle Type';
    }
  }

  getVehicleTypeData(vehicleId) {
    if (!vehicleId) {
      return this.seedVehicleTypeFromList(vehicleId);
    }

    if (this.vehicleTypeDrafts[vehicleId]) {
      return { ...this.vehicleTypeDrafts[vehicleId] };
    }

    const seed = this.vehicleTypeSeeds[vehicleId];
    if (seed) {
      return { ...seed };
    }

    return this.seedVehicleTypeFromList(vehicleId);
  }

  seedVehicleTypeFromList(vehicleId) {
    const item = vehicleId ? document.querySelector(`.vehicle-type-item[data-vehicle-id="${vehicleId}"]`) : null;
    const name = item ? item.textContent.trim() : '';
    return {
      id: vehicleId,
      name,
      status: 'active',
      pricing_basis: 'hours',
      passenger_capacity: '2',
      luggage_capacity: '2',
      color_hex: '#000000',
      service_type: '',
      accessible: false,
      description: name ? `${name} description pending.` : ''
    };
  }

  captureVehicleTypeForm(vehicleId) {
    if (!vehicleId) {
      return {};
    }

    const container = document.getElementById('editVehicleTypeContent');
    if (!container) {
      return;
    }

    const draft = { id: vehicleId, ...this.getVehicleTypeData(vehicleId) };

    const titleInput = container.querySelector('[data-vehicle-field="name"]');
    if (titleInput) {
      draft.name = titleInput.value.trim();
    }

    const statusSelect = container.querySelector('[data-vehicle-field="status"]');
    if (statusSelect) {
      draft.status = statusSelect.value || 'active';
    }

    const pricingBasis = container.querySelector('[data-vehicle-field="pricing_basis"]');
    if (pricingBasis) {
      draft.pricing_basis = pricingBasis.value || 'hours';
    }

    const passengerCapacity = container.querySelector('[data-vehicle-field="passenger_capacity"]');
    if (passengerCapacity) {
      draft.passenger_capacity = passengerCapacity.value || '2';
    }

    const luggageCapacity = container.querySelector('[data-vehicle-field="luggage_capacity"]');
    if (luggageCapacity) {
      draft.luggage_capacity = luggageCapacity.value || '6';
    }

    const colorInput = container.querySelector('[data-vehicle-field="color_hex"]');
    if (colorInput) {
      draft.color_hex = colorInput.value.trim();
    }

    const serviceType = container.querySelector('[data-vehicle-field="service_type"]');
    if (serviceType) {
      draft.service_type = serviceType.value || '';
    }

    const accessibleCheckbox = container.querySelector('[data-vehicle-field="accessible"]');
    if (accessibleCheckbox instanceof HTMLInputElement) {
      draft.accessible = accessibleCheckbox.checked;
    }

    const descriptionElement = container.querySelector('[data-vehicle-field="description"]');
    if (descriptionElement) {
      draft.description = descriptionElement.innerHTML.trim();
    }

    this.vehicleTypeDrafts[vehicleId] = draft;
    this.persistVehicleTypeDraft(vehicleId, draft);
    return draft;
  }

  captureVehicleRates() {
    const parseNumber = (val) => {
      const num = parseFloat(val);
      return Number.isFinite(num) ? num : 0;
    };

    const perHour = {};
    const perHourContainer = document.getElementById('perHourRates');
    if (perHourContainer) {
      const asLowInput = perHourContainer.querySelector('.rate-input-section input');
      perHour.asLow = parseNumber(asLowInput?.value || '0');

      const selects = perHourContainer.querySelectorAll('.rate-input-section select');
      perHour.baseAssociation = selects[0]?.value || '';
      perHour.duration = selects[1]?.value || '';
      perHour.multiplier = selects[2]?.value || '';

      const rateSchedules = Array.from(perHourContainer.querySelectorAll('.rate-schedule-row')).map((row) => {
        const inputs = row.querySelectorAll('input');
        if (inputs.length < 3) return null;
        return {
          from: inputs[0].value,
          to: inputs[1].value,
          ratePerHour: inputs[2].value
        };
      }).filter(Boolean);
      perHour.rateSchedules = rateSchedules;

      const hoursGrids = perHourContainer.querySelectorAll('.hours-schedule-grid');
      if (hoursGrids.length > 1) {
        const selectsHours = hoursGrids[1].querySelectorAll('select');
        perHour.hoursRange = {
          from: selectsHours[0]?.value || '',
          to: selectsHours[1]?.value || '',
          ratePerHour: selectsHours[3]?.value || ''
        };
      }

      const peakRows = perHourContainer.querySelectorAll('.peak-rate-table tbody tr');
      perHour.peakSchedule = Array.from(peakRows).map((row) => {
        const cells = row.querySelectorAll('td');
        const checkbox = cells[0]?.querySelector('input[type="checkbox"]');
        const selectsRow = row.querySelectorAll('select');
        return {
          day: cells[1]?.textContent?.trim() || '',
          enabled: Boolean(checkbox?.checked),
          start1: selectsRow[0]?.value || '',
          end1: selectsRow[1]?.value || '',
          start2: selectsRow[2]?.value || '',
          end2: selectsRow[3]?.value || ''
        };
      });
    }

    const perPassenger = {};
    const perPassengerContainer = document.getElementById('perPassengerRates');
    if (perPassengerContainer) {
      perPassenger.matrix = perPassengerContainer.querySelector('[data-rate-field="pp-matrix"]')?.value || '';
      perPassenger.baseRate = parseNumber(perPassengerContainer.querySelector('[data-rate-field="pp-base-rate"]')?.value || '0');
      perPassenger.minPassengers = parseInt(perPassengerContainer.querySelector('[data-rate-field="pp-min"]')?.value || '0', 10) || 0;
      perPassenger.maxPassengers = parseInt(perPassengerContainer.querySelector('[data-rate-field="pp-max"]')?.value || '0', 10) || 0;

      const tierRows = perPassengerContainer.querySelectorAll('.pp-tier-row');
      perPassenger.tiers = Array.from(tierRows).map((row) => {
        const from = row.querySelector('[data-rate-field="pp-from"]')?.value || '';
        const to = row.querySelector('[data-rate-field="pp-to"]')?.value || '';
        const rate = row.querySelector('[data-rate-field="pp-rate"]')?.value || '';
        const hasData = from || to || rate;
        if (!hasData) {
          return null;
        }
        return {
          from,
          to,
          rate: parseNumber(rate)
        };
      }).filter(Boolean);

      const flatRows = perPassengerContainer.querySelectorAll('.pp-flat-row');
      perPassenger.flatFees = Array.from(flatRows).map((row) => {
        const label = row.querySelector('[data-rate-field="pp-flat-label"]')?.value?.trim() || '';
        const amount = row.querySelector('[data-rate-field="pp-flat-amount"]')?.value || '';
        if (!label && !amount) {
          return null;
        }
        return {
          label,
          amount: parseNumber(amount)
        };
      }).filter(Boolean);
    }

    const distance = {};
    const distanceContainer = document.getElementById('distanceRates');
    if (distanceContainer) {
      distance.matrix = distanceContainer.querySelector('[data-rate-field="dist-matrix"]')?.value || '';
      distance.basePerMile = parseNumber(distanceContainer.querySelector('[data-rate-field="dist-base"]')?.value || '0');
      distance.minimumFare = parseNumber(distanceContainer.querySelector('[data-rate-field="dist-min-fare"]')?.value || '0');
      distance.includedMiles = parseNumber(distanceContainer.querySelector('[data-rate-field="dist-included"]')?.value || '0');

      const tierRows = distanceContainer.querySelectorAll('.distance-tier-row');
      distance.tiers = Array.from(tierRows).map((row) => {
        const from = row.querySelector('[data-rate-field="dist-from"]')?.value || '';
        const to = row.querySelector('[data-rate-field="dist-to"]')?.value || '';
        const rate = row.querySelector('[data-rate-field="dist-rate"]')?.value || '';
        const hasData = from || to || rate;
        if (!hasData) {
          return null;
        }
        return {
          from,
          to,
          rate: parseNumber(rate)
        };
      }).filter(Boolean);

      const surchargeRows = distanceContainer.querySelectorAll('.distance-surcharge-row');
      distance.surcharges = Array.from(surchargeRows).map((row) => {
        const label = row.querySelector('[data-rate-field="dist-surcharge-label"]')?.value?.trim() || '';
        const amount = row.querySelector('[data-rate-field="dist-surcharge-amount"]')?.value || '';
        if (!label && !amount) {
          return null;
        }
        return {
          label,
          amount: parseNumber(amount)
        };
      }).filter(Boolean);
    }

    return { perHour, perPassenger, distance };
  }

  async saveVehicleRates() {
    const vehicleId = this.activeVehicleTypeId;
    if (!vehicleId) {
      alert('Select a vehicle type first.');
      return;
    }

    const draft = this.captureVehicleTypeForm(vehicleId);
    const rates = this.captureVehicleRates();
    const payload = { ...draft, rates };
    this.vehicleTypeDrafts[vehicleId] = payload;
    this.persistVehicleTypeDraft(vehicleId, payload);

    try {
      if (!this.apiReady) throw new Error('API not ready');
      const saved = await upsertVehicleType(payload);
      if (saved?.id) {
        this.vehicleTypeSeeds[saved.id] = saved;
        this.vehicleTypeDrafts[saved.id] = saved;
        this.refreshVehicleTypeList(saved.id, saved.name);
      }
      alert('Vehicle type rates saved to Supabase.');
    } catch (err) {
      console.error('Vehicle Type rate save failed, kept locally:', err);
      alert('Saved locally. Supabase save failed.');
    }
  }

  persistVehicleTypeDraft(vehicleId, draft) {
    try {
      const stored = { ...this.vehicleTypeDrafts, [vehicleId]: draft };
      localStorage.setItem('vehicleTypeDrafts', JSON.stringify(stored));
    } catch (err) {
      console.warn('Unable to persist vehicle type draft locally', err);
    }
  }

  loadVehicleTypeDrafts() {
    try {
      const stored = localStorage.getItem('vehicleTypeDrafts');
      if (stored) {
        this.vehicleTypeDrafts = JSON.parse(stored) || {};
      }
    } catch (err) {
      console.warn('Unable to load vehicle type drafts from localStorage', err);
    }
  }

  async loadVehicleTypesList() {
    const list = document.querySelector('#vehicleTypeList');
    if (!list) return;

    this.loadVehicleTypeDrafts();
    let records = Object.values(this.vehicleTypeSeeds);
    let derivedFromVehicles = [];
    let remoteRecords = [];

    if (this.apiReady) {
      const remote = await fetchVehicleTypes({ includeInactive: true });

      if (Array.isArray(remote) && remote.length) {
        remoteRecords = remote;
        remote.forEach((v) => { this.vehicleTypeSeeds[v.id] = v; });
        const localExtras = Object.values(this.vehicleTypeSeeds).filter((v) => v.id && !remote.find((r) => r.id === v.id));
        if (localExtras.length) {
          remoteRecords = [...remoteRecords, ...localExtras];
        }
      }

      // Also derive types from vehicles to prefer the longer list when Supabase types are sparse
      const vehicles = await fetchActiveVehicles({ includeInactive: true });
      if (Array.isArray(vehicles) && vehicles.length) {
        const seen = new Set();
        derivedFromVehicles = [];
        vehicles.forEach((veh) => {
          const name = (veh.veh_type || veh.vehicle_type || veh.veh_title || veh.unit_number || '').trim();
          if (!name || seen.has(name)) return;
          seen.add(name);
          const id = veh.vehicle_type_id || veh.id || name;
          derivedFromVehicles.push({ id, name, status: veh.status || 'active', source: 'vehicles' });
        });
        if (derivedFromVehicles.length) {
          derivedFromVehicles.forEach((v) => { this.vehicleTypeSeeds[v.id] = v; });
        }
      }
    }

    // Pick the longest deterministic list: prefer derived if it is larger than remote; otherwise remote; fallback to seeds
    const longestList = (derivedFromVehicles.length > remoteRecords.length)
      ? derivedFromVehicles
      : (remoteRecords.length ? remoteRecords : records);

    // Merge duplicates while favoring derived entries (they often carry the richer set)
    const unique = new Map();
    const pushList = (arr, preferVehicles = false) => {
      (arr || []).forEach((v) => {
        const id = v.id || v.code || v.name;
        if (!id) return;
        if (!unique.has(id) || preferVehicles) {
          unique.set(id, v);
        }
      });
    };

    pushList(longestList, longestList === derivedFromVehicles);
    pushList(remoteRecords, false);
    pushList(Object.values(this.vehicleTypeSeeds || {}), false);

    records = Array.from(unique.values());
    records.sort((a, b) => this.normalizeVehicleTypeName(a.name || '').localeCompare(this.normalizeVehicleTypeName(b.name || ''), undefined, { sensitivity: 'base' }));

    list.innerHTML = '';
    records.forEach((v) => {
      const div = document.createElement('div');
      div.className = 'vehicle-type-item';
      div.dataset.vehicleId = v.id || v.code || crypto.randomUUID();
      div.textContent = this.normalizeVehicleTypeName(v.name || 'Untitled Vehicle Type');
      list.appendChild(div);
    });

    this.populateFleetVehicleTypeOptions(records);

    // Re-init selection bindings
    this.vehicleTypeSelectionInitialized = false;
    this.setupVehicleTypeSelection();
  }

  refreshVehicleTypeList(vehicleId, name) {
    const list = document.querySelector('#vehicleTypeList');
    if (!list) return;
    let item = list.querySelector(`.vehicle-type-item[data-vehicle-id="${vehicleId}"]`);
    if (!item) {
      item = document.createElement('div');
      item.className = 'vehicle-type-item';
      item.dataset.vehicleId = vehicleId;
      list.appendChild(item);
    }
    item.textContent = name || 'Untitled Vehicle Type';
    list.querySelectorAll('.vehicle-type-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    this.populateVehicleTypeForm(vehicleId);
  }

  createNewVehicleType() {
    const vehicleId = crypto.randomUUID();
    const draft = {
      id: vehicleId,
      name: 'New Vehicle Type',
      status: 'active',
      pricing_basis: 'hours',
      passenger_capacity: '2',
      luggage_capacity: '2',
      color_hex: '#000000',
      service_type: '',
      accessible: false,
      description: ''
    };

    this.vehicleTypeSeeds[vehicleId] = draft;
    this.vehicleTypeDrafts[vehicleId] = draft;
    this.activeVehicleTypeId = vehicleId;
    this.refreshVehicleTypeList(vehicleId, draft.name);
    this.unlockVehicleTypeTabs();
    this.switchVehicleTypeTab('edit');
    this.populateVehicleTypeForm(vehicleId);

    const list = document.getElementById('vehicleTypeList');
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }

  async handleVehicleTypeDelete() {
    const vehicleId = this.activeVehicleTypeId;
    if (!vehicleId) {
      alert('Select a vehicle type to delete.');
      return;
    }

    const name = this.vehicleTypeSeeds[vehicleId]?.name || this.vehicleTypeDrafts[vehicleId]?.name || 'this vehicle type';
    const confirmed = confirm(`Delete ${name}? This cannot be undone.`);
    if (!confirmed) return;

    let remoteError = null;
    if (this.apiReady) {
      try {
        await deleteVehicleType(vehicleId);
      } catch (error) {
        console.error('Vehicle Type delete failed (will still remove locally):', error);
        remoteError = error;
      }
    }

    delete this.vehicleTypeSeeds[vehicleId];
    delete this.vehicleTypeDrafts[vehicleId];
    await this.loadVehicleTypesList();

    const list = document.getElementById('vehicleTypeList');
    const nextItem = list?.querySelector('.vehicle-type-item');

    if (nextItem?.dataset?.vehicleId) {
      this.activeVehicleTypeId = nextItem.dataset.vehicleId;
      this.populateVehicleTypeForm(this.activeVehicleTypeId);
    } else {
      this.activeVehicleTypeId = null;
      const container = document.getElementById('editVehicleTypeContent');
      if (container) {
        container.querySelectorAll('input, select, textarea, .vehicle-editor-content').forEach((el) => {
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.value = '';
          } else if (el instanceof HTMLSelectElement) {
            el.selectedIndex = 0;
          } else {
            el.innerHTML = '';
          }
        });
      }
      this.lockVehicleTypeTabs();
    }

    if (remoteError) {
      alert('Vehicle Type removed locally. Supabase delete failed; see console.');
    } else {
      alert('Vehicle Type deleted.');
    }
  }

  initializeFleetSection() {
    this.populateFleetYearOptions();
    this.populateFleetVehicleTypeOptions(Object.values(this.vehicleTypeSeeds || {}));
    this.populateFleetDriverOptions();
    this.fleetRecords = this.loadFleetFromStorage();
    this.removeDemoFleetEntry();
    if (!this.fleetRecords.length) {
      this.fleetRecords = this.seedFleetRecords();
      if (this.fleetRecords.length) {
        this.persistFleet();
      }
    }
    this.renderFleetList();
    this.setupFleetItemSelection();
    this.attachFleetFormHandlers();
  }

  attachFleetFormHandlers() {
    const addBtn = document.getElementById('fleetAddBtn');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = 'true';
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.startNewFleet();
      });
    }

    const saveBtn = document.getElementById('fleetSaveBtn');
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = 'true';
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleFleetSave();
      });
    }

    const cancelBtn = document.getElementById('fleetCancelBtn');
    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = 'true';
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleFleetCancel();
      });
    }

    const deleteBtn = document.getElementById('fleetDeleteBtn');
    if (deleteBtn && !deleteBtn.dataset.bound) {
      deleteBtn.dataset.bound = 'true';
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleFleetDelete();
      });
    }
  }

  populateFleetYearOptions() {
    const yearSelect = document.getElementById('fleetYear');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();
    const startYear = currentYear + 1; // allow ordering units ahead of delivery
    const minYear = 1990;
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    for (let year = startYear; year >= minYear; year -= 1) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    }
  }

  populateFleetVehicleTypeOptions(types = []) {
    const select = document.getElementById('fleetVehicleType');
    if (!select) return;
    const previous = select.value;
    const uniqueTypes = new Map();
    const source = Array.isArray(types) && types.length ? types : Object.values(this.vehicleTypeSeeds || {});
    source.forEach((t) => {
      const status = (t.status || '').toUpperCase();
      if (status && status !== 'ACTIVE') return;
      const id = t.id || t.code || t.name;
      if (!id) return;
      if (!uniqueTypes.has(id)) {
        uniqueTypes.set(id, { id, name: this.normalizeVehicleTypeName(t.name || t.display_name || id) });
      }
    });
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select Vehicle Type';
    select.appendChild(placeholder);
    uniqueTypes.forEach((t) => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = t.name;
      select.appendChild(option);
    });
    if (previous && !select.querySelector(`option[value="${previous}"]`)) {
      const missing = document.createElement('option');
      missing.value = previous;
      missing.textContent = 'Previously Used Type';
      select.appendChild(missing);
    }
    if (previous) {
      select.value = previous;
    }
  }

  populateFleetDriverOptions() {
    const select = document.getElementById('fleetAssignedDriver');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Not Assigned';
    select.appendChild(placeholder);
    const activeDrivers = (this.drivers || []).filter(d => d.is_active !== false);
    activeDrivers.forEach((driver) => {
      const option = document.createElement('option');
      option.value = driver.id;
      const displayName = driver.dispatch_display_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
      option.textContent = displayName || 'Unnamed Driver';
      select.appendChild(option);
    });
    if (previous && !select.querySelector(`option[value="${previous}"]`)) {
      const missing = document.createElement('option');
      missing.value = previous;
      missing.textContent = 'Previously Assigned Driver';
      select.appendChild(missing);
    }
    if (previous) {
      select.value = previous;
    }
  }

  loadFleetFromStorage() {
    try {
      const raw = localStorage.getItem(this.fleetStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Unable to load fleet from storage:', error);
      return [];
    }
  }

  persistFleet() {
    try {
      localStorage.setItem(this.fleetStorageKey, JSON.stringify(this.fleetRecords));
    } catch (error) {
      console.warn('Unable to persist fleet:', error);
    }
  }

  seedFleetRecords() {
    return [];
  }

  removeDemoFleetEntry() {
    const before = (this.fleetRecords || []).length;
    this.fleetRecords = (this.fleetRecords || []).filter((r) => (
      r.vin !== '5LMJJ2H53FEL12345'
      && r.license_plate !== 'ABC1234'
      && r.unit_number !== '101'
    ));
    if (before !== this.fleetRecords.length) {
      this.persistFleet();
    }
  }

  renderFleetList() {
    const list = document.getElementById('fleetList');
    if (!list) return;
    list.innerHTML = '';

    if (!this.fleetRecords.length) {
      this.activeFleetId = null;
      const empty = document.createElement('div');
      empty.style.padding = '12px';
      empty.style.color = '#666';
      empty.style.fontSize = '12px';
      empty.textContent = 'No vehicles added yet. Start by adding a new vehicle.';
      list.appendChild(empty);
      this.clearFleetForm();
      return;
    }

    const sorted = [...this.fleetRecords].sort((a, b) => {
      const aUnit = (a.unit_number || '').toString();
      const bUnit = (b.unit_number || '').toString();
      return aUnit.localeCompare(bUnit, undefined, { numeric: true, sensitivity: 'base' });
    });

    sorted.forEach((record) => {
      const item = this.buildFleetListItem(record);
      list.appendChild(item);
    });

    const activeId = this.activeFleetId || sorted[0]?.id || null;
    if (activeId) {
      this.setActiveFleet(activeId);
    }
  }

  buildFleetListItem(record) {
    const item = document.createElement('div');
    item.className = 'resource-item fleet-card';
    item.style.background = '#fff7fb';
    item.style.border = '1px solid #f6d1e0';
    item.style.boxShadow = '0 2px 8px rgba(246, 175, 205, 0.25)';
    item.style.borderRadius = '10px';
    item.style.marginBottom = '10px';
    item.dataset.fleetId = record.id;

    const name = record.veh_disp_name || `${record.make || ''} ${record.model || ''}`.trim() || 'Untitled Vehicle';
    const unitLabel = record.unit_number ? `Unit #${record.unit_number}` : '';
    const license = record.license_plate ? `License: ${record.license_plate}` : '';
    const vin = record.vin ? `VIN: ${record.vin}` : '';
    const type = record.vehicle_type ? `Type: ${record.vehicle_type}` : '';
    const year = record.year ? `Year: ${record.year}` : '';

    item.innerHTML = `
      <div class="fleet-card-body" style="padding: 10px 12px;">
        <div class="resource-item-main">
          <div class="resource-status-badge" style="background: ${this.getFleetStatusColor(record.status)};"></div>
          <div class="resource-item-details">
            <div class="resource-item-name">${name}${unitLabel ? ` - ${unitLabel}` : ''}</div>
            <div class="resource-item-meta">
              ${vin ? `<span>${vin}</span>` : ''}
              ${license ? `<span>${license}</span>` : ''}
            </div>
            <div class="resource-item-meta">
              ${type ? `<span>${type}</span>` : ''}
              ${year ? `<span>${year}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
    return item;
  }

  normalizeVehicleTypeName(name) {
    if (!name) return '';
    return name.replace(/\s*\(.*?\)\s*$/, '').trim();
  }

  getFleetStatusColor(status) {
    const normalized = (status || '').toUpperCase();
    const palette = {
      ACTIVE: '#4caf50',
      AVAILABLE: '#4caf50',
      IN_USE: '#2196f3',
      MAINTENANCE: '#ff9800',
      OUT_OF_SERVICE: '#f44336',
      INACTIVE: '#9e9e9e',
      RETIRED: '#6d4c41'
    };
    return palette[normalized] || '#9e9e9e';
  }

  setActiveFleet(fleetId) {
    const list = document.getElementById('fleetList');
    if (!list) return;
    const target = list.querySelector(`.resource-item[data-fleet-id="${fleetId}"]`);
    list.querySelectorAll('.resource-item').forEach((item) => item.classList.remove('active'));
    if (target) {
      target.classList.add('active');
      this.activeFleetId = fleetId;
      const record = this.fleetRecords.find((r) => r.id === fleetId);
      if (record) {
        this.populateFleetForm(record);
      }
    } else {
      this.activeFleetId = null;
      this.clearFleetForm();
    }
  }

  populateFleetForm(record) {
    if (!record) return;
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = value ?? '';
      }
    };

    setValue('fleetUnitNumber', record.unit_number);
    setValue('fleetStatus', record.status || 'ACTIVE');
    setValue('fleetVehicleType', record.vehicle_type || '');
    setValue('fleetYear', record.year || '');
    setValue('fleetMake', record.make);
    setValue('fleetModel', record.model);
    setValue('fleetColor', record.color);
    setValue('fleetPassengers', record.passengers);
    setValue('fleetVin', record.vin);
    setValue('fleetLicense', record.license_plate);
    setValue('fleetRegExp', record.registration_expiration);
    setValue('fleetInsExp', record.insurance_expiration);
    setValue('fleetInsCompany', record.insurance_company);
    setValue('fleetPolicyNumber', record.policy_number);
    setValue('fleetInsContact', record.insurance_contact);
    setValue('fleetMileage', record.mileage);
    setValue('fleetNextServiceMiles', record.next_service_miles);
    setValue('fleetLastServiceDate', record.last_service_date);
    setValue('fleetNextServiceDate', record.next_service_date);
    setValue('fleetServiceNotes', record.service_notes);
    setValue('fleetGaragedLocation', record.garaged_location);

    this.populateFleetDriverOptions();
    const driverSelect = document.getElementById('fleetAssignedDriver');
    if (driverSelect) {
      const driverId = record.assigned_driver_id || '';
      if (driverId && !driverSelect.querySelector(`option[value="${driverId}"]`)) {
        const missing = document.createElement('option');
        missing.value = driverId;
        missing.textContent = 'Previously Assigned Driver';
        driverSelect.appendChild(missing);
      }
      driverSelect.value = driverId;
    }

    this.applyFleetFeatures(record.features || []);
    const internalNotes = document.getElementById('fleetInternalNotes');
    if (internalNotes) {
      internalNotes.value = record.internal_notes || '';
    }
    const serviceNotes = document.getElementById('fleetServiceNotes');
    if (serviceNotes) {
      serviceNotes.value = record.service_notes || '';
    }
  }

  applyFleetFeatures(features) {
    const featureInputs = document.querySelectorAll('.fleet-feature');
    featureInputs.forEach((checkbox) => {
      const value = checkbox.dataset.value;
      checkbox.checked = Array.isArray(features) ? features.includes(value) : false;
    });
  }

  collectFleetFeatures() {
    const featureInputs = document.querySelectorAll('.fleet-feature');
    const values = [];
    featureInputs.forEach((checkbox) => {
      if (checkbox.checked && checkbox.dataset.value) {
        values.push(checkbox.dataset.value);
      }
    });
    return values;
  }

  clearFleetForm() {
    const fields = [
      'fleetUnitNumber', 'fleetStatus', 'fleetVehicleType', 'fleetYear', 'fleetMake', 'fleetModel',
      'fleetColor', 'fleetPassengers', 'fleetVin', 'fleetLicense', 'fleetRegExp', 'fleetInsExp',
      'fleetInsCompany', 'fleetPolicyNumber', 'fleetInsContact', 'fleetMileage', 'fleetNextServiceMiles',
      'fleetLastServiceDate', 'fleetNextServiceDate', 'fleetServiceNotes', 'fleetGaragedLocation',
      'fleetAssignedDriver', 'fleetInternalNotes'
    ];
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === 'SELECT') {
          el.selectedIndex = 0;
        } else {
          el.value = '';
        }
      }
    });
    this.applyFleetFeatures([]);
  }

  getFleetFormData() {
    const getValue = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    return {
      id: this.activeFleetId || crypto.randomUUID(),
      unit_number: getValue('fleetUnitNumber'),
      status: getValue('fleetStatus') || 'ACTIVE',
      vehicle_type: getValue('fleetVehicleType'),
      year: getValue('fleetYear'),
      make: getValue('fleetMake'),
      model: getValue('fleetModel'),
      color: getValue('fleetColor'),
      passengers: getValue('fleetPassengers'),
      vin: getValue('fleetVin'),
      license_plate: getValue('fleetLicense'),
      registration_expiration: getValue('fleetRegExp'),
      insurance_expiration: getValue('fleetInsExp'),
      insurance_company: getValue('fleetInsCompany'),
      policy_number: getValue('fleetPolicyNumber'),
      insurance_contact: getValue('fleetInsContact'),
      mileage: getValue('fleetMileage'),
      next_service_miles: getValue('fleetNextServiceMiles'),
      last_service_date: getValue('fleetLastServiceDate'),
      next_service_date: getValue('fleetNextServiceDate'),
      service_notes: getValue('fleetServiceNotes'),
      garaged_location: getValue('fleetGaragedLocation'),
      assigned_driver_id: getValue('fleetAssignedDriver'),
      features: this.collectFleetFeatures(),
      internal_notes: getValue('fleetInternalNotes')
    };
  }

  startNewFleet() {
    const list = document.getElementById('fleetList');
    if (list) {
      list.querySelectorAll('.resource-item').forEach((item) => item.classList.remove('active'));
    }
    this.activeFleetId = null;
    this.clearFleetForm();
  }

  handleFleetSave() {
    const data = this.getFleetFormData();
    const requiredFields = ['unit_number', 'status', 'vehicle_type', 'year', 'make', 'model', 'license_plate', 'vin'];
    const missing = requiredFields.filter((key) => !data[key]);
    if (missing.length) {
      alert(`Please fill in required fields: ${missing.join(', ')}`);
      return;
    }

    const existingIndex = this.fleetRecords.findIndex((r) => r.id === this.activeFleetId);
    if (existingIndex >= 0) {
      this.fleetRecords[existingIndex] = { ...this.fleetRecords[existingIndex], ...data };
    } else {
      this.fleetRecords.push(data);
      this.activeFleetId = data.id;
    }

    this.persistFleet();
    this.renderFleetList();
    this.setActiveFleet(data.id);
    alert('Vehicle saved.');
  }

  handleFleetCancel() {
    if (this.activeFleetId) {
      const record = this.fleetRecords.find((r) => r.id === this.activeFleetId);
      if (record) {
        this.populateFleetForm(record);
        return;
      }
    }
    this.clearFleetForm();
  }

  handleFleetDelete() {
    if (!this.activeFleetId) {
      alert('Select a vehicle to delete.');
      return;
    }
    const confirmed = confirm('Delete this vehicle from the fleet?');
    if (!confirmed) return;
    this.fleetRecords = this.fleetRecords.filter((r) => r.id !== this.activeFleetId);
    this.activeFleetId = null;
    this.persistFleet();
    this.renderFleetList();
    if (this.fleetRecords.length) {
      this.setActiveFleet(this.fleetRecords[0].id);
    } else {
      this.clearFleetForm();
    }
  }

  setupFleetItemSelection() {
    if (this.fleetSelectionBound) return;
    const fleetList = document.getElementById('fleetList');
    if (fleetList) {
      fleetList.addEventListener('click', (e) => {
        const target = e.target;
        const item = target instanceof Element ? target.closest('.resource-item') : null;
        if (item?.dataset?.fleetId) {
          this.setActiveFleet(item.dataset.fleetId);
        }
      });
      this.fleetSelectionBound = true;
    }
  }

  setupAirportsItemSelection() {
    // Use event delegation for Airports items (they may be dynamically added)
    const airportsList = document.getElementById('airportsList');
    if (airportsList) {
      airportsList.addEventListener('click', (e) => {
        const target = e.target;
        const item = target instanceof Element ? target.closest('.resource-item') : null;
        if (item) {
          // Remove active class from all items
          airportsList.querySelectorAll('.resource-item').forEach(i => {
            i.classList.remove('active');
          });
          // Add active class to clicked item
          item.classList.add('active');
        }
      });
    }
  }

  setupAirlinesItemSelection() {
    // Use event delegation for Airlines items (they may be dynamically added)
    const airlinesList = document.getElementById('airlinesList');
    if (airlinesList) {
      airlinesList.addEventListener('click', (e) => {
        const target = e.target;
        const item = target instanceof Element ? target.closest('.resource-item') : null;
        if (item) {
          // Remove active class from all items
          airlinesList.querySelectorAll('.resource-item').forEach(i => {
            i.classList.remove('active');
          });
          // Add active class to clicked item
          item.classList.add('active');
        }
      });
    }
  }

  setupFBOItemSelection() {
    // Use event delegation for FBO items (they may be dynamically added)
    const fboList = document.getElementById('fboList');
    if (fboList) {
      fboList.addEventListener('click', (e) => {
        const target = e.target;
        const item = target instanceof Element ? target.closest('.resource-item') : null;
        if (item) {
          // Remove active class from all items
          fboList.querySelectorAll('.resource-item').forEach(i => {
            i.classList.remove('active');
          });
          // Add active class to clicked item
          item.classList.add('active');
        }
      });
    }
  }

  navigateToListSection(section) {
    // Update list section button active state
    const listButtons = document.querySelectorAll('#listManagementGroup .sidebar-btn');
    listButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.listSection === section) {
        btn.classList.add('active');
      }
    });

    // Hide all office sections
    document.querySelectorAll('.office-section').forEach(sec => {
      sec.classList.remove('active');
      sec.style.display = 'none';
    });

    // Show the appropriate list section
    let sectionId = '';
    if (section === 'payment-methods') {
      sectionId = 'payment-methods-section';
    } else if (section === 'states-provinces') {
      sectionId = 'states-provinces-section';
    } else if (section === 'driver-groups') {
      sectionId = 'driver-groups-section';
    }
    // Add more sections as they are implemented
    // else if (section === 'time-zones') {
    //   sectionId = 'time-zones-section';
    // }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    } else {
      // Show placeholder for not-yet-implemented sections
      console.log(`${section} section is not yet implemented`);
    }
  }

  navigateToRateSection(section) {
    // Update rate section button active state
    const rateButtons = document.querySelectorAll('#rateManagementGroup .sidebar-btn');
    rateButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.rateSection === section) {
        btn.classList.add('active');
      }
    });

    // Update horizontal rate tabs active state
    const topTabs = document.querySelectorAll('.rate-top-tab');
    topTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.rateSection === section) {
        tab.classList.add('active');
      }
    });

    // Hide all office sections
    document.querySelectorAll('.office-section').forEach(section => {
      section.classList.remove('active');
      section.style.display = 'none';
    });

    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      if (section === 'system-rate-manager') {
        contentArea.classList.add('rate-manager-active');
      } else {
        contentArea.classList.remove('rate-manager-active');
      }
    }

    // Show the appropriate rate section
    let sectionId = '';
    if (section === 'system-rate-manager') {
      sectionId = 'system-rate-manager-section';
    } else if (section === 'fixed-rates-zones') {
      sectionId = 'fixed-rates-zones-section';
    } else if (section === 'special-promotion') {
      sectionId = 'special-promotion-section';
    } else if (section === 'miscellaneous-fees') {
      sectionId = 'miscellaneous-fees-section';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
      sectionElement.style.display = 'block';
    } else {
      // Show placeholder for not-yet-implemented sections
      alert(`${section} section is under construction`);
      // Keep showing the system rate manager by default
      const systemRateSection = document.getElementById('system-rate-manager-section');
      if (systemRateSection) {
        systemRateSection.classList.add('active');
        systemRateSection.style.display = 'block';
      }
    }
  }

  switchRateTypeForm(rateType) {
    // Update tab active state
    document.querySelectorAll('.rate-type-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.rateType === rateType) {
        tab.classList.add('active');
      }
    });

    // Update form visibility
    document.querySelectorAll('.rate-form').forEach(form => {
      form.classList.remove('active');
    });

    let formId = '';
    if (rateType === 'fixed') {
      formId = 'fixedRateForm';
    } else if (rateType === 'multiplier') {
      formId = 'multiplierRateForm';
    } else if (rateType === 'percentage') {
      formId = 'percentageRateForm';
    }

    const formElement = document.getElementById(formId);
    if (formElement) {
      formElement.classList.add('active');
    }
  }

  switchPromoTab(promoTab) {
    // Update tab active state
    document.querySelectorAll('.promo-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.promoTab === promoTab) {
        tab.classList.add('active');
      }
    });

    // For now, all tabs show the same content
    // In a full implementation, you would switch between different promo content
    console.log('Switched to promo tab:', promoTab);
  }

  switchCustomFormCategory(category) {
    // Update sidebar button active state
    const customFormsGroup = document.getElementById('customFormsGroup');
    if (customFormsGroup) {
      customFormsGroup.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.customFormCategory === category) {
          btn.classList.add('active');
        }
      });
    }

    // Update the form list based on category
    const formsList = document.getElementById('customFormsList');
    if (formsList) {
      formsList.innerHTML = '';
      
      if (category === 'trip-email-print') {
        // Trip Email & Print forms
        const options = [
          { value: 'trip-sheet', text: 'Trip Sheet and Agreement' },
          { value: 'payment-receipt', text: 'Payment Receipt' },
          { value: 'payment-receipt-2', text: 'Payment receipt stamp copy' },
          { value: 'uber-receipt', text: 'Uber receipt' },
          { value: 'detail-receipt', text: 'Detail Receipt' },
          { value: 'trip-email', text: 'Trip Email' },
          { value: 'res-receipt', text: 'res receipt' },
          { value: 'driver-trip', text: 'driver trip sheet edit' },
          { value: 'affiliate-trip', text: 'Affiliate Trip Sheet custom' },
          { value: 'trip-details', text: 'trip details' },
          { value: 'quote', text: 'Quote' }
        ];
        options.forEach((opt, index) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.text;
          if (index === 0) option.selected = true;
          formsList.appendChild(option);
        });
      } else if (category === 'invoice-email-print') {
        // Invoice Email & Print forms
        const options = [
          { value: 'invoice-affiliate', text: 'custom Invoice for affilia(INVOICE 1)' },
          { value: 'payment-receipt-stamp', text: 'Payment Receipt stamp copy' },
          { value: 'invoice-customer', text: 'custom Invoice for customer' }
        ];
        options.forEach((opt, index) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.text;
          if (index === 0) option.selected = true;
          formsList.appendChild(option);
        });
      }
    }

    console.log('Switched to custom form category:', category);
  }

  switchCustomFormTab(formTab) {
    // Update tab active state
    document.querySelectorAll('.custom-form-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.tab === formTab) {
        tab.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.custom-form-tab-content').forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });

    let contentId = '';
    if (formTab === 'html-template') {
      contentId = 'htmlTemplateTab';
    } else if (formTab === 'invoice-trip') {
      contentId = 'invoiceTripTab';
    } else if (formTab === 'invoice-routing') {
      contentId = 'invoiceRoutingTab';
    } else if (formTab === 'additional-pax') {
      contentId = 'additionalPaxTab';
    }

    const contentElement = document.getElementById(contentId);
    if (contentElement) {
      contentElement.style.display = 'block';
      contentElement.classList.add('active');
      
      // Reinitialize editors and drag-drop when switching tabs
      if (window.reinitializeEditorViewSwitchers) {
        window.reinitializeEditorViewSwitchers();
      }
      if (window.reinitializeDragDrop) {
        window.reinitializeDragDrop();
      }
    }

    console.log('Switched to custom form tab:', formTab);
  }

  switchVehicleTypeTab(tabName) {
    if (this.vehicleTabsLocked && tabName !== 'edit') {
      return;
    }

    // Update tab active state
    document.querySelectorAll('.vehicle-type-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.vtypeTab === tabName) {
        tab.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.vehicle-type-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    let contentId = '';
    if (tabName === 'edit') {
      contentId = 'editVehicleTypeContent';
    } else if (tabName === 'rates') {
      contentId = 'ratesVehicleTypeContent';
    } else if (tabName === 'images') {
      contentId = 'imagesVehicleTypeContent';
    }

    const contentElement = document.getElementById(contentId);
    if (contentElement) {
      contentElement.classList.add('active');
    }

    this.updateVehicleTypeTabLockState();
  }

  updateVehicleTypeTabLockState() {
    const tabs = document.querySelectorAll('.vehicle-type-tab');
    tabs.forEach((tab) => {
      const locked = this.vehicleTabsLocked && tab.dataset.vtypeTab !== 'edit';
      tab.disabled = locked;
      tab.classList.toggle('disabled', locked);
    });

    document.querySelectorAll('.vehicle-type-tab-content').forEach((content) => {
      const locked = this.vehicleTabsLocked && content.id !== 'editVehicleTypeContent';
      if (locked) {
        content.classList.remove('active');
        content.style.display = 'none';
      } else {
        content.style.display = '';
      }
    });

    const hint = document.getElementById('vehicleTabsLockedHint');
    if (hint) {
      hint.style.display = this.vehicleTabsLocked ? 'block' : 'none';
    }
  }

  lockVehicleTypeTabs() {
    this.vehicleTabsLocked = true;
    this.switchVehicleTypeTab('edit');
    this.updateVehicleTypeTabLockState();
  }

  unlockVehicleTypeTabs() {
    this.vehicleTabsLocked = false;
    this.updateVehicleTypeTabLockState();
  }

  switchRateType(rateType) {
    // Update subtab active state
    document.querySelectorAll('.rates-subtab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.rateType === rateType) {
        tab.classList.add('active');
      }
    });

    // Update rate section
    document.querySelectorAll('.rates-section').forEach(section => {
      section.classList.remove('active');
    });

    let sectionId = '';
    if (rateType === 'per-hour') {
      sectionId = 'perHourRates';
    } else if (rateType === 'per-passenger') {
      sectionId = 'perPassengerRates';
    } else if (rateType === 'distance') {
      sectionId = 'distanceRates';
    }

    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
      sectionElement.classList.add('active');
    }
  }

  setupCustomFormsInteraction() {
    // Category button selection
    const categoryButtons = document.querySelectorAll('.custom-forms-category-btn');
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active from all category buttons
        categoryButtons.forEach(b => b.classList.remove('active'));
        
        // Add active to clicked button
        const button = e.currentTarget;
        button.classList.add('active');
        
        const category = button.dataset.category;
        console.log('Switched to category:', category);
        
        // Here you would filter the forms list based on category
        // For now, just log it
      });
    });
    
    // Use event delegation for custom forms list items
    const customFormsList = document.getElementById('customFormsList');
    if (customFormsList) {
      customFormsList.addEventListener('click', (e) => {
        const target = e.target;
        const item = target instanceof Element ? target.closest('.custom-form-list-item') : null;
        if (item) {
          // Remove active class from all items
          customFormsList.querySelectorAll('.custom-form-list-item').forEach(i => {
            i.classList.remove('active');
          });
          
          // Add active class to clicked item
          item.classList.add('active');
          
          // Load the form content
          this.loadCustomFormContent(item.dataset.formId, item.textContent);
        }
      });
    }
  }

  loadCustomFormContent(formId, formName) {
    console.log('Loading form:', formId, formName);
    
    // Update the subject field to show the form name
    const subjectField = document.querySelector('.custom-forms-subject-row input');
    if (subjectField) {
      subjectField.value = `${formName} - Email Subject`;
    }
    
    // Update the editor content based on the selected form
    const editor = document.getElementById('customFormsEditor');
    if (editor) {
      // You can load different content based on formId
      // For now, we'll show a placeholder
      editor.innerHTML = `<h2>${formName}</h2><p>Content for ${formName} will be loaded here...</p><p>This is where the HTML template content would appear.</p>`;
    }
    
    // Update form fields based on the selected form
    const customFormTypeSelect = document.querySelectorAll('.custom-forms-fields-row select')[1];
    
    // Set some example values based on form name
    if (formName.toLowerCase().includes('invoice')) {
      if (customFormTypeSelect) {
        customFormTypeSelect.value = 'invoice';
      }
    } else if (formName.toLowerCase().includes('receipt')) {
      if (customFormTypeSelect) {
        customFormTypeSelect.value = '';
      }
    }
  }

  setupMagicLinkHelpers() {
    const copyButtons = document.querySelectorAll('[data-copy-target]');
    copyButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copyTarget;
        const source = targetId ? document.getElementById(targetId) : null;

        if (!source) {
          return;
        }

        const text = source.textContent.trim();

        if (!navigator.clipboard) {
          alert('Clipboard is unavailable in this browser.');
          return;
        }

        navigator.clipboard.writeText(text).then(() => {
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = original;
          }, 1200);
        }).catch(() => {
          alert('Unable to copy. Please copy the text manually.');
        });
      });
    });
  }

  setupListManagementSidebar() {
    // Built-in sidebar button selection
    const sidebarButtons = document.querySelectorAll('.list-mgmt-sidebar-btn');
    sidebarButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Remove active from all buttons
        sidebarButtons.forEach(b => b.classList.remove('active'));
        
        // Add active to clicked button
        const button = e.currentTarget;
        button.classList.add('active');
        
        const section = button.dataset.listSection;
        console.log('Navigating to list section:', section);
        this.navigateToListSection(section);
      });
    });
  }

  setupDriversForm() {
    // Load drivers when Drivers section is opened
    const driversSection = document.getElementById('drivers-section');
    if (!driversSection) return;

    if (this.apiReady) {
      this.loadDriversList(this.currentDriver?.id || null);
    }

    // Show All checkbox - reload list when toggled
    const showAllCheckbox = document.getElementById('showAllDriversCheckbox');
    if (showAllCheckbox) {
      showAllCheckbox.addEventListener('change', () => this.loadDriversList(this.currentDriver?.id || null));
    }

    // Delete Driver button
    const deleteDriverBtn = document.getElementById('deleteDriverBtn');
    if (deleteDriverBtn) {
      deleteDriverBtn.addEventListener('click', () => this.deleteDriver());
    }

    // Add New Driver button
    const addNewDriverBtn = document.getElementById('addNewDriverBtn');
    if (addNewDriverBtn) {
      addNewDriverBtn.addEventListener('click', () => {
        this.currentDriver = null;
        const formTitle = document.getElementById('driverFormTitle');
        if (formTitle) formTitle.textContent = 'Add New Driver';
        
        // Clear all form inputs
        const form = document.querySelector('.drivers-form-panel');
        if (form) {
          form.querySelectorAll('input[type="text"], textarea').forEach(input => input.value = '');
          form.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
          form.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        }
        
        // Deselect all in list
        const driversListContainer = document.getElementById('driversListContainer');
        if (driversListContainer) {
          driversListContainer.querySelectorAll('.driver-list-item').forEach(i => {
            i.style.background = '#fff';
          });
        }

        this.renderDriverContactSummary(null);
      });
    }

    // Driver list selection (old select dropdown - backward compatibility)
    const driversList = document.querySelector('.drivers-list-select');
    if (driversList) {
      driversList.addEventListener('change', (e) => {
        const select = e.currentTarget;
        const selectedIndex = select.selectedIndex;
        if (selectedIndex >= 0 && this.drivers[selectedIndex]) {
          this.loadDriverForm(this.drivers[selectedIndex]);
        }
      });
    }

    // Form submission for saving driver
    const form = driversSection.querySelector('.drivers-form-panel');
    if (form) {
      // Find or create a save button
      let saveBtn = form.querySelector('.btn-save-driver');
      if (!saveBtn) {
        saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-primary btn-large btn-save-driver';
        saveBtn.textContent = 'Save Driver';
        saveBtn.style.marginTop = '20px';
        form.appendChild(saveBtn);
      }

      saveBtn.addEventListener('click', () => this.saveDriver());
    }
  }

  setupAffiliatesForm() {
    // Setup Affiliates section event handlers
    const affiliatesSection = document.getElementById('affiliates-section');
    if (!affiliatesSection) return;

    // Show All checkbox - reload list when toggled
    const showAllCheckbox = document.getElementById('showAllAffiliatesCheckbox');
    if (showAllCheckbox) {
      showAllCheckbox.addEventListener('change', () => this.loadAffiliatesList());
    }

    // Save Affiliate button
    const saveAffiliateBtn = document.getElementById('saveAffiliateBtn');
    if (saveAffiliateBtn) {
      saveAffiliateBtn.addEventListener('click', () => this.saveAffiliate());
    }
    
    // Clear/New Affiliate button
    const clearAffiliateBtn = document.getElementById('clearAffiliateBtn');
    if (clearAffiliateBtn) {
      clearAffiliateBtn.addEventListener('click', () => {
        this.clearAffiliateForm();
        // Also clear selection in list
        const affiliatesListContainer = document.getElementById('affiliatesListContainer');
        if (affiliatesListContainer) {
          affiliatesListContainer.querySelectorAll('.affiliate-row').forEach(i => {
            i.style.background = '';
          });
        }
      });
    }
  }
  
  async saveAffiliate() {
    try {
      const getVal = (id) => document.getElementById(id)?.value || '';
      const getCheck = (id) => document.getElementById(id)?.checked || false;
      
      const affiliateData = {
        company_name: getVal('affCompanyName'),
        primary_address: getVal('affAddress'),
        address_line2: getVal('affAddress2'),
        city: getVal('affCity'),
        state: getVal('affState'),
        zip: getVal('affZip'),
        country: getVal('affCountry') || 'US',
        school: getVal('affSchool'),
        tax_id_ssn: getVal('affTaxId'),
        markets_serviced: getVal('affMarketsServiced'),
        first_name: getVal('affFirstName'),
        last_name: getVal('affLastName'),
        phone: getVal('affPhone'),
        phone_ext: getVal('affPhoneExt'),
        fax: getVal('affFax'),
        fax_ext: getVal('affFaxExt'),
        email: getVal('affEmail'),
        website: getVal('affWebsite'),
        send_trip_email: getCheck('affSendEmail'),
        send_trip_sms: getCheck('affSendSms'),
        send_trip_fax: getCheck('affSendFax'),
        dont_send_auto_notifications: getCheck('affDontSendAuto'),
        internal_notes: getVal('affNotes'),
        status: getVal('affStatus') || 'ACTIVE',
        learned_priority: getVal('affPriority'),
        turnaround_monitor_code: getVal('affTurnaround'),
        web_username: getVal('affUsername'),
        web_password: getVal('affPassword'),
        rental_agreement: getVal('affRentalAgreement'),
        alt_first_name: getVal('affAltFirstName'),
        alt_last_name: getVal('affAltLastName'),
        alt_phone: getVal('affAltPhone'),
        alt_phone_ext: getVal('affAltPhoneExt'),
        alt_fax: getVal('affAltFax'),
        alt_fax_ext: getVal('affAltFaxExt'),
        alt_email: getVal('affAltEmail'),
        alt_send_trip_email: getCheck('affAltSendEmail'),
        alt_send_trip_sms: getCheck('affAltSendSms')
      };
      
      if (!affiliateData.company_name) {
        alert('Company Name is required');
        return;
      }
      
      let result;
      if (this.currentAffiliate?.id) {
        // Update existing
        result = await updateAffiliate(this.currentAffiliate.id, affiliateData);
        if (result) {
          alert('Affiliate updated successfully!');
        }
      } else {
        // Create new
        result = await createAffiliate(affiliateData);
        if (result) {
          alert('Affiliate created successfully!');
        }
      }
      
      if (result) {
        // Reload the list
        await this.loadAffiliatesList();
      } else {
        alert('Failed to save affiliate. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving affiliate:', error);
      alert('Error saving affiliate: ' + error.message);
    }
  }

  async loadDriversList(selectedDriverId = null) {
    if (!this.apiReady) {
      const container = document.getElementById('driversListContainer');
      if (container) {
        container.innerHTML = '<div style="padding: 10px; color: #666; font-size: 11px;">Connecting to driver directory…</div>';
      }
      return;
    }

    try {
      const showAll = document.getElementById('showAllDriversCheckbox')?.checked || false;
      const data = await fetchDrivers();

      // Pull overrides so UI reflects last-known availability even if API doesn't persist it
      let overrideMap = {};
      try {
        const rawOverrides = localStorage.getItem('relia_driver_status_overrides');
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : [];
        if (Array.isArray(parsedOverrides)) {
          overrideMap = parsedOverrides.reduce((acc, curr) => {
            if (curr && curr.id != null && curr.status) {
              acc[String(curr.id)] = curr.status.toString().toLowerCase();
            }
            return acc;
          }, {});
        }
      } catch (err) {
        console.warn('Unable to read driver status overrides for list merge:', err);
      }

      if (data) {
        const normalizedDrivers = (Array.isArray(data) ? data : []).map(driver => {
          const baseStatus = (driver?.driver_status || driver?.status || 'available').toString().toLowerCase();
          const overrideStatus = overrideMap[String(driver?.id)] || null;
          const mergedStatus = overrideStatus || baseStatus;
          return {
            ...driver,
            cell_phone: driver?.cell_phone || driver?.mobile_phone || driver?.phone || driver?.phone_number || driver?.primary_phone || '',
            home_phone: driver?.home_phone || driver?.phone_home || driver?.secondary_phone || '',
            other_phone: driver?.other_phone || driver?.pager || driver?.pager_phone || driver?.other_contact || '',
            fax: driver?.fax || driver?.fax_number || driver?.fax_phone || '',
            driver_status: mergedStatus,
            status: (driver?.status || mergedStatus || 'available').toString().toUpperCase()
          };
        });
        // Filter by active status unless "Show All" is checked
        this.drivers = showAll ? normalizedDrivers : normalizedDrivers.filter(d => d.is_active !== false);
        
        // Render to the new container layout (clickable list items)
        const driversListContainer = document.getElementById('driversListContainer');
        if (driversListContainer) {
          if (this.drivers.length === 0) {
            driversListContainer.innerHTML = '<div style="padding: 10px; color: #666; font-size: 11px;">No drivers found</div>';
            this.renderDriverContactSummary(null);
          } else {
            const driverIdToFocus = selectedDriverId || this.currentDriver?.id || (this.drivers[0]?.id ?? null);

            driversListContainer.innerHTML = this.drivers.map((driver, index) => {
              const isActive = driver.is_active !== false;
              const statusClass = isActive ? 'driver-active' : 'driver-inactive';
              const statusIcon = isActive ? '🟢' : '🔴';
              const isSelected = driver.id === driverIdToFocus || (!driverIdToFocus && index === 0);
              const background = isSelected ? '#e3f2fd' : '#fff';
              return `
                <div class="driver-list-item ${statusClass}" 
                     data-driver-id="${driver.id}" 
                     data-index="${index}"
                     style="padding: 8px 10px; cursor: pointer; border-radius: 4px; font-size: 12px; display: flex; align-items: center; gap: 6px; background: ${background}; border: 1px solid #ddd;">
                  <span>${statusIcon}</span>
                  <span>${driver.last_name}, ${driver.first_name}</span>
                </div>
              `;
            }).join('');
            
            // Add click handlers
            driversListContainer.querySelectorAll('.driver-list-item').forEach(item => {
              item.addEventListener('click', () => {
                // Remove selection from all
                driversListContainer.querySelectorAll('.driver-list-item').forEach(i => {
                  i.style.background = '#fff';
                });
                // Highlight selected
                item.style.background = '#e3f2fd';
                
                const index = parseInt(item.dataset.index);
                if (this.drivers[index]) {
                  this.loadDriverForm(this.drivers[index]);
                }
              });
            });
            
            const driverToLoad = this.drivers.find((d) => d.id === driverIdToFocus) || this.drivers[0];
            if (driverToLoad) {
              const itemToSelect = driversListContainer.querySelector(`.driver-list-item[data-driver-id="${driverToLoad.id}"]`);
              if (itemToSelect) {
                itemToSelect.style.background = '#e3f2fd';
              }
              this.loadDriverForm(driverToLoad);
            } else {
              this.renderDriverContactSummary(null);
            }
          }
        }
        
        // Also update the old select dropdown if it exists (for backward compatibility)
        const driversList = document.querySelector('.drivers-list-select');
        if (driversList) {
          driversList.innerHTML = '';
          this.drivers.forEach((driver) => {
            const option = document.createElement('option');
            option.value = driver.id;
            option.textContent = `${driver.last_name}, ${driver.first_name}`;
            driversList.appendChild(option);
          });
        }
        this.populateFleetDriverOptions();

        // Cache driver directory for dashboard/farm-out maps
        try {
          localStorage.setItem('relia_driver_directory', JSON.stringify(this.drivers));
        } catch (e) {
          console.warn('Unable to cache driver directory:', e.message);
        }
        
        console.log(`✅ Drivers loaded: ${this.drivers.length} (showAll: ${showAll})`);
      }
    } catch (error) {
      console.error('❌ Error loading drivers:', error);
      const driversListContainer = document.getElementById('driversListContainer');
      if (driversListContainer) {
        driversListContainer.innerHTML = '<div style="padding: 10px; color: #c00; font-size: 11px;">Error loading drivers</div>';
      }
      this.renderDriverContactSummary(null);
    }
  }

  async loadAffiliatesList() {
    console.log('🔄 loadAffiliatesList called');
    const affiliatesListContainer = document.getElementById('affiliatesListContainer');
    console.log('📦 affiliatesListContainer:', affiliatesListContainer);
    
    try {
      const showAll = document.getElementById('showAllAffiliatesCheckbox')?.checked || false;
      console.log('📡 Calling fetchAffiliates...');
      const data = await fetchAffiliates();
      console.log('📡 fetchAffiliates returned:', data, 'length:', data?.length);
      if (data && data.length > 0) {
        console.log('📡 First affiliate object keys:', Object.keys(data[0]));
        console.log('📡 First affiliate object:', data[0]);
      }
      
      if (!data) {
        // API returned null - show error
        if (affiliatesListContainer) {
          affiliatesListContainer.innerHTML = '<div style="padding: 10px; color: #c00; font-size: 11px;">Failed to load affiliates</div>';
        }
        console.error('❌ fetchAffiliates returned null');
        return;
      }
      
      // Filter by active status unless "Show All" is checked (case-insensitive)
      this.affiliates = showAll ? data : data.filter(a => (a.status || 'ACTIVE').toUpperCase() !== 'INACTIVE');
      
      // Render to the container
      if (affiliatesListContainer) {
        if (this.affiliates.length === 0) {
          affiliatesListContainer.innerHTML = `
            <div style="padding: 10px; color: #666; font-size: 12px;">
              No affiliates found. 
              <a href="import-export-affiliates.html" target="_blank" style="color: #007bff;">Import affiliates</a>
            </div>`;
        } else {
          affiliatesListContainer.innerHTML = this.affiliates.map((affiliate, index) => {
            const displayName = affiliate.company_name || `${affiliate.first_name || ''} ${affiliate.last_name || ''}`.trim() || 'Unknown';
            const city = affiliate.city || '';
            const state = affiliate.state || '';
            const location = [city, state].filter(Boolean).join(', ');
            return `
              <div class="affiliate-row" data-index="${index}" style="padding: 8px 10px; border-bottom: 1px solid #eee; cursor: pointer; transition: background 0.15s;">
                <div style="font-size: 13px; font-weight: 500; color: #333;">${displayName}</div>
                ${location ? `<div style="font-size: 11px; color: #666; margin-top: 2px;">${location}</div>` : ''}
              </div>`;
          }).join('');
          
          // Add click handlers
          affiliatesListContainer.querySelectorAll('.affiliate-row').forEach(item => {
            item.addEventListener('click', () => {
              // Remove selection from all
              affiliatesListContainer.querySelectorAll('.affiliate-row').forEach(i => {
                i.style.background = '';
              });
              // Highlight selected
              item.style.background = '#e3f2fd';
              
              const index = parseInt(item.dataset.index);
              if (this.affiliates[index]) {
                this.loadAffiliateForm(this.affiliates[index]);
              }
            });
          });
          
          // Start with blank form - don't auto-select
          this.clearAffiliateForm();
        }
      }
      
      console.log(`✅ Affiliates loaded: ${this.affiliates.length} (showAll: ${showAll})`);
    } catch (error) {
      console.error('❌ Error loading affiliates:', error);
      if (affiliatesListContainer) {
        affiliatesListContainer.innerHTML = '<div style="padding: 10px; color: #c00; font-size: 11px;">Error loading affiliates</div>';
      }
    }
  }

  loadAffiliateForm(affiliate) {
    this.currentAffiliate = affiliate;
    const form = document.querySelector('.affiliates-form-panel');
    if (!form) return;

    // DEBUG: Log affiliate data to see structure
    console.log('📋 Loading affiliate form with data:', affiliate);

    // Update form title
    const formTitle = form.querySelector('h3');
    if (formTitle) {
      const displayName = affiliate.company_name || `${affiliate.first_name || ''} ${affiliate.last_name || ''}`.trim();
      formTitle.textContent = displayName || 'Affiliate Details';
    }

    // Populate form fields by ID
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };
    
    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };
    
    // Company Info
    setVal('affCompanyName', affiliate.company_name);
    // Handle address 1 from multiple possible column names
    const address1 = affiliate.primary_address || affiliate.address_1 || affiliate['address 1'] || affiliate['Address 1'] || '';
    console.log('📍 Address 1 resolved to:', address1, 'from fields:', { primary_address: affiliate.primary_address, address_1: affiliate.address_1, 'address 1': affiliate['address 1'], 'Address 1': affiliate['Address 1'] });
    setVal('affAddress', address1);
    setVal('affAddress2', affiliate.address_line2 || affiliate.address_2 || affiliate['address 2'] || affiliate['Address 2'] || '');
    setVal('affCity', affiliate.city);
    setVal('affState', affiliate.state);
    setVal('affZip', affiliate.zip);
    setVal('affCountry', affiliate.country);
    setVal('affSchool', affiliate.school);
    setVal('affTaxId', affiliate.tax_id_ssn);
    setVal('affMarketsServiced', affiliate.markets_serviced);
    
    // Primary Contact
    setVal('affFirstName', affiliate.first_name);
    setVal('affLastName', affiliate.last_name);
    setVal('affPhone', affiliate.phone);
    setVal('affPhoneExt', affiliate.phone_ext);
    setVal('affFax', affiliate.fax);
    setVal('affFaxExt', affiliate.fax_ext);
    setVal('affEmail', affiliate.email);
    setVal('affWebsite', affiliate.website);
    
    // Send options
    setCheck('affSendEmail', affiliate.send_trip_email);
    setCheck('affSendSms', affiliate.send_trip_sms);
    setCheck('affSendFax', affiliate.send_trip_fax);
    setCheck('affDontSendAuto', affiliate.dont_send_auto_notifications);
    
    // Notes and Settings
    setVal('affNotes', affiliate.internal_notes);
    setVal('affStatus', affiliate.status || 'ACTIVE');
    setVal('affPriority', affiliate.learned_priority);
    setVal('affTurnaround', affiliate.turnaround_monitor_code);
    
    // Web Access
    setVal('affUsername', affiliate.web_username);
    setVal('affPassword', affiliate.web_password);
    
    // Rental Agreement
    setVal('affRentalAgreement', affiliate.rental_agreement);
    
    // Alt contact
    setVal('affAltFirstName', affiliate.alt_first_name);
    setVal('affAltLastName', affiliate.alt_last_name);
    setVal('affAltPhone', affiliate.alt_phone);
    setVal('affAltPhoneExt', affiliate.alt_phone_ext);
    setVal('affAltFax', affiliate.alt_fax);
    setVal('affAltFaxExt', affiliate.alt_fax_ext);
    setVal('affAltEmail', affiliate.alt_email);
    setCheck('affAltSendEmail', affiliate.alt_send_trip_email);
    setCheck('affAltSendSms', affiliate.alt_send_trip_sms);

    console.log('📝 Loaded affiliate form:', affiliate.company_name || affiliate.id);
  }
  
  clearAffiliateForm() {
    this.currentAffiliate = null;
    const form = document.querySelector('.affiliates-form-panel');
    if (!form) return;

    // Reset title
    const formTitle = form.querySelector('h3');
    if (formTitle) {
      formTitle.textContent = 'Select an Affiliate or Add New';
    }

    // Clear all text inputs and textareas
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
    inputs.forEach(input => input.value = '');
    
    // Reset checkboxes
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    
    // Reset selects to first option
    const selects = form.querySelectorAll('select');
    selects.forEach(select => {
      if (select.id === 'affStatus') {
        select.value = 'ACTIVE';
      } else {
        select.selectedIndex = 0;
      }
    });
    
    console.log('📝 Affiliate form cleared');
  }

  loadDriverForm(driver) {
    this.currentDriver = driver;
    const form = document.querySelector('.drivers-form-panel');
    if (!form) return;

    // Update form title
    const formTitle = document.getElementById('driverFormTitle');
    if (formTitle) {
      formTitle.textContent = `Edit Driver: ${driver.first_name} ${driver.last_name}`;
    }

    this.renderDriverContactSummary(driver);

    // Apply availability status to dropdown
    const statusSelect = document.getElementById('driverStatusSelect');
    if (statusSelect) {
      const allowedStatuses = ['available','enroute','arrived','passenger_onboard','busy','offline'];
      let normalizedStatus = (driver.driver_status || driver.status || 'available').toString().toLowerCase();

      // If an override exists, prefer it so the form shows the last saved availability
      try {
        const rawOverrides = localStorage.getItem('relia_driver_status_overrides');
        const parsedOverrides = rawOverrides ? JSON.parse(rawOverrides) : [];
        if (Array.isArray(parsedOverrides)) {
          const match = parsedOverrides.find(o => String(o.id) === String(driver.id) && o.status);
          if (match) {
            normalizedStatus = match.status.toString().toLowerCase();
          }
        }
      } catch (err) {
        console.warn('Unable to read driver overrides for form load:', err);
      }

      statusSelect.value = allowedStatuses.includes(normalizedStatus) ? normalizedStatus : 'available';
    }

    // Populate form fields with driver data
    const fields = form.querySelectorAll('input, select, textarea');

    // Reset field values so a previous driver's data does not linger when a field is blank for this driver
    fields.forEach((field) => {
      if (field.type === 'checkbox') {
        field.checked = false;
      } else if (field.tagName === 'SELECT') {
        field.selectedIndex = 0;
      } else {
        field.value = '';
      }
    });
    const normalizeLabel = (text) => (text || '')
      .replace(/\*/g, '')
      .replace(/[:#']/g, '')
      .replace(/\//g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const setFieldValue = (field, value) => {
      const finalValue = value ?? '';
      if (field.tagName === 'SELECT') {
        field.value = finalValue;
      } else {
        field.value = finalValue;
      }
    };

    fields.forEach((field) => {
      const labelEl = field.previousElementSibling;
      if (!labelEl || labelEl.tagName.toLowerCase() !== 'label') {
        return;
      }

      const label = normalizeLabel(labelEl.textContent);
      if (!label) {
        return;
      }

      if (label.startsWith('first name')) {
        setFieldValue(field, driver.first_name || '');
      } else if (label.startsWith('last name')) {
        setFieldValue(field, driver.last_name || '');
      } else if (label.includes('email')) {
        setFieldValue(field, driver.email || driver.contact_email || '');
      } else if (label.includes('cellular phone') || label.includes('cell phone') || label.includes('mobile')) {
        setFieldValue(field, driver.cell_phone || driver.phone || driver.mobile_phone || driver.phone_number || '');
      } else if (label.includes('home phone')) {
        setFieldValue(field, driver.home_phone || driver.phone_home || driver.secondary_phone || '');
      } else if (label.includes('pager') && label.includes('other')) {
        setFieldValue(field, driver.other_phone || driver.pager || driver.pager_phone || '');
      } else if (label.includes('fax')) {
        setFieldValue(field, driver.fax || driver.fax_number || '');
      } else if (label.includes('phone')) {
        setFieldValue(field, driver.cell_phone || driver.phone || '');
      } else if (label === 'primary address') {
        setFieldValue(field, driver.primary_address || driver.address || '');
      } else if (label === 'city') {
        setFieldValue(field, driver.city || '');
      } else if (label.startsWith('state')) {
        setFieldValue(field, driver.state || driver.state_province || '');
      } else if (label.includes('zip') || label.includes('postal')) {
        setFieldValue(field, driver.postal_code || driver.zip || driver.zip_post || '');
      } else if (label.includes('driver s license')) {
        setFieldValue(field, driver.license_number || '');
      } else if (label === 'badge other id') {
        setFieldValue(field, driver.badge_id || driver.other_id || '');
      } else if (label === 'social security') {
        setFieldValue(field, driver.social_security || driver.ssn || '');
      } else if (label === 'dob') {
        setFieldValue(field, driver.dob || driver.date_of_birth || '');
      } else if (label === 'driver payroll id') {
        setFieldValue(field, driver.payroll_id || '');
      } else if (label === 'hire date') {
        setFieldValue(field, driver.hire_date || '');
      } else if (label === 'termination date') {
        setFieldValue(field, driver.termination_date || '');
      } else if (label === 'driver notes') {
        setFieldValue(field, driver.driver_notes || '');
      }
    });

    console.log('✅ Driver form loaded:', driver);
  }

  async saveDriver() {
    try {
      const form = document.querySelector('.drivers-form-panel');
      if (!form) {
        console.warn('⚠️ Driver form panel not found');
        return;
      }

      const normalizeLabel = (text) => (text || '')
        .replace(/\*/g, '')
        .replace(/[:#']/g, '')
        .replace(/\//g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const labelControlMap = new Map();
      const allLabels = Array.from(form.querySelectorAll('label'));

      const resolveControl = (labelEl) => {
        if (!labelEl) return null;
        const nested = labelEl.querySelector('input, select, textarea');
        if (nested) return nested;

        let sibling = labelEl.nextElementSibling;
        while (sibling) {
          if (sibling.matches?.('input, select, textarea')) {
            return sibling;
          }
          const descendant = sibling.querySelector?.('input, select, textarea');
          if (descendant) {
            return descendant;
          }
          sibling = sibling.nextElementSibling;
        }
        return null;
      };

      allLabels.forEach((labelEl) => {
        const key = normalizeLabel(labelEl.textContent);
        if (!key) return;

        const control = resolveControl(labelEl);
        if (!control) return;

        if (!labelControlMap.has(key)) {
          labelControlMap.set(key, []);
        }
        labelControlMap.get(key).push(control);
      });

      const coalesceString = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
      };

      const readControl = (labelKey, index = 0) => {
        const list = labelControlMap.get(labelKey);
        return list && list[index] ? list[index] : null;
      };

      const readString = (labelKey, index = 0) => {
        const control = readControl(labelKey, index);
        if (!control) return null;
        return coalesceString(control.value);
      };

      const readRawString = (labelKey, index = 0) => {
        const control = readControl(labelKey, index);
        if (!control) return '';
        const value = control.value;
        return typeof value === 'string' ? value.trim() : value;
      };

      const readBoolean = (labelKey, index = 0) => {
        const control = readControl(labelKey, index);
        if (!control) return false;
        return Boolean(control.checked);
      };

      const readNumber = (labelKey, index = 0) => {
        const raw = readRawString(labelKey, index);
        if (!raw) return null;
        const cleaned = raw.replace(/[^0-9.\-]/g, '');
        if (!cleaned) return null;
        const parsed = Number.parseFloat(cleaned);
        return Number.isNaN(parsed) ? null : parsed;
      };

      const requiredFirstName = readRawString('first name');
      const requiredLastName = readRawString('last name');

      if (!requiredFirstName || !requiredLastName) {
        alert('Please enter First Name and Last Name');
        return;
      }

      const providerControls = labelControlMap.get('provider') || [];
      const expDateControls = labelControlMap.get('exp date') || [];
      const regularControls = labelControlMap.get('regular') || [];
      const overtimeControls = labelControlMap.get('overtime') || [];
      const doubleTimeControls = labelControlMap.get('double time') || [];

      const statusSelect = document.getElementById('driverStatusSelect');
      const driverStatus = (statusSelect?.value || 'available').toLowerCase();

      const employmentStatus = (readString('status') || 'ACTIVE').toUpperCase();

      const driverData = {
        first_name: requiredFirstName,
        last_name: requiredLastName,
        primary_address: readString('primary address'),
        address_line2: readString('add zip'),
        city: readString('city'),
        state: readString('state prov') || readString('state'),
        postal_code: readString('zip post') || readString('postal code'),
        license_number: readString('drivers license'),
        license_state: readString('dl state'),
        license_exp_date: expDateControls[0] ? coalesceString(expDateControls[0].value) : null,
        badge_id: readString('badge other id'),
        badge_exp_date: expDateControls[1] ? coalesceString(expDateControls[1].value) : null,
        ssn: readString('social security') || readString('ssn'),
        dob: readString('dob'),
        tlc_license_number: readString('tlc drivers license'),
        tlc_license_exp_date: expDateControls[2] ? coalesceString(expDateControls[2].value) : null,
        payroll_id: readString('driver payroll id'),
        hire_date: readString('hire date'),
        termination_date: readString('termination date'),
        cell_phone: readString('cellular phone') || readString('cell phone') || readString('mobile phone'),
        cell_phone_provider: providerControls[0] ? coalesceString(providerControls[0].value) : null,
        home_phone: readString('home phone'),
        fax: readString('fax'),
        other_phone: readString('pager other'),
        other_phone_provider: providerControls[1] ? coalesceString(providerControls[1].value) : null,
        email: readString('email address'),
        suppress_auto_notifications: readBoolean("don't send auto notifications") || readBoolean('dont send auto notifications'),
        show_call_email_dispatch: readBoolean('show both call and email on dispatch'),
        quick_edit_dispatch: readBoolean('quick edit driver info on dispatch'),
        include_phone_home: readBoolean('home'),
        include_phone_cell: readBoolean('cell'),
        include_phone_other: readBoolean('other'),
        dispatch_display_name: readString('name to display in dispatch'),
        trip_sheets_display_name: readString('name to display on trip sheets'),
        driver_level: readString('driver level'),
        is_vip: readBoolean('vip'),
        assigned_vehicle_id: readString('assign driver to car'),
        driver_alias: readString('assign driver to alias'),
        driver_group: readString('assign driver to group'),
        driver_notes: readString('driver notes'),
        web_username: readString('username'),
        web_password: readString('password'),
        type: readString('type'),
        status: employmentStatus,
        web_access: readString('web access'),
        trip_regular_rate: regularControls[0] ? readNumber('regular', 0) : null,
        trip_overtime_rate: overtimeControls[0] ? readNumber('overtime', 0) : null,
        trip_double_time_rate: doubleTimeControls[0] ? readNumber('double time', 0) : null,
        travel_regular_rate: regularControls[1] ? readNumber('regular', 1) : null,
        travel_overtime_rate: overtimeControls[1] ? readNumber('overtime', 1) : null,
        travel_double_time_rate: doubleTimeControls[1] ? readNumber('double time', 1) : null,
        passenger_regular_rate: regularControls[2] ? readNumber('regular', 2) : null,
        passenger_overtime_rate: overtimeControls[2] ? readNumber('overtime', 2) : null,
        passenger_double_time_rate: doubleTimeControls[2] ? readNumber('double time', 2) : null,
        driver_status: driverStatus
      };

      const contactEmail = driverData.email || null;
      driverData.cell_phone = driverData.cell_phone || null;
      driverData.home_phone = driverData.home_phone || null;
      driverData.other_phone = driverData.other_phone || null;
      driverData.contact_email = contactEmail;

      const assignedVehicleRaw = readRawString('assign driver to car');
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      driverData.assigned_vehicle_id = uuidPattern.test(assignedVehicleRaw) ? assignedVehicleRaw : null;

      if (driverData.web_access) {
        driverData.web_access = driverData.web_access.toUpperCase();
      }

      driverData.updated_at = new Date().toISOString();

      let result;
      const isUpdating = Boolean(this.currentDriver?.id);
      if (isUpdating) {
        result = await updateDriver(this.currentDriver.id, driverData);
        if (!result) throw new Error('Failed to update driver');
        console.log('✅ Driver updated:', result);
        alert('Driver updated successfully!');
      } else {
        result = await createDriver(driverData);
        if (!result) throw new Error('Failed to create driver');
        console.log('✅ Driver created:', result);
        alert('Driver created successfully!');
      }

      this.currentDriver = result;

      // Sync availability overrides for driver-availability board
      try {
        const raw = localStorage.getItem('relia_driver_status_overrides');
        const overrides = raw ? JSON.parse(raw) : [];
        const safeOverrides = Array.isArray(overrides) ? overrides : [];
        const existing = safeOverrides.find(o => String(o.id) === String(result.id));
        if (existing) {
          existing.status = driverStatus;
          existing.updatedAt = new Date().toISOString();
        } else {
          safeOverrides.push({ id: result.id, status: driverStatus, notes: '', updatedAt: new Date().toISOString() });
        }
        localStorage.setItem('relia_driver_status_overrides', JSON.stringify(safeOverrides));
        localStorage.setItem('relia_driver_status_overrides_timestamp', Date.now().toString());
      } catch (e) {
        console.warn('Unable to sync driver availability override:', e.message);
      }

      // Keep cached driver directory in sync with the chosen status so pages without overrides still show it
      try {
        this.updateCachedDriverDirectoryStatus(result.id, driverStatus);
      } catch (e) {
        console.warn('Unable to cache driver status locally:', e.message);
      }

      const driverIdToSelect = result.id;
      await this.loadDriversList(driverIdToSelect);
      if (driverIdToSelect) {
        const updatedDriver = this.drivers.find((d) => d.id === driverIdToSelect) || result;
        this.renderDriverContactSummary(updatedDriver || null);
      }
    } catch (error) {
      console.error('❌ Error saving driver:', error);
      alert('Error saving driver: ' + error.message);
    }
  }

  updateCachedDriverDirectoryStatus(driverId, driverStatus) {
    const normalizedId = String(driverId);
    try {
      const raw = localStorage.getItem('relia_driver_directory');
      const parsed = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(parsed) ? parsed : [];

      let found = false;
      const updated = list.map(d => {
        if (String(d.id) === normalizedId) {
          found = true;
          return {
            ...d,
            driver_status: driverStatus,
            status: driverStatus.toUpperCase ? driverStatus.toUpperCase() : driverStatus
          };
        }
        return d;
      });

      if (!found) {
        updated.push({ id: driverId, driver_status: driverStatus, status: driverStatus.toUpperCase ? driverStatus.toUpperCase() : driverStatus });
      }

      localStorage.setItem('relia_driver_directory', JSON.stringify(updated));
    } catch (e) {
      console.warn('Unable to update cached driver directory:', e.message);
    }
  }

  renderDriverContactSummary(driver) {
    const body = document.getElementById('driverContactSummaryBody');
    if (!body) return;

    const formatValue = (value) => {
      if (!value) return '<span style="color:#b0bec5;">—</span>';
      return `${value}`;
    };

    const normalized = driver || {};
    const cellPhone = normalized.cell_phone || normalized.phone || normalized.mobile_phone || normalized.phone_number || normalized.primary_phone || '';
    const cellProvider = normalized.cell_phone_provider || normalized.phone_provider || '';
    const homePhone = normalized.home_phone || normalized.phone_home || normalized.secondary_phone || '';
    const otherPhone = normalized.other_phone || normalized.pager || normalized.pager_phone || '';
    const email = normalized.email || normalized.contact_email || normalized.primary_email || '';

    const rows = [
      { label: 'Cellular Phone *', column: 'cell_phone', value: cellPhone },
      { label: 'Cell Provider', column: 'cell_phone_provider', value: cellProvider },
      { label: 'Home Phone', column: 'home_phone', value: homePhone },
      { label: 'Pager / Other', column: 'other_phone', value: otherPhone },
      { label: 'Email Address', column: 'email', value: email }
    ];

    body.innerHTML = rows.map(row => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e0e0e0;">${row.label}</td>
        <td style="padding: 6px 8px; border: 1px solid #e0e0e0; font-family: 'Courier New', monospace;">${row.column}</td>
        <td style="padding: 6px 8px; border: 1px solid #e0e0e0;">${formatValue(row.value)}</td>
      </tr>
    `).join('');
  }

  async deleteDriver() {
    if (!this.currentDriver?.id) {
      alert('No driver selected');
      return;
    }

    if (!confirm(`Delete ${this.currentDriver.first_name} ${this.currentDriver.last_name}?`)) {
      return;
    }

    try {
      await deleteDriver(this.currentDriver.id);
      console.log('✅ Driver deleted');
      alert('Driver deleted successfully!');
      
      // Reload drivers list
      await this.loadDriversList();
      
      // Clear form
      const form = document.querySelector('.drivers-form-panel');
      if (form) form.reset();
      this.currentDriver = null;
    } catch (error) {
      console.error('❌ Error deleting driver:', error);
      alert('Error deleting driver: ' + error.message);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new MyOffice();
});
