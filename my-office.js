// Import API service
import { setupAPI, apiFetch, fetchDrivers, createDriver, updateDriver, deleteDriver, fetchAffiliates, createAffiliate, updateAffiliate, deleteAffiliate, fetchVehicleTypes, upsertVehicleType, deleteVehicleType, fetchActiveVehicles, uploadVehicleTypeImage, fetchVehicleTypeImages, deleteVehicleTypeImage, updateVehicleTypeImage } from './api-service.js';
import { wireMainNav } from './navigation.js';
import { loadServiceTypes, SERVICE_TYPES_STORAGE_KEY } from './service-types-store.js';
import { loadPolicies, upsertPolicy, deletePolicyById, getActivePolicies, POLICIES_STORAGE_KEY, normalizePolicy } from './policies-store.js';
import { MapboxService } from './MapboxService.js';
import { googleMapsService } from './GoogleMapsService.js';

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
    this.serviceTypes = [];
    this.policies = [];
    this.selectedPolicyId = null;
    this.currentPolicyTab = 'stored';
    this.policyShowAll = false;
    this.vehicleTypeSeeds = this.buildVehicleTypeSeeds();
    this.vehicleTypeDrafts = {};
    this.activeVehicleTypeId = null;
    this.vehicleTypeSelectionInitialized = false;
    this.vehicleTypeShowAll = false;
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
    this.mapboxService = new MapboxService();
    this.googleMapsService = googleMapsService;
    this.companyGeo = { latitude: null, longitude: null };
    this.airportGeo = { latitude: null, longitude: null };
    this.companyRouteMapExpanded = false;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupCustomFormsInteraction();
    this.setupListManagementSidebar();
    this.setupMagicLinkHelpers();
    this.setupDriversForm();
    this.setupAffiliatesForm();
    this.setupAirportAddressLookup();
    this.setupSystemUsers();
    this.setupCompanyInfoForm();
    this.setupCompanyRouteTester();
    this.setupAccountsCalendarPrefs();
    this.setupVehicleTypeSelection();
    this.setupVehicleTypeShowAllToggle();
    this.setupVehicleTypeSave();
    this.setupVehicleTypeTitleSync();
    this.setupVehicleRatesSave();
    this.setupVehicleTypeCreateDelete();
    this.populatePassengerCapacityOptions();
    this.setupServiceTypesSync();
    this.loadAndApplyServiceTypes();
    this.setupPoliciesSync();
    this.loadAndApplyPolicies();
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
      // Now that API is ready, reload fleet from all sources (Supabase + localStorage)
      await this.loadFleetFromAllSources();
      this.renderFleetList();
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

    // Policies - list selection (delegated; list is dynamic)
    const policiesList = document.getElementById('policiesList');
    if (policiesList) {
      policiesList.addEventListener('click', (e) => {
        const item = e.target?.closest?.('.policy-item');
        if (item?.dataset?.policyId) {
          this.selectPolicy(item.dataset.policyId);
        }
      });
    }

    // Policies - Policy tab switching
    document.querySelectorAll('.policy-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const policyType = e.currentTarget?.dataset?.policyType;
        if (policyType) {
          this.switchPolicyTab(policyType);
        }
      });
    });

    // Policies - buttons
    const policyShowAllBtn = document.getElementById('policyShowAllBtn');
    if (policyShowAllBtn) {
      policyShowAllBtn.addEventListener('click', () => {
        this.policyShowAll = !this.policyShowAll;
        this.renderPoliciesList();
      });
    }

    const policyAddBtn = document.getElementById('policyAddBtn');
    if (policyAddBtn) {
      policyAddBtn.addEventListener('click', () => {
        this.createNewPolicy();
      });
    }

    const policySaveBtn = document.getElementById('policySaveBtn');
    if (policySaveBtn) {
      policySaveBtn.addEventListener('click', () => this.savePolicy({ asNew: false }));
    }

    const policySaveAsBtn = document.getElementById('policySaveAsBtn');
    if (policySaveAsBtn) {
      policySaveAsBtn.addEventListener('click', () => this.savePolicy({ asNew: true }));
    }

    const policyDeleteBtn = document.getElementById('policyDeleteBtn');
    if (policyDeleteBtn) {
      policyDeleteBtn.addEventListener('click', () => this.deleteSelectedPolicy());
    }

    const policyDeleteBtnLeft = document.getElementById('policyDeleteBtnLeft');
    if (policyDeleteBtnLeft) {
      policyDeleteBtnLeft.addEventListener('click', () => this.deleteSelectedPolicy());
    }

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
    
    // Vehicle Type Image Upload
    this.setupVehicleTypeImageUpload();
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
  // VEHICLE TYPE IMAGE UPLOAD
  // ===================================

  setupVehicleTypeImageUpload() {
    const imagesContainer = document.getElementById('imagesVehicleTypeContent');
    if (!imagesContainer) return;

    // Delegate click events for upload and delete buttons
    imagesContainer.addEventListener('click', async (e) => {
      const target = e.target;
      
      // Handle Upload button clicks
      if (target.matches('.btn-primary') && target.textContent.includes('Upload')) {
        e.preventDefault();
        const row = target.closest('tr');
        if (!row) return;
        
        const fileInput = row.querySelector('input[type="file"]');
        if (!fileInput || !fileInput.files?.length) {
          alert('Please select an image file first.');
          return;
        }
        
        await this.handleVehicleTypeImageUpload(fileInput.files[0], row);
      }
      
      // Handle Delete button clicks
      if (target.matches('.btn-secondary') && target.textContent.includes('Delete')) {
        e.preventDefault();
        const row = target.closest('tr');
        if (!row) return;
        
        const imageId = row.dataset?.imageId;
        if (imageId) {
          await this.handleVehicleTypeImageDelete(imageId, row);
        } else {
          // Just clear the file input if no saved image
          const fileInput = row.querySelector('input[type="file"]');
          if (fileInput) fileInput.value = '';
          const preview = row.querySelector('img');
          if (preview) {
            preview.src = '';
            preview.style.display = 'none';
          }
          // Show placeholder
          const placeholder = row.querySelector('.vehicle-image-placeholder');
          if (placeholder) placeholder.style.display = 'flex';
        }
      }
    });

    // Preview images when file is selected
    imagesContainer.addEventListener('change', (e) => {
      if (e.target.matches('input[type="file"]')) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const row = e.target.closest('tr');
        if (!row) return;
        
        // Validate file type
        const allowedTypes = ['image/gif', 'image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
          alert('Invalid file type. Allowed: GIF, JPG, JPEG, PNG');
          e.target.value = '';
          return;
        }
        
        // Validate size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size must be less than 5MB');
          e.target.value = '';
          return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (ev) => {
          const previewContainer = row.querySelector('td:nth-child(2) > div');
          if (previewContainer) {
            // Hide placeholder, show preview image
            previewContainer.innerHTML = `<img src="${ev.target.result}" style="width: 120px; height: 120px; object-fit: cover; border: 1px solid #ddd;" />`;
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  async handleVehicleTypeImageUpload(file, row) {
    const vehicleTypeId = this.activeVehicleTypeId;
    if (!vehicleTypeId) {
      alert('Please select a vehicle type first.');
      return;
    }

    // Check if it's a valid UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vehicleTypeId);
    if (!isUUID) {
      alert('Please save this vehicle type to Supabase before uploading images.');
      return;
    }

    try {
      const uploadBtn = row.querySelector('.btn-primary');
      if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading...';
      }

      const rowIndex = parseInt(row.querySelector('td:first-child')?.textContent || '1', 10);
      const isPrimary = rowIndex === 1;

      const savedImage = await uploadVehicleTypeImage(vehicleTypeId, file, {
        isPrimary,
        displayName: file.name
      });

      console.log('✅ Image uploaded:', savedImage);

      // Mark the row with the saved image ID
      row.dataset.imageId = savedImage.id;

      // Update button state
      if (uploadBtn) {
        uploadBtn.textContent = 'Uploaded ✓';
        uploadBtn.disabled = true;
      }

      // Reload images list
      await this.loadVehicleTypeImages();

    } catch (err) {
      console.error('❌ Image upload failed:', err);
      alert(`Image upload failed: ${err.message || err}`);
      
      const uploadBtn = row.querySelector('.btn-primary');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload >>';
      }
    }
  }

  async handleVehicleTypeImageDelete(imageId, row) {
    if (!confirm('Delete this image?')) return;

    try {
      await deleteVehicleTypeImage(imageId);
      console.log('✅ Image deleted:', imageId);

      // Reset the row
      delete row.dataset.imageId;
      const fileInput = row.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      const previewContainer = row.querySelector('td:nth-child(2) > div');
      if (previewContainer) {
        previewContainer.innerHTML = `
          <div style="text-align: center; color: #999;">
            <div style="font-size: 48px; margin-bottom: 5px;">📷</div>
            <div style="font-size: 11px; font-weight: 600;">PICTURE<br>COMING<br>SOON</div>
          </div>
        `;
      }

      const uploadBtn = row.querySelector('.btn-primary');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload >>';
      }

    } catch (err) {
      console.error('❌ Image delete failed:', err);
      alert(`Delete failed: ${err.message || err}`);
    }
  }

  async loadVehicleTypeImages() {
    const vehicleTypeId = this.activeVehicleTypeId;
    if (!vehicleTypeId) return;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vehicleTypeId);
    if (!isUUID) return;

    try {
      const images = await fetchVehicleTypeImages(vehicleTypeId);
      console.log('📷 Loaded vehicle type images:', images);

      const imagesContainer = document.getElementById('imagesVehicleTypeContent');
      if (!imagesContainer) return;

      const tbody = imagesContainer.querySelector('tbody');
      if (!tbody) return;

      const rows = tbody.querySelectorAll('tr');
      
      // Reset all rows first
      rows.forEach((row, idx) => {
        delete row.dataset.imageId;
        const previewContainer = row.querySelector('td:nth-child(2) > div');
        if (previewContainer) {
          previewContainer.innerHTML = `
            <div style="text-align: center; color: #999;">
              <div style="font-size: 48px; margin-bottom: 5px;">📷</div>
              <div style="font-size: 11px; font-weight: 600;">PICTURE<br>COMING<br>SOON</div>
            </div>
          `;
        }
        const uploadBtn = row.querySelector('.btn-primary');
        if (uploadBtn) {
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'Upload >>';
        }
        const fileInput = row.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
      });

      // Populate with saved images
      images.forEach((img, idx) => {
        if (idx >= rows.length) return; // Skip if more images than rows
        
        const row = rows[idx];
        row.dataset.imageId = img.id;

        const previewContainer = row.querySelector('td:nth-child(2) > div');
        if (previewContainer && img.public_url) {
          previewContainer.innerHTML = `<img src="${img.public_url}" style="width: 120px; height: 120px; object-fit: cover; border: 1px solid #ddd;" />`;
        }

        const uploadBtn = row.querySelector('.btn-primary');
        if (uploadBtn) {
          uploadBtn.textContent = 'Replace';
        }
      });

    } catch (err) {
      console.error('❌ Failed to load vehicle type images:', err);
    }
  }

  // ===================================
  // COMPANY INFORMATION FORM
  // ===================================

  setupCompanyInfoForm() {
    // Load existing company info on page load
    this.loadCompanyInfo();

    // Wire address lookup/autofill
    this.setupCompanyAddressLookup();

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

    // Persist geocode values into hidden fields for later saves
    const latitudeInput = document.getElementById('companyLatitude');
    const longitudeInput = document.getElementById('companyLongitude');
    if (latitudeInput) latitudeInput.value = info.latitude || '';
    if (longitudeInput) longitudeInput.value = info.longitude || '';
    this.companyGeo = {
      latitude: info.latitude || null,
      longitude: info.longitude || null
    };

    // Checkbox
    const showEinCheckbox = document.getElementById('companyShowEinOnDocs');
    if (showEinCheckbox) {
      showEinCheckbox.checked = info.show_ein_on_docs || false;
    }
  }

  setupCompanyAddressLookup() {
    const addressInput = document.getElementById('companyStreetAddress');
    const suggestions = document.getElementById('companyAddressSuggestions');
    if (!addressInput || !suggestions) {
      return;
    }

    let debounceTimer;
    addressInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = (e.target?.value || '').trim();
      if (query.length < 3) {
        suggestions.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await this.mapboxService.geocodeAddress(query);
        this.showCompanyAddressSuggestions(addressInput, suggestions, results);
      }, 300);
    });

    addressInput.addEventListener('blur', () => {
      setTimeout(() => suggestions.classList.remove('active'), 200);
    });
  }

  setupCompanyRouteTester() {
    const originInput = document.getElementById('companyRouteOrigin');
    const destinationInput = document.getElementById('companyRouteDestination');
    const runBtn = document.getElementById('companyRouteRun');
    const expandBtn = document.getElementById('companyRouteExpandBtn');
    const mapCard = document.getElementById('companyRouteMapCard');

    if (!originInput || !destinationInput || !runBtn) return;

    // Prefill origin from company address if empty
    const prefillOrigin = () => {
      const assembled = this.buildCompanyAddressString();
      if (assembled && !originInput.value) {
        originInput.value = assembled;
      }
    };
    prefillOrigin();

    runBtn.addEventListener('click', () => {
      this.runCompanyRouteLookup();
    });

    [originInput, destinationInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.runCompanyRouteLookup();
        }
      });
    });

    if (expandBtn && mapCard) {
      expandBtn.addEventListener('click', () => {
        this.companyRouteMapExpanded = !this.companyRouteMapExpanded;
        mapCard.classList.toggle('expanded', this.companyRouteMapExpanded);
        expandBtn.textContent = this.companyRouteMapExpanded ? 'Collapse Map' : 'Expand Map';
      });
    }
  }

  buildCompanyAddressString() {
    const address1 = document.getElementById('companyStreetAddress')?.value?.trim();
    const address2 = document.getElementById('companyStreetAddress2')?.value?.trim();
    const city = document.getElementById('companyCity')?.value?.trim();
    const state = document.getElementById('companyState')?.value?.trim();
    const zip = document.getElementById('companyZipCode')?.value?.trim();

    return [address1, address2, city, state, zip].filter(Boolean).join(', ');
  }

  async runCompanyRouteLookup() {
    const originInput = document.getElementById('companyRouteOrigin');
    const destinationInput = document.getElementById('companyRouteDestination');
    const distanceEl = document.getElementById('companyRouteDistance');
    const durationEl = document.getElementById('companyRouteDuration');
    const statusEl = document.getElementById('companyRouteStatus');

    if (!originInput || !destinationInput || !distanceEl || !durationEl) return;

    const origin = (originInput.value || '').trim();
    const destination = (destinationInput.value || '').trim();

    if (!origin || !destination) {
      statusEl.textContent = 'Enter both origin and destination.';
      return;
    }

    statusEl.textContent = 'Looking up route via Google...';
    distanceEl.textContent = '-';
    durationEl.textContent = '-';

    try {
      const summary = await this.googleMapsService.getRouteSummary({ origin, destination });
      if (!summary) {
        statusEl.textContent = 'No route found.';
        return;
      }

      distanceEl.textContent = summary.distanceText || '-';
      durationEl.textContent = summary.durationText || '-';
      statusEl.textContent = 'Route loaded.';

      // Render map with Mapbox (visual only) using the two addresses
      this.renderCompanyRouteMap(origin, destination).catch((err) => {
        console.warn('Map render failed:', err);
      });
    } catch (err) {
      console.warn('Route lookup failed:', err);
      statusEl.textContent = 'Route lookup failed.';
    }
  }

  async renderCompanyRouteMap(origin, destination) {
    const mapImg = document.getElementById('companyRouteMapImg');
    const mapCard = document.getElementById('companyRouteMapCard');
    if (!mapImg || !mapCard) return;

    const token = this.mapboxService?.accessToken;
    if (!token || token === 'YOUR_MAPBOX_TOKEN_HERE') {
      mapImg.alt = 'Mapbox token missing';
      return;
    }

    const [origGeo, destGeo] = await Promise.all([
      this.mapboxService.geocodeAddress(origin),
      this.mapboxService.geocodeAddress(destination)
    ]);

    const origCoords = Array.isArray(origGeo) && origGeo[0]?.coordinates ? origGeo[0].coordinates : null;
    const destCoords = Array.isArray(destGeo) && destGeo[0]?.coordinates ? destGeo[0].coordinates : null;

    if (!origCoords || !destCoords) {
      mapImg.alt = 'Could not geocode addresses for map.';
      return;
    }

    const [origLng, origLat] = origCoords;
    const [destLng, destLat] = destCoords;

    // Build static map with two pins and a path
    const markers = [
      `pin-s-a+285A98(${origLng},${origLat})`,
      `pin-s-b+cc3333(${destLng},${destLat})`
    ];
    const path = `path-4+285A98-0.7(${origLng},${origLat};${destLng},${destLat})`;

    const centerLng = (origLng + destLng) / 2;
    const centerLat = (origLat + destLat) / 2;

    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/${markers.join(',')},${path}/${centerLng},${centerLat},9/480x320?access_token=${token}`;

    mapImg.src = url;
    mapImg.alt = 'Route map preview';
  }

  showCompanyAddressSuggestions(inputElement, suggestionsContainer, results) {
    if (!results || results.length === 0) {
      suggestionsContainer.classList.remove('active');
      return;
    }

    suggestionsContainer.innerHTML = results.map((result, index) => `
      <div class="address-suggestion-item" data-index="${index}">
        <div class="suggestion-main">${result.name}</div>
        <div class="suggestion-secondary">${result.address}</div>
      </div>
    `).join('');

    suggestionsContainer.querySelectorAll('.address-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectCompanyAddress(results[index]);
        suggestionsContainer.classList.remove('active');
      });
    });

    suggestionsContainer.classList.add('active');
  }

  selectCompanyAddress(addressData) {
    const latitude = Array.isArray(addressData.coordinates) ? addressData.coordinates[1] : null;
    const longitude = Array.isArray(addressData.coordinates) ? addressData.coordinates[0] : null;

    // Parse address components from the full address
    const fullAddress = addressData.address || addressData.name || '';
    const city = addressData.context?.city || addressData.context?.place || '';
    const stateRaw = addressData.context?.state || '';
    const zip = addressData.context?.zipcode || addressData.context?.postcode || '';
    
    // Extract just the street address (first part before city)
    let streetAddress = fullAddress;
    if (city && fullAddress.includes(city)) {
      streetAddress = fullAddress.split(city)[0].replace(/,\s*$/, '').trim();
    } else if (fullAddress.includes(',')) {
      // Fallback: take everything before the first comma after the house number
      const parts = fullAddress.split(',');
      streetAddress = parts[0].trim();
    }
    
    // Convert state name to abbreviation if needed
    const stateAbbreviations = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    };
    let state = stateRaw;
    if (stateRaw && stateRaw.length > 2) {
      const abbrev = stateAbbreviations[stateRaw.toLowerCase()];
      if (abbrev) state = abbrev;
    }

    const addressInput = document.getElementById('companyStreetAddress');
    const cityInput = document.getElementById('companyCity');
    const stateInput = document.getElementById('companyState');
    const zipInput = document.getElementById('companyZipCode');
    const latitudeInput = document.getElementById('companyLatitude');
    const longitudeInput = document.getElementById('companyLongitude');

    if (addressInput) addressInput.value = streetAddress;
    if (cityInput) cityInput.value = city;
    if (stateInput) stateInput.value = state;
    if (zipInput) zipInput.value = zip;
    if (latitudeInput) latitudeInput.value = latitude ?? '';
    if (longitudeInput) longitudeInput.value = longitude ?? '';

    this.companyGeo = { latitude, longitude };
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
      latitude: parseFloat(document.getElementById('companyLatitude')?.value) || null,
      longitude: parseFloat(document.getElementById('companyLongitude')?.value) || null,
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
  // ---------- Policies / Agreements ----------
  setupPoliciesSync() {
    // Refresh when another page (like Service Types iframe) updates policies storage
    window.addEventListener('storage', (e) => {
      if (!e) return;
      if (e.key === POLICIES_STORAGE_KEY) {
        this.loadAndApplyPolicies();
      }
    });
  }

  async loadAndApplyPolicies() {
    try {
      const preferRemote = !!this.apiReady; // only try Supabase after auth init
      let policies = await loadPolicies({ includeInactive: true, preferRemote });

      // Seed if empty (grab current editor content as first “standard” agreement)
      if (!Array.isArray(policies) || !policies.length) {
        policies = this.seedDefaultPoliciesFromEditor();
        // Persist to storage immediately so other pages (Service Types) can use them
        for (const p of policies) {
          await upsertPolicy(p, { preferRemote: false });
        }
      }

      this.policies = Array.isArray(policies) ? policies.map(normalizePolicy) : [];
      this.renderPoliciesList();

      // Auto-select first policy in the current tab if none selected
      if (!this.selectedPolicyId) {
        const first = this.getPoliciesForCurrentTab()[0];
        if (first?.id) this.selectPolicy(first.id);
      }
    } catch (err) {
      console.warn('Policies: load failed; continuing with empty list.', err);
      this.policies = this.policies || [];
      this.renderPoliciesList();
    }
  }

  seedDefaultPoliciesFromEditor() {
    const nameEl = document.getElementById('policyName');
    const typeEl = document.getElementById('policyType');
    const statusEl = document.getElementById('policyStatus');

    const initialName = (nameEl?.value || 'Standard Agreement').toString().trim() || 'Standard Agreement';
    const initialType = (typeEl?.value || 'rental').toString().trim().toLowerCase() || 'rental';
    const initialActive = (statusEl?.value || 'active') !== 'inactive';

    const agreementHtml = this.getEditorHtml() || '<p><strong>Standard Agreement</strong></p><p>Enter agreement text here.</p>';
    const privacyHtml =
      '<h2>Privacy Policy</h2>' +
      '<p>This Privacy Policy describes how we collect, use, and protect customer information.</p>' +
      '<p><strong>Information we collect:</strong> Name, contact details, pickup/dropoff locations, and payment details.</p>' +
      '<p><strong>How we use it:</strong> To provide transportation services, confirmations, receipts, and support.</p>' +
      '<p><strong>Sharing:</strong> Only with drivers/affiliates needed to fulfill trips, and payment processors as required.</p>' +
      '<p><strong>Contact:</strong> Add your company contact email/phone here.</p>';

    const standardAgreement = normalizePolicy({
      id: crypto?.randomUUID?.() || undefined,
      name: initialName,
      type: initialType,
      active: initialActive,
      status: initialActive ? 'active' : 'inactive',
      sort_order: 10,
      html: agreementHtml
    });

    const privacyPolicy = normalizePolicy({
      id: crypto?.randomUUID?.() || undefined,
      name: 'Privacy Policy',
      type: 'privacy',
      active: true,
      status: 'active',
      sort_order: 20,
      html: privacyHtml
    });

    return [standardAgreement, privacyPolicy];
  }

  getPoliciesForCurrentTab() {
    const tab = this.currentPolicyTab || 'stored';
    const showAll = !!this.policyShowAll;

    const inTab = (p) => {
      if (tab === 'privacy') return (p.type || '').toLowerCase() === 'privacy';
      // “Stored Agreements” tab shows everything except privacy
      return (p.type || '').toLowerCase() !== 'privacy';
    };

    let list = Array.isArray(this.policies) ? this.policies.filter(inTab) : [];
    if (!showAll) list = list.filter((p) => p.active);

    // deterministic ordering
    list.sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || a.name.localeCompare(b.name));
    return list;
  }

  renderPoliciesList() {
    const listEl = document.getElementById('policiesList');
    if (!listEl) return;

    const showAllBtn = document.getElementById('policyShowAllBtn');
    if (showAllBtn) {
      showAllBtn.textContent = this.policyShowAll ? 'Show Active' : 'Show All';
    }

    const policies = this.getPoliciesForCurrentTab();
    listEl.innerHTML = '';

    if (!policies.length) {
      const empty = document.createElement('div');
      empty.style.padding = '10px';
      empty.style.color = '#777';
      empty.textContent = 'No policies found. Click “Add New Agreement” to create one.';
      listEl.appendChild(empty);
      return;
    }

    policies.forEach((p) => {
      const item = document.createElement('div');
      item.className = 'policy-item';
      if (p.id === this.selectedPolicyId) item.classList.add('active');
      if (!p.active) item.classList.add('inactive');
      item.dataset.policyId = p.id;

      const name = document.createElement('div');
      name.className = 'policy-item-name';
      name.textContent = p.active ? p.name : `${p.name} (Inactive)`;
      item.appendChild(name);

      listEl.appendChild(item);
    });
  }

  selectPolicy(policyId) {
    this.selectedPolicyId = policyId;

    const policy = Array.isArray(this.policies) ? this.policies.find((p) => p.id === policyId) : null;
    if (!policy) {
      this.renderPoliciesList();
      return;
    }

    // Update list highlight
    this.renderPoliciesList();

    // Populate editor fields
    const nameEl = document.getElementById('policyName');
    const typeEl = document.getElementById('policyType');
    const statusEl = document.getElementById('policyStatus');
    const useDefaultEl = document.getElementById('useAsDefault');
    const farmoutEl = document.getElementById('defaultFarmoutAgreement');

    if (nameEl) nameEl.value = policy.name || '';
    if (typeEl) typeEl.value = (policy.type || 'rental').toLowerCase();
    if (statusEl) statusEl.value = policy.active ? 'active' : 'inactive';
    if (useDefaultEl) useDefaultEl.checked = !!policy.use_as_default;
    if (farmoutEl) farmoutEl.checked = !!policy.default_farmout;

    this.setEditorHtml(policy.html || '');
  }

  switchPolicyTab(policyType) {
    this.currentPolicyTab = policyType || 'stored';

    // Update tab active state
    document.querySelectorAll('.policy-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.policyType === this.currentPolicyTab) {
        tab.classList.add('active');
      }
    });

    // Reset selection to first item in tab
    this.selectedPolicyId = null;
    this.renderPoliciesList();
    const first = this.getPoliciesForCurrentTab()[0];
    if (first?.id) this.selectPolicy(first.id);
  }

  getEditorHtml() {
    const sourceEl = document.getElementById('htmlEditorSource');
    const editorEl = document.getElementById('htmlEditor');

    // If source view is visible, it is the source of truth
    if (sourceEl && sourceEl.style.display !== 'none') {
      return (sourceEl.value || '').toString();
    }
    if (editorEl) return (editorEl.innerHTML || '').toString();
    return '';
  }

  setEditorHtml(html) {
    const sourceEl = document.getElementById('htmlEditorSource');
    const editorEl = document.getElementById('htmlEditor');

    if (sourceEl) sourceEl.value = html || '';
    if (editorEl) editorEl.innerHTML = html || '';
  }

  getPolicyDraftFromEditor() {
    const nameEl = document.getElementById('policyName');
    const typeEl = document.getElementById('policyType');
    const statusEl = document.getElementById('policyStatus');
    const useDefaultEl = document.getElementById('useAsDefault');
    const farmoutEl = document.getElementById('defaultFarmoutAgreement');

    const name = (nameEl?.value || '').toString().trim() || 'Untitled Policy';
    const type = (typeEl?.value || 'rental').toString().trim().toLowerCase();
    const active = (statusEl?.value || 'active') !== 'inactive';

    const html = this.getEditorHtml();

    return normalizePolicy({
      id: this.selectedPolicyId || undefined,
      name,
      type,
      active,
      status: active ? 'active' : 'inactive',
      use_as_default: !!useDefaultEl?.checked,
      default_farmout: !!farmoutEl?.checked,
      html,
      sort_order: 0
    });
  }

  async createNewPolicy() {
    const draft = this.getPolicyDraftFromEditor();
    const tab = this.currentPolicyTab || 'stored';

    const type = tab === 'privacy' ? 'privacy' : 'rental';
    const p = normalizePolicy({
      id: crypto?.randomUUID?.() || undefined,
      name: tab === 'privacy' ? 'New Privacy Policy' : 'New Agreement',
      type,
      active: true,
      status: 'active',
      html: type === 'privacy'
        ? '<h2>Privacy Policy</h2><p>Enter your privacy policy here...</p>'
        : '<p><strong>Agreement</strong></p><p>Enter agreement text here...</p>',
      sort_order: (this.policies?.length || 0) + 100
    });

    const saved = await upsertPolicy(p, { preferRemote: !!this.apiReady });

    // refresh local memory
    const idx = (this.policies || []).findIndex((x) => x.id === saved.id);
    if (idx >= 0) this.policies[idx] = saved;
    else this.policies.push(saved);

    this.currentPolicyTab = saved.type === 'privacy' ? 'privacy' : 'stored';
    this.selectPolicy(saved.id);
    this.renderPoliciesList();
  }

  async savePolicy({ asNew = false } = {}) {
    const draft = this.getPolicyDraftFromEditor();

    const willBeNew = asNew || !this.selectedPolicyId;
    const id = willBeNew ? (crypto?.randomUUID?.() || undefined) : draft.id;

    let name = draft.name;
    if (willBeNew) {
      // If saving as new, allow rename (prompt is optional)
      const suggested = name && !name.toLowerCase().includes('copy') ? `${name} (Copy)` : name;
      const input = prompt('Save As New Policy Name:', suggested || name);
      if (input !== null) {
        name = input.toString().trim() || name;
      }
    }

    const payload = normalizePolicy({
      ...draft,
      id,
      name
    });

    const saved = await upsertPolicy(payload, { preferRemote: !!this.apiReady });

    // Update memory
    const idx = (this.policies || []).findIndex((x) => x.id === saved.id);
    if (idx >= 0) this.policies[idx] = saved;
    else this.policies.push(saved);

    this.selectedPolicyId = saved.id;
    this.currentPolicyTab = saved.type === 'privacy' ? 'privacy' : 'stored';
    this.renderPoliciesList();
    this.selectPolicy(saved.id);
  }

  async deleteSelectedPolicy() {
    if (!this.selectedPolicyId) return;
    const p = this.policies?.find((x) => x.id === this.selectedPolicyId);
    const name = p?.name || 'this policy';
    const ok = confirm(`Delete ${name}? This cannot be undone.`);
    if (!ok) return;

    await deletePolicyById(this.selectedPolicyId, { preferRemote: !!this.apiReady });

    this.policies = (this.policies || []).filter((x) => x.id !== this.selectedPolicyId);
    this.selectedPolicyId = null;
    this.renderPoliciesList();

    const first = this.getPoliciesForCurrentTab()[0];
    if (first?.id) this.selectPolicy(first.id);
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

  async navigateToResource(resource) {
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

    // Hide rate manager when switching to resources to avoid it appearing below
    const rateSection = document.getElementById('system-rate-manager-section');
    if (rateSection) {
      rateSection.style.display = 'none';
      rateSection.classList.remove('active');
    }
    document.querySelectorAll('.rate-top-tab').forEach(tab => tab.classList.remove('active'));
    const contentArea = document.querySelector('.content-area');
    if (contentArea) {
      contentArea.classList.remove('rate-manager-active');
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
        // Reload from ALL sources (Supabase + localStorage) to pick up vehicles added from other pages
        await this.loadFleetFromAllSources();
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
    // No local seeds - all vehicle types come from Supabase
    return {};
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
  setupVehicleTypeShowAllToggle() {
    const btn = document.getElementById('vehicleTypeShowAllBtn');
    if (!btn) return;

    // Initialize button text based on current state
    btn.textContent = this.vehicleTypeShowAll ? 'Show Active Types' : 'Show All Types';

    btn.addEventListener('click', async () => {
      this.vehicleTypeShowAll = !this.vehicleTypeShowAll;
      btn.textContent = this.vehicleTypeShowAll ? 'Show Active Types' : 'Show All Types';
      await this.loadVehicleTypesList();
    });
  }

  startInlineVehicleTypeRename(vehicleId) {
    const list = document.getElementById('vehicleTypeList');
    if (!list) return;

    const item = list.querySelector(`.vehicle-type-item[data-vehicle-id="${vehicleId}"]`);
    if (!item) return;

    const nameSpan = item.querySelector('.vehicle-type-name');
    if (!nameSpan) return;

    const original = (nameSpan.textContent || '').trim();

    nameSpan.setAttribute('contenteditable', 'true');
    nameSpan.classList.add('editing');
    nameSpan.focus();

    try {
      const range = document.createRange();
      range.selectNodeContents(nameSpan);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameSpan.blur();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        nameSpan.textContent = original;
        nameSpan.blur();
      }
    };

    const finish = async () => {
      nameSpan.removeEventListener('blur', finish);
      nameSpan.removeEventListener('keydown', onKeyDown);

      nameSpan.setAttribute('contenteditable', 'false');
      nameSpan.classList.remove('editing');

      const next = (nameSpan.textContent || '').trim();
      if (!next || next === original) {
        nameSpan.textContent = original;
        return;
      }

      await this.commitVehicleTypeRename(vehicleId, next);
    };

    nameSpan.addEventListener('keydown', onKeyDown);
    nameSpan.addEventListener('blur', finish);
  }

  async commitVehicleTypeRename(vehicleId, newName) {
    // Check for duplicate name before renaming
    if (this.isDuplicateVehicleTypeName(newName, vehicleId)) {
      alert(`A vehicle type named "${newName}" already exists. Please choose a different name.`);
      // Restore original name in the list
      const originalName = this.vehicleTypeSeeds?.[vehicleId]?.name || this.vehicleTypeDrafts?.[vehicleId]?.name || 'Untitled';
      const list = document.getElementById('vehicleTypeList');
      const item = list?.querySelector(`.vehicle-type-item[data-vehicle-id="${vehicleId}"]`);
      const nameSpan = item?.querySelector('.vehicle-type-name');
      if (nameSpan) nameSpan.textContent = originalName;
      return;
    }
    
    // Get the old name before updating
    const oldName = this.vehicleTypeSeeds?.[vehicleId]?.name || this.vehicleTypeDrafts?.[vehicleId]?.name || '';
    
    // Local cache so UI updates immediately
    const existing = this.vehicleTypeSeeds?.[vehicleId] || {};
    this.vehicleTypeSeeds = this.vehicleTypeSeeds || {};
    this.vehicleTypeSeeds[vehicleId] = { ...existing, id: vehicleId, name: newName, status: existing.status || 'active' };

    if (this.vehicleTypeDrafts?.[vehicleId]) {
      const draft = { ...this.vehicleTypeDrafts[vehicleId], name: newName };
      this.vehicleTypeDrafts[vehicleId] = draft;
      this.persistVehicleTypeDraft(vehicleId, draft);
    }

    if (this.activeVehicleTypeId === vehicleId) {
      const titleInput = document.getElementById('vehicleTypeName');
      if (titleInput) titleInput.value = newName;
    }

    // Remote persist (best-effort) - only for UUID vehicle type ids
    const isUuid = typeof vehicleId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicleId);
    if (this.apiReady && isUuid) {
      try {
        const now = new Date().toISOString();
        const payload = { name: newName, updated_at: now };
        const res = await apiFetch(`/rest/v1/vehicle_types?id=eq.${encodeURIComponent(vehicleId)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify(payload),
          retry: true
        });
        if (!res.ok) {
          console.warn('Vehicle type rename remote failed:', res.status);
        } else {
          // Also update all vehicles that have this vehicle type
          try {
            const { updateVehiclesWithVehicleTypeName } = await import('./api-service.js');
            const result = await updateVehiclesWithVehicleTypeName(oldName, newName, vehicleId);
            if (result.updated > 0) {
              console.log(`✅ Propagated vehicle type rename to ${result.updated} vehicles`);
            }
          } catch (propError) {
            console.warn('Failed to propagate vehicle type rename to vehicles:', propError);
          }
        }
      } catch (err) {
        console.warn('Vehicle type rename remote error:', err);
      }
    }
    
    // Also update local fleet records if they reference this vehicle type
    this.updateLocalFleetVehicleType(oldName, newName, vehicleId);

    this.refreshVehicleTypeList(vehicleId, newName);
  }

  /**
   * Update local fleet records when a vehicle type is renamed
   * Only updates vehicles that store vehicle type by name (legacy data)
   * Vehicles with UUID references are handled by vehicleTypeSeeds lookup
   */
  updateLocalFleetVehicleType(oldName, newName, vehicleTypeId) {
    try {
      const raw = localStorage.getItem('cr_fleet');
      if (!raw) return;
      
      const fleet = JSON.parse(raw);
      if (!Array.isArray(fleet)) return;
      
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      let updated = 0;
      fleet.forEach(vehicle => {
        // Only update vehicles that store vehicle type by name (not UUID)
        // If it's a UUID, the lookup will happen at render time via vehicleTypeSeeds
        if (!uuidPattern.test(vehicle.vehicle_type)) {
          if (vehicle.vehicle_type === oldName) {
            vehicle.vehicle_type = newName;
            vehicle.updated_at = new Date().toISOString();
            updated++;
          }
        }
        if (!uuidPattern.test(vehicle.veh_type)) {
          if (vehicle.veh_type === oldName) {
            vehicle.veh_type = newName;
            vehicle.updated_at = new Date().toISOString();
            if (!updated) updated++; // Don't double count
          }
        }
      });
      
      if (updated > 0) {
        localStorage.setItem('cr_fleet', JSON.stringify(fleet));
        // Also update in-memory fleet records
        this.fleetRecords = fleet;
        console.log(`✅ Updated ${updated} local fleet vehicles with new vehicle type name`);
      }
    } catch (e) {
      console.warn('Failed to update local fleet vehicle types:', e);
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
      
      // Check for duplicate name (different vehicle type with same name)
      if (this.isDuplicateVehicleTypeName(draft.name, vehicleId)) {
        alert(`A vehicle type named "${draft.name}" already exists. Please choose a different name.`);
        return;
      }
      
      // Check if this is an update to an existing vehicle type (has UUID)
      const isUuid = typeof vehicleId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vehicleId);
      if (isUuid) {
        const confirmUpdate = confirm(
          `⚠️ Overwrite Vehicle Type\n\n` +
          `You are about to overwrite the Vehicle Type "${draft.name}".\n\n` +
          `Do you want to continue?`
        );
        if (!confirmUpdate) {
          return;
        }
      }
      
      this.persistVehicleTypeDraft(vehicleId, draft);

      // Update seeds immediately with the draft status so refreshVehicleTypeList sees it
      this.vehicleTypeSeeds[vehicleId] = { ...this.vehicleTypeSeeds[vehicleId], ...draft };
      this.vehicleTypeDrafts[vehicleId] = draft;

      try {
        if (!this.apiReady) throw new Error('API not ready');
        const saved = await upsertVehicleType(draft);
        if (saved?.id) {
          // Preserve the uppercase status from draft when merging with saved
          this.vehicleTypeSeeds[saved.id] = { ...saved, status: draft.status || saved.status };
          this.vehicleTypeDrafts[saved.id] = { ...saved, status: draft.status || saved.status };
        }
        // Refresh the list - this will remove inactive items immediately
        this.refreshVehicleTypeList(vehicleId, draft.name);
        alert('Vehicle Type saved to Supabase.');
      } catch (error) {
        console.error('Vehicle Type save failed, kept locally:', error);
        // Still refresh to update the UI based on draft
        this.refreshVehicleTypeList(vehicleId, draft.name);
        alert(`Saved locally. Supabase save failed: ${error.message || error}`);
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

    // Status is stored in uppercase (ACTIVE/INACTIVE) in database, but HTML options are lowercase
    const statusValue = data.status ? data.status.toString().toLowerCase() : 'active';
    setSelectValue(container.querySelector('[data-vehicle-field="status"]'), statusValue, 'active');
    setSelectValue(container.querySelector('[data-vehicle-field="pricing_basis"]'), data.pricing_basis, 'hours');
    setSelectValue(container.querySelector('[data-vehicle-field="passenger_capacity"]'), data.passenger_capacity, '2');
    setSelectValue(container.querySelector('[data-vehicle-field="luggage_capacity"]'), data.luggage_capacity, '6');
    
    // Associated Service Types (multi-select) - field is data-vehicle-field="service_type_tags"
    const serviceTypeSelect = container.querySelector('[data-vehicle-field="service_type_tags"]');
    if (serviceTypeSelect) {
      const tagsRaw = Array.isArray(data.service_type_tags)
        ? data.service_type_tags
        : (data.service_type ? [data.service_type] : []);
      const tags = this.normalizeServiceTypeTags(tagsRaw);
      
      console.log('📋 Loading service_type_tags for vehicle type:', this.activeVehicleTypeId, 'tags:', tags);

      if (serviceTypeSelect instanceof HTMLSelectElement && serviceTypeSelect.multiple) {
        Array.from(serviceTypeSelect.options).forEach((opt) => {
          opt.selected = tags.includes(opt.value);
        });
        // Refresh enhanced multi-select UI label (if present)
        this.updateServiceTypesMultiSelectLabel(serviceTypeSelect);
      } else {
        setSelectValue(serviceTypeSelect, tags[0] || data.service_type || '', '');
      }
    }

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

    // Load images for this vehicle type
    this.loadVehicleTypeImages();
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
      // Store status in UPPERCASE to match database convention
      draft.status = (statusSelect.value || 'active').toUpperCase();
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

    // Handle service_type_tags multi-select
    const serviceTypeTags = container.querySelector('[data-vehicle-field="service_type_tags"]');
    if (serviceTypeTags) {
      // Vehicle Types can be associated with one OR MORE service types.
      // We store multiple selections in `service_type_tags` (TEXT[]) and keep `service_type` for legacy compatibility.
      if (serviceTypeTags instanceof HTMLSelectElement && serviceTypeTags.multiple) {
        const selected = Array.from(serviceTypeTags.selectedOptions)
          .map((opt) => opt.value)
          .filter((v) => v && v.trim());
        draft.service_type_tags = this.normalizeServiceTypeTags(selected);
        draft.service_type = draft.service_type_tags[0] || '';
      } else {
        const v = serviceTypeTags.value || '';
        draft.service_type_tags = this.normalizeServiceTypeTags(v ? [v] : []);
        draft.service_type = v;
      }
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
      console.log('📤 Saving vehicle rates payload:', payload);
      const saved = await upsertVehicleType(payload);
      if (saved?.id) {
        this.vehicleTypeSeeds[saved.id] = saved;
        this.vehicleTypeDrafts[saved.id] = saved;
        this.refreshVehicleTypeList(saved.id, saved.name);
      }
      alert('Vehicle type rates saved to Supabase.');
    } catch (err) {
      console.error('Vehicle Type rate save failed, kept locally:', err);
      alert(`Saved locally. Supabase save failed: ${err.message || err}`);
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

  /**
   * Check if a vehicle type name already exists (case-insensitive)
   * @param {string} name - The name to check
   * @param {string} excludeId - Optional vehicle ID to exclude (for editing existing types)
   * @returns {boolean} - True if duplicate exists
   */
  isDuplicateVehicleTypeName(name, excludeId = null) {
    if (!name) return false;
    const normalizedName = name.trim().toLowerCase();
    
    // Check in seeds
    for (const [id, vt] of Object.entries(this.vehicleTypeSeeds || {})) {
      if (excludeId && id === excludeId) continue;
      const vtName = (vt.name || '').trim().toLowerCase();
      if (vtName === normalizedName) return true;
    }
    
    // Check in drafts (in case of unsaved new types)
    for (const [id, draft] of Object.entries(this.vehicleTypeDrafts || {})) {
      if (excludeId && id === excludeId) continue;
      const draftName = (draft.name || '').trim().toLowerCase();
      if (draftName === normalizedName) return true;
    }
    
    return false;
  }

  async loadVehicleTypesList() {
    const list = document.querySelector('#vehicleTypeList');
    if (!list) return;

    this.loadVehicleTypeDrafts();
    let records = Object.values(this.vehicleTypeSeeds);
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

      // NOTE: We no longer derive vehicle types from the vehicles table.
      // All vehicle types should come from the vehicle_types table in Supabase.
      // This ensures status filtering works correctly (ACTIVE vs INACTIVE).
    }

    // Use remote records from Supabase; fallback to seeds only if no remote data
    const vehicleTypeSource = remoteRecords.length ? remoteRecords : records;

    // Merge duplicates - Supabase (remote) data takes precedence
    const unique = new Map();
    const pushList = (arr) => {
      (arr || []).forEach((v) => {
        const id = v.id || v.code || v.name;
        if (!id) return;
        // Always update with the latest data (Supabase wins)
        unique.set(id, { ...unique.get(id), ...v });
      });
    };

    pushList(Object.values(this.vehicleTypeSeeds || {}));
    pushList(vehicleTypeSource); // Supabase data wins

    // Apply drafts on top to ensure the latest local changes are reflected (especially status)
    Object.entries(this.vehicleTypeDrafts || {}).forEach(([id, draft]) => {
      if (unique.has(id)) {
        unique.set(id, { ...unique.get(id), ...draft });
      }
    });

    records = Array.from(unique.values());
    
    // Deduplicate by name (case-insensitive) - keep the first occurrence (typically lower ID = older)
    const seenNames = new Map();
    records = records.filter((v) => {
      const normalizedName = (v.name || '').trim().toLowerCase();
      if (!normalizedName) return true; // Keep items without names
      if (seenNames.has(normalizedName)) {
        console.log(`🚨 Removing duplicate vehicle type: "${v.name}" (ID: ${v.id}), keeping ID: ${seenNames.get(normalizedName)}`);
        return false;
      }
      seenNames.set(normalizedName, v.id);
      return true;
    });
    
    records.sort((a, b) => this.normalizeVehicleTypeName(a.name || '').localeCompare(this.normalizeVehicleTypeName(b.name || ''), undefined, { sensitivity: 'base' }));

    list.innerHTML = '';

    const showAll = !!this.vehicleTypeShowAll;
    const isActive = (v) => {
      // Check drafts first for most recent status, then fall back to record data
      const vehicleId = v?.id || v?.code;
      const draft = vehicleId ? this.vehicleTypeDrafts[vehicleId] : null;
      const raw = draft?.status ?? v?.status ?? (v?.active === false ? 'inactive' : null);
      if (raw === null || raw === undefined || raw === '') return true; // treat missing as active
      const status = raw.toString().toUpperCase();
      return status !== 'INACTIVE';
    };

    const visible = showAll ? records : records.filter(isActive);

    visible.forEach((v) => {
      const div = document.createElement('div');
      div.className = 'vehicle-type-item';
      div.dataset.vehicleId = v.id || v.code || crypto.randomUUID();

      const nameSpan = document.createElement('span');
      nameSpan.className = 'vehicle-type-name';
      nameSpan.textContent = this.normalizeVehicleTypeName(v.name || 'Untitled Vehicle Type');
      div.appendChild(nameSpan);

      if (!isActive(v)) {
        div.classList.add('inactive');
        const badge = document.createElement('span');
        badge.className = 'vehicle-type-badge';
        badge.textContent = 'Inactive';
        div.appendChild(badge);
      }

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'vehicle-type-rename-btn';
      renameBtn.title = 'Rename vehicle type';
      renameBtn.textContent = '✎';
      renameBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.startInlineVehicleTypeRename(div.dataset.vehicleId);
      });
      div.appendChild(renameBtn);

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
    
    // Get the vehicle data to check its status
    const data = this.getVehicleTypeData(vehicleId);
    const statusRaw = data?.status ?? '';
    const isInactive = statusRaw.toString().toUpperCase() === 'INACTIVE';
    const showAll = !!this.vehicleTypeShowAll;
    
    let item = list.querySelector(`.vehicle-type-item[data-vehicle-id="${vehicleId}"]`);
    
    // If vehicle is inactive and we're not showing all, remove it from the list
    if (isInactive && !showAll) {
      if (item) {
        item.remove();
      }
      // Select next available item or clear selection
      const nextItem = list.querySelector('.vehicle-type-item');
      if (nextItem) {
        list.querySelectorAll('.vehicle-type-item').forEach(el => el.classList.remove('active'));
        nextItem.classList.add('active');
        this.activeVehicleTypeId = nextItem.dataset.vehicleId;
        this.populateVehicleTypeForm(nextItem.dataset.vehicleId);
      }
      return;
    }
    
    if (!item) {
      item = document.createElement('div');
      item.className = 'vehicle-type-item';
      item.dataset.vehicleId = vehicleId;
      list.appendChild(item);
      
      // Add name span
      const nameSpan = document.createElement('span');
      nameSpan.className = 'vehicle-type-name';
      item.appendChild(nameSpan);
    }
    
    const span = item.querySelector('.vehicle-type-name');
    if (span) span.textContent = name || 'Untitled Vehicle Type';
    else item.textContent = name || 'Untitled Vehicle Type';
    
    // Update inactive badge
    item.classList.toggle('inactive', isInactive);
    let badge = item.querySelector('.vehicle-type-badge');
    if (isInactive && !badge) {
      badge = document.createElement('span');
      badge.className = 'vehicle-type-badge';
      badge.textContent = 'Inactive';
      item.appendChild(badge);
    } else if (!isInactive && badge) {
      badge.remove();
    }
    
    list.querySelectorAll('.vehicle-type-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
    this.populateVehicleTypeForm(vehicleId);
    
    // Also refresh all vehicle type dropdowns to reflect updated names
    this.refreshAllVehicleTypeDropdowns();
  }
  
  /**
   * Refresh all dropdowns that show vehicle types
   * Called after vehicle type name changes to update UI everywhere
   */
  refreshAllVehicleTypeDropdowns() {
    // Refresh the Fleet section's vehicle type dropdown
    const vehicleTypes = Object.values(this.vehicleTypeSeeds || {});
    this.populateFleetVehicleTypeOptions(vehicleTypes);
    
    // Refresh the driver's assigned vehicle dropdown (shows vehicle types in parentheses)
    this.populateDriverVehicleDropdown(this.currentDriver?.assigned_vehicle_id || null);
    
    // Refresh the fleet list to show updated vehicle type names
    this.renderFleetList();
    
    console.log('✅ Refreshed all vehicle type dropdowns and fleet list');
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
    // Resolve the true DB id for the vehicle type. UI may use code or name as dataset id.
    let resolvedId = vehicleId;
    const name = this.vehicleTypeSeeds[vehicleId]?.name || this.vehicleTypeDrafts[vehicleId]?.name || vehicleId || 'this vehicle type';

    // If the vehicleId doesn't look like a UUID or we don't have a matching seed with an id property, try to look up by code or name
    const looksLikeUUID = (id) => typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id);
    if (!looksLikeUUID(vehicleId)) {
      // Search seeds for a record whose id, code, or name matches
      const candidates = Object.values(this.vehicleTypeSeeds || {});
      const found = candidates.find(v => v && (v.id === vehicleId || v.code === vehicleId || (v.name || '').trim().toLowerCase() === (vehicleId || '').toString().trim().toLowerCase()));
      if (found && found.id) {
        resolvedId = found.id;
      } else {
        // Also check drafts
        const drafts = Object.values(this.vehicleTypeDrafts || {});
        const foundDraft = drafts.find(v => v && (v.id === vehicleId || v.code === vehicleId || (v.name || '').trim().toLowerCase() === (vehicleId || '').toString().trim().toLowerCase()));
        if (foundDraft && foundDraft.id) resolvedId = foundDraft.id;
      }
    }
    const confirmed = confirm(`Delete ${name}? This cannot be undone.`);
    if (!confirmed) return;

    let remoteError = null;
    if (this.apiReady) {
      if (!resolvedId) {
        console.warn('⚠️ Could not resolve a database id for vehicle type:', vehicleId);
        remoteError = new Error('Could not resolve vehicle type id for remote delete');
      } else {
        try {
          await deleteVehicleType(resolvedId);
        } catch (error) {
          console.error('Vehicle Type delete failed (will still remove locally):', error);
          remoteError = error;
        }
      }
    }

    // Remove any local references that match the dataset id, resolved id, or name
    try {
      // remove by key
      delete this.vehicleTypeSeeds[vehicleId];
      delete this.vehicleTypeDrafts[vehicleId];
      // also remove by resolved id if different
      if (resolvedId && resolvedId !== vehicleId) {
        delete this.vehicleTypeSeeds[resolvedId];
        delete this.vehicleTypeDrafts[resolvedId];
      }
      // remove any seeds whose name matches
      Object.keys(this.vehicleTypeSeeds || {}).forEach(k => {
        const v = this.vehicleTypeSeeds[k];
        if (v && (v.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase()) {
          delete this.vehicleTypeSeeds[k];
        }
      });
      Object.keys(this.vehicleTypeDrafts || {}).forEach(k => {
        const v = this.vehicleTypeDrafts[k];
        if (v && (v.name || '').trim().toLowerCase() === (name || '').trim().toLowerCase()) {
          delete this.vehicleTypeDrafts[k];
        }
      });
    } catch (e) {
      console.warn('⚠️ Error cleaning local vehicle type caches:', e);
    }
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
      // Remote delete failed (likely permissions). Mark the vehicle type as locally INACTIVE
      // so it will be hidden from the list and won't reappear when we refresh from remote.
      const draftKey = resolvedId || vehicleId || (name || '').trim();
      try {
        this.vehicleTypeDrafts[draftKey] = { ...(this.vehicleTypeDrafts[draftKey] || {}), id: resolvedId || vehicleId, name: name, status: 'INACTIVE' };
        console.log('⚠️ Remote delete failed — marking vehicle type locally INACTIVE:', draftKey);
      } catch (e) {
        console.warn('⚠️ Failed to persist local INACTIVE draft for vehicle type:', e);
      }

      await this.loadVehicleTypesList();
      alert('Vehicle Type removed locally (remote delete failed). It has been hidden locally. See console for details.');
    } else {
      alert('Vehicle Type deleted.');
    }
  }

  async initializeFleetSection() {
    this.populateFleetYearOptions();
    this.populateFleetVehicleTypeOptions(Object.values(this.vehicleTypeSeeds || {}));
    this.populateFleetDriverOptions();
    // Load fleet from BOTH Supabase and localStorage (same as dropdown)
    await this.loadFleetFromAllSources();
    this.removeDemoFleetEntry();
    this.removeSeededVehicles();
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
    
    // Deduplicate by normalized name (case-insensitive)
    const uniqueTypes = new Map();
    const source = Array.isArray(types) && types.length ? types : Object.values(this.vehicleTypeSeeds || {});
    
    source.forEach((t) => {
      const status = (t.status || '').toUpperCase();
      if (status && status !== 'ACTIVE') return;
      
      const id = t.id || t.code || t.name;
      if (!id) return;
      
      const normalizedName = this.normalizeVehicleTypeName(t.name || t.display_name || id);
      const nameKey = normalizedName.toLowerCase().replace(/[_\s]+/g, ' ').trim();
      
      // Only add if we haven't seen this name before (prefer entries with UUID ids)
      if (!uniqueTypes.has(nameKey)) {
        uniqueTypes.set(nameKey, { id, name: normalizedName });
      } else {
        // If existing entry has non-UUID id and this one has UUID, prefer UUID
        const existing = uniqueTypes.get(nameKey);
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!isUUID.test(existing.id) && isUUID.test(id)) {
          uniqueTypes.set(nameKey, { id, name: normalizedName });
        }
      }
    });
    
    // Sort by name
    const sortedTypes = Array.from(uniqueTypes.values()).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select Vehicle Type';
    select.appendChild(placeholder);
    
    sortedTypes.forEach((t) => {
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

  /**
   * Update the assigned driver info display in Fleet form
   */
  updateFleetDriverInfoDisplay(driverId) {
    const infoPanel = document.getElementById('fleetAssignedDriverInfo');
    const initialsEl = document.getElementById('fleetDriverInitials');
    const nameEl = document.getElementById('fleetDriverName');
    const contactEl = document.getElementById('fleetDriverContact');
    
    if (!infoPanel) return;
    
    if (!driverId) {
      infoPanel.style.display = 'none';
      return;
    }
    
    const driver = (this.drivers || []).find(d => d.id === driverId);
    if (!driver) {
      infoPanel.style.display = 'none';
      return;
    }
    
    const firstName = driver.first_name || '';
    const lastName = driver.last_name || '';
    const displayName = driver.dispatch_display_name || `${firstName} ${lastName}`.trim() || 'Unnamed Driver';
    const initials = ((firstName[0] || '') + (lastName[0] || '')).toUpperCase() || '?';
    const phone = driver.cell_phone || driver.home_phone || '';
    const email = driver.email || '';
    const contactParts = [phone, email].filter(Boolean);
    
    if (initialsEl) initialsEl.textContent = initials;
    if (nameEl) nameEl.textContent = displayName;
    if (contactEl) contactEl.textContent = contactParts.join(' • ');
    
    infoPanel.style.display = 'block';
  }

  /**
   * Load fleet from BOTH Supabase and localStorage (same source as dropdown)
   * This ensures Fleet section shows the same vehicles as "Assign Driver to Car" dropdown
   * localStorage is the primary source - Supabase vehicles are merged in but don't overwrite local edits
   */
  async loadFleetFromAllSources() {
    try {
      // Load localStorage fleet first (this is the primary/editable source)
      const localFleet = this.loadFleetFromStorage();
      const localIds = new Set(localFleet.map(v => v.id));
      
      // Use fetchActiveVehicles to get Supabase vehicles
      const vehicles = await fetchActiveVehicles({ includeInactive: false });
      
      // Filter out placeholder vehicles (unit_number starting with "UNIT-" are vehicle type placeholders, not real fleet)
      const realVehicles = vehicles.filter(v => {
        const unitNum = (v.unit_number || '').toString();
        // Exclude auto-generated placeholder vehicles
        if (unitNum.startsWith('UNIT-')) return false;
        return true;
      });
      
      // Start with local fleet (preserves edits)
      this.fleetRecords = [...localFleet];
      
      // Add Supabase vehicles that aren't already in local fleet
      for (const v of realVehicles) {
        if (!localIds.has(v.id)) {
          this.fleetRecords.push({
            id: v.id,
            unit_number: v.unit_number,
            status: v.status || (v.veh_active === 'Y' ? 'ACTIVE' : 'INACTIVE'),
            vehicle_type: v.vehicle_type || v.veh_type,
            vehicle_type_id: v.vehicle_type_id,
            veh_type: v.veh_type || v.vehicle_type,
            year: v.year,
            make: v.make,
            model: v.model,
            color: v.color,
            license_plate: v.license_plate,
            vin: v.vin,
            veh_disp_name: v.veh_disp_name || `${v.unit_number || ''} ${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim(),
            veh_pax_capacity: v.veh_pax_capacity || v.passenger_capacity,
            assigned_driver_id: v.assigned_driver_id,
            organization_id: v.organization_id,
            created_at: v.created_at,
            updated_at: v.updated_at
          });
        }
      }
      
      // Persist the merged result
      this.persistFleet();
      
    } catch (error) {
      console.warn('Failed to load fleet from all sources, falling back to localStorage:', error);
      this.fleetRecords = this.loadFleetFromStorage();
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
    // Seed a sample SUV for drivers who need a vehicle to assign
    const sampleSuv = {
      id: 'seed-suv-001',
      unit_number: 'SUV-01',
      status: 'ACTIVE',
      vehicle_type: 'suv',
      veh_type: 'SUV',
      year: '2024',
      make: 'Cadillac',
      model: 'Escalade',
      color: 'Black',
      license_plate: 'LIMO-SUV',
      vin: '1GYS4CKL4NR000001',
      veh_disp_name: 'SUV-01 Cadillac Escalade',
      veh_pax_capacity: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    console.log('🚙 Seeded sample SUV for driver assignment');
    return [sampleSuv];
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

  removeSeededVehicles() {
    // Remove all seeded/demo vehicles (IDs starting with 'seed-')
    const before = (this.fleetRecords || []).length;
    this.fleetRecords = (this.fleetRecords || []).filter((r) => {
      const id = (r.id || '').toString();
      // Remove any seeded entries
      if (id.startsWith('seed-')) return false;
      // Also remove the sample SUV by VIN
      if (r.vin === '1GYS4CKL4NR000001') return false;
      return true;
    });
    if (before !== this.fleetRecords.length) {
      console.log(`🗑️ Removed ${before - this.fleetRecords.length} seeded vehicle(s)`);
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
    
    // Get assigned driver info instead of unit number
    let driverLabel = '';
    if (record.assigned_driver_id) {
      const driver = (this.drivers || []).find(d => d.id === record.assigned_driver_id);
      if (driver) {
        const driverName = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Unknown Driver';
        driverLabel = `🚗 ${driverName}`;
      } else {
        driverLabel = '🚗 Driver Assigned';
      }
    } else {
      driverLabel = '<span style="color: #999;">No Driver Assigned</span>';
    }
    
    const license = record.license_plate ? `License: ${record.license_plate}` : '';
    const vin = record.vin ? `VIN: ${record.vin}` : '';
    
    // Look up vehicle type name from ID
    let typeName = '';
    if (record.vehicle_type) {
      const vehicleType = this.vehicleTypeSeeds?.[record.vehicle_type];
      if (vehicleType && vehicleType.name) {
        typeName = vehicleType.name;
      } else {
        // Fallback: maybe vehicle_type is already the name
        typeName = record.vehicle_type;
      }
    }
    const type = typeName ? `Type: ${typeName}` : '';
    const year = record.year ? `Year: ${record.year}` : '';

    item.innerHTML = `
      <div class="fleet-card-body" style="padding: 10px 12px;">
        <div class="resource-item-main">
          <div class="resource-status-badge" style="background: ${this.getFleetStatusColor(record.status)};"></div>
          <div class="resource-item-details">
            <div class="resource-item-name">${name}</div>
            <div class="resource-item-meta" style="font-weight: 500; color: #333;">
              ${driverLabel}
            </div>
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
      
      // Update driver info display
      this.updateFleetDriverInfoDisplay(driverId);
      
      // Store original driver ID for change detection
      driverSelect.dataset.originalDriverId = driverId;
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

    const unitNumber = getValue('fleetUnitNumber');
    const year = getValue('fleetYear');
    const make = getValue('fleetMake');
    const model = getValue('fleetModel');
    const licensePlate = getValue('fleetLicense');
    
    // Generate display name from vehicle details
    const veh_disp_name = [unitNumber, year, make, model].filter(Boolean).join(' ').trim() || licensePlate || 'Vehicle';

    return {
      id: this.activeFleetId || crypto.randomUUID(),
      unit_number: unitNumber,
      status: getValue('fleetStatus') || 'ACTIVE',
      vehicle_type: getValue('fleetVehicleType'),
      year: year,
      make: make,
      model: model,
      color: getValue('fleetColor'),
      passengers: getValue('fleetPassengers'),
      vin: getValue('fleetVin'),
      license_plate: licensePlate,
      veh_disp_name: veh_disp_name,
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
      internal_notes: getValue('fleetInternalNotes'),
      updated_at: new Date().toISOString()
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

  async handleFleetSave() {
    const data = this.getFleetFormData();
    const requiredFields = ['status', 'vehicle_type', 'year', 'make', 'model', 'license_plate'];
    const missing = requiredFields.filter((key) => !data[key]);
    if (missing.length) {
      alert(`Please fill in required fields: ${missing.join(', ')}`);
      return;
    }

    const existingIndex = this.fleetRecords.findIndex((r) => r.id === this.activeFleetId);
    const previousDriverId = existingIndex >= 0 ? this.fleetRecords[existingIndex].assigned_driver_id : null;
    const newDriverId = data.assigned_driver_id;
    
    if (existingIndex >= 0) {
      this.fleetRecords[existingIndex] = { ...this.fleetRecords[existingIndex], ...data };
    } else {
      this.fleetRecords.push(data);
      this.activeFleetId = data.id;
    }

    this.persistFleet();
    this.renderFleetList();
    this.setActiveFleet(data.id);
    
    // Update driver's assigned_vehicle_id when assigning/unassigning from Fleet
    const vehicleId = data.id;
    
    // If driver assignment changed
    if (newDriverId !== previousDriverId) {
      try {
        // Unassign vehicle from previous driver
        if (previousDriverId) {
          console.log(`🔄 Unassigning vehicle from previous driver ${previousDriverId}`);
          await updateDriver(previousDriverId, { assigned_vehicle_id: null });
        }
        
        // Assign vehicle to new driver
        if (newDriverId) {
          console.log(`🔄 Assigning vehicle ${vehicleId} to driver ${newDriverId}`);
          await updateDriver(newDriverId, { assigned_vehicle_id: vehicleId });
        }
      } catch (err) {
        console.warn('Could not sync driver vehicle assignment:', err);
      }
    }
    
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
    
    // Also refresh the driver vehicle dropdown to remove deleted vehicle, but preserve current selection
    this.populateDriverVehicleDropdown(this.currentDriver?.assigned_vehicle_id || null);
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
    
    // Add change listener for assigned driver dropdown
    const driverSelect = document.getElementById('fleetAssignedDriver');
    if (driverSelect && !driverSelect.dataset.changeListenerBound) {
      driverSelect.addEventListener('change', async (e) => {
        const newDriverId = e.target.value;
        const originalDriverId = driverSelect.dataset.originalDriverId || '';
        
        // If driver is changing, show confirmation dialog first
        if (newDriverId !== originalDriverId && (newDriverId || originalDriverId)) {
          // Check if the new driver already has a different vehicle assigned
          if (newDriverId) {
            try {
              const allDrivers = await fetchDrivers() || [];
              const targetDriver = allDrivers.find(d => d.id === newDriverId);
              
              if (targetDriver && targetDriver.assigned_vehicle_id && targetDriver.assigned_vehicle_id !== this.activeFleetId) {
                // Driver already has a different vehicle - get its info
                let otherVehicleName = 'another vehicle';
                const otherVehicle = this.fleetRecords.find(v => v.id === targetDriver.assigned_vehicle_id);
                if (otherVehicle) {
                  otherVehicleName = otherVehicle.veh_disp_name || 
                    [otherVehicle.year, otherVehicle.make, otherVehicle.model].filter(Boolean).join(' ');
                }
                
                const driverName = [targetDriver.first_name, targetDriver.last_name].filter(Boolean).join(' ');
                const confirmed = confirm(
                  `⚠️ Driver Already Has Vehicle Assigned\n\n` +
                  `${driverName} is currently assigned to:\n` +
                  `"${otherVehicleName}"\n\n` +
                  `Assigning this vehicle will replace their current assignment.\n\n` +
                  `Click OK to proceed, or Cancel to keep the original assignment.`
                );
                
                if (!confirmed) {
                  driverSelect.value = originalDriverId;
                  return;
                }
              } else {
                // Standard confirmation
                const confirmed = confirm('You are about to change the driver of this vehicle. This change will also update the Driver\'s "Assign Driver to Car" selection.\n\nClick OK to proceed.');
                if (!confirmed) {
                  driverSelect.value = originalDriverId;
                  return;
                }
              }
            } catch (err) {
              console.warn('Could not check driver vehicle assignments:', err);
              // Fall through to standard confirmation
              const confirmed = confirm('You are about to change the driver of this vehicle. This change will also update the Driver\'s "Assign Driver to Car" selection.\n\nClick OK to proceed.');
              if (!confirmed) {
                driverSelect.value = originalDriverId;
                return;
              }
            }
          } else {
            // Removing driver - simple confirmation
            const confirmed = confirm('You are about to remove the driver from this vehicle. This will also update the Driver\'s "Assign Driver to Car" selection.\n\nClick OK to proceed.');
            if (!confirmed) {
              driverSelect.value = originalDriverId;
              return;
            }
          }
        }
        
        // Update driver info display (warning message no longer needed)
        this.updateFleetDriverInfoDisplay(newDriverId);
      });
      driverSelect.dataset.changeListenerBound = 'true';
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
          this.populateAirportFormFromItem(item);
        }
      });
    }
  }

  populateAirportFormFromItem(item) {
    const codeInput = document.getElementById('airportCode');
    const descriptionInput = document.getElementById('airportDescription');
    const addressSearch = document.getElementById('airportAddressSearch');
    const address1 = document.getElementById('airportAddress1');
    const city = document.getElementById('airportCity');
    const state = document.getElementById('airportState');
    const zip = document.getElementById('airportZip');
    const country = document.getElementById('airportCountry');
    const latitude = document.getElementById('airportLatitude');
    const longitude = document.getElementById('airportLongitude');

    const dataset = item.dataset || {};
    if (codeInput) codeInput.value = dataset.code || '';
    if (descriptionInput) descriptionInput.value = dataset.description || dataset.name || '';
    if (addressSearch) addressSearch.value = dataset.address || dataset.addressLine1 || '';
    if (address1) address1.value = dataset.address || dataset.addressLine1 || '';
    if (city) city.value = dataset.city || '';
    if (state) state.value = dataset.state || '';
    if (zip) zip.value = dataset.zip || dataset.postalCode || '';
    if (country) country.value = dataset.country || 'United States';
    if (latitude) latitude.value = dataset.latitude || '';
    if (longitude) longitude.value = dataset.longitude || '';

    this.airportGeo = {
      latitude: dataset.latitude ? parseFloat(dataset.latitude) : null,
      longitude: dataset.longitude ? parseFloat(dataset.longitude) : null
    };
  }

  setupAirportAddressLookup() {
    const addressInput = document.getElementById('airportAddressSearch');
    const suggestions = document.getElementById('airportAddressSuggestions');
    if (!addressInput || !suggestions) {
      return;
    }

    let debounceTimer;
    addressInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = (e.target?.value || '').trim();
      if (query.length < 3) {
        suggestions.classList.remove('active');
        return;
      }

      debounceTimer = setTimeout(async () => {
        const results = await this.mapboxService.geocodeAddress(query);
        this.showAirportAddressSuggestions(suggestions, results);
      }, 300);
    });

    addressInput.addEventListener('blur', () => {
      setTimeout(() => suggestions.classList.remove('active'), 200);
    });
  }

  showAirportAddressSuggestions(suggestionsContainer, results) {
    if (!results || results.length === 0) {
      suggestionsContainer.classList.remove('active');
      return;
    }

    suggestionsContainer.innerHTML = results.map((result, index) => `
      <div class="address-suggestion-item" data-index="${index}">
        <div class="suggestion-main">${result.name}</div>
        <div class="suggestion-secondary">${result.address}</div>
      </div>
    `).join('');

    suggestionsContainer.querySelectorAll('.address-suggestion-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectAirportAddress(results[index]);
        suggestionsContainer.classList.remove('active');
      });
    });

    suggestionsContainer.classList.add('active');
  }

  selectAirportAddress(addressData) {
    const addressLine = addressData.address || addressData.name || '';
    const latitude = Array.isArray(addressData.coordinates) ? addressData.coordinates[1] : null;
    const longitude = Array.isArray(addressData.coordinates) ? addressData.coordinates[0] : null;

    const city = addressData.context?.city || addressData.context?.place || '';
    const state = addressData.context?.state || '';
    const zip = addressData.context?.zipcode || addressData.context?.postcode || '';

    const addressSearch = document.getElementById('airportAddressSearch');
    const address1 = document.getElementById('airportAddress1');
    const cityInput = document.getElementById('airportCity');
    const stateInput = document.getElementById('airportState');
    const zipInput = document.getElementById('airportZip');
    const countryInput = document.getElementById('airportCountry');
    const latitudeInput = document.getElementById('airportLatitude');
    const longitudeInput = document.getElementById('airportLongitude');

    if (addressSearch) addressSearch.value = addressLine;
    if (address1) address1.value = addressLine;
    if (cityInput) cityInput.value = city;
    if (stateInput) stateInput.value = state;
    if (zipInput) zipInput.value = zip;
    if (countryInput) countryInput.value = addressData.context?.country || countryInput.value || 'United States';
    if (latitudeInput) latitudeInput.value = latitude ?? '';
    if (longitudeInput) longitudeInput.value = longitude ?? '';

    this.airportGeo = { latitude, longitude };
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
      // Note: Vehicle dropdown will be populated when loadDriverForm is called
      // Don't call populateDriverVehicleDropdown here as it will be overwritten by loadDriverForm
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
      addNewDriverBtn.addEventListener('click', async () => {
        this.currentDriver = null;
        const formTitle = document.getElementById('driverFormTitle');
        if (formTitle) formTitle.textContent = 'Add New Driver';
        
        // Clear all form inputs
        const form = document.querySelector('.drivers-form-panel');
        if (form) {
          form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => input.value = '');
          form.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
          form.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
          // Clear validation errors
          form.querySelectorAll('.validation-error').forEach(el => el.classList.remove('validation-error'));
        }
        
        // Default: Include Cell Phone on Trip Sheets should be checked for new drivers
        const includePhoneCellCheckbox = document.getElementById('driverIncludePhoneCell');
        if (includePhoneCellCheckbox) {
          includePhoneCellCheckbox.checked = true;
        }
        
        // Re-populate vehicle dropdown for new driver
        await this.populateDriverVehicleDropdown(null);
        
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

    // Create Vehicle popup button
    const createVehicleBtn = document.getElementById('createVehicleBtn');
    if (createVehicleBtn) {
      createVehicleBtn.addEventListener('click', () => this.openCreateVehiclePopup());
    }

    // Setup vehicle popup modal event handlers
    this.setupVehiclePopupHandlers();

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

    // Setup "Add Another Driver" button for affiliate driver associations
    const addDriverBtn = document.getElementById('addAnotherDriverBtn');
    if (addDriverBtn) {
      addDriverBtn.addEventListener('click', () => this.addAffiliateDriverRow());
    }

    // Initialize the first driver dropdown
    this.populateAffiliateDriverDropdowns();
  }

  // Counter for affiliate driver rows
  affiliateDriverRowCount = 1;

  // Add a new driver dropdown row in the affiliate form
  addAffiliateDriverRow() {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return;

    const rowIndex = this.affiliateDriverRowCount++;
    const rowDiv = document.createElement('div');
    rowDiv.className = 'aff-driver-row';
    rowDiv.style.cssText = 'display: flex; gap: 10px; align-items: center; margin-bottom: 8px;';
    rowDiv.dataset.rowIndex = rowIndex;

    const select = document.createElement('select');
    select.id = `affDriverSelect_${rowIndex}`;
    select.className = 'form-control aff-driver-select';
    select.style.flex = '1';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary btn-small remove-aff-driver-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.title = 'Remove Driver';
    removeBtn.addEventListener('click', () => {
      rowDiv.remove();
      // Show remove buttons on remaining rows if more than one
      this.updateAffDriverRemoveButtons();
    });

    rowDiv.appendChild(select);
    rowDiv.appendChild(removeBtn);
    container.appendChild(rowDiv);

    // Populate the new dropdown with active drivers
    this.populateAffiliateDriverDropdown(select);

    // Update remove button visibility
    this.updateAffDriverRemoveButtons();
  }

  // Update visibility of remove buttons (hide if only one row)
  updateAffDriverRemoveButtons() {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return;

    const rows = container.querySelectorAll('.aff-driver-row');
    rows.forEach((row, index) => {
      const removeBtn = row.querySelector('.remove-aff-driver-btn');
      if (removeBtn) {
        removeBtn.style.display = rows.length > 1 ? 'inline-block' : 'none';
      }
    });
  }

  // Populate all affiliate driver dropdowns
  async populateAffiliateDriverDropdowns() {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return;

    const selects = container.querySelectorAll('.aff-driver-select');
    for (const select of selects) {
      await this.populateAffiliateDriverDropdown(select);
    }
  }

  // Populate a single affiliate driver dropdown with active drivers
  async populateAffiliateDriverDropdown(selectElement) {
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">-- Select Driver --</option>';

    try {
      // Get drivers from cache or fetch
      let drivers = this.drivers || [];
      if (drivers.length === 0) {
        drivers = await fetchDrivers() || [];
      }

      // Filter to only show active drivers
      const activeDrivers = drivers.filter(d => {
        const status = (d.status || 'ACTIVE').toString().toUpperCase();
        return d.is_active !== false && status !== 'INACTIVE';
      });

      // Sort by name
      activeDrivers.sort((a, b) => {
        const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
        const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      activeDrivers.forEach(driver => {
        const option = document.createElement('option');
        option.value = driver.id;
        option.textContent = `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || `Driver ${driver.id}`;
        selectElement.appendChild(option);
      });
    } catch (error) {
      console.error('Error populating affiliate driver dropdown:', error);
    }
  }

  // Get selected driver IDs from affiliate form
  getAffiliateAssociatedDriverIds() {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return [];

    const selects = container.querySelectorAll('.aff-driver-select');
    const driverIds = [];
    selects.forEach(select => {
      if (select.value) {
        driverIds.push(select.value);
      }
    });
    return driverIds;
  }

  // Set associated drivers in the affiliate form
  async setAffiliateAssociatedDrivers(driverIds = []) {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return;

    // Clear existing rows except the first one
    const existingRows = container.querySelectorAll('.aff-driver-row');
    existingRows.forEach((row, index) => {
      if (index > 0) row.remove();
    });

    // Reset counter
    this.affiliateDriverRowCount = 1;

    // Populate the first dropdown
    const firstSelect = container.querySelector('.aff-driver-select');
    if (firstSelect) {
      await this.populateAffiliateDriverDropdown(firstSelect);
      if (driverIds.length > 0) {
        firstSelect.value = driverIds[0];
      }
    }

    // Add additional rows for remaining drivers
    for (let i = 1; i < driverIds.length; i++) {
      this.addAffiliateDriverRow();
      const newSelect = document.getElementById(`affDriverSelect_${this.affiliateDriverRowCount - 1}`);
      if (newSelect) {
        newSelect.value = driverIds[i];
      }
    }

    this.updateAffDriverRemoveButtons();
  }

  // Clear affiliate driver associations
  clearAffiliateDriverAssociations() {
    const container = document.getElementById('affAssociatedDriversContainer');
    if (!container) return;

    // Remove all rows except the first
    const rows = container.querySelectorAll('.aff-driver-row');
    rows.forEach((row, index) => {
      if (index > 0) row.remove();
    });

    // Reset the first dropdown
    const firstSelect = container.querySelector('.aff-driver-select');
    if (firstSelect) {
      firstSelect.value = '';
    }

    this.affiliateDriverRowCount = 1;
    this.updateAffDriverRemoveButtons();
  }

  // Populate the driver's affiliate dropdown with active affiliates
  async populateDriverAffiliateDropdown() {
    const selectElement = document.getElementById('driverAffiliateSelect');
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">-- No Affiliate --</option>';

    try {
      // Get affiliates from cache or fetch
      let affiliates = this.affiliates || [];
      if (affiliates.length === 0) {
        affiliates = await fetchAffiliates() || [];
        // Store for later use in saveDriver
        this.affiliates = affiliates;
      }

      // Filter to only show active affiliates
      const activeAffiliates = affiliates.filter(a => {
        const status = (a.status || 'ACTIVE').toString().toUpperCase();
        return status !== 'INACTIVE';
      });

      // Sort by company name
      activeAffiliates.sort((a, b) => {
        const nameA = (a.company_name || '').toLowerCase();
        const nameB = (b.company_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });

      activeAffiliates.forEach(affiliate => {
        const option = document.createElement('option');
        option.value = affiliate.id;
        option.textContent = affiliate.company_name || `Affiliate ${affiliate.id}`;
        selectElement.appendChild(option);
      });

      // Add change listener to auto-populate driver fields from affiliate
      if (!selectElement.dataset.affiliateListenerAdded) {
        selectElement.addEventListener('change', (e) => this.onDriverAffiliateChange(e.target.value));
        selectElement.dataset.affiliateListenerAdded = 'true';
      }
    } catch (error) {
      console.error('Error populating driver affiliate dropdown:', error);
    }
  }

  /**
   * When affiliate is selected in driver form, populate address/phone from affiliate
   */
  async onDriverAffiliateChange(affiliateId) {
    if (!affiliateId) {
      console.log('🔗 No affiliate selected, skipping auto-fill');
      return;
    }

    // Find the affiliate in our cached list
    let affiliate = (this.affiliates || []).find(a => a.id === affiliateId);
    
    // If not cached, try fetching
    if (!affiliate) {
      try {
        const affiliates = await fetchAffiliates();
        this.affiliates = affiliates || [];
        affiliate = this.affiliates.find(a => a.id === affiliateId);
      } catch (err) {
        console.error('Failed to fetch affiliate:', err);
        return;
      }
    }

    if (!affiliate) {
      console.warn('⚠️ Affiliate not found:', affiliateId);
      return;
    }

    console.log('🔗 Auto-populating driver form from affiliate:', affiliate.company_name || affiliateId);

    // Get the driver form
    const form = document.querySelector('.drivers-form-panel');
    if (!form) return;

    // Helper to find field by label text
    const findFieldByLabel = (labelText) => {
      const labels = form.querySelectorAll('label');
      for (const label of labels) {
        const normalizedLabel = (label.textContent || '').replace(/\*/g, '').trim().toLowerCase();
        if (normalizedLabel === labelText.toLowerCase()) {
          const field = label.nextElementSibling;
          if (field && (field.tagName === 'INPUT' || field.tagName === 'SELECT' || field.tagName === 'TEXTAREA')) {
            return field;
          }
        }
      }
      return null;
    };

    // Auto-fill address fields
    const addressField = findFieldByLabel('Primary Address');
    if (addressField && !addressField.value) {
      addressField.value = affiliate.primary_address || affiliate.address_1 || '';
    }

    const cityField = findFieldByLabel('City');
    if (cityField && !cityField.value) {
      cityField.value = affiliate.city || '';
    }

    // Find state field (label might be "State/Prov")
    const stateLabels = form.querySelectorAll('label');
    for (const label of stateLabels) {
      const text = (label.textContent || '').toLowerCase();
      if (text.includes('state')) {
        const field = label.nextElementSibling;
        if (field && field.tagName === 'SELECT' && !field.value) {
          field.value = affiliate.state || '';
        }
        break;
      }
    }

    // Find zip field (label might be "Add/Zip" or "Zip")
    for (const label of stateLabels) {
      const text = (label.textContent || '').toLowerCase();
      if (text.includes('zip')) {
        const field = label.nextElementSibling;
        if (field && field.tagName === 'INPUT' && !field.value) {
          field.value = affiliate.zip || '';
        }
        break;
      }
    }

    // Auto-fill phone (Cellular/Mobile)
    const phoneLabels = form.querySelectorAll('label');
    for (const label of phoneLabels) {
      const text = (label.textContent || '').toLowerCase();
      if (text.includes('cellular') || text.includes('cell') || text.includes('mobile')) {
        const field = label.nextElementSibling;
        if (field && field.tagName === 'INPUT' && !field.value) {
          field.value = affiliate.phone || '';
        }
        break;
      }
    }

    // Auto-fill email
    const emailField = findFieldByLabel('E-Mail');
    if (emailField && !emailField.value) {
      emailField.value = affiliate.email || '';
    }

    // Auto-fill fax
    for (const label of stateLabels) {
      const text = (label.textContent || '').toLowerCase();
      if (text === 'fax') {
        const field = label.nextElementSibling;
        if (field && field.tagName === 'INPUT' && !field.value) {
          field.value = affiliate.fax || '';
        }
        break;
      }
    }

    // Update the hidden affiliate ID field
    const affiliateIdInput = document.getElementById('driverAffiliateId');
    if (affiliateIdInput) {
      affiliateIdInput.value = affiliateId;
    }

    console.log('✅ Driver form auto-populated from affiliate:', affiliate.company_name);
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
        alt_send_trip_sms: getCheck('affAltSendSms'),
        associated_driver_ids: this.getAffiliateAssociatedDriverIds()
      };
      
      if (!affiliateData.company_name) {
        alert('Company Name is required');
        return;
      }

      // Get the old associated drivers to clear their associations if removed
      const oldDriverIds = this.currentAffiliate?.associated_driver_ids || [];
      const newDriverIds = affiliateData.associated_driver_ids || [];
      
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
        const affiliateId = result.id || this.currentAffiliate?.id;
        const affiliateName = affiliateData.company_name;

        // Update drivers' affiliate_id field
        // Remove affiliate from drivers that were removed
        for (const driverId of oldDriverIds) {
          if (!newDriverIds.includes(driverId)) {
            try {
              await updateDriver(driverId, { affiliate_id: null, affiliate_name: null });
            } catch (e) {
              console.warn('Could not clear affiliate from driver:', driverId, e);
            }
          }
        }

        // Add affiliate to newly associated drivers
        for (const driverId of newDriverIds) {
          try {
            await updateDriver(driverId, { affiliate_id: affiliateId, affiliate_name: affiliateName });
          } catch (e) {
            console.warn('Could not set affiliate on driver:', driverId, e);
          }
        }

        // Reload the list
        await this.loadAffiliatesList();
        // Also reload drivers list if on that tab
        if (this.drivers) {
          await this.loadDriversList();
        }
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
          // Determine if driver is active based on status field (ACTIVE/INACTIVE) and is_active field
          const employmentStatus = (driver?.status || 'ACTIVE').toString().toUpperCase();
          const driverIsActive = driver?.is_active !== false && employmentStatus !== 'INACTIVE';
          return {
            ...driver,
            cell_phone: driver?.cell_phone || driver?.mobile_phone || driver?.phone || driver?.phone_number || driver?.primary_phone || '',
            home_phone: driver?.home_phone || driver?.phone_home || driver?.secondary_phone || '',
            other_phone: driver?.other_phone || driver?.pager || driver?.pager_phone || driver?.other_contact || '',
            fax: driver?.fax || driver?.fax_number || driver?.fax_phone || '',
            driver_status: mergedStatus,
            status: employmentStatus,
            is_active: driverIsActive
          };
        });
        // Filter by active status unless "Show All" is checked
        this.drivers = showAll ? normalizedDrivers : normalizedDrivers.filter(d => d.is_active === true);
        
        // Render to the new container layout (clickable list items)
        const driversListContainer = document.getElementById('driversListContainer');
        if (driversListContainer) {
          if (this.drivers.length === 0) {
            driversListContainer.innerHTML = '<div style="padding: 10px; color: #666; font-size: 11px;">No drivers found</div>';
            this.renderDriverContactSummary(null);
          } else {
            const driverIdToFocus = selectedDriverId || this.currentDriver?.id || (this.drivers[0]?.id ?? null);

            driversListContainer.innerHTML = this.drivers.map((driver, index) => {
              const isActive = driver.is_active === true;
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

    // Load associated drivers
    const associatedDriverIds = affiliate.associated_driver_ids || [];
    this.setAffiliateAssociatedDrivers(associatedDriverIds);

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
      } else if (!select.classList.contains('aff-driver-select')) {
        // Skip driver association dropdowns - they're handled separately
        select.selectedIndex = 0;
      }
    });

    // Clear associated drivers
    this.clearAffiliateDriverAssociations();
    
    console.log('📝 Affiliate form cleared');
  }

  async loadDriverForm(driver) {
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

    // Apply employment status (ACTIVE/INACTIVE) to dropdown
    const employmentStatusSelect = document.getElementById('driverEmploymentStatus');
    if (employmentStatusSelect) {
      const empStatus = (driver.status || 'ACTIVE').toString().toUpperCase();
      // Also check is_active field
      const isActive = driver.is_active !== false && empStatus !== 'INACTIVE';
      employmentStatusSelect.value = isActive ? 'active' : 'inactive';
    }

    // Populate form fields with driver data
    const fields = form.querySelectorAll('input, select, textarea');

    // Reset field values so a previous driver's data does not linger when a field is blank for this driver
    // EXCLUDE special dropdowns that we set separately (affiliate, vehicle assignment, status dropdowns)
    const excludedIds = ['driverAffiliateSelect', 'driverAssignedVehicle', 'driverEmploymentStatus', 'driverStatus'];
    fields.forEach((field) => {
      // Skip excluded fields
      if (excludedIds.includes(field.id)) {
        return;
      }
      if (field.type === 'checkbox') {
        field.checked = false;
      } else if (field.tagName === 'SELECT') {
        field.selectedIndex = 0;
      } else {
        field.value = '';
      }
    });
    
    // Populate affiliate association dropdown AFTER reset
    await this.populateDriverAffiliateDropdown();
    const affiliateSelect = document.getElementById('driverAffiliateSelect');
    const affiliateIdInput = document.getElementById('driverAffiliateId');
    const affiliateOriginalInput = document.getElementById('driverAffiliateOriginal');
    
    if (affiliateSelect) {
      affiliateSelect.value = driver.affiliate_id || '';
      console.log('📋 Setting affiliate dropdown to:', driver.affiliate_id || '(none)');
    }
    if (affiliateIdInput) {
      affiliateIdInput.value = driver.affiliate_id || '';
    }
    if (affiliateOriginalInput) {
      affiliateOriginalInput.value = driver.affiliate_id || '';
    }

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

    // Populate additional driver fields with IDs
    const setById = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? '';
    };
    const setCheckById = (id, checked) => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(checked);
    };
    
    // Checkboxes
    setCheckById('driverSuppressNotifications', driver.suppress_auto_notifications);
    setCheckById('driverShowCallEmailDispatch', driver.show_call_email_dispatch);
    setCheckById('driverQuickEditDispatch', driver.quick_edit_dispatch);
    setCheckById('driverIncludePhoneHome', driver.include_phone_home);
    // Default cell phone to checked if not explicitly set to false
    setCheckById('driverIncludePhoneCell', driver.include_phone_cell !== false);
    setCheckById('driverIncludePhoneOther', driver.include_phone_other);
    setCheckById('driverIsVip', driver.is_vip);
    
    // Text fields
    setById('driverDispatchDisplayName', driver.dispatch_display_name);
    setById('driverTripSheetsDisplayName', driver.trip_sheets_display_name);
    setById('driverAlias', driver.driver_alias);
    setById('driverGroup', driver.driver_group);
    setById('driverNotes', driver.driver_notes);
    setById('driverWebUsername', driver.web_username);
    setById('driverWebPassword', driver.web_password);
    
    // Driver level select
    const levelSelect = document.getElementById('driverLevel');
    if (levelSelect) {
      levelSelect.value = driver.driver_level ?? '0';
    }

    // Populate and set the assigned vehicle dropdown
    await this.populateDriverVehicleDropdown(driver.assigned_vehicle_id);
    
    // Show assigned vehicle name in bold above dropdown
    await this.updateAssignedVehicleDisplay(driver.assigned_vehicle_id);

    console.log('✅ Driver form loaded:', driver);
  }
  
  /**
   * Update the bold display of assigned vehicle above the dropdown
   */
  async updateAssignedVehicleDisplay(vehicleId) {
    const displayDiv = document.getElementById('assignedVehicleDisplay');
    const nameSpan = document.getElementById('assignedVehicleName');
    
    if (!displayDiv || !nameSpan) return;
    
    if (!vehicleId) {
      displayDiv.style.display = 'none';
      nameSpan.textContent = '';
      return;
    }
    
    // Try to find vehicle name from fleet records or API
    let vehicleName = '';
    
    // Check local fleet first
    const localFleet = this.fleetRecords || [];
    const localVehicle = localFleet.find(v => v.id === vehicleId);
    
    if (localVehicle) {
      vehicleName = localVehicle.veh_disp_name || 
        [localVehicle.year, localVehicle.make, localVehicle.model, localVehicle.license_plate ? `(${localVehicle.license_plate})` : ''].filter(Boolean).join(' ');
    } else {
      // Try API
      try {
        const vehicles = await fetchActiveVehicles({ includeInactive: true });
        const vehicle = vehicles?.find(v => v.id === vehicleId);
        if (vehicle) {
          vehicleName = vehicle.veh_disp_name || 
            [vehicle.year, vehicle.make, vehicle.model, vehicle.license_plate ? `(${vehicle.license_plate})` : ''].filter(Boolean).join(' ');
        }
      } catch (e) {
        console.warn('Could not lookup vehicle:', e);
      }
    }
    
    if (vehicleName) {
      nameSpan.textContent = vehicleName;
      displayDiv.style.display = 'block';
    } else {
      nameSpan.textContent = `Vehicle ID: ${vehicleId.substring(0, 8)}...`;
      displayDiv.style.display = 'block';
    }
  }

  /**
   * Populate the "Assign Driver to Car" dropdown with fleet vehicles
   * Uses local fleet records from Company Resources as primary source
   * Only shows ACTIVE vehicles (excludes UNIT- placeholder vehicles)
   */
  async populateDriverVehicleDropdown(selectedVehicleId = null) {
    const select = document.getElementById('driverAssignedVehicle');
    if (!select) return;

    // Helper to check if vehicle is active
    const isVehicleActive = (v) => {
      const status = (v.status || v.veh_active || 'ACTIVE').toString().toUpperCase().trim();
      return ['ACTIVE', 'AVAILABLE', 'Y', 'YES', 'TRUE', '1'].includes(status);
    };
    
    // Helper to check if vehicle is a real fleet vehicle (not a placeholder)
    const isRealVehicle = (v) => {
      const unitNum = (v.unit_number || '').toString();
      // Exclude auto-generated placeholder vehicles (UNIT-xxxx are vehicle type placeholders)
      if (unitNum.startsWith('UNIT-')) return false;
      return true;
    };

    try {
      // First try to get vehicles from API
      let vehicles = await fetchActiveVehicles({ includeInactive: false });
      
      // Filter to only active, real vehicles from API
      if (vehicles && vehicles.length > 0) {
        vehicles = vehicles.filter(v => isVehicleActive(v) && isRealVehicle(v));
      }
      
      // If no API vehicles, use local fleet records from Company Resources
      if (!vehicles || vehicles.length === 0) {
        // Load from localStorage (same source as Fleet section)
        try {
          const raw = localStorage.getItem('cr_fleet');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              // Filter to only active, real vehicles
              vehicles = parsed.filter(v => isVehicleActive(v) && isRealVehicle(v));
            }
          }
        } catch (e) {
          console.warn('Failed to load local fleet:', e);
        }
      }
      
      // Deduplicate by ID - keep first occurrence of each ID
      if (Array.isArray(vehicles) && vehicles.length > 0) {
        const seenIds = new Set();
        vehicles = vehicles.filter(v => {
          if (!v.id) return true; // Keep vehicles without IDs
          if (seenIds.has(v.id)) {
            console.warn(`⚠️ Removing duplicate vehicle with ID: ${v.id}`);
            return false;
          }
          seenIds.add(v.id);
          return true;
        });
      }
      
      // Helper to get vehicle type display name (handle UUID vs name)
      const getVehicleTypeName = (vehicle) => {
        let typeName = vehicle.vehicle_type || vehicle.veh_type || '';
        // If it looks like a UUID, try to look up the actual name
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidPattern.test(typeName)) {
          // Try to find in vehicle type seeds
          const vt = this.vehicleTypeSeeds?.[typeName] || 
                     Object.values(this.vehicleTypeSeeds || {}).find(v => v.id === typeName);
          if (vt?.name) {
            typeName = vt.name;
          } else {
            // UUID with no matching name - don't show it
            typeName = '';
          }
        }
        return typeName;
      };
      
      // Clear existing options
      select.innerHTML = '<option value="">- Not Assigned -</option>';

      if (Array.isArray(vehicles) && vehicles.length > 0) {
        vehicles.forEach((vehicle) => {
          const vehicleTypeName = getVehicleTypeName(vehicle);
          const displayName = [
            vehicle.unit_number,
            vehicle.year,
            vehicle.make,
            vehicle.model,
            vehicleTypeName ? `(${vehicleTypeName})` : ''
          ].filter(Boolean).join(' ');
          
          const option = document.createElement('option');
          option.value = vehicle.id;
          option.textContent = displayName || vehicle.veh_disp_name || `Vehicle ${vehicle.id}`;
          select.appendChild(option);
        });
      }

      // Set selected value if provided
      if (selectedVehicleId) {
        select.value = selectedVehicleId;
        console.log('📋 After setting select.value:', select.value, '(expected:', selectedVehicleId + ')');
        
        // If the vehicle wasn't found in the list (maybe inactive), add it anyway so selection is visible
        if (select.value !== selectedVehicleId) {
          console.log('⚠️ Assigned vehicle not in active list, adding it:', selectedVehicleId);
          // Try to find the vehicle info
          let vehicleName = `Vehicle ${selectedVehicleId.substring(0, 8)}...`;
          
          // Check if we can get more info from API
          try {
            const allVehicles = await fetchActiveVehicles({ includeInactive: true });
            const assignedVehicle = allVehicles?.find(v => v.id === selectedVehicleId);
            if (assignedVehicle) {
              const typeName = getVehicleTypeName(assignedVehicle);
              vehicleName = [
                assignedVehicle.unit_number,
                assignedVehicle.year,
                assignedVehicle.make,
                assignedVehicle.model,
                typeName ? `(${typeName})` : '',
                '(Inactive)'
              ].filter(Boolean).join(' ');
            }
          } catch (e) {
            console.warn('Could not lookup assigned vehicle details:', e);
          }
          
          const option = document.createElement('option');
          option.value = selectedVehicleId;
          option.textContent = vehicleName;
          select.appendChild(option);
          select.value = selectedVehicleId;
        }
      }
      
      // Add change listener to update bold display and check for conflicts when user selects a vehicle
      if (!select.dataset.displayListenerBound) {
        select.addEventListener('change', async (e) => {
          const selectedVehicleId = select.value;
          const selectedOption = select.options[select.selectedIndex];
          const displayDiv = document.getElementById('assignedVehicleDisplay');
          const nameSpan = document.getElementById('assignedVehicleName');
          
          // Check if this vehicle is already assigned to another driver
          if (selectedVehicleId) {
            try {
              const allDrivers = await fetchDrivers() || [];
              const currentDriverId = this.currentDriver?.id;
              const conflictingDriver = allDrivers.find(d => 
                d.assigned_vehicle_id === selectedVehicleId && 
                d.id !== currentDriverId
              );
              
              if (conflictingDriver) {
                const driverName = [conflictingDriver.first_name, conflictingDriver.last_name].filter(Boolean).join(' ') || 'Unknown Driver';
                const vehicleName = selectedOption?.textContent || 'this vehicle';
                
                const confirmChange = confirm(
                  `⚠️ Vehicle Already Assigned\n\n` +
                  `"${vehicleName}" is currently assigned to:\n` +
                  `${driverName}\n\n` +
                  `Do you want to reassign this vehicle to the current driver?\n\n` +
                  `Click OK to reassign, or Cancel to keep the original assignment.`
                );
                
                if (!confirmChange) {
                  // Revert to previous value
                  select.value = this.currentDriver?.assigned_vehicle_id || '';
                  return;
                }
                
                // User confirmed - we'll unassign from the other driver when saving
                console.log(`⚠️ User confirmed reassigning vehicle from ${driverName} to current driver`);
              }
            } catch (err) {
              console.warn('Could not check for vehicle conflicts:', err);
            }
          }
          
          // Update the bold display and button color
          const createVehicleBtn = document.getElementById('createVehicleBtn');
          if (displayDiv && nameSpan) {
            if (select.value && selectedOption) {
              nameSpan.textContent = selectedOption.textContent;
              displayDiv.style.display = 'block';
              // Vehicle selected - make button light grey
              if (createVehicleBtn) {
                createVehicleBtn.style.background = '#e0e0e0';
                createVehicleBtn.style.color = '#666';
                createVehicleBtn.style.border = '1px solid #bdbdbd';
              }
            } else {
              displayDiv.style.display = 'none';
              nameSpan.textContent = '';
              // No vehicle selected - make button bright yellow
              if (createVehicleBtn) {
                createVehicleBtn.style.background = '#ffeb3b';
                createVehicleBtn.style.color = '#333';
                createVehicleBtn.style.border = '1px solid #fbc02d';
              }
            }
          }
        });
        select.dataset.displayListenerBound = 'true';
      }
      
      // Set initial button color based on current selection
      const createVehicleBtn = document.getElementById('createVehicleBtn');
      if (createVehicleBtn) {
        if (selectedVehicleId) {
          createVehicleBtn.style.background = '#e0e0e0';
          createVehicleBtn.style.color = '#666';
          createVehicleBtn.style.border = '1px solid #bdbdbd';
        } else {
          createVehicleBtn.style.background = '#ffeb3b';
          createVehicleBtn.style.color = '#333';
          createVehicleBtn.style.border = '1px solid #fbc02d';
        }
      }

      console.log(`✅ Populated driver vehicle dropdown with ${vehicles?.length || 0} vehicles, selected: ${selectedVehicleId || 'none'}`);
    } catch (err) {
      console.warn('⚠️ Failed to load vehicles for driver assignment:', err);
    }
  }

  /**
   * Setup vehicle popup modal event handlers
   */
  setupVehiclePopupHandlers() {
    const modal = document.getElementById('createVehicleModal');
    if (!modal) return;

    const closeBtn = document.getElementById('closeVehicleModalBtn');
    const cancelBtn = document.getElementById('cancelVehiclePopupBtn');
    const saveBtn = document.getElementById('saveVehicleFromPopupBtn');
    const overlay = modal.querySelector('.vehicle-popup-overlay');

    // Close modal handlers
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeCreateVehiclePopup());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeCreateVehiclePopup());
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.closeCreateVehiclePopup());
    }

    // Save and close handler
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveVehicleFromPopup());
    }

    // Listen for messages from iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'VEHICLE_SAVED') {
        console.log('📦 Vehicle saved from popup:', event.data.vehicle);
        // Refresh the vehicle dropdown
        this.populateDriverVehicleDropdown(event.data.vehicle?.id || null);
      }
    });
  }

  /**
   * Open the Create Vehicle popup modal
   */
  openCreateVehiclePopup() {
    const modal = document.getElementById('createVehicleModal');
    const iframe = document.getElementById('vehicleFormIframe');
    
    if (!modal || !iframe) {
      console.warn('⚠️ Vehicle popup modal elements not found');
      return;
    }

    // Set iframe source
    iframe.src = 'fleet-form-popup.html';
    
    // When iframe loads, send the vehicle types data to it
    iframe.onload = () => {
      // Get active vehicle types using the same isActive logic as loadVehicleTypesList
      // Also check vehicleTypeDrafts for the most recent status
      const isActive = (v) => {
        const vehicleId = v?.id || v?.code;
        const draft = vehicleId ? this.vehicleTypeDrafts?.[vehicleId] : null;
        const raw = draft?.status ?? v?.status ?? (v?.active === false ? 'inactive' : null);
        if (raw === null || raw === undefined || raw === '') return true;
        const status = raw.toString().toUpperCase();
        return status !== 'INACTIVE';
      };
      
      const allTypes = Object.values(this.vehicleTypeSeeds || {});
      const activeTypes = allTypes.filter(isActive);
      
      // Get the currently active driver info (from the driver being edited)
      const activeDriverId = this.currentDriver?.id || null;
      const firstName = this.currentDriver?.first_name || this.currentDriver?.firstName || '';
      const lastName = this.currentDriver?.last_name || this.currentDriver?.lastName || '';
      const activeDriverName = (firstName + ' ' + lastName).trim();
      
      console.log('📤 Sending vehicle types to iframe:', activeTypes.length, 'active of', allTypes.length, 'total');
      console.log('📤 Auto-assigning to driver:', activeDriverId, activeDriverName);
      
      // Send data to iframe
      iframe.contentWindow.postMessage({
        type: 'INIT_VEHICLE_FORM',
        vehicleTypes: activeTypes,
        activeDriverId: activeDriverId,
        activeDriverName: activeDriverName
      }, '*');
    };
    
    // Show modal
    modal.style.display = 'block';
    
    console.log('🚗 Opened Create Vehicle popup');
  }

  /**
   * Close the Create Vehicle popup modal
   */
  closeCreateVehiclePopup() {
    const modal = document.getElementById('createVehicleModal');
    const iframe = document.getElementById('vehicleFormIframe');
    
    if (modal) {
      modal.style.display = 'none';
    }
    if (iframe) {
      iframe.src = '';
    }
    
    console.log('🚗 Closed Create Vehicle popup');
  }

  /**
   * Save vehicle from popup and close
   */
  async saveVehicleFromPopup() {
    const iframe = document.getElementById('vehicleFormIframe');
    
    if (!iframe || !iframe.contentWindow) {
      console.warn('⚠️ Vehicle popup iframe not accessible');
      return;
    }

    try {
      // Call the save function in the iframe
      const iframeWindow = iframe.contentWindow;
      if (iframeWindow.fleetFormPopup && typeof iframeWindow.fleetFormPopup.save === 'function') {
        const result = iframeWindow.fleetFormPopup.save();
        
        if (result && result.success) {
          console.log('✅ Vehicle saved successfully:', result.vehicle);
          
          // Add to fleetRecords and refresh Fleet list
          if (result.vehicle) {
            this.fleetRecords = this.fleetRecords || [];
            this.fleetRecords.push(result.vehicle);
            this.persistFleet();
            this.renderFleetList();
            console.log('📋 Fleet list updated with new vehicle');
          }
          
          // Refresh the vehicle dropdown with the new vehicle selected
          await this.populateDriverVehicleDropdown(result.vehicle?.id || null);
          
          // Close the popup after a brief delay to show success message
          setTimeout(() => {
            this.closeCreateVehiclePopup();
          }, 500);
        } else {
          console.warn('⚠️ Vehicle save failed:', result?.error);
          // Error message is shown in iframe, don't close popup
        }
      } else {
        console.warn('⚠️ Fleet form popup save function not available');
        alert('Unable to save vehicle. Please try again.');
      }
    } catch (err) {
      console.error('❌ Error saving vehicle from popup:', err);
      alert('Error saving vehicle: ' + err.message);
    }
  }

  async saveDriver() {
    try {
      const form = document.querySelector('.drivers-form-panel');
      if (!form) {
        console.warn('⚠️ Driver form panel not found');
        return;
      }

      // CRITICAL: Capture the vehicle dropdown value IMMEDIATELY before any async operations
      // This prevents race conditions where the dropdown might be reset during async calls
      const vehicleDropdown = document.getElementById('driverAssignedVehicle');
      const capturedVehicleId = vehicleDropdown?.value?.trim() || '';
      const originalVehicleId = this.currentDriver?.assigned_vehicle_id || null;
      
      // Store the selected option text as well for logging
      const selectedOptionText = vehicleDropdown?.options?.[vehicleDropdown.selectedIndex]?.textContent || 'none';
      console.log('🚗 SAVE START - Vehicle dropdown value:', capturedVehicleId, '| Selected option:', selectedOptionText, '| Original:', originalVehicleId);

      // Validate required fields: cell phone, email, assigned vehicle (only for active drivers)
      const cellPhone = document.getElementById('driverCellPhone');
      const email = document.getElementById('driverEmail');
      const assignedVehicle = document.getElementById('driverAssignedVehicle');
      // Check employment status (ACTIVE/INACTIVE), not availability status
      const employmentStatusSelect = document.getElementById('driverEmploymentStatus');
      const employmentStatus = (employmentStatusSelect?.value || 'active').toLowerCase();
      const isInactive = employmentStatus === 'inactive';

      const errors = [];
      
      if (!cellPhone?.value?.trim()) {
        errors.push('Cellular Phone is required');
        cellPhone?.classList.add('validation-error');
      } else {
        cellPhone?.classList.remove('validation-error');
      }

      if (!email?.value?.trim()) {
        errors.push('Email Address is required');
        email?.classList.add('validation-error');
      } else {
        email?.classList.remove('validation-error');
      }

      // Only require assigned vehicle for active drivers
      if (!isInactive && !capturedVehicleId) {
        console.log('❌ Vehicle validation failed - capturedVehicleId is empty');
        errors.push('Assign Driver to Car is required - each active driver must be assigned to a vehicle');
        assignedVehicle?.classList.add('validation-error');
      } else {
        assignedVehicle?.classList.remove('validation-error');
      }

      if (errors.length > 0) {
        alert('Please fix the following errors before saving:\n\n• ' + errors.join('\n• '));
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

      // Get availability status for driver_status field (used for driver availability board)
      const availabilitySelect = document.getElementById('driverStatusSelect');
      const driverStatus = (availabilitySelect?.value || 'available').toLowerCase();

      // Employment status already checked above for validation (isInactive)
      const employmentStatusUpper = (employmentStatus || 'active').toUpperCase();

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
        // Use direct ID-based reads for these fields (more reliable than label matching)
        suppress_auto_notifications: document.getElementById('driverSuppressNotifications')?.checked || false,
        show_call_email_dispatch: document.getElementById('driverShowCallEmailDispatch')?.checked || false,
        quick_edit_dispatch: document.getElementById('driverQuickEditDispatch')?.checked || false,
        include_phone_home: document.getElementById('driverIncludePhoneHome')?.checked || false,
        include_phone_cell: document.getElementById('driverIncludePhoneCell')?.checked || false,
        include_phone_other: document.getElementById('driverIncludePhoneOther')?.checked || false,
        dispatch_display_name: document.getElementById('driverDispatchDisplayName')?.value?.trim() || null,
        trip_sheets_display_name: document.getElementById('driverTripSheetsDisplayName')?.value?.trim() || null,
        driver_level: document.getElementById('driverLevel')?.value || '0',
        is_vip: document.getElementById('driverIsVip')?.checked || false,
        assigned_vehicle_id: capturedVehicleId || null, // Use captured value from start of save to prevent race conditions
        driver_alias: document.getElementById('driverAlias')?.value?.trim() || null,
        driver_group: document.getElementById('driverGroup')?.value?.trim() || null,
        driver_notes: document.getElementById('driverNotes')?.value?.trim() || null,
        web_username: document.getElementById('driverWebUsername')?.value?.trim() || null,
        web_password: document.getElementById('driverWebPassword')?.value?.trim() || null,
        // Normalize type to match database constraint ('FULL TIME' or 'PART TIME')
        type: (() => {
          const rawType = readString('type') || 'full-time';
          // Convert 'full-time' -> 'FULL TIME', 'part-time' -> 'PART TIME'
          if (rawType.toLowerCase().includes('part')) return 'PART TIME';
          return 'FULL TIME';
        })(),
        status: employmentStatusUpper,
        is_active: !isInactive,
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

      // Handle affiliate association change from dropdown
      const affiliateSelect = document.getElementById('driverAffiliateSelect');
      const affiliateOriginalInput = document.getElementById('driverAffiliateOriginal');
      // Normalize empty strings to null for comparison
      const newAffiliateId = affiliateSelect?.value || null;
      const originalAffiliateId = affiliateOriginalInput?.value || this.currentDriver?.affiliate_id || null;
      
      console.log('🔍 Affiliate check - new:', newAffiliateId, 'original:', originalAffiliateId, 'affiliates loaded:', this.affiliates?.length);
      
      // Check if affiliate is actually being changed (normalize empty strings to null)
      const normalizedNew = newAffiliateId || null;
      const normalizedOrig = originalAffiliateId || null;
      
      if (normalizedNew !== normalizedOrig) {
        // Get affiliate names for the warning message
        let oldAffiliateName = 'None';
        let newAffiliateName = 'None';
        
        // Ensure affiliates are loaded
        if (!this.affiliates || this.affiliates.length === 0) {
          console.log('🔄 Loading affiliates for save...');
          this.affiliates = await fetchAffiliates() || [];
        }
        
        if (normalizedOrig && this.affiliates) {
          const oldAff = this.affiliates.find(a => a.id === normalizedOrig);
          if (oldAff) oldAffiliateName = oldAff.company_name || 'Unknown';
        }
        if (normalizedNew && this.affiliates) {
          const newAff = this.affiliates.find(a => a.id === normalizedNew);
          if (newAff) newAffiliateName = newAff.company_name || 'Unknown';
        }
        
        console.log('🔍 Affiliate names - old:', oldAffiliateName, 'new:', newAffiliateName);
        
        const confirmChange = confirm(
          `⚠️ Affiliate Association Change\n\n` +
          `You are about to change this driver's affiliate association:\n\n` +
          `From: ${oldAffiliateName}\n` +
          `To: ${newAffiliateName}\n\n` +
          `This will update the affiliate's associated drivers list.\n\n` +
          `Do you want to continue?`
        );
        
        if (!confirmChange) {
          // Reset the dropdown to original value
          if (affiliateSelect) {
            affiliateSelect.value = normalizedOrig || '';
          }
          return;
        }
      }
      
      // Get the affiliate name for the new association
      let finalAffiliateName = null;
      if (normalizedNew && this.affiliates) {
        const newAff = this.affiliates.find(a => a.id === normalizedNew);
        if (newAff) finalAffiliateName = newAff.company_name || null;
      }
      
      driverData.affiliate_id = normalizedNew;
      driverData.affiliate_name = finalAffiliateName;
      
      console.log('📋 Driver affiliate_id being saved:', driverData.affiliate_id);
      console.log('📋 Driver affiliate_name being saved:', driverData.affiliate_name);

      const contactEmail = driverData.email || null;
      driverData.cell_phone = driverData.cell_phone || null;
      driverData.home_phone = driverData.home_phone || null;
      driverData.other_phone = driverData.other_phone || null;
      driverData.contact_email = contactEmail;

      // Use the captured vehicle ID from the start of the save function
      // IMPORTANT: Supabase assigned_vehicle_id column is UUID type - only UUID format is valid
      // localStorage-style IDs (vehicle_timestamp) cannot be saved to database
      const uuidPatternForSave = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = capturedVehicleId && uuidPatternForSave.test(capturedVehicleId);
      const vehicleIdToSave = isValidUUID ? capturedVehicleId : null;
      driverData.assigned_vehicle_id = vehicleIdToSave;
      
      // Warn if localStorage vehicle selected - it won't be saved to database
      if (capturedVehicleId && !isValidUUID) {
        console.warn('⚠️ Vehicle ID is not a UUID - cannot save to database. Please recreate this vehicle to get a valid ID.');
        console.log('📋 Driver assigned_vehicle_id: null (localStorage vehicle:', capturedVehicleId, 'is not compatible with database)');
      } else {
        console.log('📋 Driver assigned_vehicle_id being saved:', vehicleIdToSave, '(from captured:', capturedVehicleId + ')', isValidUUID ? '✅ Valid UUID' : '❌ No vehicle selected');
      }

      // If assigning a vehicle, check if it's currently assigned to another driver and unassign it
      if (driverData.assigned_vehicle_id) {
        try {
          const allDrivers = await fetchDrivers() || [];
          const currentDriverId = this.currentDriver?.id;
          const conflictingDriver = allDrivers.find(d => 
            d.assigned_vehicle_id === driverData.assigned_vehicle_id && 
            d.id !== currentDriverId
          );
          
          if (conflictingDriver) {
            console.log(`🔄 Unassigning vehicle from driver ${conflictingDriver.id} (${conflictingDriver.first_name} ${conflictingDriver.last_name})`);
            await updateDriver(conflictingDriver.id, { assigned_vehicle_id: null });
            console.log(`✅ Vehicle unassigned from previous driver`);
          }
        } catch (err) {
          console.warn('Could not unassign vehicle from previous driver:', err);
        }
      }

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

      // Update affiliate associations if affiliate was changed
      const driverId = result.id;
      if (normalizedNew !== normalizedOrig) {
        try {
          // Remove driver from old affiliate's list
          if (normalizedOrig) {
            const oldAffiliate = this.affiliates?.find(a => a.id === normalizedOrig);
            if (oldAffiliate) {
              const oldDriverIds = oldAffiliate.associated_driver_ids || [];
              const updatedOldIds = oldDriverIds.filter(id => id !== driverId);
              await updateAffiliate(normalizedOrig, { associated_driver_ids: updatedOldIds });
              console.log(`✅ Removed driver ${driverId} from affiliate ${normalizedOrig}`);
            }
          }
          
          // Add driver to new affiliate's list
          if (normalizedNew) {
            const newAffiliate = this.affiliates?.find(a => a.id === normalizedNew);
            if (newAffiliate) {
              const newDriverIds = newAffiliate.associated_driver_ids || [];
              if (!newDriverIds.includes(driverId)) {
                newDriverIds.push(driverId);
                await updateAffiliate(normalizedNew, { associated_driver_ids: newDriverIds });
                console.log(`✅ Added driver ${driverId} to affiliate ${normalizedNew}`);
              }
            }
          }
          
          // Refresh affiliates cache
          this.affiliates = await fetchAffiliates() || [];
        } catch (e) {
          console.warn('Error updating affiliate associations:', e);
        }
      }

      // Sync Fleet vehicle's assigned_driver_id with driver's assigned_vehicle_id
      try {
        const vehicleId = result.assigned_vehicle_id;
        
        // If vehicle assignment changed, update fleet records
        if (vehicleId !== originalVehicleId) {
          // Unassign driver from old vehicle in fleet
          if (originalVehicleId) {
            const oldFleetVehicle = this.fleetRecords?.find(v => v.id === originalVehicleId);
            if (oldFleetVehicle) {
              oldFleetVehicle.assigned_driver_id = null;
              console.log(`🔄 Unassigned driver from old fleet vehicle ${originalVehicleId}`);
            }
          }
          
          // Assign driver to new vehicle in fleet
          if (vehicleId) {
            const newFleetVehicle = this.fleetRecords?.find(v => v.id === vehicleId);
            if (newFleetVehicle) {
              // First, unassign this vehicle from any other driver in fleet
              this.fleetRecords?.forEach(v => {
                if (v.assigned_driver_id === driverId && v.id !== vehicleId) {
                  v.assigned_driver_id = null;
                }
              });
              newFleetVehicle.assigned_driver_id = driverId;
              console.log(`✅ Assigned driver ${driverId} to fleet vehicle ${vehicleId}`);
            }
          }
          
          // Persist fleet changes
          this.persistFleet();
        }
      } catch (e) {
        console.warn('Error syncing fleet vehicle assignment:', e);
      }

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
      
      // If driver was set to inactive and Show All is not checked, they won't be in the list
      // In that case, select the first available driver or clear the form
      const showAll = document.getElementById('showAllDriversCheckbox')?.checked || false;
      const driverStillVisible = this.drivers.find((d) => d.id === driverIdToSelect);
      
      if (driverStillVisible) {
        this.renderDriverContactSummary(driverStillVisible);
      } else if (isInactive && !showAll) {
        // Driver was set to inactive and is now hidden - select first available driver
        if (this.drivers.length > 0) {
          this.loadDriverForm(this.drivers[0]);
        } else {
          this.currentDriver = null;
          this.renderDriverContactSummary(null);
        }
      } else if (driverIdToSelect) {
        const updatedDriver = result;
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
      const deletedDriverId = this.currentDriver.id;
      await deleteDriver(deletedDriverId);
      console.log('✅ Driver deleted');
      alert('Driver deleted successfully!');
      
      this.currentDriver = null;
      
      // Reload drivers list - this will select the first available driver
      await this.loadDriversList();
      
      // If there are remaining drivers, load the first one
      if (this.drivers.length > 0) {
        this.loadDriverForm(this.drivers[0]);
      } else {
        // No drivers left - clear form fields
        const formPanel = document.querySelector('.drivers-form-panel');
        if (formPanel) {
          formPanel.querySelectorAll('input').forEach(input => {
            if (input.type === 'checkbox') input.checked = false;
            else input.value = '';
          });
          formPanel.querySelectorAll('select').forEach(select => select.selectedIndex = 0);
          formPanel.querySelectorAll('textarea').forEach(ta => ta.value = '');
        }
        this.renderDriverContactSummary(null);
      }
    } catch (error) {
      console.error('❌ Error deleting driver:', error);
      alert('Error deleting driver: ' + error.message);
    }
  }

  // -----------------------------
  // Service Types (System Settings)
  // -----------------------------

  setupServiceTypesSync() {
    // Listen for postMessage from the System Settings iframe (service-types.html)
    window.addEventListener('message', (event) => {
      const data = event?.data;
      if (!data) return;
      if (data.action === 'serviceTypesUpdated' && Array.isArray(data.payload)) {
        // payload is active-only list in most cases
        this.serviceTypes = data.payload;
        this.refreshServiceTypeDropdowns();
      }
    });

    // Listen for same-window custom event emitted by the store when localStorage changes
    window.addEventListener('relia:service-types-updated', (e) => {
      const list = e?.detail;
      if (Array.isArray(list)) {
        this.serviceTypes = list;
        this.refreshServiceTypeDropdowns();
      }
    });

    // Listen for cross-window localStorage sync
    window.addEventListener('storage', (e) => {
      if (e.key === SERVICE_TYPES_STORAGE_KEY) {
        this.loadAndApplyServiceTypes();
    this.setupPoliciesSync();
    this.loadAndApplyPolicies();
      }
    });
  }

  async loadAndApplyServiceTypes() {
    try {
      const list = await loadServiceTypes({ includeInactive: true, preferRemote: true });
      this.serviceTypes = Array.isArray(list) ? list : [];
      this.refreshServiceTypeDropdowns();
    } catch (e) {
      console.warn('⚠️ Failed to load service types; using existing list.', e);
      this.refreshServiceTypeDropdowns();
    }
  }

  refreshServiceTypeDropdowns() {
    const active = Array.isArray(this.serviceTypes)
      ? this.serviceTypes.filter((st) => st && st.active !== false && st.code)
      : [];

    // 1) Update any Company Preferences selectors that contain "All Service Types"
    this.refreshServiceTypeFilterSelects(active);

    // 2) Update Vehicle Types editor multi-select
    this.refreshVehicleTypeServiceTypesSelect(active);
  }

  refreshServiceTypeFilterSelects(activeServiceTypes) {
    const selects = Array.from(document.querySelectorAll('select'));
    selects.forEach((select) => {
      const options = Array.from(select.options || []);
      const looksLikeServiceTypeFilter = options.some((opt) => /all\s+service\s+types/i.test(opt.textContent || ''));
      if (!looksLikeServiceTypeFilter) return;

      const currentValue = select.value;
      const currentText = select.selectedOptions?.[0]?.textContent || currentValue;

      // Build new options
      const newOptions = [];
      newOptions.push(new Option('All Service Types', 'all'));

      activeServiceTypes
        .slice()
        .sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || String(a.name || '').localeCompare(String(b.name || '')))
        .forEach((st) => {
          newOptions.push(new Option(st.name, st.code));
        });

      // Preserve legacy selection if it doesn't exist in the new list
      const hasCurrent = newOptions.some((o) => o.value === currentValue);
      if (currentValue && !hasCurrent && currentValue !== 'all') {
        newOptions.push(new Option(`Legacy: ${currentText || currentValue}`, currentValue));
      }

      // Replace DOM options
      select.innerHTML = '';
      newOptions.forEach((opt) => select.add(opt));

      // Restore selection
      if (currentValue && Array.from(select.options).some((o) => o.value === currentValue)) {
        select.value = currentValue;
      } else if (Array.from(select.options).some((o) => o.value === 'all')) {
        select.value = 'all';
      }
    });
  }

  refreshVehicleTypeServiceTypesSelect(activeServiceTypes) {
    const container = document.getElementById('editVehicleTypeContent');
    if (!container) return;

    const select = container.querySelector('[data-vehicle-field="service_type_tags"]');
    if (!(select instanceof HTMLSelectElement)) return;

    // Ensure multi-select capability
    select.multiple = true;

    // Determine current tags to keep selected
    const data = this.activeVehicleTypeId ? this.getVehicleTypeData(this.activeVehicleTypeId) : null;
    const rawTags = Array.isArray(data?.service_type_tags)
      ? data.service_type_tags
      : (data?.service_type ? [data.service_type] : Array.from(select.selectedOptions || []).map((o) => o.value));

    const selectedTags = this.normalizeServiceTypeTags(rawTags);

    // Rebuild select options
    const activeSorted = activeServiceTypes
      .slice()
      .sort((a, b) => (Number(a.sort_order) - Number(b.sort_order)) || String(a.name || '').localeCompare(String(b.name || '')));

    const allowedCodes = new Set(activeSorted.map((s) => s.code));
    const legacyCodes = selectedTags.filter((code) => code && !allowedCodes.has(code));

    select.innerHTML = '';
    select.add(new Option('- - - - NOT ASSIGNED - - - -', ''));

    activeSorted.forEach((st) => {
      select.add(new Option(st.name, st.code));
    });

    legacyCodes.forEach((code) => {
      select.add(new Option(`Legacy: ${code}`, code));
    });

    // Apply selection
    Array.from(select.options).forEach((opt) => {
      opt.selected = selectedTags.includes(opt.value);
    });

    // Enhance UI (checkbox dropdown) — keeps the underlying select as the data source
    this.renderServiceTypesMultiSelect(select, activeSorted);

    // Update label
    this.updateServiceTypesMultiSelectLabel(select);
  }

  normalizeServiceTypeTags(input) {
    const arr = Array.isArray(input)
      ? input
      : (typeof input === 'string' && input.trim() ? [input.trim()] : []);
    const out = [];
    arr.forEach((raw) => {
      const tag = String(raw || '').trim();
      if (!tag) return;

      // Backwards-compat mappings from older hardcoded values
      if (tag === 'airport' || tag === 'airport-transfer') {
        out.push('from-airport', 'to-airport');
        return;
      }
      if (tag === 'point') {
        out.push('point-to-point');
        return;
      }
      out.push(tag);
    });
    return Array.from(new Set(out));
  }

  renderServiceTypesMultiSelect(select, activeSorted) {
    if (!(select instanceof HTMLSelectElement)) return;

    // Build wrapper once
    if (select.dataset.reliaMultiselect === '1') {
      // Re-render options list in case service types changed
      const wrapper = select.parentElement?.querySelector('.relia-multiselect');
      if (wrapper) {
        this.populateServiceTypesMultiSelectUI(wrapper, select, activeSorted);
      }
      return;
    }

    select.dataset.reliaMultiselect = '1';
    select.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'relia-multiselect';

    wrapper.innerHTML = `
      <button type="button" class="relia-multiselect-toggle">- - - - NOT ASSIGNED - - - -</button>
      <div class="relia-multiselect-menu" style="display:none;">
        <label class="relia-multiselect-item relia-multiselect-selectall">
          <input type="checkbox" class="relia-multiselect-selectall-checkbox" />
          <span>Select All</span>
        </label>
        <div class="relia-multiselect-options"></div>
      </div>
    `;

    select.insertAdjacentElement('afterend', wrapper);

    // Toggle open/close
    const toggle = wrapper.querySelector('.relia-multiselect-toggle');
    const menu = wrapper.querySelector('.relia-multiselect-menu');

    toggle?.addEventListener('click', (e) => {
      e.preventDefault();
      const isOpen = menu.style.display === 'block';
      menu.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) {
        this.syncMultiSelectCheckboxesFromSelect(wrapper, select);
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target) && menu.style.display === 'block') {
        menu.style.display = 'none';
      }
    });

    // Populate list + wire checkbox changes
    this.populateServiceTypesMultiSelectUI(wrapper, select, activeSorted);

    // Initial label
    this.updateServiceTypesMultiSelectLabel(select);
  }

  populateServiceTypesMultiSelectUI(wrapper, select, activeSorted) {
    const optionsContainer = wrapper.querySelector('.relia-multiselect-options');
    const selectAllBox = wrapper.querySelector('.relia-multiselect-selectall-checkbox');

    if (!optionsContainer || !selectAllBox) return;

    optionsContainer.innerHTML = '';

    activeSorted.forEach((st) => {
      const item = document.createElement('label');
      item.className = 'relia-multiselect-item';
      item.innerHTML = `
        <input type="checkbox" value="${this.escapeHtml(String(st.code))}" />
        <span>${this.escapeHtml(String(st.name))}</span>
      `;
      optionsContainer.appendChild(item);
    });

    // Wire checkbox change events
    optionsContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        this.applyMultiSelectCheckboxesToSelect(wrapper, select);
      });
    });

    // Select all
    selectAllBox.addEventListener('change', () => {
      const checked = selectAllBox.checked === true;
      optionsContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => { cb.checked = checked; });
      this.applyMultiSelectCheckboxesToSelect(wrapper, select);
    });

    // Sync initial state
    this.syncMultiSelectCheckboxesFromSelect(wrapper, select);
  }

  syncMultiSelectCheckboxesFromSelect(wrapper, select) {
    const selectedValues = new Set(Array.from(select.selectedOptions || []).map((o) => o.value).filter(Boolean));
    const optionCheckboxes = wrapper.querySelectorAll('.relia-multiselect-options input[type="checkbox"]');
    optionCheckboxes.forEach((cb) => {
      cb.checked = selectedValues.has(cb.value);
    });

    const selectAllBox = wrapper.querySelector('.relia-multiselect-selectall-checkbox');
    if (selectAllBox) {
      const allChecked = optionCheckboxes.length > 0 && Array.from(optionCheckboxes).every((cb) => cb.checked);
      selectAllBox.checked = allChecked;
    }
  }

  applyMultiSelectCheckboxesToSelect(wrapper, select) {
    const values = Array.from(wrapper.querySelectorAll('.relia-multiselect-options input[type="checkbox"]:checked'))
      .map((cb) => cb.value)
      .filter(Boolean);

    // Apply to underlying select
    const selectedSet = new Set(values);
    Array.from(select.options).forEach((opt) => {
      opt.selected = selectedSet.has(opt.value);
    });

    // Update label text
    this.updateServiceTypesMultiSelectLabel(select);
  }

  updateServiceTypesMultiSelectLabel(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const wrapper = select.parentElement?.querySelector('.relia-multiselect');
    if (!wrapper) return;

    const toggle = wrapper.querySelector('.relia-multiselect-toggle');
    if (!toggle) return;

    const selected = Array.from(select.selectedOptions || [])
      .map((o) => o.textContent?.trim() || o.value)
      .filter((v) => v && v !== '- - - - NOT ASSIGNED - - - -' && v !== 'Legacy:');

    if (!selected.length) {
      toggle.textContent = '- - - - NOT ASSIGNED - - - -';
      return;
    }
    toggle.textContent = selected.join(', ');
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
  /**
   * Initialize office.Airports from localStorage and ensure each airport has its own cell
   */
  initializeOfficeAirports() {
    if (!window.office || !window.office.Airports) return;
    
    // Load airports from localStorage (company resources module storage)
    const airportsData = JSON.parse(localStorage.getItem('cr_airports') || '[]');
    
    // Clear existing airports in office.Airports
    window.office.Airports.clear();
    
    // Add each airport to its own cell in office.Airports Map
    airportsData.forEach(airport => {
      if (airport.code) {
        // Each airport gets its own cell using the airport code as key
        window.office.Airports.set(airport.code, {
          code: airport.code,
          name: airport.name || '',
          city: airport.city || '',
          state: airport.state || '',
          country: airport.country || 'United States',
          latitude: airport.latitude || null,
          longitude: airport.longitude || null,
          address: airport.address || '',
          zip: airport.zip || '',
          id: airport.id
        });
      }
    });
    
    console.log(`Initialized ${window.office.Airports.size} airports in office.Airports`);
  }

  /**
   * Save airport data to both localStorage and office.Airports structure
   */
  saveAirportToOffice(airportData) {
    if (!window.office || !window.office.Airports || !airportData.code) return;
    
    // Save to office.Airports (each airport in its own cell)
    window.office.Airports.set(airportData.code, {
      code: airportData.code,
      name: airportData.name || '',
      city: airportData.city || '',
      state: airportData.state || '',
      country: airportData.country || 'United States',
      latitude: airportData.latitude || null,
      longitude: airportData.longitude || null,
      address: airportData.address || '',
      zip: airportData.zip || '',
      id: airportData.id || this.generateAirportId()
    });
    
    // Also update localStorage for persistence
    const currentAirports = JSON.parse(localStorage.getItem('cr_airports') || '[]');
    const existingIndex = currentAirports.findIndex(a => a.code === airportData.code);
    
    if (existingIndex >= 0) {
      currentAirports[existingIndex] = window.office.Airports.get(airportData.code);
    } else {
      currentAirports.push(window.office.Airports.get(airportData.code));
    }
    
    localStorage.setItem('cr_airports', JSON.stringify(currentAirports));
    console.log(`Saved airport ${airportData.code} to office.Airports`);
  }

  /**
   * Generate unique airport ID
   */
  generateAirportId() {
    return 'airport_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get all airports from office.Airports as an array
   */
  getAllAirports() {
    if (!window.office || !window.office.Airports) return [];
    return Array.from(window.office.Airports.values());
  }

  /**
   * Get specific airport by code from office.Airports
   */
  getAirportByCode(code) {
    if (!window.office || !window.office.Airports || !code) return null;
    return window.office.Airports.get(code.toUpperCase());
  }

  /**
   * Check if airport exists in office.Airports
   */
  hasAirport(code) {
    if (!window.office || !window.office.Airports || !code) return false;
    return window.office.Airports.has(code.toUpperCase());
  }

  /**
   * Get airports count
   */
  getAirportsCount() {
    if (!window.office || !window.office.Airports) return 0;
    return window.office.Airports.size;
  }

<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Create global office object with Airports structure
  if (!window.office) {
    window.office = {
      Airports: new Map() // Use Map to ensure each airport gets its own cell/entry
    };
  }
  
  // Expose instance globally so child iframes can access vehicle types, drivers, etc.
  window.myOffice = new MyOffice();
<<<<<<< Updated upstream
=======
  
  // Initialize airports from localStorage into office.Airports
  window.myOffice.initializeOfficeAirports();
  
  // Add global utility functions for office.Airports access
  window.getOfficeAirports = function() {
    return window.office && window.office.Airports ? Array.from(window.office.Airports.values()) : [];
  };
  
  window.getOfficeAirport = function(code) {
    return window.office && window.office.Airports && code ? window.office.Airports.get(code.toUpperCase()) : null;
  };
  
  window.addOfficeAirport = function(airportData) {
    if (window.myOffice && airportData && airportData.code) {
      window.myOffice.saveAirportToOffice(airportData);
      return true;
    }
    return false;
  };
  
  console.log('Office airports system initialized - each airport stored in its own cell in office.Airports');
<<<<<<< Updated upstream
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
});