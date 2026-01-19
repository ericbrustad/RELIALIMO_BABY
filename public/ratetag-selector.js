// All available rate tags
const rateTags = [
    // Rate Summary Tags
    { tag: '#TRIP_RATES_ITEMIZED#', description: 'Rates Itemized', category: 'rates' },
    { tag: '#TRIP_RATES_ITEMIZED_NOHEADER#', description: 'Rates Itemized (No header)', category: 'rates' },
    { tag: '#TRIP_RATES_GROUPED#', description: 'Rates Grouped', category: 'rates' },
    { tag: '#TRIP_RATES_GROUPED_NOHEADER#', description: 'Rates Grouped (No header)', category: 'rates' },
    { tag: '#TRIP_RATES_SUMMARY#', description: 'Rates Summary', category: 'rates' },
    { tag: '#TRIP_RATES_TOTAL#', description: 'Rates Total', category: 'rates' },
    { tag: '#TRIP_RATES_TOTALDUE#', description: 'Rates Total Due', category: 'rates' },
    { tag: '#TRIP_RATES_VAT_TOTAL#', description: 'VAT Rates Total', category: 'rates' },
    { tag: '#TRIP_RATES_NET_TOTAL#', description: 'Rates Total Minus VAT Rates', category: 'rates' },
    { tag: '#TRIP_RATES_BASE_TOTAL#', description: 'Total of Base Rates Group', category: 'rates' },
    { tag: '#TRIP_RATES_GRATUITIES_TOTAL#', description: 'Total of Gratuities Rates Group', category: 'rates' },
    { tag: '#TRIP_RATES_TAXES_TOTAL#', description: 'Total of Taxes Rates Group', category: 'rates' },
    { tag: '#TRIP_RATES_MISC_TOTAL#', description: 'Total of Miscellaneous Rates Group', category: 'rates' },
    { tag: '#TRIP_RATES_SURCHARGES_TOTAL#', description: 'Sum of All Surcharge Groups', category: 'rates' },
    { tag: '#TRIP_RATES_DISCOUNTS_TOTAL#', description: 'Sum of All Discounts Groups', category: 'rates' },
    { tag: '#TRIP_CURRENCY_SYMBOL#', description: 'Currency Symbol', category: 'rates' },
    { tag: '#TRIP_CURRENCY_ABBR#', description: 'Currency Abbreviation', category: 'rates' },
    
    // Individual Rate Line Items - Base Rates
    { tag: '#Rate_ID_327125#', description: 'Base Rate - Flat Rate (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327126#', description: 'Base Rate - Per Hour (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327127#', description: 'Base Rate - Per Unit (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327128#', description: 'Base Rate - OT/Wait Time (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327129#', description: 'Base Rate - Extra Stops (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327144#', description: 'Base Rate - Per Pass (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_327145#', description: 'Base Rate - Per Mile (Default: 4.00)', category: 'base-rate' },
    { tag: '#Rate_ID_356133#', description: 'Base Rate - Base (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_376606#', description: 'Base Rate - Per Mile (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_376607#', description: 'Base Rate - Per Hour (Default: 0.00)', category: 'base-rate' },
    { tag: '#Rate_ID_389208#', description: 'Base Rate - Flat 50 (Default: 50.00)', category: 'base-rate' },
    
    // Individual Rate Line Items - Miscellaneous
    { tag: '#Rate_ID_327133#', description: 'Miscellaneous - Tolls (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327132#', description: 'Miscellaneous - Parking (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327136#', description: 'Miscellaneous - Setup Fee (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327137#', description: 'Miscellaneous - Admin Fee (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327139#', description: 'Miscellaneous - Baggage Claim Meet and Greet (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327140#', description: 'Miscellaneous - Misc Fee 3 (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327134#', description: 'Miscellaneous - Voucher (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_327138#', description: 'Miscellaneous - Meet and Greet (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_344890#', description: 'Miscellaneous - M.A.C. Fee (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_344891#', description: 'Miscellaneous - Meet and Greet (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_344892#', description: 'Miscellaneous - Front Facing Booster Seat (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_346651#', description: 'Miscellaneous - Baggage storage (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_380279#', description: 'Miscellaneous - EsXape Ride (Default: 0.00)', category: 'miscellaneous' },
    { tag: '#Rate_ID_344893#', description: 'Miscellaneous - Booster seat (Default: 3.95)', category: 'miscellaneous' },
    
    // Individual Rate Line Items - Gratuities
    { tag: '#Rate_ID_327130#', description: 'Gratuities - Std Grat (Default: 0.00)', category: 'gratuities' },
    { tag: '#Rate_ID_327131#', description: 'Gratuities - Gratuity (Default: 0.00)', category: 'gratuities' },
    { tag: '#Rate_ID_389844#', description: 'Gratuities - Requested Gratuity (Default: 0.00)', category: 'gratuities' },
    { tag: '#Rate_ID_415620#', description: 'Gratuities - Late Night/Earlybird Surch (Default: 0.00)', category: 'gratuities' },
    
    // Individual Rate Line Items - Taxes
    { tag: '#Rate_ID_327148#', description: 'Taxes - Std Tax 2 (Default: 0.00)', category: 'taxes' },
    { tag: '#Rate_ID_327147#', description: 'Taxes - Std Tax 1 (Default: 0.00)', category: 'taxes' },
    { tag: '#Rate_ID_402540#', description: 'Taxes - Total 20% gratuity (Default: 20.00)', category: 'taxes' },
    
    // Individual Rate Line Items - Surcharges
    { tag: '#Rate_ID_402541#', description: 'Surcharge 5 - Total Gratuity (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_327143#', description: 'Surcharge 1 - STC Surch (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_327135#', description: 'Surcharge 3 - Fuel Surch (Default: 4.90)', category: 'surcharges' },
    { tag: '#Rate_ID_342894#', description: 'Surcharge 2 - Surface Transportation Charge (Default: 24.00)', category: 'surcharges' },
    { tag: '#Rate_ID_362582#', description: 'Surcharge 2 - Base rate STC (Default: 20.00)', category: 'surcharges' },
    { tag: '#Rate_ID_376608#', description: 'Surcharge 1 - Admin Fee (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_376609#', description: 'Surcharge 1 - Base rate STC (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_376610#', description: 'Surcharge 2 - Fuel Surcharge (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_362581#', description: 'Surcharge 2 - Base STC (Default: 0.00)', category: 'surcharges' },
    { tag: '#Rate_ID_327146#', description: 'Surcharge 2 - State Tax (Default: 0.00)', category: 'surcharges' },
    
    // Individual Rate Line Items - Discounts
    { tag: '#Rate_ID_327141#', description: 'Discount 3 - Discount (Default: 0.00)', category: 'discounts' },
    { tag: '#Rate_ID_327142#', description: 'Discount 1 - Discount (Default: 0.00)', category: 'discounts' },
];

