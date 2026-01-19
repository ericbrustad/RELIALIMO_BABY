// Drag and Drop functionality
let draggedElement = null;

document.addEventListener('DOMContentLoaded', () => {
  setupDragAndDrop();
  setupTabSwitching();
});

function setupDragAndDrop() {
  const draggables = document.querySelectorAll('.status-item.draggable');
  
  draggables.forEach(item => {
    item.setAttribute('draggable', 'true');
    
    item.addEventListener('dragstart', (e) => {
      draggedElement = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedElement = null;
    });
  });
  
  const columns = document.querySelectorAll('.status-items');
  
  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = getDragAfterElement(column, e.clientY);
      if (afterElement == null) {
        column.appendChild(draggedElement);
      } else {
        column.insertBefore(draggedElement, afterElement);
      }
    });
    
    column.addEventListener('drop', (e) => {
      e.preventDefault();
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.status-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function setupTabSwitching() {
  const tabs = document.querySelectorAll('.mapping-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Here you would switch content based on the tab
      // For now, just update the active state
      console.log('Switched to tab:', tab.textContent);
    });
  });
}

// Add Status button handler
document.querySelector('.btn-add-status')?.addEventListener('click', () => {
  const statusName = prompt('Enter new status name:');
  if (statusName) {
    console.log('Adding new status:', statusName);
    alert('Status "' + statusName + '" would be added to the system.');
  }
});

// Info icon handlers
document.querySelectorAll('.info-icon').forEach(icon => {
  icon.addEventListener('click', (e) => {
    e.stopPropagation();
    alert('Information about this section would be displayed here.');
  });
});
