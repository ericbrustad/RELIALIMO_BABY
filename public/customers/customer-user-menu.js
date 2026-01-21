// ============================================
// Customer User Menu Component
// Provides consistent header with user info, dropdown menu, and logout
// ============================================

import CustomerAuth from './customer-auth-service.js';

// ============================================
// User Menu State
// ============================================
let menuState = {
  isOpen: false,
  customer: null,
  menuElement: null,
  unsubscribe: null
};

// ============================================
// Initialize User Menu
// ============================================

/**
 * Initialize the user menu - call after DOM is loaded
 * @param {string} containerId - ID of the container element for the menu
 */
export function initUserMenu(containerId = 'userMenuContainer') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn('[UserMenu] Container not found:', containerId);
    return;
  }
  
  // Subscribe to auth state changes
  menuState.unsubscribe = CustomerAuth.onAuthStateChange(({ isAuthenticated, customer, event }) => {
    menuState.customer = customer;
    renderUserMenu(container, isAuthenticated, customer);
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (menuState.isOpen && menuState.menuElement && !menuState.menuElement.contains(e.target)) {
      closeMenu();
    }
  });
  
  // Close menu on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuState.isOpen) {
      closeMenu();
    }
  });
}

/**
 * Destroy user menu and clean up listeners
 */
export function destroyUserMenu() {
  if (menuState.unsubscribe) {
    menuState.unsubscribe();
    menuState.unsubscribe = null;
  }
}

// ============================================
// Render Functions
// ============================================

function renderUserMenu(container, isAuthenticated, customer) {
  if (!isAuthenticated || !customer) {
    // Show login button
    container.innerHTML = `
      <a href="/auth" class="user-menu-login-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        <span>Sign In</span>
      </a>
    `;
    return;
  }
  
  // Get initials
  const initials = getInitials(customer.first_name, customer.last_name);
  const fullName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
  const email = customer.email || '';
  const portalSlug = CustomerAuth.getPortalSlug();
  
  container.innerHTML = `
    <div class="user-menu-wrapper" id="userMenuWrapper">
      <button class="user-menu-trigger hamburger-trigger" id="userMenuTrigger" aria-expanded="false" aria-haspopup="true" aria-label="Menu">
        <svg class="hamburger-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
      
      <div class="user-menu-dropdown" id="userMenuDropdown" role="menu" aria-hidden="true">
        <div class="menu-header">
          <div class="user-avatar-large">
            ${customer.avatar_url ? 
              `<img src="${customer.avatar_url}" alt="${fullName}" class="avatar-img">` : 
              `<span class="avatar-initials">${initials}</span>`
            }
          </div>
          <div class="user-details">
            <span class="user-name-full">${escapeHtml(fullName)}</span>
            <span class="user-email">${escapeHtml(email)}</span>
            ${customer.email_verified ? 
              '<span class="verified-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified</span>' : 
              '<span class="unverified-badge">⚠️ Email not verified</span>'
            }
          </div>
        </div>
        
        <div class="menu-divider"></div>
        
        <nav class="menu-nav">
          <a href="/${portalSlug}" class="menu-item" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>My Portal</span>
          </a>
          
          <a href="/${portalSlug}?tab=trips" class="menu-item" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>My Trips</span>
          </a>
          
          <a href="/${portalSlug}?tab=account" class="menu-item" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>My Profile</span>
          </a>
          
          <button class="menu-item" id="changePasswordMenuItem" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Change Password</span>
          </button>
          
          <button class="menu-item" id="preferencesMenuItem" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Preferences</span>
          </button>
          
          <a href="/${portalSlug}?tab=book" class="menu-item menu-item-highlight" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
            <span>Book a Ride</span>
          </a>
        </nav>
        
        <div class="menu-divider"></div>
        
        <div class="menu-footer">
          <button class="menu-item menu-item-danger" id="logoutMenuItem" role="menuitem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
        
        <div class="menu-session-info">
          <span>Session active</span>
          <span class="session-dot"></span>
        </div>
      </div>
    </div>
  `;
  
  // Store reference
  menuState.menuElement = container.querySelector('#userMenuWrapper');
  
  // Attach event listeners
  const trigger = container.querySelector('#userMenuTrigger');
  const dropdown = container.querySelector('#userMenuDropdown');
  const logoutBtn = container.querySelector('#logoutMenuItem');
  const preferencesBtn = container.querySelector('#preferencesMenuItem');
  const changePasswordBtn = container.querySelector('#changePasswordMenuItem');
  
  trigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(trigger, dropdown);
  });
  
  logoutBtn?.addEventListener('click', async () => {
    await handleLogout();
  });
  
  preferencesBtn?.addEventListener('click', () => {
    closeMenu();
    // Open the preferences modal directly
    const preferencesModal = document.getElementById('preferencesModal');
    if (preferencesModal) {
      preferencesModal.classList.remove('hidden');
    }
  });
  
  changePasswordBtn?.addEventListener('click', () => {
    closeMenu();
    openChangePasswordModal();
  });
  
  // Handle keyboard navigation
  dropdown?.addEventListener('keydown', (e) => {
    handleMenuKeyboard(e, dropdown);
  });
}

