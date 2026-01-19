// ============================================
// Customer Email Verification Service
// Handles email verification with roundtrip links
// ============================================

import { getSupabaseCredentials } from '/shared/supabase-config.js';

/**
 * Customer Email Verification Service
 * Sends verification emails with secure tokens and handles verification callbacks
 */
class CustomerEmailVerificationService {
  constructor() {
    this.verificationTokens = new Map(); // Store tokens temporarily (in production, use Supabase)
    this.tokenExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Generate a secure verification token
   */
  generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate the verification URL for the customer
   * @param {string} email - Customer email
   * @param {string} firstName - Customer first name
   * @param {string} lastName - Customer last name
   * @param {string} token - Verification token
   * @returns {string} Full verification URL
   */
  generateVerificationUrl(email, firstName, lastName, token) {
    const baseUrl = 'https://account.relialimo.com';
    const slug = this.generatePortalSlug(firstName, lastName);
    // The verification link goes to the onboarding page with the token
    return `${baseUrl}/verify?token=${token}&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(slug)}`;
  }

  /**
   * Generate portal slug from name
   * @param {string} firstName 
   * @param {string} lastName 
   * @returns {string} Portal slug like First_name_Last_name
   */
  generatePortalSlug(firstName, lastName) {
    const first = (firstName || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
    const last = (lastName || '').trim().replace(/[^a-zA-Z0-9]/g, '_');
    return `${first}_${last}`;
  }

  /**
   * Store verification token in Supabase
   * @param {string} email 
   * @param {string} token 
   * @param {object} userData - Additional user data to store
   */
  async storeVerificationToken(email, token, userData = {}) {
    const creds = getSupabaseCredentials();
    
    const expiresAt = new Date(Date.now() + this.tokenExpiry).toISOString();
    
    const response = await fetch(`${creds.url}/rest/v1/customer_email_verifications`, {
      method: 'POST',
      headers: {
        'apikey': creds.anonKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt,
        user_data: userData,
        verified: false,
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.warn('Failed to store verification token in DB, using local storage fallback');
      // Fallback to local storage for development
      const stored = JSON.parse(localStorage.getItem('pending_verifications') || '{}');
      stored[token] = { email, userData, expiresAt, verified: false };
      localStorage.setItem('pending_verifications', JSON.stringify(stored));
    }

    return { email, token, expiresAt };
  }

  /**
   * Verify a token and mark email as verified
   * @param {string} token 
   * @param {string} email 
   * @returns {object} Verification result
   */
  async verifyToken(token, email) {
    const creds = getSupabaseCredentials();
    
    try {
      // Try Supabase first
      const response = await fetch(
        `${creds.url}/rest/v1/customer_email_verifications?token=eq.${token}&email=eq.${encodeURIComponent(email.toLowerCase())}`,
        {
          headers: {
            'apikey': creds.anonKey
          }
        }
      );

      if (response.ok) {
        const records = await response.json();
        if (records.length > 0) {
          const record = records[0];
          
          // Check if expired
          if (new Date(record.expires_at) < new Date()) {
            return { success: false, error: 'Token has expired. Please request a new verification email.' };
          }
          
          // Check if already verified
          if (record.verified) {
            return { success: true, alreadyVerified: true, userData: record.user_data };
          }
          
          // Mark as verified
          await fetch(`${creds.url}/rest/v1/customer_email_verifications?id=eq.${record.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': creds.anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ verified: true, verified_at: new Date().toISOString() })
          });
          
          return { success: true, userData: record.user_data };
        }
      }
      
      // Fallback to local storage
      const stored = JSON.parse(localStorage.getItem('pending_verifications') || '{}');
      if (stored[token]) {
        const record = stored[token];
        if (record.email.toLowerCase() !== email.toLowerCase()) {
          return { success: false, error: 'Invalid verification link.' };
        }
        if (new Date(record.expiresAt) < new Date()) {
          return { success: false, error: 'Token has expired. Please request a new verification email.' };
        }
        
        stored[token].verified = true;
        localStorage.setItem('pending_verifications', JSON.stringify(stored));
        return { success: true, userData: record.userData };
      }
      
      return { success: false, error: 'Invalid verification token.' };
    } catch (err) {
      console.error('Verification error:', err);
      return { success: false, error: 'Verification failed. Please try again.' };
    }
  }

  /**
   * Send verification email to customer
   * @param {string} email 
   * @param {string} firstName 
   * @param {string} lastName 
   * @param {object} additionalData - Additional data to store with verification
   */
  async sendVerificationEmail(email, firstName, lastName, additionalData = {}) {
    const token = this.generateToken();
    const verificationUrl = this.generateVerificationUrl(email, firstName, lastName, token);
    const portalSlug = this.generatePortalSlug(firstName, lastName);
    
    // Store the token
    await this.storeVerificationToken(email, token, {
      firstName,
      lastName,
      portalSlug,
      ...additionalData
    });

    // Build email content
    const subject = 'Welcome to RELIALIMO - Verify Your Email';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background: #1a1a2e;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #1e1e3f 0%, #252549 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
                <!-- Header -->
                <tr>
                  <td align="center" style="padding: 40px 40px 20px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);">
                    <img src="https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png" 
                         alt="RELIALIMO" 
                         style="max-width: 200px; height: auto;">
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px 40px;">
                    <h1 style="color: #fff; font-size: 28px; margin: 0 0 10px; text-align: center;">
                      Welcome, ${firstName}! 🎉
                    </h1>
                    <p style="color: #a0aec0; font-size: 16px; line-height: 1.6; margin: 0 0 30px; text-align: center;">
                      Thank you for creating your RELIALIMO account. Please verify your email address to complete your account setup.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center">
                          <a href="${verificationUrl}" 
                             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); 
                                    color: #fff; text-decoration: none; padding: 16px 40px; border-radius: 12px; 
                                    font-size: 18px; font-weight: 600; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">
                            ✅ Verify My Email
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 30px 0 0; text-align: center;">
                      This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
                    </p>
                    
                    <!-- Alternative Link -->
                    <div style="margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                      <p style="color: #a0aec0; font-size: 12px; margin: 0 0 10px;">
                        Having trouble with the button? Copy and paste this link:
                      </p>
                      <p style="color: #6366f1; font-size: 12px; word-break: break-all; margin: 0;">
                        ${verificationUrl}
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px 30px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <p style="color: #718096; font-size: 12px; margin: 0; text-align: center;">
                      Your portal URL after verification:<br>
                      <strong style="color: #a0aec0;">https://account.relialimo.com/${portalSlug}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email via API
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject,
          html,
          text: `Welcome to RELIALIMO, ${firstName}! Please verify your email by clicking this link: ${verificationUrl}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send verification email');
      }

      console.log('✅ Verification email sent to:', email);
      return { success: true, token, verificationUrl, portalSlug };
    } catch (err) {
      console.error('Failed to send verification email:', err);
      
      // Try fallback method (Resend API directly)
      try {
        const creds = getSupabaseCredentials();
        const fallbackResponse = await fetch(`${creds.url}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${creds.anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: email,
            subject,
            html
          })
        });

        if (fallbackResponse.ok) {
          console.log('✅ Verification email sent via Supabase function');
          return { success: true, token, verificationUrl, portalSlug };
        }
      } catch (fallbackErr) {
        console.error('Fallback email also failed:', fallbackErr);
      }

      // Return the verification URL anyway for development/testing
      console.log('📧 Verification URL (for testing):', verificationUrl);
      return { success: true, token, verificationUrl, portalSlug, emailFailed: true };
    }
  }

  /**
   * Resend verification email
   * @param {string} email 
   */
  async resendVerificationEmail(email) {
    const creds = getSupabaseCredentials();
    
    // Look up the pending verification
    try {
      const response = await fetch(
        `${creds.url}/rest/v1/customer_email_verifications?email=eq.${encodeURIComponent(email.toLowerCase())}&verified=eq.false&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': creds.anonKey
          }
        }
      );

      if (response.ok) {
        const records = await response.json();
        if (records.length > 0) {
          const userData = records[0].user_data || {};
          return await this.sendVerificationEmail(
            email,
            userData.firstName || '',
            userData.lastName || '',
            userData
          );
        }
      }
      
      return { success: false, error: 'No pending verification found for this email.' };
    } catch (err) {
      console.error('Resend verification error:', err);
      return { success: false, error: 'Failed to resend verification email.' };
    }
  }
}

// Export singleton instance
export const customerEmailVerification = new CustomerEmailVerificationService();
export default customerEmailVerification;

// Also expose globally for non-module scripts
window.CustomerEmailVerification = customerEmailVerification;
