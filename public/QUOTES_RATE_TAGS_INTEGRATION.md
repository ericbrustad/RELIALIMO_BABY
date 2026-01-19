# Quotes Rate Tags Integration

## Overview
Added **💰 Rate Tags** support to both HTML editors in the RELIA🐂LIMO™ Quotes section, giving users access to 70+ rate-related tags alongside the existing 250+ trip tags.

---

## What Was Added

### 1. **Response Templates Editor**
**Location**: Quotes → Response Templates tab

**New Buttons**:
- 📋 **Trip Tags** (existing - golden gradient)
- 💰 **Rate Tags** (NEW - green gradient)

**Toolbar Layout**:
```
[Format] [Font] [Size] | B I U S | ≡ ≡ ≡ | • 1. | 🔗 🖼️ 📊 | 📋 Trip Tags | 💰 Rate Tags
```

---

### 2. **Initial Response Editor**
**Location**: Quotes → Initial Response tab

**New Buttons**:
- 📋 **Trip Tags** (existing - golden gradient)
- 💰 **Rate Tags** (NEW - green gradient)

**Toolbar Layout**:
```
[Format] [Font] [Size] | B I U S | ≡ ≡ ≡ | • 1. | 🔗 🖼️ 📊 | 📋 Trip Tags | 💰 Rate Tags
```

---

## Visual Design

### Rate Tags Button Styling
```css
background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
color: #fff;
font-weight: 600;
```

