// Character Counter
const memoText = document.getElementById('memo-text');
const charCount = document.getElementById('char-count');
const charLeft = document.getElementById('char-left');

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
document.querySelector('.calendar-btn').addEventListener('click', function() {
    const dueDateInput = document.getElementById('due-date');
    // In a real app, this would open a date picker
    alert('Date picker would open here. You can integrate a date picker library like Flatpickr.');
});

// Add Memo Form
document.querySelector('.add-memo-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const text = document.getElementById('memo-text').value.trim();
    const memoTo = document.getElementById('memo-to').value.trim();
    const dueDate = document.getElementById('due-date').value.trim();
    const color = document.getElementById('memo-color').value;
    
    if (!text) {
        alert('Please enter memo text.');
        return;
    }
    
    // Create new memo
    const memosList = document.querySelector('.memos-list');
    const newMemo = document.createElement('div');
    newMemo.className = 'memo-item';
    
    // Set background color
    const colorMap = {
        'red': '#ff3333',
        'yellow': '#ffd700',
        'green': '#90ee90',
        'blue': '#87ceeb',
        'orange': '#ffb366',
        'purple': '#dda0dd'
    };
    newMemo.style.backgroundColor = colorMap[color] || '#ff3333';
    
    // Get current date
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
    
    newMemo.innerHTML = `
        <div class="memo-header">
            <span class="memo-date">${dateStr}</span>
            <span class="memo-audience">${memoTo || 'For Everyone'}</span>
            <span class="memo-author">admin</span>
            <label class="memo-checkbox">
                <input type="checkbox">
            </label>
            <a href="#" class="delete-link">delete</a>
        </div>
        <div class="memo-body">
            ${text}
        </div>
    `;
    
    // Add to top of list
    memosList.insertBefore(newMemo, memosList.firstChild);
    
    // Attach delete handler
    newMemo.querySelector('.delete-link').addEventListener('click', handleDelete);
    
    // Clear form
    document.getElementById('memo-text').value = '';
    document.getElementById('memo-to').value = '';
    document.getElementById('due-date').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.getElementById('show-dispatch').checked = false;
    document.getElementById('show-reservation').checked = false;
    
    // Reset character counter
    charCount.textContent = '0';
    charLeft.textContent = '200';
    charLeft.style.color = '#666';
    
    alert('Memo added successfully!');
});

// Delete Memo
function handleDelete(e) {
    e.preventDefault();
    
    if (confirm('Are you sure you want to delete this memo?')) {
        this.closest('.memo-item').remove();
    }
}

// Attach delete handlers to existing memos
document.querySelectorAll('.delete-link').forEach(link => {
    link.addEventListener('click', handleDelete);
});

// Show/Hide Store Memos
document.getElementById('show-store-memos').addEventListener('change', function() {
    const memosList = document.querySelector('.memos-list');
    
    if (this.checked) {
        memosList.style.display = 'block';
    } else {
        memosList.style.display = 'none';
    }
});

console.log('Memos module initialized');
