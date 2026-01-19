# 🎯 Drag & Drop Tag System

## Overview
The RELIA🐂LIMO™ tag insertion system now supports **drag-and-drop** functionality across all HTML editors in the application. Users can either click to insert tags or drag them directly from the tag selector modals into any text editor.

---

## ✨ Features

### 1. **Dual Tag Selector System**

#### 📋 Trip Tag Selector (Gold)
- **320+ trip-related tags** organized in 17 categories
- Gold gradient styling (#d4af37 to #f4d03f)
- Categories include:
  - Company Information
  - Trip Details
  - Billing/Booking Contacts
  - Passengers & Drivers
  - Vehicle Information
  - Payment & Rates
  - System URLs & More

#### 💰 Rate Tag Selector (Blue)
- **70+ rate-specific tags** organized in 8 categories
- Blue gradient styling (#0066cc to #0088ff)
- Categories include:
  - Rate Summaries
  - Base Rates
  - Miscellaneous Fees
  - Gratuities
  - Taxes
  - Surcharges
  - Discounts
  - Individual Rate Line Items

---

## 🎨 User Interface

### Tag Selector Modal Features
- **Search Bar**: Real-time filtering across tag names and descriptions
- **Category Filters**: Quick navigation buttons for each category
- **Draggable Rows**: Each tag row displays a drag handle (⋮⋮) icon
- **Visual Feedback**: Rows show "grabbing" cursor and transparency when dragging
- **Keyboard Shortcuts**:
  - `Enter`: Insert selected tag
  - `Escape`: Close modal

### Drop Zone Indicators
When dragging a tag over an editor:
- **Dashed blue outline** appears around the editor
- **"Drop tag here"** message displays at center
- **Light blue background** highlights the drop area
- Visual feedback confirms valid drop target

---

## 🚀 How to Use

### Method 1: Click to Insert (Original)
1. Click the **📋 Trip Tags** or **💰 Rate Tags** button
2. Browse or search for your desired tag
3. Click to select a tag (row highlights in blue)
4. Click **"Insert"** button or double-click the row
5. Tag inserts at cursor position

### Method 2: Drag and Drop (New!)
1. Open the **📋 Trip Tags** or **💰 Rate Tags** modal
2. Click and hold on any tag row (drag handle visible)
3. Drag the tag to your target editor
4. Release mouse button to drop
5. Tag automatically inserts at drop position

---

## 📍 Available Locations

Drag-and-drop functionality works in **all HTML editors** throughout the system:

### My Office Section
1. **Policies & Agreements Editor** (Company Settings)
2. **ReadBack Script Templates** (Company Settings)
3. **Custom Forms Editor** (Custom Forms Tab)
4. **Scheduled Email Templates** (Messaging & Template Settings)

### Memos Section
5. **Company Memos Editor** (Main memo textarea)

### Any Future Editors
The system automatically detects and enables drag-drop for:
- All `<textarea>` elements
- All `contenteditable="true"` elements
- Dynamically added editors

---

## 🛠️ Technical Implementation

### Files Structure

```
/triptag-selector.js       # Trip tag selector with drag events
/ratetag-selector.js       # Rate tag selector with drag events
/drag-drop-handler.js      # Universal drop zone manager
/tag-selector.css          # Styling for drag-drop UI
/my-office.html            # Main page with tag buttons
/memos.html                # Memos page with tag buttons
/my-office.js              # Reinitialization on section changes
```

### Key Functions

#### `drag-drop-handler.js`
```javascript
initializeDragDropForEditors()  // Initializes all editors as drop zones
makeDropZone(element)           // Converts element to drop target
handleDrop(e)                   // Processes dropped tags
insertTagIntoTextarea()         // Inserts tag into textarea
insertTagIntoContentEditable()  // Inserts tag into rich text editor
observeNewEditors()             // Watches for dynamically added editors
```

#### `triptag-selector.js` & `ratetag-selector.js`
- `dragstart` event: Sets tag data and visual feedback
- `dragend` event: Resets visual state
- Tags stored as plain text in `dataTransfer`

---

## 🎯 Drop Zone Detection

### Automatic Initialization
The system automatically initializes drop zones:
1. **On page load**: All existing editors become drop zones
2. **On section change**: Editors in newly visible sections are enabled
3. **On dynamic content**: MutationObserver detects new editors

### Supported Editor Types
- **Textareas**: Standard form textareas
- **ContentEditable**: Rich text WYSIWYG editors
- **Input Fields**: Single-line text inputs

---

## 🔧 Customization

### Adding New Editors
No manual setup required! Just create any:
```html
<!-- Textareas automatically work -->
<textarea class="my-editor"></textarea>

<!-- ContentEditable elements automatically work -->
<div contenteditable="true"></div>
```

### Reinitializing After Content Changes
If you dynamically load new content:
```javascript
// Call this after loading new editors
window.reinitializeDragDrop();
```

---

## 🎨 Visual Styling

### Drag Handle
- **Icon**: ⋮⋮ (vertical dots)
- **Color**: Gray (#999), darkens on hover (#666)
- **Position**: Left side of tag name

### Dragging State
```css
.draggable-tag.dragging {
    opacity: 0.5;
    cursor: grabbing;
}
```

### Drop Zone Active
```css
.drop-zone.drag-over {
    outline: 2px dashed #4A90E2;
    background-color: rgba(74, 144, 226, 0.05);
}
```

---

## 🧪 Testing Checklist

- [ ] Drag trip tag into textarea
- [ ] Drag rate tag into contenteditable
- [ ] Drag multiple tags in sequence
- [ ] Drop at beginning, middle, and end of text
- [ ] Test with empty editors
- [ ] Test with existing content and cursor position
- [ ] Switch sections and test newly visible editors
- [ ] Test keyboard shortcuts (Enter, Escape)
- [ ] Test double-click to insert
- [ ] Test search and category filters

---

## 🐛 Known Limitations

1. **Browser Compatibility**: Drag-and-drop requires modern browsers (Chrome 4+, Firefox 3.5+, Safari 3.1+)
2. **Mobile Support**: Touch-based drag-and-drop has limited support; click-to-insert remains primary method on mobile
3. **Cross-Window**: Cannot drag from modal to external windows (by design)

---

## 🚀 Future Enhancements

- [ ] Tag preview on hover (show sample data)
- [ ] Recently used tags quick access
- [ ] Favorite/starred tags system
- [ ] Tag validation on save
- [ ] Backend tag replacement engine
- [ ] Multi-tag selection and batch insert
- [ ] Tag syntax highlighting in editors

---

## 📚 Tag Format

All tags use the format: `#TAG_NAME#`

**Examples:**
- `#COMP_NAME#` - Company Name
- `#TRIP_CONFNUM#` - Trip Confirmation Number
- `#Rate_ID_327125#` - Flat Rate Amount
- `#TRIP_BC_EMAIL1#` - Billing Contact Email

---

## 💡 Tips for Users

1. **Use Search**: Type keywords to quickly find tags (e.g., "email", "phone", "rate")
2. **Category Filters**: Click category buttons to narrow down results
3. **Drag Handle**: Look for the ⋮⋮ icon to know rows are draggable
4. **Visual Feedback**: Watch for the blue outline when hovering over drop zones
5. **Keyboard Shortcut**: Press Enter to quickly insert selected tag
6. **Double-Click**: Fastest way to insert without dragging

---

## 🎓 Developer Notes

### Event Flow
1. User clicks tag row → `dragstart` fires
2. Tag text stored in `dataTransfer`
3. User drags over editor → `dragover` and `dragenter` fire
4. Drop zone shows visual feedback
5. User releases mouse → `drop` event fires
6. Handler inserts tag at cursor/drop position
7. `dragend` cleans up visual state

### Cursor Position Handling
- **Textareas**: Uses `selectionStart` and `selectionEnd`
- **ContentEditable**: Uses `window.getSelection()` and Range API
- **Fallback**: Inserts at end if no cursor position detected

### Performance Considerations
- MutationObserver throttled to prevent performance issues
- Drag event handlers use event delegation where possible
- Drop zone indicators use CSS for smooth rendering

---

## 📞 Support

For issues or feature requests related to the drag-and-drop tag system:
1. Check this documentation first
2. Test in latest Chrome/Firefox/Safari
3. Check browser console for errors
4. Verify editors have correct HTML structure
5. Ensure scripts loaded in correct order

---

**Version**: 2.0  
**Last Updated**: 2024  
**Status**: ✅ Production Ready
