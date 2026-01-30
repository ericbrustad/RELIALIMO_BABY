/**
 * Viewer Role Guard
 * 
 * This module provides read-only mode functionality for users with the "viewer" role.
 * When a viewer is logged in, all edit controls are disabled and a banner is shown.
 */

class ViewerGuard {
  constructor() {
    this.isViewer = false;
    this.initialized = false;
    this.updateTimeout = null;
  }

  /**
   * Initialize the viewer guard - check user role and apply restrictions
   */
  async init() {
    if (this.initialized) return;
    
    try {
      const role = await this.getUserRole();
      this.isViewer = role === 'viewer';
      
      if (this.isViewer) {
        this.applyViewerMode();
        console.log('👁️ Viewer mode enabled - read-only access');
      }
      
      this.initialized = true;
    } catch (err) {
      console.error('ViewerGuard init error:', err);
      this.initialized = true; // Mark as initialized even on error to prevent loops
    }
  }

  /**
   * Get the current user's role from Supabase
   */
  async getUserRole() {
    // Try from localStorage first (cached)
    const cachedRole = localStorage.getItem('user_role');
    const cacheTime = localStorage.getItem('user_role_time');
    
    // Use cache if less than 5 minutes old
    if (cachedRole && cacheTime) {
      const age = Date.now() - parseInt(cacheTime, 10);
      if (age < 5 * 60 * 1000) {
        return cachedRole;
      }
    }

    // Try to get from Supabase
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      
      // Get credentials from multiple sources
      const supabaseUrl = window.ENV?.SUPABASE_URL || 
                         window.SUPABASE_URL || 
                         localStorage.getItem('supabaseUrl');
      const supabaseKey = window.ENV?.SUPABASE_ANON_KEY || 
                         window.SUPABASE_ANON_KEY || 
                         localStorage.getItem('supabaseAnonKey');
      
      if (!supabaseUrl || !supabaseKey) {
        console.warn('[ViewerGuard] Supabase not configured');
        return 'user';
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.log('[ViewerGuard] No authenticated user');
        return 'user';
      }

      // Check user_metadata first
      if (user.user_metadata?.role) {
        this.cacheRole(user.user_metadata.role);
        return user.user_metadata.role;
      }

      // Check user_profiles table
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.warn('[ViewerGuard] Could not fetch profile:', profileError.message);
      }

      const role = profile?.role || 'user';
      this.cacheRole(role);
      return role;
    } catch (err) {
      console.warn('[ViewerGuard] Could not fetch user role:', err);
      return 'user';
    }
  }
  
  /**
   * Cache the role in localStorage
   */
  cacheRole(role) {
    localStorage.setItem('user_role', role);
    localStorage.setItem('user_role_time', Date.now().toString());
  }

  /**
   * Apply viewer mode - disable all editing and show banner
   */
  applyViewerMode() {
    // Add viewer mode class to body
    document.body.classList.add('viewer-mode');
    
    // Show viewer banner
    this.showViewerBanner();
    
    // Disable all form inputs
    this.disableFormElements();
    
    // Hide action buttons
    this.hideActionButtons();
    
    // Observe DOM for dynamically added elements
    this.observeDOM();
  }

  /**
   * Show a banner indicating read-only mode
   */
  showViewerBanner() {
    // Don't add if already exists
    if (document.getElementById('viewer-mode-banner')) return;
    
    const banner = document.createElement('div');
    banner.id = 'viewer-mode-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #6b46c1, #805ad5);
        color: white;
        padding: 8px 16px;
        text-align: center;
        font-size: 13px;
        font-weight: 500;
        z-index: 100000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      ">
        👁️ <strong>Viewer Mode</strong> - You have read-only access. Changes cannot be saved.
      </div>
    `;
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Add padding to body to account for banner
    document.body.style.paddingTop = '36px';
  }

  /**
   * Disable all form elements
   */
  disableFormElements() {
    const selectors = [
      'input:not([type="search"]):not([type="checkbox"][data-viewer-allow]):not([readonly])',
      'textarea:not([readonly])',
      'select:not([data-viewer-allow])',
      '[contenteditable="true"]'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      if (el.hasAttribute('data-viewer-disabled')) return; // Already processed
      
      el.setAttribute('disabled', 'true');
      el.setAttribute('data-viewer-disabled', 'true');
      el.style.opacity = '0.7';
      el.style.cursor = 'not-allowed';
    });
  }

  /**
   * Hide or disable action buttons (save, delete, create, etc.)
   */
  hideActionButtons() {
    const actionKeywords = [
      'save', 'submit', 'create', 'add', 'new', 'delete', 'remove', 
      'update', 'edit', 'assign', 'confirm', 'send', 'post', 'upload',
      'import', 'export', 'cancel', 'clear', 'reset', 'compose'
    ];

    document.querySelectorAll('button, .btn, [role="button"], a.btn').forEach(btn => {
      if (btn.hasAttribute('data-viewer-disabled')) return; // Already processed
      
      const text = (btn.textContent || btn.innerText || '').toLowerCase();
      const id = (btn.id || '').toLowerCase();
      const className = (btn.className || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      const combinedText = `${text} ${id} ${className} ${ariaLabel}`;
      
      const isActionButton = actionKeywords.some(keyword => 
        combinedText.includes(keyword)
      );

      // Allow search, filter, view, navigation buttons
      const isAllowed = ['search', 'filter', 'view', 'show', 'refresh', 'close', 
                         'back', 'next', 'prev', 'previous', 'detail', 'expand', 'collapse']
        .some(word => combinedText.includes(word)) ||
        btn.hasAttribute('data-viewer-allow');

      if (isActionButton && !isAllowed) {
        btn.setAttribute('disabled', 'true');
        btn.setAttribute('data-viewer-disabled', 'true');
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.title = 'Viewer mode - read only';
      }
    });
  }

  /**
   * Observe DOM for dynamically added elements
   */
  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      let needsUpdate = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              needsUpdate = true;
            }
          });
        }
      });

      if (needsUpdate) {
        // Debounce the update
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
          this.disableFormElements();
          this.hideActionButtons();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Check if current user is a viewer
   */
  isViewerMode() {
    return this.isViewer;
  }

  /**
   * Prevent form submission for viewers
   */
  preventSubmit(form) {
    if (this.isViewer) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        alert('Viewer mode - you cannot make changes.');
        return false;
      });
    }
  }
  
  /**
   * Clear cached role (call on logout)
   */
  clearCache() {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_role_time');
    this.isViewer = false;
    this.initialized = false;
  }
}

// Create global instance
window.viewerGuard = new ViewerGuard();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.viewerGuard.init());
} else {
  window.viewerGuard.init();
}

// Export for module usage
export default window.viewerGuard;
export { ViewerGuard };
