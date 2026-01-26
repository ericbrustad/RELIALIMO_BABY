/**
 * MemoNotificationService.js
 * ==========================
 * Handles loading and displaying company memos/notifications
 * across different portals (customer, driver, admin).
 * 
 * Usage:
 *   import { MemoNotificationService } from './MemoNotificationService.js';
 *   await MemoNotificationService.loadAndDisplayMemos('driver-login', containerId);
 */

import { getSupabaseConfig } from './config.js';

class MemoNotificationServiceClass {
  constructor() {
    this.memos = [];
    this.organizationId = null;
  }

  /**
   * Get Supabase config
   */
  getConfig() {
    try {
      return getSupabaseConfig();
    } catch (e) {
      return {
        url: window.ENV?.SUPABASE_URL || '',
        anonKey: window.ENV?.SUPABASE_ANON_KEY || ''
      };
    }
  }

  /**
   * Load active memos for a specific location
   * @param {string} location - 'login', 'account-login', 'driver-login', 'dispatch-res'
   * @param {string} organizationId - Optional organization ID
   * @returns {Promise<Array>} - Array of memo objects
   */
  async loadMemos(location, organizationId = null) {
    const config = this.getConfig();
    if (!config.url) {
      console.warn('[MemoNotificationService] No Supabase config');
      return [];
    }

    try {
      // Build query
      let url = `${config.url}/rest/v1/company_memos?select=*&is_active=eq.true&notify_location=eq.${location}`;
      
      // Add date range filters
      const today = new Date().toISOString().split('T')[0];
      url += `&or=(display_from.is.null,display_from.lte.${today})`;
      url += `&or=(display_to.is.null,display_to.gte.${today})`;
      
      // Add organization filter if provided
      if (organizationId) {
        url += `&organization_id=eq.${organizationId}`;
      }
      
      // Order by pinned first, then priority, then date
      url += `&order=is_pinned.desc,created_at.desc`;

      const response = await fetch(url, {
        headers: {
          'apikey': config.anonKey,
          'Authorization': `Bearer ${config.anonKey}`
        }
      });

      if (response.ok) {
        this.memos = await response.json();
        console.log(`[MemoNotificationService] Loaded ${this.memos.length} memos for ${location}`);
        return this.memos;
      }
    } catch (err) {
      console.error('[MemoNotificationService] Failed to load memos:', err);
    }

    return [];
  }

  /**
   * Get color CSS value from color name
   */
  getColorValue(colorName) {
    const colorMap = {
      'red': '#ef4444',
      'yellow': '#eab308',
      'green': '#22c55e',
      'blue': '#3b82f6',
      'orange': '#f97316',
      'purple': '#a855f7'
    };
    return colorMap[colorName] || '#eab308';
  }

  /**
   * Get priority icon
   */
  getPriorityIcon(priority) {
    const icons = {
      'urgent': '🚨',
      'high': '⚠️',
      'normal': '📋',
      'low': '📝'
    };
    return icons[priority] || '📋';
  }

  /**
   * Render memos as HTML
   * @param {Array} memos - Array of memo objects
   * @param {Object} options - Rendering options
   * @returns {string} - HTML string
   */
  renderMemos(memos, options = {}) {
    if (!memos || memos.length === 0) {
      return '';
    }

    const { 
      showDismiss = true, 
      compact = false,
      maxItems = 5 
    } = options;

    const displayMemos = memos.slice(0, maxItems);

    return `
      <div class="memo-notifications ${compact ? 'compact' : ''}">
        ${displayMemos.map(memo => `
          <div class="memo-notification-item" data-memo-id="${memo.id}" style="border-left: 4px solid ${this.getColorValue(memo.color)}; background: ${this.getColorValue(memo.color)}15;">
            <div class="memo-notification-header">
              <span class="memo-priority-icon">${this.getPriorityIcon(memo.priority)}</span>
              ${memo.memo_to ? `<span class="memo-audience">${memo.memo_to}</span>` : ''}
              ${memo.is_pinned ? '<span class="memo-pinned">📌</span>' : ''}
              ${showDismiss ? `<button class="memo-dismiss-btn" onclick="MemoNotificationService.dismissMemo('${memo.id}')" title="Dismiss">✕</button>` : ''}
            </div>
            <div class="memo-notification-body">
              ${memo.memo_text}
            </div>
            ${memo.due_date ? `<div class="memo-due-date">Due: ${new Date(memo.due_date).toLocaleDateString()}</div>` : ''}
          </div>
        `).join('')}
        ${memos.length > maxItems ? `<div class="memo-more">+ ${memos.length - maxItems} more notifications</div>` : ''}
      </div>
    `;
  }

