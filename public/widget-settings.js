/**
 * Widget Settings - JavaScript
 * Handles configuration for clock and farmout timer widgets
 */

// Default settings
const DEFAULT_SETTINGS = {
  // Timer settings
  timerAlwaysVisible: false,
  timerDraggable: true,
  timerPlayChime: true,
  timerSize: 100,
  timerTheme: 'amber',
  timerPosition: null,
  
  // Clock settings
  clockVisible: true,
  clockDraggable: false,
  clockShowDate: true,
  clockStyle: 'digital-modern',
  clockSize: 100,
  clockTextColor: '#1f2937',
  clockPosition: null,
  
  // System Monitor settings
  sysMonitorVisible: false,
  sysMonitorDraggable: true,
  sysMonitorShowCpu: true,
  sysMonitorShowRam: true,
  sysMonitorSize: 100,
  sysMonitorStyle: 'bars',
  sysMonitorPosition: null
};

// Current settings state
let currentSettings = { ...DEFAULT_SETTINGS };
let hasUnsavedChanges = false;
let savedSettings = null;

// Load settings from localStorage
function loadSettings() {
  try {
    const saved = localStorage.getItem('widgetSettings');
    if (saved) {
      currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
    
    // Also check for legacy clock style setting
    const legacyClockStyle = localStorage.getItem('clockStyle');
    if (legacyClockStyle && !saved) {
      currentSettings.clockStyle = legacyClockStyle;
    }
  } catch (e) {
    console.warn('Failed to load widget settings:', e);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  
  // Store copy for unsaved changes detection
  savedSettings = JSON.stringify(currentSettings);
  hasUnsavedChanges = false;
  
  return currentSettings;
}

// Mark settings as changed (but they're already saved instantly)
function markUnsaved() {
  // Settings are now applied instantly, so just update the button state
  // to show that changes have been made
  hasUnsavedChanges = false; // Actually saved instantly now
  savedSettings = JSON.stringify(currentSettings);
  updateSaveButtonState();
}

// Update save button to show saved state
function updateSaveButtonState() {
  const saveBtn = document.getElementById('saveSettings');
  if (saveBtn) {
    // Always show as saved since we apply instantly now
    saveBtn.textContent = '✓ Auto-Saved';
    saveBtn.style.background = '#059669';
  }
}

// Save settings to localStorage
function saveSettings() {
  try {
    localStorage.setItem('widgetSettings', JSON.stringify(currentSettings));
    savedSettings = JSON.stringify(currentSettings);
    hasUnsavedChanges = false;
    // Also save clock style in legacy format for compatibility
    localStorage.setItem('clockStyle', currentSettings.clockStyle);
    console.log('[WidgetSettings] Settings saved:', currentSettings);
    
    // Notify parent window to reload widget settings (if we're in an iframe)
    try {
      if (window.self !== window.top) {
        window.top.postMessage({ type: 'widgetSettingsChanged', settings: currentSettings }, '*');
        console.log('[WidgetSettings] Notified parent window of settings change');
      }
      // Also try to call the reload function directly if available
      if (window.top?.reloadWidgetSettings) {
        window.top.reloadWidgetSettings();
      }
    } catch (e) {
      console.log('[WidgetSettings] Could not notify parent window:', e.message);
    }
    
    showSaveConfirmation();
  } catch (e) {
    console.error('Failed to save widget settings:', e);
    alert('Failed to save settings. Please try again.');
  }
}

// Show save confirmation
function showSaveConfirmation() {
  const saveBtn = document.getElementById('saveSettings');
  if (saveBtn) {
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '✓ Saved!';
    saveBtn.style.background = '#059669';
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 2000);
  }
}

// Apply settings to form controls
function applySettingsToForm() {
  // Timer toggles
  setCheckbox('timerAlwaysVisible', currentSettings.timerAlwaysVisible);
  setCheckbox('timerDraggable', currentSettings.timerDraggable);
  setCheckbox('timerPlayChime', currentSettings.timerPlayChime);
  
  // Timer size
  setRange('timerSize', currentSettings.timerSize);
  updateSizeLabel('timerSize', 'timerSizeValue');
  
  // Timer theme
  setActiveTheme(currentSettings.timerTheme);
  
  // Clock toggles
  setCheckbox('clockVisible', currentSettings.clockVisible);
  setCheckbox('clockDraggable', currentSettings.clockDraggable);
  setCheckbox('clockShowDate', currentSettings.clockShowDate);
  
  // Clock style
  setActiveClockStyle(currentSettings.clockStyle);
  
  // Clock size
  setRange('clockSize', currentSettings.clockSize);
  updateSizeLabel('clockSize', 'clockSizeValue');
  
  // Clock color
  setColorPicker('clockTextColor', currentSettings.clockTextColor);
  
  // System Monitor toggles
  setCheckbox('sysMonitorVisible', currentSettings.sysMonitorVisible);
  setCheckbox('sysMonitorDraggable', currentSettings.sysMonitorDraggable);
  setCheckbox('sysMonitorShowCpu', currentSettings.sysMonitorShowCpu);
  setCheckbox('sysMonitorShowRam', currentSettings.sysMonitorShowRam);
  
  // System Monitor size
  setRange('sysMonitorSize', currentSettings.sysMonitorSize);
  updateSizeLabel('sysMonitorSize', 'sysMonitorSizeValue');
  
  // System Monitor style
  setActiveMonitorStyle(currentSettings.sysMonitorStyle);
  
  // Position displays
  updatePositionDisplays();
  
  // Update preview
  updatePreview();
}

// Helper functions for form controls
function setCheckbox(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = !!value;
}

function getCheckbox(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function setRange(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getRange(id) {
  const el = document.getElementById(id);
  return el ? parseInt(el.value, 10) : 100;
}

function setColorPicker(id, value) {
  const el = document.getElementById(id);
  const label = document.getElementById(id + 'Label');
  if (el) el.value = value;
  if (label) label.textContent = value;
}

function updateSizeLabel(sliderId, labelId) {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  if (slider && label) {
    label.textContent = slider.value + '%';
  }
}

function setActiveTheme(theme) {
  document.querySelectorAll('.color-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function setActiveClockStyle(style) {
  document.querySelectorAll('.clock-style-card').forEach(card => {
    card.classList.toggle('active', card.dataset.style === style);
  });
}

function setActiveMonitorStyle(style) {
  document.querySelectorAll('.sys-monitor-style').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === style);
  });
}

function updatePositionDisplays() {
  const timerPos = document.getElementById('timerPositionDisplay');
  const clockPos = document.getElementById('clockPositionDisplay');
  const sysMonitorPos = document.getElementById('sysMonitorPositionDisplay');
  
  if (timerPos) {
    timerPos.textContent = currentSettings.timerPosition 
      ? `Custom (${currentSettings.timerPosition.x}, ${currentSettings.timerPosition.y})`
      : 'Default (Header)';
  }
  
  if (clockPos) {
    clockPos.textContent = currentSettings.clockPosition
      ? `Custom (${currentSettings.clockPosition.x}, ${currentSettings.clockPosition.y})`
      : 'Default (Header)';
  }
  
  if (sysMonitorPos) {
    sysMonitorPos.textContent = currentSettings.sysMonitorPosition
      ? `Custom (${currentSettings.sysMonitorPosition.x}, ${currentSettings.sysMonitorPosition.y})`
      : 'Default (Below Clock)';
  }
}

// Read settings from form
function readSettingsFromForm() {
  currentSettings.timerAlwaysVisible = getCheckbox('timerAlwaysVisible');
  currentSettings.timerDraggable = getCheckbox('timerDraggable');
  currentSettings.timerPlayChime = getCheckbox('timerPlayChime');
  currentSettings.timerSize = getRange('timerSize');
  
  const activeTheme = document.querySelector('.color-theme-btn:not(.sys-monitor-style).active');
  currentSettings.timerTheme = activeTheme ? activeTheme.dataset.theme : 'amber';
  
  currentSettings.clockVisible = getCheckbox('clockVisible');
  currentSettings.clockDraggable = getCheckbox('clockDraggable');
  currentSettings.clockShowDate = getCheckbox('clockShowDate');
  currentSettings.clockSize = getRange('clockSize');
  
  const clockColorEl = document.getElementById('clockTextColor');
  currentSettings.clockTextColor = clockColorEl ? clockColorEl.value : '#1f2937';
  
  const activeClockStyle = document.querySelector('.clock-style-card.active');
  currentSettings.clockStyle = activeClockStyle ? activeClockStyle.dataset.style : 'digital-modern';
  
  // System Monitor settings
  currentSettings.sysMonitorVisible = getCheckbox('sysMonitorVisible');
  currentSettings.sysMonitorDraggable = getCheckbox('sysMonitorDraggable');
  currentSettings.sysMonitorShowCpu = getCheckbox('sysMonitorShowCpu');
  currentSettings.sysMonitorShowRam = getCheckbox('sysMonitorShowRam');
  currentSettings.sysMonitorSize = getRange('sysMonitorSize');
  
  const activeMonitorStyle = document.querySelector('.sys-monitor-style.active');
  currentSettings.sysMonitorStyle = activeMonitorStyle ? activeMonitorStyle.dataset.style : 'bars';
}

// Update preview panel
function updatePreview() {
  const previewTimer = document.getElementById('previewTimer');
  const previewClock = document.getElementById('previewClock');
  
  if (previewTimer) {
    // Remove all theme classes
    previewTimer.classList.remove('theme-amber', 'theme-blue', 'theme-green', 'theme-purple', 'theme-dark');
    // Add current theme
    if (currentSettings.timerTheme !== 'amber') {
      previewTimer.classList.add('theme-' + currentSettings.timerTheme);
    }
    // Apply size
    previewTimer.style.transform = `scale(${currentSettings.timerSize / 100})`;
    previewTimer.style.transformOrigin = 'top right';
    // Visibility
    previewTimer.style.opacity = currentSettings.timerAlwaysVisible ? '1' : '0.6';
  }
  
  if (previewClock) {
    // Visibility
    previewClock.style.display = currentSettings.clockVisible ? 'block' : 'none';
    // Size
    previewClock.style.transform = `scale(${currentSettings.clockSize / 100})`;
    previewClock.style.transformOrigin = 'top right';
    // Color
    const timeEl = previewClock.querySelector('.preview-clock-time');
    if (timeEl) {
      timeEl.style.color = currentSettings.clockTextColor;
    }
    // Date visibility
    const dateEl = previewClock.querySelector('.preview-clock-date');
    if (dateEl) {
      dateEl.style.display = currentSettings.clockShowDate ? 'block' : 'none';
    }
  }
  
  // System Monitor preview
  const previewSysMonitor = document.getElementById('previewSysMonitor');
  if (previewSysMonitor) {
    // Visibility
    previewSysMonitor.style.display = currentSettings.sysMonitorVisible ? 'flex' : 'none';
    // Size
    previewSysMonitor.style.transform = `scale(${currentSettings.sysMonitorSize / 100})`;
    previewSysMonitor.style.transformOrigin = 'top right';
    // CPU/RAM visibility
    const cpuRow = previewSysMonitor.querySelector('.preview-cpu');
    const ramRow = previewSysMonitor.querySelector('.preview-ram');
    if (cpuRow) cpuRow.style.display = currentSettings.sysMonitorShowCpu ? 'flex' : 'none';
    if (ramRow) ramRow.style.display = currentSettings.sysMonitorShowRam ? 'flex' : 'none';
  }
}

// Play test chime
function playTestChime() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // First chime tone
    const oscillator1 = audioContext.createOscillator();
    const gainNode1 = audioContext.createGain();
    oscillator1.connect(gainNode1);
    gainNode1.connect(audioContext.destination);
    oscillator1.frequency.value = 880; // A5 note
    oscillator1.type = 'sine';
    gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator1.start(audioContext.currentTime);
    oscillator1.stop(audioContext.currentTime + 0.3);
    
    // Second chime tone (slightly delayed)
    setTimeout(() => {
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      oscillator2.frequency.value = 1174.66; // D6 note
      oscillator2.type = 'sine';
      gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator2.start(audioContext.currentTime);
      oscillator2.stop(audioContext.currentTime + 0.4);
    }, 150);
    
  } catch (e) {
    console.warn('Could not play chime:', e);
  }
}

