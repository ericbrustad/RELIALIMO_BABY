# Company Settings Implementation - Testing & Verification Guide

## Quick Start

### 1. Access the Settings Interface
- Navigate to "My Office" page in the application
- In the left sidebar, click "Company Preferences"
- You should see the "Company Settings Management" section at the top

### 2. Initial Setup
On first load, the system will:
1. Check localStorage for saved settings
2. If not found, create default settings
3. Render all 8 categories in expandable sections
4. Expand the first category (General Company Info)

## Features to Test

### Feature 1: Category Expand/Collapse
**Steps:**
1. Click on any category header (e.g., "Business Information")
2. Verify the arrow rotates 90 degrees
3. Verify the category content appears/disappears
4. Click again to collapse

**Expected Result:**
- Categories toggle smoothly with CSS transition
- Arrow indicator rotates
- Content slides in/out

### Feature 2: Form Input Display
**Steps:**
1. Expand "General Company Info"
2. Verify 8 text input fields are visible:
   - Company Name (text)
   - Phone Number (tel)
   - Email Address (email)
   - Website (url)
   - Address, City, State, ZIP (text)
3. Expand "Financial Settings"
4. Verify correct input types:
   - Currency (select dropdown)
   - Default Tax Rate (number input)
   - Payment checkboxes

**Expected Result:**
- All fields display with correct input types
- Select fields show options
- Number inputs have spinner controls
- Checkboxes are properly styled

### Feature 3: Change Detection (Dirty State)
**Steps:**
1. Edit any field (e.g., change Company Name)
2. Verify the field gets orange background highlighting
3. Verify the "Save Changes" button becomes enabled (not grayed out)
4. Edit a different field
5. Verify button remains enabled

