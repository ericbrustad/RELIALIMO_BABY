// Tab switching
document.querySelectorAll('.setup-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.setup-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Hide all content
    document.querySelectorAll('.setup-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Show selected content
    switch(tabName) {
      case 'grid':
        document.getElementById('gridSetupContent').style.display = 'block';
        break;
      case 'datetime':
        document.getElementById('dateTimeContent').style.display = 'block';
        break;
      case 'conflicts':
        document.getElementById('conflictsContent').style.display = 'block';
        break;
      case 'prefs':
        document.getElementById('prefsContent').style.display = 'block';
        break;
      case 'company':
        document.getElementById('companyContent').style.display = 'block';
        break;
    }
  });
});

function closeSetupModal() {
  const modal = document.getElementById('setupModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function saveGridSetup() {
  // Collect all field settings
  const fields = [];
  document.querySelectorAll('.setup-table tbody tr').forEach(row => {
    const checkbox = row.querySelector('.setup-checkbox');
    const widthInput = row.querySelector('.setup-width-input');
    
    if (checkbox && widthInput) {
      const fieldName = row.cells[1].textContent.trim();
      fields.push({
        name: fieldName,
        show: checkbox.checked,
        width: widthInput.value
      });
    }
  });
  
  console.log('Saving grid configuration:', fields);
  
  // Here you would save to backend
  alert('Grid configuration saved successfully!');
  closeSetupModal();
}

// Close modal when clicking outside
document.querySelector('.setup-modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('setup-modal-overlay')) {
    closeSetupModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSetupModal();
  }
});