// Test timer animation
function testTimerAnimation() {
  const previewTimer = document.getElementById('previewTimer');
  if (previewTimer) {
    previewTimer.classList.add('pulse-test');
    setTimeout(() => {
      previewTimer.classList.remove('pulse-test');
    }, 2000);
  }
  playTestChime();
}

// Fetch next driver info
async function fetchNextDriver() {
  const nameEl = document.getElementById('nextDriverName');
  const companyEl = document.getElementById('nextDriverCompany');
  const ratingEl = document.getElementById('nextDriverRating');
  
  // Try to get from FarmoutAutomationService if available
  if (window.FarmoutAutomationService) {
    try {
      const service = window.FarmoutAutomationService;
      const queue = service.getDriverQueue ? service.getDriverQueue() : [];
      if (queue.length > 0) {
        const nextDriver = queue[0];
        if (nameEl) nameEl.textContent = nextDriver.name || nextDriver.driver_name || 'Unknown';
        if (companyEl) companyEl.textContent = nextDriver.company || nextDriver.affiliate_name || '-';
        if (ratingEl) ratingEl.textContent = nextDriver.rating ? `⭐ ${nextDriver.rating}/10` : '-';
        return;
      }
    } catch (e) {
      console.warn('Could not fetch from FarmoutAutomationService:', e);
    }
  }
  
  // Default display
  if (nameEl) nameEl.textContent = 'No active farmout';
  if (companyEl) companyEl.textContent = '-';
  if (ratingEl) ratingEl.textContent = '-';
}