**Expected Result:**
- Dirty fields highlighted in orange (#fff8f0 background)
- Save button enabled when any field is modified
- Visual feedback is immediate

### Feature 4: Save Settings
**Steps:**
1. Change "Company Name" to "Test Company 123"
2. Change "Default Tax Rate" to "8.5"
3. Toggle "Send Confirmation Email" checkbox
4. Click "Save Changes" button
5. Wait for success notification

**Expected Result:**
- Green success notification appears: "Settings saved successfully!"
- Notification disappears after 3 seconds
- Save button becomes disabled again
- Fields lose orange highlighting
- Refresh page to verify settings persisted

### Feature 5: Reset Unsaved Changes
**Steps:**
1. Change "Company Name" to "Test 456"
2. Click "Reset Unsaved" button
3. Confirm the dialog

**Expected Result:**
- Form reverts to last saved state
- "Company Name" returns to previous value
- Orange highlighting is removed
- Info notification shows: "Settings reset to last saved state"

### Feature 6: Reset to Defaults
**Steps:**
1. Click "Reset to Defaults" button
2. Click "Yes" in confirmation dialog
3. Wait for notification

**Expected Result:**
- All fields reset to original default values
- Success notification shows: "Settings reset to defaults!"
- All categories collapse except first
- First category expands showing reset values

### Feature 7: Export Settings (Backup)
**Steps:**
1. Click "Export Settings" button
2. Verify download dialog appears
3. Check downloads folder for file named like: `company-settings-2024-01-15.json`
4. Open file in text editor
5. Verify JSON structure with all settings

**Expected Result:**
- File downloads automatically
- Filename includes current date
- JSON is properly formatted (readable)
- File contains all current setting values

### Feature 8: Import Settings (Restore)
**Steps:**
1. Export current settings (creates backup file)
2. Change "Company Name" to "Modified Name"
3. Click "Import Settings" button
4. Select the exported JSON file from previous step
5. Click "Yes" in confirmation dialog
6. Wait for notification

**Expected Result:**
- File browser dialog opens
- Settings update from imported file
- Success notification shows: "Settings imported successfully!"
- "Company Name" returns to previous value
- All settings match the imported file

### Feature 9: Input Types & Validation
**Test Number Inputs:**
1. Go to "Financial Settings"
2. Try to set negative value in "Default Tax Rate"
3. Try to set value > 100

**Expected Result:**
- HTML5 validation prevents invalid values
- Min/max constraints enforced
- Clear error feedback

**Test Select Dropdowns:**
1. Go to "Operational Settings"
2. Click "Time Zone" dropdown
3. Verify options appear: EST, CST, MST, PST

**Expected Result:**
- Dropdown opens with all options
- Current selection highlighted
- Options are readable and clear

**Test Checkboxes:**
1. Go to "Financial Settings"
2. Toggle "Accept Credit Cards" checkbox
3. Verify it toggles on/off with visual feedback

**Expected Result:**
- Checkbox toggles properly
- State change is immediate
- Field is marked as dirty

### Feature 10: Notifications
**Steps:**
1. Click "Save Changes" with unsaved modifications
2. Watch notification appear in top-right corner
3. Verify it disappears after 3 seconds
4. Try "Reset to Defaults" and cancel to see info notification

**Expected Result:**
- Success notification (green) on save
- Info notification (blue) for informational messages
- Notifications position fixed in top-right
- Smooth slide-in animation
- Auto-dismiss after 3 seconds

### Feature 11: Responsive Layout
**Test on Desktop (1920px):**
- Settings grid should show 3 columns
- Category sections should be wide and readable

**Test on Tablet (768px):**
1. Resize browser to 900px width
2. Verify grid shows 2 columns
3. Buttons should still be visible

**Test on Mobile (375px):**
1. Resize browser to 375px width
2. Verify grid shows 1 column
3. Verify buttons stack vertically
4. All content should be readable

**Expected Result:**
- Layout adapts smoothly to all screen sizes
- No horizontal scrolling needed
- All inputs accessible and usable

## Data Persistence Testing

### Test 1: Browser Refresh
**Steps:**
1. Change "Company Name" to "Persistence Test"
2. Click "Save Changes"
3. Press F5 to refresh page
4. Navigate back to Settings

**Expected Result:**
- Company Name field still shows "Persistence Test"
- Settings persisted through page refresh

### Test 2: New Tab
**Steps:**
1. In new tab, navigate to same application
2. Go to Company Settings
3. Verify same values appear

**Expected Result:**
- Settings are accessible from any tab
- No duplication or conflicts

### Test 3: Clear localStorage
**Steps:**
1. Open DevTools (F12)
2. Go to Application > Local Storage
3. Find entry: `relia_company_settings`
4. Delete it
5. Refresh page

**Expected Result:**
- Settings reset to defaults on refresh
- New localStorage entry created with defaults

## Browser DevTools Debugging

### Check Storage
1. Press F12 to open DevTools
2. Go to "Application" tab
3. Click "Local Storage"
4. Find: `relia_company_settings`
5. View the JSON data

### Check Console
1. Open DevTools Console
2. No errors should appear when page loads
3. Check that CompanySettingsUI initializes

### Example Console Check:
```javascript
// In DevTools Console:
window.companySettingsUI  // Should show CompanySettingsUI instance
window.companySettingsUI.currentSettings  // Shows all loaded settings
window.companySettingsUI.loadSettings()  // Reload settings
```

## Performance Checklist

- [ ] Page loads settings within 100ms
- [ ] Settings render without lag
- [ ] Expand/collapse transitions are smooth
- [ ] Input changes don't cause delays
- [ ] Save completes quickly
- [ ] Export/Import don't block UI
- [ ] No memory leaks with repeated expand/collapse

## Known Limitations

1. **Client-side Only**: Settings stored in localStorage (limited to ~5-10MB)
2. **Single User**: No user-specific settings yet
3. **No Validation**: Basic HTML5 validation only, no server validation
4. **No Versioning**: Settings don't track change history
5. **No Sync**: Changes don't sync across browser tabs in real-time

## Future Testing (Post-Implementation)

1. Integration with backend API for server-side persistence
2. User role-based access control to specific settings
3. Settings change audit trail
4. Real-time sync across browser tabs
5. Settings validation and constraints
6. Custom settings support
7. Settings templates for different company types

## Support & Troubleshooting

### Settings Not Saving?
1. Check browser localStorage is enabled
2. Check localStorage quota isn't exceeded
3. Open DevTools and check for JavaScript errors
4. Try exporting/importing settings

### Settings Reset to Defaults?
1. Check if localStorage was cleared
2. Check for browser extensions interfering
3. Try disabling browser cache-clearing on exit

### Import Not Working?
1. Verify JSON file is valid (check in text editor)
2. Ensure file was exported from same application
3. Check browser security permissions for file upload

## Contact & Support
For issues or questions about the Company Settings implementation, refer to:
- COMPANY_SETTINGS_IMPLEMENTATION.md (technical details)
- CompanySettingsManager.js (core logic)
- CompanySettingsUI.js (UI handling)
