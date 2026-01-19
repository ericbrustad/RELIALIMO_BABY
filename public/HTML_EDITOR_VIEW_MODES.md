# 📝 HTML Editor View Modes for eric

## Overview
All HTML template editors in the RELIA🐂LIMO™ system now support **three view modes** that can be switched dynamically:

1. **xhtml** - Source code view (raw HTML)
2. **Editing** - WYSIWYG visual editor
3. **Preview** - Rendered preview with sample data

---

## 🎯 Features

### xhtml (Source Code) View
- Monospace font for code readability
- Auto-formatted HTML with proper indentation
- Gray background (#f8f8f8) to distinguish from editing mode
- Direct HTML editing for advanced users
- Syntax remains preserved when switching views

### Editing (WYSIWYG) View
- **Default mode** - Users start here
- Full rich text editing with toolbar
- Contenteditable div for natural editing experience
- Real-time formatting
- Drag-and-drop tag insertion supported

### Preview View
- **Read-only** rendering of the HTML
- **Sample data replacement** - Tags automatically replaced with realistic sample data
- Visual highlights:
  - **Yellow background** - Tags with sample data
  - **Red background** - Tags without sample data (need mapping)
- See exactly how the template will look to end users
- No editing allowed - purely for review

---

## 💡 How It Works

### View Switching
Click any of the three footer tabs to switch modes:
```
┌──────────────────────────────────────┐
│  [xhtml] [Editing] [Preview]        │
└──────────────────────────────────────┘
```

### Automatic Content Sync
- Content automatically syncs between views
- Switching from **xhtml** → **Editing**: HTML loads into visual editor
- Switching from **Editing** → **xhtml**: Visual content converts to formatted HTML
- Switching to **Preview**: Content renders with sample data

### Sample Data in Preview
The preview mode replaces tags with realistic examples:

| Tag | Preview Value |
|-----|---------------|
| `#COMP_NAME#` | RELIA🐂LIMO™ |
| `#TRIP_CONFNUM#` | RB-2024-001234 |
| `#TRIP_BC_FNAME#` | John |
| `#TRIP_BC_EMAIL1#` | john.doe@example.com |
| `#TRIP_RATES_TOTAL#` | $250.00 |
| `#TRIP_DRIVER1_FNAME#` | Michael |

---

## 📍 Available Editors

All Custom Forms section editors now support three-view modes!

### 1. **Policies & Agreements Editor**
- **Location**: My Office → Company Settings → Policies
- **Editor ID**: `htmlEditor`
- **Purpose**: Rental agreements, terms, waivers

### 2. **HTML Template Editor**
- **Location**: My Office → Custom Forms → HTML Template
- **Editor ID**: `customFormsEditor`
- **Purpose**: Custom HTML forms, general templates

### 3. **Invoice Trip Block Editor** ✨ NEW
- **Location**: My Office → Custom Forms → Invoice Trip Block
- **Editor ID**: `invoiceTripEditor`
- **Purpose**: Invoice trip block templates

### 4. **Invoice Trip Routing Editor** ✨ NEW
- **Location**: My Office → Custom Forms → Invoice Trip Routing Additional Pax Block
- **Editor ID**: `invoiceRoutingEditor`
- **Purpose**: Invoice routing and additional passenger block templates

### 5. **ReadBack Scripts** (Future)
- Coming soon with view modes

### 6. **Email Templates** (Future)
- Coming soon with view modes

---

## 🎨 Visual Design

### xhtml View
```css
- Background: #f8f8f8 (light gray)
- Font: Courier New, monospace
- Font Size: 12px
- Padding: 20px
- Scrollable content area
```

### Editing View
```css
- Background: White
- Font: Arial, sans-serif
- Font Size: 13px
- Line Height: 1.6
- Contenteditable enabled
```

### Preview View
```css
- Background: White
- Border: 1px solid #e0e0e0
- Font: Arial, sans-serif
- Tag highlights with colored backgrounds
- Read-only display
```

---

## 🔧 Technical Implementation

### Class: HTMLEditorViewSwitcher

```javascript
// Initialize an editor with three-view support
const editor = new HTMLEditorViewSwitcher('htmlEditor');

// Programmatically switch views
editor.switchView('source');  // Switch to xhtml
editor.switchView('editor');  // Switch to editing
editor.switchView('preview'); // Switch to preview

// Get content
const html = editor.getContent();

// Set content
editor.setContent('<p>New HTML content</p>');
```

### HTML Structure
Each editor requires three elements:

```html
<!-- Source view (textarea) -->
<textarea class="html-editor-source" id="htmlEditorSource" style="display: none;"></textarea>

<!-- Editing view (contenteditable) -->
<div class="html-editor-content" id="htmlEditor" contenteditable="true">
  <!-- Rich text content -->
</div>

<!-- Preview view (read-only div) -->
<div class="html-editor-preview" id="htmlEditorPreview" style="display: none;">
  <!-- Preview content -->
</div>

<!-- Footer with view tabs -->
<div class="html-editor-footer">
  <div class="editor-footer-tabs">
    <button class="editor-footer-tab" data-mode="source">xhtml</button>
    <button class="editor-footer-tab active" data-mode="editor">Editing</button>
    <button class="editor-footer-tab" data-mode="preview">Preview</button>
  </div>
</div>
```

### Naming Convention
For an editor with ID `myEditor`:
- Source textarea: `myEditorSource`
- Editing div: `myEditor`
- Preview div: `myEditorPreview`

---

## 📊 Content Formatting

### HTML Formatting (xhtml View)
When switching to xhtml view, HTML is automatically formatted:

**Before:**
```html
<p><strong>Hello</strong> <span>World</span></p><div><ul><li>Item</li></ul></div>
```

**After:**
```html
<p>
  <strong>Hello</strong>
  <span>World</span>
</p>
<div>
  <ul>
    <li>Item</li>
  </ul>
</div>
```

### Tag Replacement (Preview Mode)
Tags are replaced with:
1. **Yellow highlight** - Known tags with sample data
2. **Red highlight** - Unknown tags (need configuration)

---

## 🚀 Usage Examples

### For Template Designers
1. Start in **Editing** mode to compose your template
2. Use toolbar for formatting (bold, lists, alignment)
3. Drag-and-drop tags from Trip Tags or Rate Tags
4. Switch to **Preview** to see how it renders
5. Switch to **xhtml** to fine-tune HTML or copy source code

### For Developers
1. Switch to **xhtml** mode
2. Write/paste HTML directly
3. Use proper tags: `#COMP_NAME#`, `#TRIP_CONFNUM#`, etc.
4. Switch to **Preview** to test tag replacements
5. Switch to **Editing** to visually verify formatting

### For Reviewers
1. Open template in **Editing** or **Preview** mode
2. Review content and formatting
3. Switch to **Preview** to see final output
4. Check that all tags are highlighted in yellow (not red)
5. Provide feedback on visual appearance

---

## 🎓 Best Practices

### When to Use Each Mode

**xhtml (Source):**
- Advanced HTML editing
- Copying/pasting HTML from external sources
- Fine-tuning element attributes
- Debugging formatting issues
- Removing unwanted inline styles

**Editing (WYSIWYG):**
- Day-to-day template editing
- Content writing
- Formatting text
- Inserting tags via drag-and-drop
- Quick updates

**Preview:**
- Final review before saving
- Client presentations
- Quality assurance
- Verifying tag replacements
- Testing responsive layout

---

## ⚠️ Important Notes

1. **Content is Synced**: Changes in one view affect all views
2. **Preview is Read-Only**: Cannot edit in preview mode
3. **HTML Validation**: Invalid HTML may render differently in preview
4. **Tag Format**: Always use `#TAG_NAME#` format
5. **Formatting Preservation**: Switching views preserves formatting
6. **Auto-Save**: Remember to click Save button after editing

---

## 🔄 Integration with Drag-and-Drop

The view mode system works seamlessly with drag-and-drop tags:

1. **In Editing Mode**:
   - Drag tags directly into editor ✅
   - Visual drop zone indicators ✅
   - Inserts at cursor position ✅

2. **In xhtml Mode**:
   - Drag tags into source code ✅
   - Inserts as text in textarea ✅
   - Maintains proper tag format ✅

3. **In Preview Mode**:
   - Drag-and-drop disabled ❌
   - Read-only view for review only

---

## 🐛 Troubleshooting

### Tags Don't Show in Preview
- Ensure tags use proper format: `#TAG_NAME#`
- Check tag is defined in `replaceTags()` function
- Unknown tags show with red background

### Formatting Lost When Switching
- Check for invalid HTML in source
- Ensure proper tag nesting
- Avoid mixing inline styles with semantic HTML

### Editor Not Switching Views
- Check browser console for errors
- Ensure HTMLEditorViewSwitcher is initialized
- Verify footer tabs have `data-mode` attributes

---

## 📁 Files

- `/html-editor-view-switcher.js` - View switching logic
- `/my-office.html` - Editor HTML structures
- `/my-office.css` - Editor styling
- `/my-office.js` - Initialization and events

---

## 🎯 Future Enhancements

- [ ] Syntax highlighting in xhtml mode
- [ ] Real-time tag validation
- [ ] Custom sample data sets
- [ ] Export templates as standalone HTML
- [ ] Version history and diff viewing
- [ ] Collaborative editing indicators
- [ ] Mobile-responsive preview modes

---

**Version**: 1.0  
**Status**: ✅ Production Ready  
**Last Updated**: 2024