// Initialize event listeners
function initEventListeners() {
  // Save button
  document.getElementById('saveSettings')?.addEventListener('click', () => {
    readSettingsFromForm();
    saveSettings();
  });
  
  // Reset defaults button
  document.getElementById('resetDefaults')?.addEventListener('click', () => {
    if (confirm('Reset all widget settings to defaults?')) {
      currentSettings = { ...DEFAULT_SETTINGS };
      applySettingsToForm();
      saveSettings();
    }
  });
  
  // Timer size slider
  document.getElementById('timerSize')?.addEventListener('input', (e) => {
    updateSizeLabel('timerSize', 'timerSizeValue');
    currentSettings.timerSize = parseInt(e.target.value, 10);
    updatePreview();
    markUnsaved();
    applyWidgetInstantly('timerSize');
  });
  
  // Clock size slider
  document.getElementById('clockSize')?.addEventListener('input', (e) => {
    updateSizeLabel('clockSize', 'clockSizeValue');
    currentSettings.clockSize = parseInt(e.target.value, 10);
    updatePreview();
    markUnsaved();
    applyWidgetInstantly('clockSize');
  });
  
  // Color theme buttons
  document.querySelectorAll('.color-theme-btn:not(.sys-monitor-style)').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveTheme(btn.dataset.theme);
      currentSettings.timerTheme = btn.dataset.theme;
      updatePreview();
      markUnsaved();
      applyWidgetInstantly('timerTheme');
    });
  });
  
  // Clock style cards
  document.querySelectorAll('.clock-style-card').forEach(card => {
    card.addEventListener('click', () => {
      setActiveClockStyle(card.dataset.style);
      currentSettings.clockStyle = card.dataset.style;
      updatePreview();
      markUnsaved();
      applyWidgetInstantly('clockStyle');
    });
  });
  
  // Clock color picker
  document.getElementById('clockTextColor')?.addEventListener('input', (e) => {
    const label = document.getElementById('clockTextColorLabel');
    if (label) label.textContent = e.target.value;
    currentSettings.clockTextColor = e.target.value;
    updatePreview();
    markUnsaved();
    applyWidgetInstantly('clockTextColor');
  });
  
  // Reset clock color
  document.getElementById('resetClockColor')?.addEventListener('click', () => {
    currentSettings.clockTextColor = DEFAULT_SETTINGS.clockTextColor;
    setColorPicker('clockTextColor', currentSettings.clockTextColor);
    updatePreview();
    markUnsaved();
    applyWidgetInstantly('clockTextColor');
  });
  
  // Toggle changes - apply INSTANTLY to widgets and mark unsaved
  ['timerAlwaysVisible', 'timerDraggable', 'timerPlayChime', 'clockVisible', 'clockDraggable', 'clockShowDate',
   'sysMonitorVisible', 'sysMonitorDraggable', 'sysMonitorShowCpu', 'sysMonitorShowRam'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      readSettingsFromForm();
      updatePreview();
      markUnsaved();
      
      // Apply widget visibility INSTANTLY
      applyWidgetInstantly(id);
    });
  });
  
  // System Monitor size slider
  document.getElementById('sysMonitorSize')?.addEventListener('input', (e) => {
    updateSizeLabel('sysMonitorSize', 'sysMonitorSizeValue');
    currentSettings.sysMonitorSize = parseInt(e.target.value, 10);
    updatePreview();
    markUnsaved();
    applyWidgetInstantly('sysMonitorSize');
  });
  
  // System Monitor style buttons
  document.querySelectorAll('.sys-monitor-style').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveMonitorStyle(btn.dataset.style);
      currentSettings.sysMonitorStyle = btn.dataset.style;
      updatePreview();
      markUnsaved();
      applyWidgetInstantly('sysMonitorStyle');
    });
  });
  
  // Position reset buttons
  document.getElementById('resetTimerPosition')?.addEventListener('click', () => {
    currentSettings.timerPosition = null;
    updatePositionDisplays();
    markUnsaved();
    applyWidgetInstantly('timerPosition');
  });
  
  document.getElementById('resetClockPosition')?.addEventListener('click', () => {
    currentSettings.clockPosition = null;
    updatePositionDisplays();
    markUnsaved();
    applyWidgetInstantly('clockPosition');
  });
  
  document.getElementById('resetSysMonitorPosition')?.addEventListener('click', () => {
    currentSettings.sysMonitorPosition = null;
    updatePositionDisplays();
    markUnsaved();
    applyWidgetInstantly('sysMonitorPosition');
  });
  
  // Test buttons
  document.getElementById('testTimer')?.addEventListener('click', testTimerAnimation);
  document.getElementById('testChime')?.addEventListener('click', playTestChime);
  
  // Refresh next driver
  document.getElementById('refreshNextDriver')?.addEventListener('click', fetchNextDriver);
}

