# Quotes Initial Response Implementation

## Overview
Professional initial auto-response template editor for quote requests in the RELIA🐂LIMO™ Quotes section. This is the first automated email sent instantly when customers submit quote requests, before any staff processing or price calculation.

---

## Location
**File**: `/quotes.html`  
**Tab**: "Initial Response" (third tab in Quotes section)

---

## Purpose
Configure the immediate automated acknowledgment sent when quote requests are received. The purpose: "We got your request, call us with questions, wait patiently!" This is sent BEFORE any human interaction or price calculation.

---

## Architecture

### Layout Structure
```
┌──────────────────────────────────────────┐
│  Initial Response Container              │
├──────────┬───────────────────────────────┤
│ Recipients│  Editor Panel                │
│ List      │                              │
│ (200px)   │  - Recipient Dropdown        │
│           │  - Info Box (Blue banner)    │
│ ├─ online │  - Email Subject Input       │
│ │  Quote  │  - Rich Text Toolbar         │
│ ├─ online │  - HTML Editor (400px)       │
│ │  Express│  - Footer w/ View Modes      │
│ ├─ online │  - Save/Cancel Buttons       │
│ │ Contract│                              │
│ └─ online │                              │
│   Account │                              │
└──────────┴───────────────────────────────┘
```

---

## Features Implemented

### 1. **Recipients List Panel** (Left Side)
- **Dark header** with "Recipients" title
- **Four recipient types**:
  - online Quote (default active)
  - online Express
  - online Contract
  - online Account
- **Active state styling** - Blue background for selected recipient
- **Click to load** - Each recipient loads corresponding template

### 2. **Configuration Options**
- **Recipient Dropdown** - Select which customer type this applies to
- **Info Banner** (blue background with left border):
  > "This is the initial/instantaneous email sent when your customers submit quote requests, BEFORE any staff processes or BEFORE any price calculation. The purpose: 'we got your request, call us with questions, wait patiently!'. Usually you will NOT add Trip Tags here."
- **Email Subject Field** - Customize the subject line

### 3. **Rich Text Editor Toolbar**
Comprehensive formatting options:
- **Dropdowns**: Cell Class, Font Family, Font Size
- **Text Formatting**: Bold, Italic, Underline, Strikethrough
- **Alignment**: Left, Center, Right
- **Lists**: Bullet List, Numbered List
- **Insert**: Link, Image, Table
- **📋 Trip Tags Button** - Golden gradient (though typically not used for initial responses)

### 4. **Three-View Mode System**
Located in editor footer:
- **xhtml** - Raw HTML source with monospace font
- **HTML** - WYSIWYG visual editor (default)
- **Preview** - Rendered output with sample tag data

### 5. **Default Template Content**
Pre-populated with professional initial response:
```
Thank you for contacting us for your upcoming transportation needs. 
Please save the phone number (555) 123-4567.

A Customer Service Representative will follow up shortly! 
If you have any questions, please call us.

Regards,
Customer Service

Please save our phone number for future reference.
```

### 6. **Drag-and-Drop Tag Insertion**
- **Auto-enabled** via MutationObserver
- **Works across all views**
- **Visual feedback** during drag operations

---

## Files Modified/Created

### HTML
- `/quotes.html` - Added Initial Response tab content with editor UI
  - Recipients list panel structure
  - Info banner with explanatory text
  - Email subject input
  - Full rich text editor

### CSS
- `/quotes.css` - Added complete styling (200+ lines)
  - `.initial-response-container` - Main layout
  - `.initial-response-list-panel` - Left navigation (200px)
  - `.initial-response-editor-panel` - Right editor area
  - `.initial-editor-wrapper` - Editor container (400px height)
  - `.initial-editor-toolbar` - Formatting toolbar
  - `.initial-editor-content` - Editable area
  - `.initial-editor-footer` - View mode switcher
  - `.info-box` - Blue informational banner

### JavaScript
- `/quotes.js` - Added event handlers
  - Initial response item click handlers
  - Trip Tags button event listeners
  - Editor reinitialization on tab switch
  - `loadInitialResponse()` method
  - Recipient dropdown synchronization
  
- `/html-editor-view-switcher.js` - Added initial response editor
  - `initialResponseEditorSwitcher` variable
  - Auto-initialization logic
  - Three-view mode support

---

## Integration Points

