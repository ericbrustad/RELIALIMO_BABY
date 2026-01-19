// HTML Editor View Switcher
// Handles switching between xhtml (source), Editing (WYSIWYG), and Preview modes

class HTMLEditorViewSwitcher {
    constructor(editorId) {
        this.editorId = editorId;
        this.sourceView = document.getElementById(`${editorId}Source`);
        this.editorView = document.getElementById(editorId);
        this.previewView = document.getElementById(`${editorId}Preview`);
        this.currentMode = 'editor'; // default to editing mode
        
        this.init();
    }
    
    init() {
        // Find all view switcher buttons for this editor
        const editorWrapper = this.editorView.closest('.custom-forms-editor-wrapper');
        if (!editorWrapper) return;
        
        const buttons = editorWrapper.querySelectorAll('.editor-footer-tab');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchView(mode);
                
                // Update active button
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
        
        // Initialize with default content if empty
        if (!this.editorView.innerHTML.trim()) {
            this.editorView.innerHTML = '<p>Start typing or drag tags here...</p>';
        }
    }
    
    switchView(mode) {
        // Save current content before switching
        this.saveCurrentContent();
        
        // Hide all views
        this.sourceView.style.display = 'none';
        this.editorView.style.display = 'none';
        this.previewView.style.display = 'none';
        
        // Show selected view and load content
        switch(mode) {
            case 'source':
                this.showSourceView();
                break;
            case 'editor':
                this.showEditorView();
                break;
            case 'preview':
                this.showPreviewView();
                break;
        }
        
        this.currentMode = mode;
    }
    
    saveCurrentContent() {
        if (this.currentMode === 'source') {
            // Save from source to editor
            const html = this.sourceView.value;
            this.editorView.innerHTML = html;
        } else if (this.currentMode === 'editor') {
            // Save from editor to source
            const html = this.editorView.innerHTML;
            this.sourceView.value = this.formatHTML(html);
        }
        // Preview is read-only, no saving needed
    }
    
    showSourceView() {
        this.sourceView.style.display = 'block';
        // Load HTML from editor if source is empty
        if (!this.sourceView.value) {
            this.sourceView.value = this.formatHTML(this.editorView.innerHTML);
        }
        this.sourceView.focus();
        
        // Re-initialize drag-drop for source view
        if (window.initializeDragDropForEditors) {
            window.initializeDragDropForEditors();
        }
    }
    
    showEditorView() {
        this.editorView.style.display = 'block';
        // Load HTML from source if it was edited
        if (this.sourceView.value) {
            this.editorView.innerHTML = this.sourceView.value;
        }
        this.editorView.focus();
        
        // Re-initialize drag-drop for editor view
        if (window.initializeDragDropForEditors) {
            window.initializeDragDropForEditors();
        }
    }
    
    showPreviewView() {
        this.previewView.style.display = 'block';
        // Load content from editor
        const html = this.editorView.innerHTML;
        this.previewView.innerHTML = this.replaceTags(html);
        
        // Re-initialize drag-drop for preview view (though it's read-only)
        if (window.initializeDragDropForEditors) {
            window.initializeDragDropForEditors();
        }
    }
    
    formatHTML(html) {
        // Basic HTML formatting for readability
        try {
            // Remove excessive whitespace
            html = html.trim();
            
            // Add line breaks after tags for better readability
            html = html.replace(/></g, '>\n<');
            
            // Basic indentation (simple version)
            const lines = html.split('\n');
            let indentLevel = 0;
            const indentedLines = lines.map(line => {
                line = line.trim();
                if (!line) return '';
                
                // Decrease indent for closing tags
                if (line.startsWith('</')) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }
                
                const indented = '  '.repeat(indentLevel) + line;
                
                // Increase indent for opening tags (but not self-closing)
                if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
                    // Check if it's not a self-closing tag like <br>, <img>, etc.
                    if (!line.match(/<(br|img|input|hr|meta|link)\b/i)) {
                        indentLevel++;
                    }
                }
                
                return indented;
            });
            