// ============================================
// Menu Actions
// ============================================

function toggleMenu(trigger, dropdown) {
  menuState.isOpen = !menuState.isOpen;
  
  trigger.setAttribute('aria-expanded', menuState.isOpen.toString());
  dropdown.setAttribute('aria-hidden', (!menuState.isOpen).toString());
  
  if (menuState.isOpen) {
    dropdown.classList.add('open');
    // Focus first menu item
    const firstItem = dropdown.querySelector('.menu-item');
    firstItem?.focus();
  } else {
    dropdown.classList.remove('open');
  }
}

function closeMenu() {
  menuState.isOpen = false;
  const trigger = document.querySelector('#userMenuTrigger');
  const dropdown = document.querySelector('#userMenuDropdown');
  
  trigger?.setAttribute('aria-expanded', 'false');
  dropdown?.setAttribute('aria-hidden', 'true');
  dropdown?.classList.remove('open');
}

async function handleLogout() {
  const confirmed = confirm('Are you sure you want to sign out?');
  if (!confirmed) return;
  
  // Show loading state
  const logoutBtn = document.querySelector('#logoutMenuItem');
  if (logoutBtn) {
    logoutBtn.innerHTML = `
      <svg class="spinner" width="18" height="18" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate" dur="1s" from="0 12 12" to="360 12 12" repeatCount="indefinite"/>
        </circle>
      </svg>
      <span>Signing out...</span>
    `;
    logoutBtn.disabled = true;
  }
  
  await CustomerAuth.logout(true);
}

function handleMenuKeyboard(e, dropdown) {
  const items = dropdown.querySelectorAll('.menu-item');
  const currentIndex = Array.from(items).indexOf(document.activeElement);
  
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % items.length;
      items[nextIndex]?.focus();
      break;
    case 'ArrowUp':
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[prevIndex]?.focus();
      break;
    case 'Home':
      e.preventDefault();
      items[0]?.focus();
      break;
    case 'End':
      e.preventDefault();
      items[items.length - 1]?.focus();
      break;
    case 'Tab':
      closeMenu();
      break;
  }
}

// ============================================
// Change Password Modal
// ============================================

