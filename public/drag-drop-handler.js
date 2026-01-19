// Drag and Drop Handler for HTML Editors
// Initializes drop zones for all text editors (textareas and contenteditable)

function initializeDragDropForEditors() {
    // Find all textareas that are visible
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        // Only initialize if visible (not display:none)
        if (textarea.offsetParent !== null || window.getComputedStyle(textarea).display !== 'none') {
            makeDropZone(textarea);
        }
    });

    // Find all contenteditable elements (rich text editors) that are visible
    const contentEditables = document.querySelectorAll('[contenteditable="true"]');
    contentEditables.forEach(element => {
        // Only initialize if visible
        if (element.offsetParent !== null || window.getComputedStyle(element).display !== 'none') {
            makeDropZone(element);
        }
    });

    // Also watch for dynamically added editors
    observeNewEditors();
    
    console.log('Drag-drop initialized:', textareas.length, 'textareas,', contentEditables.length, 'contenteditable elements');
}

function makeDropZone(element) {
    // Skip if already initialized
    if (element.classList.contains('drop-zone-initialized')) {
        return;
    }
    
    // Add drop-zone class
    element.classList.add('drop-zone');
    element.classList.add('drop-zone-initialized');

    // Prevent default drag behavior
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
    element.addEventListener('drop', handleDrop);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragEnter(e) {
    e.preventDefault();
    const element = e.currentTarget;
    element.classList.add('drag-over');
}

function handleDragLeave(e) {
    const element = e.currentTarget;
    // Only remove if we're actually leaving the element (not entering a child)
    if (e.target === element) {
        element.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const element = e.currentTarget;
    element.classList.remove('drag-over');
    
    // Get the tag data
    const tag = e.dataTransfer.getData('text/plain');
    
    if (!tag) return;
    
    // Insert the tag
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        // For textarea and input elements
        insertTagIntoTextarea(element, tag);
    } else if (element.isContentEditable) {
        // For contenteditable elements
        insertTagIntoContentEditable(element, tag);
    }
}

function insertTagIntoTextarea(textarea, tag) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    // Insert tag at cursor position (or replace selection)
    textarea.value = text.substring(0, start) + tag + text.substring(end);
    
    // Move cursor after inserted tag
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    
    // Focus the textarea
    textarea.focus();
    
    // Trigger input event for any listeners
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertTagIntoContentEditable(element, tag) {
    // Focus the element first
    element.focus();
    
    // Try to restore selection or insert at the end
    const selection = window.getSelection();
    
    // Ensure the selection is within the contentEditable element
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Check if selection is within our target element
        let container = range.commonAncestorContainer;
        let isWithinElement = false;
        
        while (container) {
            if (container === element) {
                isWithinElement = true;
                break;
            }
            container = container.parentNode;
        }
        
        if (isWithinElement) {
            range.deleteContents();
            const textNode = document.createTextNode(tag);
            range.insertNode(textNode);
            
            // Move cursor after inserted tag
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Selection not in element, insert at end
            insertAtEnd(element, tag, selection);
        }
    } else {
        // No selection, insert at the end
        insertAtEnd(element, tag, selection);
    }
    
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertAtEnd(element, tag, selection) {
    // Create a text node and append to element
    const textNode = document.createTextNode(tag);
    element.appendChild(textNode);
    
    // Set cursor after inserted tag
    const range = document.createRange();
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
}

// Observer to watch for dynamically added editors
function observeNewEditors() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Check if the node itself is an editor
                    if (node.tagName === 'TEXTAREA' || node.isContentEditable) {
                        makeDropZone(node);
                    }
                    
                    // Check for editors within the added node
                    if (node.querySelectorAll) {
                        const textareas = node.querySelectorAll('textarea');
                        textareas.forEach(makeDropZone);
                        
                        const contentEditables = node.querySelectorAll('[contenteditable="true"]');
                        contentEditables.forEach(makeDropZone);
                    }
                }
            });
        });
    });
    
    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDragDropForEditors);
} else {
    initializeDragDropForEditors();
}

// Re-initialize when content changes (for dynamically loaded sections)
window.reinitializeDragDrop = function() {
    setTimeout(initializeDragDropForEditors, 100);
};

// Export for use in other scripts
window.initializeDragDropForEditors = initializeDragDropForEditors;