            return indentedLines.join('\n');
        } catch (e) {
            // If formatting fails, return original
            return html;
        }
    }
    
    replaceTags(html) {
        // Replace tags with sample data for preview
        const sampleData = {
            // Company
            '#COMP_NAME#': 'RELIA🐂LIMO™',
            '#COMP_PHONE1#': '(555) 123-4567',
            '#COMP_EMAIL#': 'info@reliablelimo.com',
            '#COMP_ADDR1#': '123 Main Street',
            '#COMP_CITY#': 'New York',
            '#COMP_STATEPROV#': 'NY',
            '#COMP_ZIPPOST#': '10001',
            
            // Trip Info
            '#TRIP_CONFNUM#': 'RB-2024-001234',
            '#TRIP_PUDATE#': 'January 15, 2024',
            '#TRIP_PUTIME#': '2:30 PM',
            '#TRIP_DOTIME#': '5:45 PM',
            '#TRIP_STATUS#': 'Confirmed',
            
            // Billing Contact
            '#TRIP_BC_FNAME#': 'John',
            '#TRIP_BC_LNAME#': 'Doe',
            '#TRIP_BC_EMAIL1#': 'john.doe@example.com',
            '#TRIP_BC_PHONEMOB1#': '(555) 987-6543',
            '#TRIP_BC_COMPANY#': 'Acme Corporation',
            
            // Passenger
            '#TRIP_PASS_FNAME#': 'Jane',
            '#TRIP_PASS_LNAME#': 'Smith',
            '#TRIP_PASS_EMAIL1#': 'jane.smith@example.com',
            '#TRIP_PASS_PHONEMOB1#': '(555) 456-7890',
            
            // Vehicle & Driver
            '#TRIP_VEHTYPE_DESC#': 'Lincoln Town Car',
            '#TRIP_CAR1_DESC#': 'Black Lincoln Town Car',
            '#TRIP_DRIVER1_FNAME#': 'Michael',
            '#TRIP_DRIVER1_LNAME#': 'Johnson',
            
            // Rates
            '#TRIP_RATES_TOTAL#': '$250.00',
            '#TRIP_RATES_BASE_TOTAL#': '$200.00',
            '#TRIP_RATES_TAXES_TOTAL#': '$20.00',
            '#TRIP_RATES_GRATUITIES_TOTAL#': '$30.00',
            '#TRIP_CURRENCY_SYMBOL#': '$',
            
            // Rate IDs
            '#Rate_ID_327125#': '$200.00',
            '#Rate_ID_327145#': '$50.00',
            '#Rate_ID_327147#': '$20.00',
        };
        
        // Replace all tags
        let previewHtml = html;
        for (const [tag, value] of Object.entries(sampleData)) {
            const regex = new RegExp(tag.replace(/[#]/g, '\\#'), 'g');
            previewHtml = previewHtml.replace(regex, `<span style="background: #ffffcc; padding: 2px 4px; border-radius: 2px;">${value}</span>`);
        }
        
        // Highlight any remaining tags that don't have sample data
        previewHtml = previewHtml.replace(/#([A-Z_0-9]+)#/g, '<span style="background: #ffcccc; padding: 2px 4px; border-radius: 2px; color: #cc0000;">#$1#</span>');
        
        return previewHtml;
    }
    
    getContent() {
        // Return the current content from active view
        if (this.currentMode === 'source') {
            return this.sourceView.value;
        } else {
            return this.editorView.innerHTML;
        }
    }
    
    setContent(html) {
        // Set content in both views
        this.editorView.innerHTML = html;
        this.sourceView.value = this.formatHTML(html);
        if (this.currentMode === 'preview') {
            this.previewView.innerHTML = this.replaceTags(html);
        }
    }
}

// Initialize editor view switchers
let customFormsEditorSwitcher;
let htmlEditorSwitcher;
let invoiceTripEditorSwitcher;
let invoiceRoutingEditorSwitcher;
let additionalPaxEditorSwitcher;
let responseTemplateEditorSwitcher;
let initialResponseEditorSwitcher;

document.addEventListener('DOMContentLoaded', function() {
    initializeAllEditors();
});

function initializeAllEditors() {
    // Initialize the custom forms editor view switcher
    const customFormsEditor = document.getElementById('customFormsEditor');
    if (customFormsEditor && !customFormsEditorSwitcher) {
        customFormsEditorSwitcher = new HTMLEditorViewSwitcher('customFormsEditor');
    }
    
    // Initialize the policies/agreements editor view switcher
    const htmlEditor = document.getElementById('htmlEditor');
    if (htmlEditor && !htmlEditorSwitcher) {
        htmlEditorSwitcher = new HTMLEditorViewSwitcher('htmlEditor');
    }
    
    // Initialize the invoice trip block editor view switcher
    const invoiceTripEditor = document.getElementById('invoiceTripEditor');
    if (invoiceTripEditor && !invoiceTripEditorSwitcher) {
        invoiceTripEditorSwitcher = new HTMLEditorViewSwitcher('invoiceTripEditor');
    }
    
    // Initialize the additional pax block editor view switcher
    const additionalPaxEditor = document.getElementById('additionalPaxEditor');
    if (additionalPaxEditor && !additionalPaxEditorSwitcher) {
        additionalPaxEditorSwitcher = new HTMLEditorViewSwitcher('additionalPaxEditor');
    }
    
    // Initialize the response template editor view switcher (Quotes page)
    const responseTemplateEditor = document.getElementById('responseTemplateEditor');
    if (responseTemplateEditor && !responseTemplateEditorSwitcher) {
        responseTemplateEditorSwitcher = new HTMLEditorViewSwitcher('responseTemplateEditor');
    }
    
    // Initialize the initial response editor view switcher (Quotes page)
    const initialResponseEditor = document.getElementById('initialResponseEditor');
    if (initialResponseEditor && !initialResponseEditorSwitcher) {
        initialResponseEditorSwitcher = new HTMLEditorViewSwitcher('initialResponseEditor');
    }
    
    // Initialize location template editors (5 editors for invoice routing)
    const locationEditorIds = [
        'addressLocationEditor',
        'airportLocationEditor',
        'seaportLocationEditor',
        'fboLocationEditor',
        'poiLocationEditor'
    ];
    
    locationEditorIds.forEach(editorId => {
        const editor = document.getElementById(editorId);
        if (editor && !window[`${editorId}Switcher`]) {
            window[`${editorId}Switcher`] = new HTMLEditorViewSwitcher(editorId);
        }
    });
}

// Re-initialize when sections change
window.reinitializeEditorViewSwitchers = function() {
    setTimeout(initializeAllEditors, 100);
};

// Export for global access
window.HTMLEditorViewSwitcher = HTMLEditorViewSwitcher;
window.customFormsEditorSwitcher = customFormsEditorSwitcher;
window.htmlEditorSwitcher = htmlEditorSwitcher;
window.invoiceTripEditorSwitcher = invoiceTripEditorSwitcher;
window.additionalPaxEditorSwitcher = additionalPaxEditorSwitcher;
window.responseTemplateEditorSwitcher = responseTemplateEditorSwitcher;
window.initialResponseEditorSwitcher = initialResponseEditorSwitcher;
window.invoiceRoutingEditorSwitcher = invoiceRoutingEditorSwitcher;
window.initializeAllEditors = initializeAllEditors;