let selectedRateTag = null;
let currentRateCategory = 'all';
let targetRateElement = null;
let savedRateSelection = null; // Store cursor position for contenteditable

// Initialize the rate tag selector
function initRateTagSelector() {
    renderRateTags(rateTags);
}

// Render rate tags in the table
function renderRateTags(tags) {
    const tbody = document.getElementById('rateTagTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    tags.forEach(tagData => {
        const row = document.createElement('tr');
        row.dataset.tag = tagData.tag;
        row.dataset.category = tagData.category;
        
        // Make row draggable
        row.draggable = true;
        row.classList.add('draggable-tag');
        
        row.innerHTML = `
            <td><span class="drag-handle">⋮⋮</span> ${tagData.tag}</td>
            <td>${tagData.description}</td>
        `;
        
        row.addEventListener('click', function() {
            selectRateTag(this, tagData.tag);
        });
        
        row.addEventListener('dblclick', function() {
            selectRateTag(this, tagData.tag);
            insertSelectedRateTag();
        });
        
        // Drag event listeners
        row.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', tagData.tag);
            e.dataTransfer.effectAllowed = 'copy';
            row.classList.add('dragging');
        });
        
        row.addEventListener('dragend', function(e) {
            row.classList.remove('dragging');
        });
        
        tbody.appendChild(row);
    });
}

// Select a rate tag
function selectRateTag(row, tag) {
    // Remove previous selection
    document.querySelectorAll('.rate-tag-table tbody tr').forEach(tr => {
        tr.classList.remove('selected');
    });
    
    // Add selection to clicked row
    row.classList.add('selected');
    selectedRateTag = tag;
}