// Apply widget settings instantly to the main page
function applyWidgetInstantly(settingId) {
  try {
    // ALWAYS save to localStorage immediately for instant effect
    localStorage.setItem('widgetSettings', JSON.stringify(currentSettings));
    localStorage.setItem('clockStyle', currentSettings.clockStyle);
    
    // Save sysMonitor settings in their own key
    const sysSettings = {
      visible: currentSettings.sysMonitorVisible,
      draggable: currentSettings.sysMonitorDraggable,
      showCpu: currentSettings.sysMonitorShowCpu,
      showRam: currentSettings.sysMonitorShowRam,
      size: currentSettings.sysMonitorSize,
      style: currentSettings.sysMonitorStyle,
      position: currentSettings.sysMonitorPosition
    };
    localStorage.setItem('sysMonitorSettings', JSON.stringify(sysSettings));
    
    console.log('[WidgetSettings] Applied instantly:', settingId, '=', currentSettings[settingId]);
    
    // Try to communicate with parent window or opener
    const targetWindow = window.opener || (window.self !== window.top ? window.top : null);
    
    if (targetWindow) {
      // Send instant update message
      targetWindow.postMessage({
        type: 'widgetSettingChanged',
        setting: settingId,
        value: currentSettings[settingId],
        allSettings: currentSettings
      }, '*');
    }
    
  } catch (e) {
    console.log('[WidgetSettings] Could not apply instantly:', e.message);
  }
}

