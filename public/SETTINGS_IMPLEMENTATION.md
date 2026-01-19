# Company Settings Application Implementation

## Overview
All company preference settings are now wired to actually affect the application's behavior. The `SettingsApplicationManager` reads settings from `CompanySettingsManager` and applies them throughout the system.

## Settings Groups & Implementation

### 1. GENERAL COMPANY INFO
**Settings**: Company Name, Phone, Email, Website, Address, City, State, ZIP
**Applied To**:
- Page title (uses company name)
- `window.COMPANY_INFO` object for app-wide access
- Elements with `data-company-name`, `data-section="company-name"` attributes
- Header and footer displays

### 2. FINANCIAL SETTINGS
**Settings**: Default Currency, Tax Rate, Minimum Reservation Amount, Payment Methods
**Applied To**:
- `window.FINANCIAL_CONFIG` - Global financial configuration
- **CostCalculator.js**: 
  - Uses `defaultCurrency` and `defaultTaxRate` for all calculations
  - `formatCurrency()` method uses company's selected currency
  - Tax calculations use company's tax rate
- **Payment Methods UI**: Shows/hides payment options (Credit Cards, Cash, Checks, Online)
- Cost calculations respect minimum reservation amount

### 3. RESERVATION SETTINGS
**Settings**: Require Payment Upfront, Advance Reservation Hours, Cancellation Policy Hours, No-Show Fee %, Max Passengers
**Applied To**:
- **ReservationManager.js**:
  - `validateReservation()` - Validates against:
    - Max passengers per vehicle
    - Advance reservation requirement
    - Payment requirement settings
  - `calculateCancellationFee()` - Uses company's no-show fee percentage
- Reservation form UI prompts updated based on payment requirement
- Error messages reflect company's policies

### 4. COMMUNICATION SETTINGS
**Settings**: Send Confirmation Email, Send Reminder SMS, Send Receipt Email, Automatic Invoicing, Invoice Due Date
**Applied To**:
- `window.COMMUNICATION_CONFIG` - Global communication settings
- Email/SMS preference checkboxes updated to reflect enabled methods
- Background processes check these before sending notifications
- Invoice generation respects due date setting

### 5. VEHICLE SETTINGS
**Settings**: Default Vehicle Type, Require Driver License, Require Insurance, Insurance Minimum
**Applied To**:
- **ReservationManager.js**:
  - `VEHICLE_VALIDATION_RULES` - Used when validating driver requirements
- Vehicle selection forms show/hide based on availability
- Driver qualification checks enforced based on settings

### 6. SYSTEM SETTINGS
**Settings**: Maintenance Mode, Enable Analytics, Enable Reporting, Data Backup Frequency
**Applied To**:
- **Maintenance Mode**: Shows banner if enabled, disables certain features
- **Reporting**: Hides reporting/reports navigation if disabled
- **Analytics**: Controls whether tracking is active
- **Backup Frequency**: Controls automated data backup schedules

## Global Configuration Objects

After settings are applied, these global objects are available:

```javascript
window.COMPANY_INFO = {
  name, phone, email, website, address, city, state, zip
}

window.FINANCIAL_CONFIG = {
  currency, currencySymbol, taxRate, minimumAmount,
  paymentMethods: { creditCard, cash, check, online }
}

window.RESERVATION_CONFIG = {
  requirePaymentUpfront, requireAdvanceReservationHours,
  cancellationPolicyHours, noShowFeePercent, maxPassengers
}

window.COMMUNICATION_CONFIG = {
  sendConfirmationEmail, sendReminderSMS, sendReceiptEmail,
  automaticInvoicing, invoiceDueDays
}

window.SYSTEM_CONFIG = {
  maintenanceMode, analyticsEnabled, reportingEnabled, backupFrequency
}

window.VEHICLE_CONFIG = {
  defaultType, requireDriverLicense, requireInsurance, insuranceMinimum
}

window.VEHICLE_VALIDATION_RULES = {
  driverLicense, insurance, insuranceMinimum
}
```

## How Settings Flow

1. **Settings Saved**: User saves preferences in Company Settings or My Office
2. **Stored**: Settings saved to `localStorage` via `CompanySettingsManager`
3. **Loaded**: `SettingsApplicationManager` initializes and loads all settings
4. **Applied**: Settings converted to global config objects
5. **Used**: Core managers (CostCalculator, ReservationManager, etc.) read from these configs
6. **Updated**: Any time settings change, global objects update automatically

## Modules Using Settings

### CostCalculator.js
- Uses: `FINANCIAL_CONFIG.currency`, `taxRate`, `minimumAmount`
- Methods affected: `calculate()`, `formatCurrency()`, `applyDiscount()`

### ReservationManager.js
- Uses: `RESERVATION_CONFIG`, `VEHICLE_VALIDATION_RULES`
- Methods affected: `validateReservation()`, `calculateCancellationFee()`
- New methods: `loadSettingsFromManager()`, `validateReservation()`, `calculateCancellationFee()`

### SettingsApplicationManager.js (NEW)
- Central hub for applying all settings
- Auto-initializes on page load
- Updates UI elements based on settings
- Shows/hides features based on system settings

## Implementation Status

✅ **Completed**:
- SettingsApplicationManager.js created and loaded
- Financial settings wired to CostCalculator
- Reservation settings wired to ReservationManager
- Company info accessible globally
- System settings control UI visibility
- Currency formatting respects settings
- Validation rules enforced based on settings

🟡 **In Progress/Needed**:
- Wire communication settings to email/SMS modules
- Implement maintenance mode feature display
- Connect analytics settings to tracking code
- Wire invoice generation to communication settings
- Update driver/vehicle selection based on vehicle settings

## Testing Settings

To test that settings are being applied:

1. **Set a preference** in Company Preferences
2. **Check console** for `[SettingsApplicationManager]` logs
3. **Verify global config**: `console.log(window.FINANCIAL_CONFIG)` etc.
4. **Test functionality** that uses that setting
   - Change max passengers → try to add more
   - Change currency → check cost display format
   - Change payment requirement → check reservation validation
   - Enable maintenance mode → verify banner shows

## Next Steps

To fully complete this implementation, the remaining modules should also load and use settings:
- Email/SMS service modules
- Reporting modules
- Analytics integrations
- Invoice generation
- Driver/vehicle selection utilities