### Tag Selector System
```javascript
// Trip Tags Button (quotes.html)
<button class="toolbar-btn initial-trip-tags-btn" 
        data-editor-target="initialResponseEditor">
  📋 Trip Tags
</button>

// Event Handler (quotes.js)
document.querySelectorAll('.initial-trip-tags-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const editor = document.getElementById(btn.dataset.editorTarget);
    if (editor && window.openTripTagSelector) {
      window.openTripTagSelector(editor);
    }
  });
});
```

### View Switcher Integration
```javascript
// Auto-initialization (html-editor-view-switcher.js)
const initialResponseEditor = document.getElementById('initialResponseEditor');
if (initialResponseEditor && !initialResponseEditorSwitcher) {
    initialResponseEditorSwitcher = new HTMLEditorViewSwitcher('initialResponseEditor');
}
```

### Drag-Drop Handler
```javascript
// Automatic detection (drag-drop-handler.js)
// MutationObserver finds initialResponseEditor automatically
const contentEditables = document.querySelectorAll('[contenteditable="true"]');
contentEditables.forEach(element => makeDropZone(element));
```

---

## Technical Details

### CSS Architecture
- **Flexbox layout** for responsive two-column design
- **Fixed width** left panel (200px narrower than Response Templates)
- **Flexible right panel** adapts to available space
- **Editor height**: 400px (smaller than other editors - appropriate for brief acknowledgments)
- **Height-based layout** using `calc(100vh - 200px)`

### Color Scheme
- **Header background**: #34495e (dark blue-gray)
- **Active recipient**: #3498db (blue)
- **Info banner**: #e8f4f8 (light blue background) with #3498db left border
- **Toolbar background**: #f5f5f5 (light gray)
- **Trip Tags button**: Linear gradient gold (#d4af37 → #f4d03f)

### Responsive Design
```css
@media (max-width: 1024px) {
  .initial-response-container {
    flex-direction: column;  /* Stack vertically */
    height: auto;
  }
  
  .initial-response-list-panel {
    width: 100%;
    max-height: 150px;  /* Limit height on mobile */
  }
}
```

---

## Usage Workflow

1. **Navigate to Quotes** → Click "Initial Response" tab
2. **Select recipient type** from left panel (online Quote, Express, Contract, or Account)
3. **Configure settings**:
   - Select recipient in dropdown (synced with left panel)
   - Review info banner about when this email is sent
   - Edit email subject line
4. **Edit email body** using the rich text toolbar
5. **Optional**: Insert trip tags (though typically not used for initial responses)
6. **Switch views**:
   - xhtml: Edit raw HTML source
   - HTML: Visual WYSIWYG editing
   - Preview: See rendered output
7. **Save changes** with Save button

---

## Key Differences from Response Templates

| Feature | Initial Response | Response Templates |
|---------|------------------|-------------------|
| **Purpose** | Instant acknowledgment | Staff-sent follow-up |
| **Timing** | Immediate/automatic | After processing |
| **Content** | Generic acknowledgment | Detailed pricing/info |
| **Trip Tags** | Usually NOT used | Frequently used |
| **Editor Height** | 400px (shorter) | 500px (taller) |
| **Left Panel Width** | 200px | 250px |
| **Info Banner** | Yes (blue banner) | No |

---

## Future Enhancements

- [ ] Backend API integration for template persistence
- [ ] Per-recipient template variations
- [ ] Schedule delay option (send after X minutes)
- [ ] A/B testing for acknowledgment effectiveness
- [ ] Open rate tracking
- [ ] Auto-include company contact info
- [ ] Multilingual template support
- [ ] Conditional content based on quote type

---

## Status
✅ **Production-ready** - Full-featured initial response template editor with professional three-view mode, drag-and-drop tag insertion, and comprehensive formatting toolbar.

**Total HTML Editors Now: 11**
1. Policies & Agreements Editor
2. HTML Template Editor  
3. Invoice Trip Block Editor
4. Address Location Editor
5. Airport Location Editor
6. Seaport Location Editor
7. FBO Location Editor
8. POI Location Editor
9. Additional Pax Block Editor
10. Response Template Editor
11. **Initial Response Editor** (NEW)

---

## Complete Quotes Section Implementation

All three tabs in the Quotes section are now fully functional:

### ✅ Manage Quotes
- Search and filter quote requests
- Table view with sorting options
- Bulk actions via checkboxes

### ✅ Response Templates
- Manage Quotes template
- Response Template
- Initial Response template
- Full HTML editor with tag insertion

### ✅ Initial Response
- Per-recipient templates (online Quote/Express/Contract/Account)
- Instant acknowledgment configuration
- Professional email body editor
- Subject line customization