// No longer needed - settings are saved instantly
function setupUnsavedWarning() {
  // All settings are now applied instantly, no warning needed
  console.log('[WidgetSettings] Instant save mode - no unsaved warning needed');
}

// Add pulse animation style
function addAnimationStyles() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulseTest {
      0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
      50% { transform: scale(1.05); box-shadow: 0 4px 20px rgba(245, 158, 11, 0.6); }
    }
    .pulse-test {
      animation: pulseTest 0.5s ease-in-out 4 !important;
    }
  `;
  document.head.appendChild(style);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  addAnimationStyles();
  loadSettings();
  applySettingsToForm();
  initEventListeners();
  setupUnsavedWarning();
  fetchNextDriver();
  
  // Update clock preview with current time
  function updateClockPreview() {
    const timeEl = document.querySelector('.preview-clock-time');
    const dateEl = document.querySelector('.preview-clock-date');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
    if (dateEl) {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  }
  
  updateClockPreview();
  setInterval(updateClockPreview, 1000);
});

// Export settings getter for other modules
export function getWidgetSettings() {
  return { ...currentSettings };
}

// Make settings available globally
window.getWidgetSettings = () => ({ ...currentSettings });
window.reloadWidgetSettings = () => {
  loadSettings();
  return currentSettings;
};
