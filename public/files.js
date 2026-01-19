// Toggle folder expansion/collapse
document.querySelectorAll('.tree-item.folder').forEach(folder => {
    const toggleIcon = folder.querySelector('.toggle-icon');
    
    toggleIcon.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const isExpanded = folder.getAttribute('data-expanded') === 'true';
        folder.setAttribute('data-expanded', !isExpanded);
        
        // Update icon
        if (!isExpanded) {
            this.textContent = '▼';
        } else {
            this.textContent = '▶';
        }
    });
});

// Launch File Manager button
document.querySelector('.launch-btn').addEventListener('click', function() {
    openFileManager();
});

// Open File Manager Modal
function openFileManager() {
    const modal = document.getElementById('fileManagerModal');
    modal.classList.add('active');
}

// Close File Manager Modal
function closeFileManager() {
    const modal = document.getElementById('fileManagerModal');
    modal.classList.remove('active');
}

// Select Folder in File Table
function selectFolder(row) {
    // Remove previous selection
    document.querySelectorAll('.folder-row').forEach(r => r.classList.remove('selected'));
    
    // Add selection to clicked row
    row.classList.add('selected');
    
    const folderName = row.querySelector('.folder-name').textContent;
    console.log('Selected folder:', folderName);
}

// Insert File
function insertFile() {
    const url = document.querySelector('.upload-panel .property-input.full-width').value;
    
    if (url) {
        alert(`File URL would be inserted: ${url}`);
        closeFileManager();
    } else {
        alert('Please select a file or enter a URL.');
    }
}

// File Upload Handler
document.getElementById('fileUpload').addEventListener('change', function(e) {
    const fileName = e.target.files[0]?.name || 'No file chosen';
    document.querySelector('.file-name').textContent = fileName;
});

// Upload Button
document.querySelector('.upload-btn').addEventListener('click', function() {
    const fileInput = document.getElementById('fileUpload');
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const maxSize = 3 * 1024 * 1024; // 3MB
        
        if (file.size > maxSize) {
            alert('File size exceeds 3MB limit. Please choose a smaller file.');
            return;
        }
        
        // Simulate upload
        alert(`Uploading file: ${file.name}\nSize: ${(file.size / 1024).toFixed(2)} KB\n\nIn a production system, this would upload to the server.`);
        
        // Reset
        fileInput.value = '';
        document.querySelector('.file-name').textContent = 'No file chosen';
    } else {
        alert('Please choose a file to upload.');
    }
});

// Toolbar - New Folder button
document.querySelector('.toolbar-btn').addEventListener('click', function() {
    const folderName = prompt('Enter new folder name:');
    
    if (folderName && folderName.trim()) {
        alert(`Creating folder: ${folderName}\n\nIn a production system, this would create a new folder in the current directory.`);
    }
});

// Close modal when clicking outside
document.getElementById('fileManagerModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFileManager();
    }
});

// Folder click (alternative way to expand/collapse)
document.querySelectorAll('.tree-item.folder').forEach(folder => {
    const folderName = folder.querySelector('.item-name');
    
    folderName.addEventListener('click', function(e) {
        e.stopPropagation();
        
        const isExpanded = folder.getAttribute('data-expanded') === 'true';
        folder.setAttribute('data-expanded', !isExpanded);
        
        // Update toggle icon
        const toggleIcon = folder.querySelector('.toggle-icon');
        if (!isExpanded) {
            toggleIcon.textContent = '▼';
        } else {
            toggleIcon.textContent = '▶';
        }
    });
});

// Right-click context menu (placeholder)
document.querySelectorAll('.tree-item').forEach(item => {
    item.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        
        const itemName = this.querySelector('.item-name').textContent;
        console.log('Right-clicked on:', itemName);
        
        // In a real app, this would show a context menu with options like:
        // - Open
        // - Rename
        // - Delete
        // - Properties
        // - Download
    });
});

console.log('Files module initialized');
