/**
 * DriverEmailQueueService.js
 * ===========================
 * Manages queued emails to drivers for assigned reservations.
 * Sends one email every 30 seconds to prevent data loss and spam filters.
 */

class DriverEmailQueueService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.processingInterval = 30000; // 30 seconds between emails
    this.intervalId = null;
    this.lastSentAt = null;
    
    // Load any pending items from localStorage
    this.loadQueue();
    
    // Start processing
    this.startProcessing();
    
    console.log('[EmailQueue] Service initialized with', this.queue.length, 'pending items');
  }
  
  /**
   * Add a reservation assignment to the email queue
   */
  addToQueue(reservation, driver, type = 'assignment') {
    const queueItem = {
      id: `${reservation.id}-${Date.now()}`,
      reservationId: reservation.id,
      confirmationNumber: reservation.confirmation_number || reservation.confirmationNumber,
      driverId: driver.id,
      driverName: driver.name || `${driver.first_name} ${driver.last_name}`,
      driverEmail: driver.email,
      driverPhone: driver.phone || driver.cell_phone,
      passengerName: reservation.passenger_name || reservation.passengerName,
      pickupDate: reservation.pickup_datetime?.split('T')[0] || reservation.pickupDate,
      pickupTime: reservation.pickup_datetime?.split('T')[1]?.substring(0, 5) || reservation.pickupTime,
      pickupAddress: reservation.pickup_address || reservation.pickupAddress,
      dropoffAddress: reservation.dropoff_address || reservation.dropoffAddress,
      vehicleType: reservation.vehicle_type || reservation.vehicleType,
      type: type, // 'assignment', 'offer', 'reminder'
      addedAt: new Date().toISOString(),
      attempts: 0,
      status: 'pending'
    };
    
    // Avoid duplicates
    const exists = this.queue.find(q => 
      q.reservationId === queueItem.reservationId && 
      q.driverId === queueItem.driverId &&
      q.status === 'pending'
    );
    
    if (exists) {
      console.log('[EmailQueue] Duplicate detected, updating existing item');
      Object.assign(exists, queueItem);
    } else {
      this.queue.push(queueItem);
      console.log('[EmailQueue] Added to queue:', queueItem.confirmationNumber, 'for driver:', queueItem.driverName);
    }
    
    this.saveQueue();
    
    // Ensure processing is running
    this.startProcessing();
    
    return queueItem;
  }
  
  /**
   * Start the queue processor
   */
  startProcessing() {
    if (this.intervalId) return;
    
    this.intervalId = setInterval(() => {
      this.processNextItem();
    }, this.processingInterval);
    
    // Also process immediately if queue has items
    if (this.queue.length > 0 && !this.isProcessing) {
      setTimeout(() => this.processNextItem(), 1000);
    }
    
    console.log('[EmailQueue] Started processing (30s intervals)');
  }
  
  /**
   * Stop the queue processor
   */
  stopProcessing() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[EmailQueue] Stopped processing');
    }
  }
  
  /**
   * Process the next item in the queue
   */
  async processNextItem() {
    if (this.isProcessing) {
      console.log('[EmailQueue] Already processing, skipping');
      return;
    }
    
    const pendingItems = this.queue.filter(q => q.status === 'pending');
    if (pendingItems.length === 0) {
      console.log('[EmailQueue] No pending items to process');
      return;
    }
    
    this.isProcessing = true;
    const item = pendingItems[0];
    
    console.log('[EmailQueue] Processing:', item.confirmationNumber, 'for', item.driverName);
    
    try {
      await this.sendDriverEmail(item);
      item.status = 'sent';
      item.sentAt = new Date().toISOString();
      this.lastSentAt = item.sentAt;
      console.log('[EmailQueue] ✅ Sent successfully:', item.confirmationNumber);
      
      // Remove from queue after successful send
      this.queue = this.queue.filter(q => q.id !== item.id);
    } catch (error) {
      item.attempts += 1;
      item.lastError = error.message;
      console.error('[EmailQueue] ❌ Failed to send:', error.message);
      
      // Mark as failed after 3 attempts
      if (item.attempts >= 3) {
        item.status = 'failed';
        console.warn('[EmailQueue] Item failed after 3 attempts:', item.confirmationNumber);
      }
    }
    
    this.saveQueue();
    this.isProcessing = false;
  }
  
  /**
   * Send email to driver for an assignment
   */
  async sendDriverEmail(item) {
    const driverPortalUrl = `${window.location.origin}/driver-portal.html`;
    
    const subject = `🚗 New Trip Assignment - ${item.confirmationNumber}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1a1a2e; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">RELIA🐂LIMO</h1>
          <p style="margin: 5px 0 0 0;">New Trip Assignment</p>
        </div>
        
        <div style="padding: 20px; background: #f9f9f9;">
          <h2 style="color: #333; margin-top: 0;">Hi ${item.driverName},</h2>
          <p>You have been assigned a new trip. Please review the details below:</p>
          
          <div style="background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Confirmation #:</td>
                <td style="padding: 8px 0; font-weight: bold;">${item.confirmationNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Passenger:</td>
                <td style="padding: 8px 0;">${item.passengerName || 'TBD'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0;">${item.pickupDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Time:</td>
                <td style="padding: 8px 0;">${item.pickupTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Pickup:</td>
                <td style="padding: 8px 0;">${item.pickupAddress || 'See portal'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Dropoff:</td>
                <td style="padding: 8px 0;">${item.dropoffAddress || 'See portal'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Vehicle:</td>
                <td style="padding: 8px 0;">${item.vehicleType || 'See portal'}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${driverPortalUrl}" style="
              display: inline-block;
              background: #4a90e2;
              color: white;
              padding: 12px 30px;
              border-radius: 6px;
              text-decoration: none;
              font-weight: bold;
            ">View in Driver Portal</a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            This trip has been assigned to you and appears in your "Upcoming" trips.
            Log into the Driver Portal to view full details and update your status.
          </p>
        </div>
        
        <div style="background: #333; color: #999; padding: 15px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">RELIA🐂LIMO Driver Notification System</p>
        </div>
      </div>
    `;
    
    // Send via API
    const response = await fetch('/api/email-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: item.driverEmail,
        subject: subject,
        html: htmlBody
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[EmailQueue] Email sent, messageId:', result.messageId);
    
    return result;
  }
  
  /**
   * Save queue to localStorage for persistence
   */
  saveQueue() {
    try {
      localStorage.setItem('driver_email_queue', JSON.stringify(this.queue));
    } catch (e) {
      console.warn('[EmailQueue] Failed to save queue:', e);
    }
  }
  
  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const saved = localStorage.getItem('driver_email_queue');
      if (saved) {
        this.queue = JSON.parse(saved);
        // Reset any "processing" status from previous session
        this.queue.forEach(item => {
          if (item.status === 'processing') {
            item.status = 'pending';
          }
        });
      }
    } catch (e) {
      console.warn('[EmailQueue] Failed to load queue:', e);
      this.queue = [];
    }
  }
  
  /**
   * Get queue status
   */
  getStatus() {
    return {
      total: this.queue.length,
      pending: this.queue.filter(q => q.status === 'pending').length,
      sent: this.queue.filter(q => q.status === 'sent').length,
      failed: this.queue.filter(q => q.status === 'failed').length,
      isProcessing: this.isProcessing,
      lastSentAt: this.lastSentAt
    };
  }
  
  /**
   * Clear completed items from queue
   */
  clearCompleted() {
    this.queue = this.queue.filter(q => q.status === 'pending');
    this.saveQueue();
  }
  
  /**
   * Retry failed items
   */
  retryFailed() {
    this.queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.attempts = 0;
      }
    });
    this.saveQueue();
  }
}

// Create global singleton
window.driverEmailQueue = new DriverEmailQueueService();