// Filter rate tags by search
function filterRateTags() {
    const searchTerm = document.getElementById('rateTagSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.rate-tag-table tbody tr');
    
    rows.forEach(row => {
        const tag = row.cells[0].textContent.toLowerCase();
        const description = row.cells[1].textContent.toLowerCase();
        const category = row.dataset.category;
        
        const matchesSearch = tag.includes(searchTerm) || description.includes(searchTerm);
        const matchesCategory = currentRateCategory === 'all' || category === currentRateCategory;
        
        if (matchesSearch && matchesCategory) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Filter by rate category
function filterByRateCategory(category) {
    currentRateCategory = category;
    
    // Update active button
    document.querySelectorAll('.rate-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    filterRateTags();
}

// Open rate tag selector
function openRateTagSelector(targetInput) {
    // If no target provided, try to find the active/focused editor
    if (!targetInput) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
            targetInput = activeElement;
        }
    }
    
    targetRateElement = targetInput;
    
    // Save current selection/cursor position for contenteditable elements
    if (targetInput && targetInput.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedRateSelection = selection.getRangeAt(0).cloneRange();
        }
    }
    
    const modal = document.getElementById('rateTagSelectorModal');
    modal.classList.add('active');
    
    console.log('Rate tag selector opened for:', targetInput);
    console.log('Saved selection:', savedRateSelection);
    
    // Focus on search input
    const searchInput = document.getElementById('rateTagSearch');
    if (searchInput) {
        searchInput.focus();
    }
}

// Close rate tag selector
function closeRateTagSelector() {
    const modal = document.getElementById('rateTagSelectorModal');
    modal.classList.remove('active');
    selectedRateTag = null;
    targetRateElement = null;
    savedRateSelection = null; // Clear saved selection
    
    // Reset filters
    document.getElementById('rateTagSearch').value = '';
    currentRateCategory = 'all';
    document.querySelectorAll('.rate-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const allBtn = document.querySelector('.rate-category-btn');
    if (allBtn) {
        allBtn.classList.add('active');
    }
    filterRateTags();
}

// Insert selected rate tag
function insertSelectedRateTag() {
    if (!selectedRateTag) {
        alert('Please select a rate tag to insert');
        return;
    }
    
    if (targetRateElement) {
        // Insert tag into the target element
        if (targetRateElement.tagName === 'TEXTAREA' || targetRateElement.tagName === 'INPUT') {
            const start = targetRateElement.selectionStart;
            const end = targetRateElement.selectionEnd;
            const text = targetRateElement.value;
            targetRateElement.value = text.substring(0, start) + selectedRateTag + text.substring(end);
            targetRateElement.selectionStart = targetRateElement.selectionEnd = start + selectedRateTag.length;
            targetRateElement.focus();
            
            // Trigger input event for any listeners
            targetRateElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('✅ Rate tag inserted into textarea:', selectedRateTag);
        }
        
        // If it's a content editable or rich text editor
        else if (targetRateElement.isContentEditable) {
            targetRateElement.focus();
            
            // Restore saved selection if available
            if (savedRateSelection) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedRateSelection);
            }
            
            // Insert the tag
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(selectedRateTag);
                range.insertNode(textNode);
                
                // Move cursor after inserted tag
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Trigger input event
                targetRateElement.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log('✅ Rate tag inserted into contenteditable:', selectedRateTag);
            } else {
                // Fallback: insert at end
                targetRateElement.appendChild(document.createTextNode(selectedRateTag));
                console.log('✅ Rate tag appended to contenteditable (no selection):', selectedRateTag);
            }
        }
    } else {
        console.log('❌ No target element for rate tag insertion');
    }
    
    closeRateTagSelector();
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('rateTagSelectorModal');
    if (e.target === modal) {
        closeRateTagSelector();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('rateTagSelectorModal');
    if (modal && modal.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeRateTagSelector();
        } else if (e.key === 'Enter' && selectedRateTag) {
            insertSelectedRateTag();
        }
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initRateTagSelector);

// Export functions for use in other files
window.openRateTagSelector = openRateTagSelector;
window.closeRateTagSelector = closeRateTagSelector;
window.insertSelectedRateTag = insertSelectedRateTag;
window.filterRateTags = filterRateTags;
window.filterByRateCategory = filterByRateCategory;