**Color Scheme**:
- **Green gradient** (#27ae60 → #2ecc71) - Distinguishes from Trip Tags
- **White text** - High contrast for readability
- **Positioned after** Trip Tags button for logical flow

---

## Rate Tag Selector Modal

### Modal Features
- **Green gradient header** (matches button)
- **White text and icons** for consistency
- **Category filtering**:
  - All Tags (default)
  - Totals
  - Base Rates
  - Fees
  - Taxes
  - Gratuities
  - Surcharges

### Tag Types Available (70+ tags)
1. **Totals**: Grand total, subtotal, balance due
2. **Base Rates**: Hourly rates, flat rates, distance rates
3. **Fees**: Service fees, fuel surcharges, booking fees
4. **Taxes**: Sales tax, luxury tax, airport fees
5. **Gratuities**: Gratuity, tip amounts, service charges
6. **Surcharges**: Peak time, holiday, weekend rates
7. **Rate IDs**: Custom rate line items by ID

---

## Implementation Details

### Files Modified

#### HTML (`/quotes.html`)
1. **Response Templates Editor**:
   - Added Rate Tags button after Trip Tags button
   - Uses `response-rate-tags-btn` class
   - `data-editor-target="responseTemplateEditor"`

2. **Initial Response Editor**:
   - Added Rate Tags button after Trip Tags button
   - Uses `initial-rate-tags-btn` class
   - `data-editor-target="initialResponseEditor"`

3. **Rate Tag Selector Modal**:
   - Complete modal structure
   - Green gradient header
   - Category buttons for filtering
   - Search input
   - Insert/Cancel buttons

4. **Script Includes**:
   - Added `<script src="ratetag-selector.js"></script>`

#### JavaScript (`/quotes.js`)
1. **Response Templates Rate Tags Handler**:
```javascript
document.querySelectorAll('.response-rate-tags-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const editorId = btn.dataset.editorTarget;
    const editor = document.getElementById(editorId);
    if (editor && window.openRateTagSelector) {
      window.openRateTagSelector(editor);
    }
  });
});
```

2. **Initial Response Rate Tags Handler**:
```javascript
document.querySelectorAll('.initial-rate-tags-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const editorId = btn.dataset.editorTarget;
    const editor = document.getElementById(editorId);
    if (editor && window.openRateTagSelector) {
      window.openRateTagSelector(editor);
    }
  });
});
```

---

## Usage Examples

### Response Templates Editor
Perfect for including pricing information in quote responses:
```html
<p>Dear #TRIP_PASS_FNAME#,</p>
<p>Thank you for your quote request. Here are the details:</p>
<ul>
  <li>Base Rate: #TRIP_RATES_BASE_TOTAL#</li>
  <li>Taxes: #TRIP_RATES_TAXES_TOTAL#</li>
  <li>Gratuity: #TRIP_RATES_GRATUITIES_TOTAL#</li>
  <li><strong>Total: #TRIP_RATES_TOTAL#</strong></li>
</ul>
```

### Initial Response Editor
Typically not used (per info banner), but available for special cases:
```html
<p>Thank you for your quote request!</p>
<p>We will respond shortly with pricing details.</p>
<!-- Rate tags generally NOT used here since pricing hasn't been calculated yet -->
```

---

## Tag System Comparison

| Feature | Trip Tags 📋 | Rate Tags 💰 |
|---------|--------------|--------------|
| **Count** | 250+ tags | 70+ tags |
| **Button Color** | Gold gradient | Green gradient |
| **Modal Header** | Gold gradient | Green gradient |
| **Categories** | Company, Trip Info, Billing, Passenger, Vehicle, Driver, etc. | Totals, Base Rates, Fees, Taxes, Gratuities, etc. |
| **Use Case** | Customer/trip information | Pricing/financial information |
| **Drag & Drop** | ✅ Supported | ✅ Supported |
| **Search** | ✅ Real-time | ✅ Real-time |
| **Keyboard** | ✅ Enter/Escape | ✅ Enter/Escape |

---

## Integration with Existing Features

### Drag-and-Drop Support
Both Trip Tags and Rate Tags support drag-and-drop:
- **Draggable rows** with ⋮⋮ grab handles
- **Drop zones** with blue dashed outline
- **Visual feedback** during drag operations
- **Smart cursor positioning** at drop location

### Three-View Mode
Tags work seamlessly across all view modes:
- **xhtml view**: Shows raw tag syntax (`#TRIP_RATES_TOTAL#`)
- **HTML view**: Shows tag in editable content
- **Preview view**: Replaces with sample data and highlights in yellow

### Sample Data Preview
Rate tags display sample values:
- `#TRIP_RATES_TOTAL#` → **$250.00** (yellow highlight)
- `#TRIP_RATES_BASE_TOTAL#` → **$200.00** (yellow highlight)
- `#TRIP_RATES_TAXES_TOTAL#` → **$20.00** (yellow highlight)
- `#TRIP_RATES_GRATUITIES_TOTAL#` → **$30.00** (yellow highlight)
- Unmapped tags → Red highlight

---

## User Workflow

### Inserting Rate Tags

**Method 1: Click Button**
1. Click 💰 **Rate Tags** button in toolbar
2. Modal opens with rate tag selector
3. Search or browse by category
4. Click tag row to select
5. Click "Insert Tag" button
6. Tag inserts at cursor position

**Method 2: Drag & Drop**
1. Click 💰 **Rate Tags** button
2. Modal opens
3. Drag tag row from modal
4. Drop into editor at desired location
5. Tag inserts at drop position
6. Modal remains open for more tags

**Method 3: Keyboard**
1. Click 💰 **Rate Tags** button
2. Search for tag
3. Click to select
4. Press **Enter** to insert
5. Press **Escape** to close modal

---

## Why Rate Tags in Quotes?

### Response Templates
**High Value** ✅
- Send detailed pricing breakdowns
- Include tax calculations
- Show itemized costs
- Professional quote presentation
- Build customer trust with transparency

### Initial Response
**Low Value** ⚠️
- Sent BEFORE pricing calculation
- Usually generic acknowledgment only
- Typically shouldn't include pricing
- Available but rarely used

---

## Status
✅ **Production-ready** - Rate Tags fully integrated into both Quotes editors with complete functionality matching Trip Tags implementation.

### Complete Tag System Coverage

**Quotes Section Editors**:
- ✅ Response Templates Editor: 📋 Trip Tags + 💰 Rate Tags
- ✅ Initial Response Editor: 📋 Trip Tags + 💰 Rate Tags

**All 11 HTML Editors** now have appropriate tag support based on their use case.

---

## Future Enhancements

- [ ] Custom rate tag creation per template
- [ ] Conditional rate tag visibility (show/hide based on conditions)
- [ ] Rate tag validation (ensure tag exists in rate calculation)
- [ ] Currency formatting options per tag
- [ ] Multi-currency support
- [ ] Real-time rate preview with actual data
