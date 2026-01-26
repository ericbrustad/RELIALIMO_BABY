// ============================================
// Company Memos Module
// Saves memos to Supabase company_memos table
// ============================================

import { getSupabaseConfig } from './config.js';

// Get organization ID (from session or config)
async function getOrganizationId() {
    try {
        const config = getSupabaseConfig();
        // Try to get from current user's organization
        const response = await fetch(`${config.url}/rest/v1/organization_members?user_id=eq.${config.userId}&select=organization_id&limit=1`, {
            headers: {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${config.anonKey}`
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return data[0].organization_id;
            }
        }
    } catch (e) {
        console.warn('[Memos] Could not get organization ID:', e);
    }
    // Fallback to stored or default
    return localStorage.getItem('organization_id') || window.currentOrganizationId;
}

// Save memo to Supabase
async function saveMemoToDatabase(memoData) {
    try {
        const config = getSupabaseConfig();
        const response = await fetch(`${config.url}/rest/v1/company_memos`, {
            method: 'POST',
            headers: {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${config.anonKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(memoData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('[Memos] Memo saved to database:', result);
            return result[0];
        } else {
            const error = await response.text();
            console.error('[Memos] Failed to save memo:', error);
            return null;
        }
    } catch (err) {
        console.error('[Memos] Error saving memo:', err);
        return null;
    }
}

// Load memos from Supabase
async function loadMemosFromDatabase() {
    try {
        const config = getSupabaseConfig();
        const orgId = await getOrganizationId();
        
        let url = `${config.url}/rest/v1/company_memos?select=*&is_active=eq.true&order=is_pinned.desc,created_at.desc`;
        if (orgId) {
            url += `&organization_id=eq.${orgId}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${config.anonKey}`
            }
        });

        if (response.ok) {
            const memos = await response.json();
            console.log('[Memos] Loaded', memos.length, 'memos from database');
            return memos;
        }
    } catch (err) {
        console.error('[Memos] Error loading memos:', err);
    }
    return [];
}

// Delete memo from Supabase
async function deleteMemoFromDatabase(memoId) {
    try {
        const config = getSupabaseConfig();
        const response = await fetch(`${config.url}/rest/v1/company_memos?id=eq.${memoId}`, {
            method: 'DELETE',
            headers: {
                'apikey': config.anonKey,
                'Authorization': `Bearer ${config.anonKey}`
            }
        });

        if (response.ok) {
            console.log('[Memos] Memo deleted from database');
            return true;
        }
    } catch (err) {
        console.error('[Memos] Error deleting memo:', err);
    }
    return false;
}

// Color map for display
const colorMap = {
    'red': '#ff3333',
    'yellow': '#ffd700',
    'green': '#90ee90',
    'blue': '#87ceeb',
    'orange': '#ffb366',
    'purple': '#dda0dd'
};

// Get notify location label
function getNotifyLocationLabel(location) {
    const labels = {
        'login': '🔐 Admin Login',
        'account-login': '👤 Account Portal',
        'driver-login': '🚗 Driver Portal',
        'dispatch-res': '📋 Dispatch/Reservation'
    };
    return labels[location] || location;
}

// Render a single memo item
function renderMemoItem(memo) {
    const memoEl = document.createElement('div');
    memoEl.className = 'memo-item';
    memoEl.dataset.memoId = memo.id;
    memoEl.style.backgroundColor = colorMap[memo.color] || '#ffd700';
    
    const dateStr = memo.created_at 
        ? new Date(memo.created_at).toLocaleDateString() 
        : new Date().toLocaleDateString();
    
    memoEl.innerHTML = `
        <div class="memo-header">
            <span class="memo-date">${dateStr}</span>
            <span class="memo-audience">${memo.memo_to || 'For Everyone'}</span>
            <span class="memo-location" style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; font-size: 11px;">
                ${getNotifyLocationLabel(memo.notify_location)}
            </span>
            <span class="memo-author">${memo.author || 'admin'}</span>
            <label class="memo-checkbox">
                <input type="checkbox">
            </label>
            <a href="#" class="delete-link" data-memo-id="${memo.id}">delete</a>
        </div>
        <div class="memo-body">
            ${memo.memo_text}
        </div>
        ${memo.due_date ? `<div class="memo-due" style="font-size: 11px; margin-top: 5px; opacity: 0.8;">Due: ${new Date(memo.due_date).toLocaleDateString()}</div>` : ''}
    `;
    
    // Attach delete handler
    memoEl.querySelector('.delete-link').addEventListener('click', handleDelete);
    
    return memoEl;
}

// Render all memos
async function renderMemosList() {
    const memosList = document.querySelector('.memos-list');
    if (!memosList) return;
    
    // Clear existing
    memosList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Loading memos...</div>';
    
    const memos = await loadMemosFromDatabase();
    
    if (memos.length === 0) {
        memosList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No memos yet. Create one using the form.</div>';
        return;
    }
    
    memosList.innerHTML = '';
    memos.forEach(memo => {
        memosList.appendChild(renderMemoItem(memo));
    });
}

// Character Counter
const memoText = document.getElementById('memo-text');
const charCount = document.getElementById('char-count');
const charLeft = document.getElementById('char-left');

if (memoText) {
    memoText.addEventListener('input', function() {
        const length = this.value.length;
        const maxLength = 200;
        
        charCount.textContent = length;
        charLeft.textContent = maxLength - length;
        
        // Change color when near limit
        if (length > 180) {
            charLeft.style.color = '#d9534f';
        } else {
            charLeft.style.color = '#666';
        }
    });
}

// Insert Trip Tags Button for Memos
const memoInsertTripTagBtn = document.getElementById('memoInsertTripTagBtn');
if (memoInsertTripTagBtn) {
    memoInsertTripTagBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof openTripTagSelector === 'function') {
            openTripTagSelector(memoText);
        }
    });
}

// Insert Rate Tags Button for Memos
const memoInsertRateTagBtn = document.getElementById('memoInsertRateTagBtn');
if (memoInsertRateTagBtn) {
    memoInsertRateTagBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (typeof openRateTagSelector === 'function') {
            openRateTagSelector(memoText);
        }
    });
}

// Calendar Button
const calendarBtn = document.querySelector('.calendar-btn');
if (calendarBtn) {
    calendarBtn.addEventListener('click', function() {
        const dueDateInput = document.getElementById('due-date');
        // Use native date input as fallback
        if (dueDateInput) {
            dueDateInput.type = 'date';
            dueDateInput.focus();
            dueDateInput.showPicker && dueDateInput.showPicker();
        }
    });
}

// Add Memo Form
const addMemoForm = document.querySelector('.add-memo-form');
if (addMemoForm) {
    addMemoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const text = document.getElementById('memo-text').value.trim();
        const memoTo = document.getElementById('memo-to').value.trim();
        const dueDate = document.getElementById('due-date').value.trim();
        const color = document.getElementById('memo-color').value;
        const notifyLocation = document.querySelector('input[name="notify-location"]:checked')?.value || 'login';
        const showDispatch = document.getElementById('show-dispatch')?.checked || false;
        const showReservation = document.getElementById('show-reservation')?.checked || false;
        const dateFrom = document.getElementById('date-from').value.trim();
        const dateTo = document.getElementById('date-to').value.trim();
        
        if (!text) {
            alert('Please enter memo text.');
            return;
        }
        
        // Get organization ID
        const orgId = await getOrganizationId();
        
        // Prepare memo data
        const memoData = {
            organization_id: orgId,
            memo_text: text,
            memo_to: memoTo || null,
            color: color,
            notify_location: notifyLocation,
            show_dispatch_grid: showDispatch,
            show_reservation_form: showReservation,
            show_customer_portal: notifyLocation === 'account-login',
            show_driver_portal: notifyLocation === 'driver-login',
            display_from: dateFrom || null,
            display_to: dateTo || null,
            due_date: dueDate || null,
            author: 'admin',
            is_active: true
        };
        
        // Show saving indicator
        const submitBtn = this.querySelector('.add-memo-btn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        // Save to database
        const savedMemo = await saveMemoToDatabase(memoData);
        
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        if (savedMemo) {
            // Add to list
            const memosList = document.querySelector('.memos-list');
            const loadingMsg = memosList.querySelector('div[style*="text-align: center"]');
            if (loadingMsg) loadingMsg.remove();
            
            memosList.insertBefore(renderMemoItem(savedMemo), memosList.firstChild);
            
            // Clear form
            document.getElementById('memo-text').value = '';
            document.getElementById('memo-to').value = '';
            document.getElementById('due-date').value = '';
            document.getElementById('date-from').value = '';
            document.getElementById('date-to').value = '';
            if (document.getElementById('show-dispatch')) document.getElementById('show-dispatch').checked = false;
            if (document.getElementById('show-reservation')) document.getElementById('show-reservation').checked = false;
            
            // Reset character counter
            if (charCount) charCount.textContent = '0';
            if (charLeft) {
                charLeft.textContent = '200';
                charLeft.style.color = '#666';
            }
            
            // Show success
            alert(`Memo saved! It will appear on ${getNotifyLocationLabel(notifyLocation)}.`);
        } else {
            alert('Failed to save memo. Please try again.');
        }
    });
}

// Delete Memo
async function handleDelete(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to delete this memo?')) {
        const memoItem = this.closest('.memo-item');
        const memoId = this.dataset.memoId || memoItem?.dataset.memoId;
        
        if (memoId) {
            await deleteMemoFromDatabase(memoId);
        }
        
        memoItem?.remove();
    }
}

// Attach delete handlers to existing memos
document.querySelectorAll('.delete-link').forEach(link => {
    link.addEventListener('click', handleDelete);
});

// Show/Hide Store Memos
const showStoreMemos = document.getElementById('show-store-memos');
if (showStoreMemos) {
    showStoreMemos.addEventListener('change', function() {
        const memosList = document.querySelector('.memos-list');
        
        if (this.checked) {
            memosList.style.display = 'block';
        } else {
            memosList.style.display = 'none';
        }
    });
}

// Initialize - load memos on page load
document.addEventListener('DOMContentLoaded', () => {
    renderMemosList();
});

console.log('Memos module initialized with Supabase integration');
