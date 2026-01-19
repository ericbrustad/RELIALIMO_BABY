// Debug helper for tag insertion issues
// This script adds visual feedback and logging to help diagnose tag insertion problems

(function() {
    'use strict';
    
    // Add visual indicators to all drop zones
    function highlightDropZones() {
        const dropZones = document.querySelectorAll('.drop-zone');
        console.log('Found drop zones:', dropZones.length);
        
        dropZones.forEach((zone, index) => {
            const isVisible = zone.offsetParent !== null;
            const zoneType = zone.tagName === 'TEXTAREA' ? 'textarea' : 
                           zone.isContentEditable ? 'contenteditable' : 'unknown';
            
            console.log(`Drop zone ${index + 1}:`, {
                type: zoneType,
                visible: isVisible,
                id: zone.id,
                classes: zone.className
            });
        });
    }
    
    // Test tag insertion into active element
    window.testTagInsertion = function() {
        const testTag = '#TEST_TAG#';
        const activeElement = document.activeElement;
        
        console.log('Testing tag insertion...');
        console.log('Active element:', activeElement);
        console.log('Is textarea:', activeElement.tagName === 'TEXTAREA');
        console.log('Is contenteditable:', activeElement.isContentEditable);
        console.log('Is drop zone:', activeElement.classList.contains('drop-zone'));
        
        if (activeElement.tagName === 'TEXTAREA') {
            const start = activeElement.selectionStart;
            const end = activeElement.selectionEnd;
            const text = activeElement.value;
            activeElement.value = text.substring(0, start) + testTag + text.substring(end);
            activeElement.selectionStart = activeElement.selectionEnd = start + testTag.length;
            console.log('✅ Test tag inserted into textarea');
        } else if (activeElement.isContentEditable) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(testTag);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
                console.log('✅ Test tag inserted into contenteditable');
            } else {
                console.log('❌ No selection found in contenteditable');
            }
        } else {
            console.log('❌ Active element is not an editor');
        }
    };
    
    // Show drop zone status
    window.debugDropZones = function() {
        highlightDropZones();
        
        // Check if drag-drop handler is loaded
        console.log('Drag-drop handler loaded:', typeof window.initializeDragDropForEditors !== 'undefined');
        console.log('Trip tag selector loaded:', typeof window.openTripTagSelector !== 'undefined');
        console.log('Rate tag selector loaded:', typeof window.openRateTagSelector !== 'undefined');
    };
    
    // Auto-run on load
    window.addEventListener('load', function() {
        setTimeout(function() {
            console.log('=== TAG INSERTION DEBUG ===');
            window.debugDropZones();
            console.log('💡 To test tag insertion:');
            console.log('   1. Click inside an editor');
            console.log('   2. Run: testTagInsertion()');
            console.log('   3. Or drag a tag from the selector');
        }, 1000);
    });
    
    // Monitor editor view switches
    const originalSwitchView = HTMLEditorViewSwitcher?.prototype?.switchView;
    if (originalSwitchView) {
        HTMLEditorViewSwitcher.prototype.switchView = function(mode) {
            console.log('📝 Editor view switching to:', mode);
            originalSwitchView.call(this, mode);
            setTimeout(function() {
                console.log('Re-checking drop zones after view switch...');
                window.debugDropZones();
            }, 200);
        };
    }
    
})();