function openChangePasswordModal() {
  // Check if modal already exists
  let modal = document.getElementById('changePasswordModal');
  if (!modal) {
    // Create the modal
    modal = document.createElement('div');
    modal.id = 'changePasswordModal';
    modal.className = 'password-modal-overlay';
    modal.innerHTML = `
      <div class="password-modal">
        <div class="password-modal-header">
          <h3>Change Password</h3>
          <button class="password-modal-close" id="closePasswordModal">&times;</button>
        </div>
        <form id="changePasswordForm" class="password-modal-form">
          <div class="form-group">
            <label for="newPassword">New Password</label>
            <input type="password" id="newPassword" class="form-input" placeholder="Enter new password" required minlength="6">
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input type="password" id="confirmPassword" class="form-input" placeholder="Confirm new password" required minlength="6">
          </div>
          <div class="password-error hidden" id="passwordError"></div>
          <div class="password-modal-actions">
            <button type="button" class="btn-secondary" id="cancelPasswordChange">Cancel</button>
            <button type="submit" class="btn-primary" id="submitPasswordChange">Update Password</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('#closePasswordModal').addEventListener('click', closeChangePasswordModal);
    modal.querySelector('#cancelPasswordChange').addEventListener('click', closeChangePasswordModal);
    modal.querySelector('#changePasswordForm').addEventListener('submit', handleChangePassword);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeChangePasswordModal();
    });
  }
  
  // Show modal
  modal.classList.add('open');
  modal.querySelector('#newPassword').focus();
}

function closeChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) {
    modal.classList.remove('open');
    // Reset form
    modal.querySelector('#changePasswordForm').reset();
    modal.querySelector('#passwordError').classList.add('hidden');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorDiv = document.getElementById('passwordError');
  const submitBtn = document.getElementById('submitPasswordChange');
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    errorDiv.textContent = 'Passwords do not match';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  // Validate password length
  if (newPassword.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    errorDiv.classList.remove('hidden');
    return;
  }
  
  // Show loading state
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating...';
  errorDiv.classList.add('hidden');
  
  try {
    await CustomerAuth.updatePassword(newPassword);
    
    closeChangePasswordModal();
    // Show success toast if available
    if (typeof showToast === 'function') {
      showToast('Password updated successfully', 'success');
    } else {
      alert('Password updated successfully');
    }
  } catch (err) {
    errorDiv.textContent = err.message || 'Failed to update password';
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Password';
  }
}

// ============================================
// Utility Functions
// ============================================

function getInitials(firstName, lastName) {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return first + last || '?';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// Inject Styles
// ============================================

export function injectUserMenuStyles() {
  if (document.getElementById('userMenuStyles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'userMenuStyles';
  styles.textContent = `
    /* User Menu Container */
    .user-menu-wrapper {
      position: relative;
      display: inline-block;
    }
    
    /* Login Button (when not authenticated) */
    .user-menu-login-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
    }
    
    .user-menu-login-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    }
    
    /* Trigger Button */
    .user-menu-trigger {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    /* Hamburger Menu Trigger */
    .user-menu-trigger.hamburger-trigger {
      padding: 8px;
      border-radius: 8px;
      background: transparent;
      border: none;
    }
    
    .user-menu-trigger.hamburger-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .hamburger-icon {
      color: white;
      transition: transform 0.3s ease;
    }
    
    .user-menu-trigger[aria-expanded="true"] .hamburger-icon {
      transform: rotate(90deg);
    }
    
    .user-menu-trigger:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(99, 102, 241, 0.5);
    }
    
    .user-menu-trigger:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.5);
    }
    
    /* Avatar */
    .user-avatar {
      position: relative;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    
    .user-avatar-large {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }
    
    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .avatar-initials {
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    
    .user-avatar-large .avatar-initials {
      font-size: 18px;
    }
    
    .online-indicator {
      position: absolute;
      bottom: 1px;
      right: 1px;
      width: 10px;
      height: 10px;
      background: #22c55e;
      border: 2px solid #1a1a2e;
      border-radius: 50%;
    }
    
    /* User Info */
    .user-info-brief {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .user-info-brief .user-name {
      color: white;
      font-size: 14px;
      font-weight: 500;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .chevron-icon {
      color: rgba(255, 255, 255, 0.5);
      transition: transform 0.3s ease;
    }
    
    .user-menu-trigger[aria-expanded="true"] .chevron-icon {
      transform: rotate(180deg);
    }
    
    /* Dropdown Menu */
    .user-menu-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 280px;
      background: linear-gradient(135deg, #1e1e3f 0%, #252549 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px) scale(0.95);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      overflow: hidden;
    }
    
    .user-menu-dropdown.open {
      opacity: 1;
      visibility: visible;
      transform: translateY(0) scale(1);
    }
    
    /* Menu Header */
    .menu-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px;
      background: rgba(99, 102, 241, 0.1);
    }
    
    .user-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow: hidden;
    }
    
    .user-name-full {
      color: white;
      font-size: 16px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .user-email {
      color: rgba(255, 255, 255, 0.6);
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .verified-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #22c55e;
      font-size: 11px;
      margin-top: 2px;
    }
    
    .unverified-badge {
      color: #f59e0b;
      font-size: 11px;
      margin-top: 2px;
    }
    
    /* Menu Divider */
    .menu-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 0;
    }
    
    /* Menu Navigation */
    .menu-nav {
      padding: 8px;
    }
    
    .menu-footer {
      padding: 8px;
    }
    
    /* Menu Items */
    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
      text-decoration: none;
      border: none;
      background: transparent;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      text-align: left;
    }
    
    .menu-item:hover {
      background: rgba(99, 102, 241, 0.15);
      color: white;
    }
    
    .menu-item:focus {
      outline: none;
      background: rgba(99, 102, 241, 0.2);
      color: white;
    }
    
    .menu-item svg {
      flex-shrink: 0;
      opacity: 0.7;
    }
    
    .menu-item:hover svg {
      opacity: 1;
    }
    
    .menu-item-highlight {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
      color: #a78bfa;
    }
    
    .menu-item-highlight:hover {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%);
      color: white;
    }
    
    .menu-item-danger {
      color: #f87171;
    }
    
    .menu-item-danger:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    
    /* Session Info */
    .menu-session-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px;
      background: rgba(0, 0, 0, 0.2);
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }
    
    .session-dot {
      width: 6px;
      height: 6px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    /* Spinner */
    .spinner {
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
      .user-info-brief .user-name {
        display: none;
      }
      
      .user-menu-dropdown {
        position: fixed;
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        min-width: 100%;
        border-radius: 20px 20px 0 0;
        max-height: 80vh;
        overflow-y: auto;
        transform: translateY(100%);
      }
      
      .user-menu-dropdown.open {
        transform: translateY(0);
      }
    }
    
    /* Password Modal Styles */
    .password-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    
    .password-modal-overlay.open {
      opacity: 1;
      visibility: visible;
    }
    
    .password-modal {
      background: linear-gradient(135deg, #1e1e3f 0%, #252549 100%);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      transform: scale(0.9) translateY(-20px);
      transition: transform 0.3s ease;
    }
    
    .password-modal-overlay.open .password-modal {
      transform: scale(1) translateY(0);
    }
    
    .password-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .password-modal-header h3 {
      margin: 0;
      color: white;
      font-size: 18px;
      font-weight: 600;
    }
    
    .password-modal-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      transition: color 0.2s ease;
    }
    
    .password-modal-close:hover {
      color: white;
    }
    
    .password-modal-form {
      padding: 20px;
    }
    
    .password-modal-form .form-group {
      margin-bottom: 16px;
    }
    
    .password-modal-form label {
      display: block;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      margin-bottom: 6px;
    }
    
    .password-modal-form .form-input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      color: white;
      font-size: 14px;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }
    
    .password-modal-form .form-input:focus {
      outline: none;
      border-color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
    }
    
    .password-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
    }
    
    .password-error.hidden {
      display: none;
    }
    
    .password-modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    
    .password-modal-actions .btn-secondary {
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .password-modal-actions .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .password-modal-actions .btn-primary {
      padding: 10px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .password-modal-actions .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }
    
    .password-modal-actions .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
  `;
  
  document.head.appendChild(styles);
}

// ============================================
// Export
// ============================================

export default {
  initUserMenu,
  destroyUserMenu,
  injectUserMenuStyles
};