  /**
   * Inject memo styles into page
   */
  injectStyles() {
    if (document.getElementById('memo-notification-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'memo-notification-styles';
    styles.textContent = `
      .memo-notifications {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
        max-width: 600px;
        margin: 0 auto;
      }
      
      .memo-notifications.compact {
        gap: 8px;
        padding: 8px;
      }
      
      .memo-notification-item {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        position: relative;
        animation: slideIn 0.3s ease;
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .memo-notification-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 12px;
        color: #64748b;
      }
      
      .memo-priority-icon {
        font-size: 16px;
      }
      
      .memo-audience {
        background: #e2e8f0;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .memo-pinned {
        margin-left: auto;
      }
      
      .memo-dismiss-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.15s;
      }
      
      .memo-dismiss-btn:hover {
        background: #f1f5f9;
        color: #475569;
      }
      
      .memo-notification-body {
        font-size: 14px;
        color: #1e293b;
        line-height: 1.5;
      }
      
      .memo-due-date {
        margin-top: 8px;
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
      }
      
      .memo-more {
        text-align: center;
        font-size: 12px;
        color: #64748b;
        padding: 8px;
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .memo-notification-item {
          background: rgba(30, 41, 59, 0.95);
        }
        
        .memo-notification-body {
          color: #e2e8f0;
        }
        
        .memo-audience {
          background: #334155;
          color: #e2e8f0;
        }
      }
      
      /* Mobile responsive */
      @media (max-width: 640px) {
        .memo-notifications {
          padding: 8px;
        }
        
        .memo-notification-item {
          padding: 10px 12px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Load and display memos in a container
   * @param {string} location - Memo location type
   * @param {string|HTMLElement} container - Container ID or element
   * @param {Object} options - Display options
   */
  async loadAndDisplayMemos(location, container, options = {}) {
    this.injectStyles();

    const containerEl = typeof container === 'string' 
      ? document.getElementById(container) 
      : container;

    if (!containerEl) {
      console.warn('[MemoNotificationService] Container not found:', container);
      return;
    }

    const memos = await this.loadMemos(location, options.organizationId);
    
    if (memos.length > 0) {
      containerEl.innerHTML = this.renderMemos(memos, options);
      containerEl.style.display = 'block';
    } else {
      containerEl.innerHTML = '';
      containerEl.style.display = 'none';
    }

    return memos;
  }

  /**
   * Dismiss a memo (hide for current session or permanently if logged in)
   * @param {string} memoId - Memo UUID
   */
  async dismissMemo(memoId) {
    // Remove from DOM immediately
    const memoEl = document.querySelector(`[data-memo-id="${memoId}"]`);
    if (memoEl) {
      memoEl.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => memoEl.remove(), 300);
    }

    // Store dismissal in localStorage for session persistence
    const dismissedMemos = JSON.parse(localStorage.getItem('dismissed_memos') || '[]');
    if (!dismissedMemos.includes(memoId)) {
      dismissedMemos.push(memoId);
      localStorage.setItem('dismissed_memos', JSON.stringify(dismissedMemos));
    }

    // If user is logged in, also record in database
    // (This would require auth context, so we'll handle it in the portal)
  }

  /**
   * Check if a memo was dismissed
   * @param {string} memoId - Memo UUID
   * @returns {boolean}
   */
  isMemoDismissed(memoId) {
    const dismissedMemos = JSON.parse(localStorage.getItem('dismissed_memos') || '[]');
    return dismissedMemos.includes(memoId);
  }

  /**
   * Create a simple banner notification for portals
   * @param {string} location - Memo location
   * @param {Object} options - Options
   * @returns {HTMLElement} - Banner element
   */
  async createBanner(location, options = {}) {
    const memos = await this.loadMemos(location, options.organizationId);
    
    // Filter out dismissed memos
    const activeMemos = memos.filter(m => !this.isMemoDismissed(m.id));
    
    if (activeMemos.length === 0) return null;

    this.injectStyles();

    const banner = document.createElement('div');
    banner.className = 'memo-banner';
    banner.innerHTML = this.renderMemos(activeMemos, { 
      showDismiss: true, 
      compact: true, 
      maxItems: 3 
    });

    return banner;
  }
}

// Export singleton instance
export const MemoNotificationService = new MemoNotificationServiceClass();

// Make available globally for onclick handlers
if (typeof window !== 'undefined') {
  window.MemoNotificationService = MemoNotificationService;
}

export default MemoNotificationService;
