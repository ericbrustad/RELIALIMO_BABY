/**
 * CustomerNotificationService.js
 * Handles sending welcome emails/SMS to new accounts and confirmation emails for reservations
 * 
 * Rules:
 * - Send welcome email AND text when new account is created
 * - Send confirmation email to billing email (with price)
 * - If passenger email differs from billing, send them confirmation WITHOUT price
 * - Template send rules can be customized in Email Settings
 */

const STORAGE_KEY_TEMPLATES = 'customerEmailTemplates';
const STORAGE_KEY_SMS_TEMPLATES = 'customerSmsTemplates';
const STORAGE_KEY_EMAIL_TEMPLATES = 'emailTemplates'; // Same key used by email-settings.js

/**
 * Check if a template should be sent for a given trigger event
 * @param {string} templateId - The template ID to check
 * @param {string} triggerEvent - The event type (e.g., 'new_account', 'new_reservation')
 * @returns {object} - { shouldSend, channels, recipients, conditions }
 */
function checkTemplateSendRules(templateId, triggerEvent) {
  try {
    // Load templates from email-settings.js storage
    const storedTemplates = localStorage.getItem(STORAGE_KEY_EMAIL_TEMPLATES);
    if (!storedTemplates) {
      // No custom rules, use defaults
      return getDefaultRulesForEvent(triggerEvent);
    }
    
    const templates = JSON.parse(storedTemplates);
    const template = templates.find(t => t.id === templateId);
    
    if (!template || !template.sendRules) {
      return getDefaultRulesForEvent(triggerEvent);
    }
    
    const rules = template.sendRules;
    
    // Check if rule is enabled
    if (rules.enabled === false) {
      console.log(`📧 Template "${templateId}" is disabled`);
      return { shouldSend: false };
    }
    
    // Check if this trigger is in the triggers list
    const triggers = rules.triggers || ['manual'];
    if (triggers.includes('manual') && !triggers.some(t => t !== 'manual')) {
      // Only manual send enabled
      if (triggerEvent !== 'manual') {
        console.log(`📧 Template "${templateId}" is set to manual send only`);
        return { shouldSend: false };
      }
    }
    
    if (!triggers.includes(triggerEvent) && !triggers.includes('manual')) {
      console.log(`📧 Template "${templateId}" not triggered by "${triggerEvent}"`);
      return { shouldSend: false };
    }
    
    return {
      shouldSend: true,
      channels: rules.channels || ['email'],
      recipients: rules.recipients || ['billing'],
      conditions: rules.conditions || [],
      timing: rules.timing || 'immediate'
    };
  } catch (e) {
    console.warn('Failed to check template send rules:', e);
    return getDefaultRulesForEvent(triggerEvent);
  }
}

/**
 * Get default send rules for an event type
 */
function getDefaultRulesForEvent(triggerEvent) {
  switch (triggerEvent) {
    case 'new_account':
      return {
        shouldSend: true,
        channels: ['email', 'sms'],
        recipients: ['billing'],
        conditions: []
      };
    case 'new_reservation':
      return {
        shouldSend: true,
        channels: ['email'],
        recipients: ['billing', 'passenger'],
        conditions: ['include_price', 'different_email']
      };
    case 'reservation_updated':
      return {
        shouldSend: false, // Default to not sending on updates
        channels: ['email'],
        recipients: ['billing'],
        conditions: []
      };
    default:
      return {
        shouldSend: false,
        channels: ['email'],
        recipients: ['billing'],
        conditions: []
      };
  }
}

// Get company logo from settings
function getCompanyLogo() {
  try {
    // Try logo management settings first
    const logoSettings = localStorage.getItem('logoManagementSettings');
    if (logoSettings) {
      const settings = JSON.parse(logoSettings);
      return settings.allPortals || settings.email || settings.customer || '';
    }
    
    // Fallback to company logo
    const companyLogo = localStorage.getItem('companyLogo');
    if (companyLogo) {
      const logo = JSON.parse(companyLogo);
      return logo.data || logo.url || '';
    }
    
    // Default Supabase logo
    const supabaseUrl = window.ENV?.SUPABASE_URL || '';
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/images/relialimo-logo-main.png`;
    }
    
    return '';
  } catch (e) {
    console.warn('Failed to get company logo:', e);
    return '';
  }
}

// Get company info from settings
function getCompanyInfo() {
  try {
    const info = localStorage.getItem('relia_company_info');
    if (info) return JSON.parse(info);
    
    const settings = localStorage.getItem('relia_company_settings');
    if (settings) return JSON.parse(settings);
    
    return { name: 'Relia Limo', phone: '', email: '', website: '' };
  } catch (e) {
    return { name: 'Relia Limo', phone: '', email: '', website: '' };
  }
}

// Default Email Templates
const DEFAULT_EMAIL_TEMPLATES = {
  'account-welcome': {
    id: 'account-welcome',
    name: 'Account Welcome Email',
    subject: 'Welcome to #COMP_NAME#!',
    category: 'account',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to #COMP_NAME#</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          
          <!-- Welcome Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); padding: 25px 40px; text-align: center;">
              <h1 style="margin: 0; color: #1a237e; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                🎉 Welcome to the Family!
              </h1>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #333; margin: 0 0 20px 0;">
                Dear <strong>#ACCT_FIRST_NAME#</strong>,
              </p>
              
              <p style="font-size: 16px; color: #555; line-height: 1.8; margin: 0 0 25px 0;">
                Thank you for choosing <strong>#COMP_NAME#</strong> for your transportation needs! We're thrilled to have you as a valued customer.
              </p>
              
              <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 10px; padding: 25px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #1565c0; font-size: 18px;">📋 Your Account Details</h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Account Number:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">#ACCT_NUMBER#</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Name:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">#ACCT_FULL_NAME#</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Email:</td>
                    <td style="padding: 8px 0; color: #333; font-weight: 600; font-size: 14px;">#ACCT_EMAIL#</td>
                  </tr>
                </table>
              </div>
              
              <h3 style="color: #1565c0; margin: 30px 0 15px 0; font-size: 18px;">✨ What We Offer</h3>
              <ul style="color: #555; line-height: 2; font-size: 15px; padding-left: 20px;">
                <li>🚗 Professional, licensed chauffeurs</li>
                <li>🌟 Premium fleet of luxury vehicles</li>
                <li>⏰ Punctual and reliable service, 24/7</li>
                <li>📱 Easy online booking and real-time updates</li>
                <li>💼 Corporate accounts and special rates</li>
              </ul>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="#BOOKING_LINK#" style="display: inline-block; background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%); color: #1a237e; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(255, 193, 7, 0.4);">
                  📅 Book Your First Ride
                </a>
              </div>
              
              <p style="font-size: 15px; color: #555; line-height: 1.8; margin: 25px 0 0 0;">
                If you have any questions, our team is here to help. Simply reply to this email or give us a call!
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #263238; padding: 30px 40px; border-radius: 0 0 12px 12px;">
              <table width="100%">
                <tr>
                  <td style="color: #90a4ae; font-size: 14px; line-height: 1.8;">
                    <p style="margin: 0 0 10px 0;"><strong style="color: #ffffff;">#COMP_NAME#</strong></p>
                    <p style="margin: 0;">📞 #COMP_PHONE#</p>
                    <p style="margin: 0;">✉️ #COMP_EMAIL#</p>
                    <p style="margin: 0;">🌐 #COMP_WEBSITE#</p>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <p style="color: #90a4ae; font-size: 12px; margin: 0;">
                      Your journey, our priority.<br>
                      © #CURRENT_YEAR# #COMP_NAME#
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  
  'reservation-confirmation-billing': {
    id: 'reservation-confirmation-billing',
    name: 'Reservation Confirmation (Billing - With Price)',
    subject: 'Confirmation #TRIP_CONFNUM# - Your Reservation Details',
    category: 'reservation',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          
          <!-- Confirmation Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ✅ Reservation Confirmed
              </h1>
              <p style="margin: 10px 0 0 0; color: #c8e6c9; font-size: 16px;">
                Confirmation #: <strong style="color: #ffffff;">#TRIP_CONFNUM#</strong>
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="font-size: 17px; color: #333; margin: 0 0 25px 0;">
                Dear <strong>#TRIP_PAX_NAME#</strong>,
              </p>
              
              <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 30px 0;">
                Thank you for booking with <strong>#COMP_NAME#</strong>! Please review your reservation details below for accuracy.
              </p>
              
              <!-- Trip Details Box -->
              <div style="background: #f8f9fa; border-left: 4px solid #1976d2; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 20px 0; color: #1976d2; font-size: 18px;">🚗 Trip Details</h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; width: 140px; vertical-align: top;">📅 Date:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_DATE#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">⏰ Pickup Time:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_TIME#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">📍 Pickup:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_PICKUP#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">🎯 Drop-off:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_DROPOFF#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">🚘 Vehicle:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_VEHICLE_TYPE#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">👥 Passengers:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_PAX_COUNT#</td>
                  </tr>
                </table>
              </div>
              
              <!-- Pricing Box (BILLING ONLY) -->
              <div style="background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 15px 0; color: #f57c00; font-size: 18px;">💰 Pricing Summary</h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Base Fare:</td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">#TRIP_RATES_BASE_TOTAL#</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Gratuity:</td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">#TRIP_RATES_GRATUITIES_TOTAL#</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #666; font-size: 14px;">Taxes & Fees:</td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">#TRIP_RATES_TAXES_TOTAL#</td>
                  </tr>
                  <tr style="border-top: 2px solid #f57c00;">
                    <td style="padding: 15px 0 8px 0; color: #333; font-size: 16px; font-weight: 700;">TOTAL:</td>
                    <td style="padding: 15px 0 8px 0; color: #e65100; font-size: 20px; font-weight: 700; text-align: right;">#TRIP_RATES_TOTAL#</td>
                  </tr>
                </table>
              </div>
              
              <!-- Action Box -->
              <div style="background: #e8f5e9; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 15px 0; color: #2e7d32; font-size: 15px; font-weight: 600;">
                  📋 Please verify all details are correct
                </p>
                <p style="margin: 0; color: #555; font-size: 14px;">
                  If any changes are needed, contact us immediately at <strong>#COMP_PHONE#</strong>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #263238; padding: 25px 40px; border-radius: 0 0 12px 12px;">
              <table width="100%">
                <tr>
                  <td style="color: #90a4ae; font-size: 13px;">
                    <strong style="color: #ffffff;">#COMP_NAME#</strong><br>
                    📞 #COMP_PHONE# | ✉️ #COMP_EMAIL#
                  </td>
                  <td style="text-align: right; color: #90a4ae; font-size: 12px;">
                    © #CURRENT_YEAR# #COMP_NAME#
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  },
  
  'reservation-confirmation-passenger': {
    id: 'reservation-confirmation-passenger',
    name: 'Reservation Confirmation (Passenger - No Price)',
    subject: 'Confirmation #TRIP_CONFNUM# - Your Upcoming Trip',
    category: 'reservation',
    isSystem: true,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <img src="#COMP_LOGO#" alt="#COMP_NAME#" style="max-height: 80px; max-width: 280px; width: auto;">
            </td>
          </tr>
          
          <!-- Confirmation Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%); padding: 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ✅ Your Trip is Confirmed!
              </h1>
              <p style="margin: 10px 0 0 0; color: #c8e6c9; font-size: 16px;">
                Confirmation #: <strong style="color: #ffffff;">#TRIP_CONFNUM#</strong>
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <p style="font-size: 17px; color: #333; margin: 0 0 25px 0;">
                Dear <strong>#TRIP_PAX_NAME#</strong>,
              </p>
              
              <p style="font-size: 15px; color: #555; line-height: 1.7; margin: 0 0 30px 0;">
                Your reservation with <strong>#COMP_NAME#</strong> is confirmed! Please review your trip details below.
              </p>
              
              <!-- Trip Details Box -->
              <div style="background: #f8f9fa; border-left: 4px solid #1976d2; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
                <h3 style="margin: 0 0 20px 0; color: #1976d2; font-size: 18px;">🚗 Your Trip Details</h3>
                <table style="width: 100%;">
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; width: 140px; vertical-align: top;">📅 Date:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_DATE#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">⏰ Pickup Time:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_TIME#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">📍 Pickup Location:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_PICKUP#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">🎯 Destination:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_DROPOFF#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">🚘 Vehicle Type:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_VEHICLE_TYPE#</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #666; font-size: 14px; vertical-align: top;">👥 Passengers:</td>
                    <td style="padding: 10px 0; color: #333; font-weight: 600; font-size: 14px;">#TRIP_PAX_COUNT#</td>
                  </tr>
                </table>
              </div>
              
              <!-- Important Info -->
              <div style="background: #e3f2fd; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <h4 style="margin: 0 0 10px 0; color: #1565c0; font-size: 15px;">📌 Important Reminders</h4>
                <ul style="margin: 0; padding-left: 20px; color: #555; font-size: 14px; line-height: 1.8;">
                  <li>Please be ready 5-10 minutes before pickup time</li>
                  <li>Your driver will contact you when arriving</li>
                  <li>Look for a #TRIP_VEHICLE_TYPE#</li>
                </ul>
              </div>
              
              <!-- Contact Box -->
              <div style="background: #fff3e0; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 10px 0; color: #e65100; font-size: 15px; font-weight: 600;">
                  Need to make changes?
                </p>
                <p style="margin: 0; color: #555; font-size: 14px;">
                  Contact us at <strong>#COMP_PHONE#</strong><br>
                  Reference: <strong>#TRIP_CONFNUM#</strong>
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #263238; padding: 25px 40px; border-radius: 0 0 12px 12px;">
              <table width="100%">
                <tr>
                  <td style="color: #90a4ae; font-size: 13px;">
                    <strong style="color: #ffffff;">#COMP_NAME#</strong><br>
                    📞 #COMP_PHONE# | ✉️ #COMP_EMAIL#
                  </td>
                  <td style="text-align: right; color: #90a4ae; font-size: 12px;">
                    © #CURRENT_YEAR# #COMP_NAME#
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  }
};

// Default SMS Templates
const DEFAULT_SMS_TEMPLATES = {
  'account-welcome': {
    id: 'account-welcome',
    name: 'Account Welcome SMS',
    category: 'account',
    isSystem: true,
    message: `🎉 Welcome to #COMP_NAME#, #ACCT_FIRST_NAME#! Your account (#ACCT_NUMBER#) is ready. We look forward to serving you. Questions? Call #COMP_PHONE#`
  },
  
  'reservation-confirmation': {
    id: 'reservation-confirmation',
    name: 'Reservation Confirmation SMS',
    category: 'reservation',
    isSystem: true,
    message: `✅ #COMP_NAME# Confirmation ##TRIP_CONFNUM#
📅 #TRIP_DATE# at #TRIP_TIME#
📍 Pickup: #TRIP_PICKUP#
🎯 To: #TRIP_DROPOFF#
Questions? #COMP_PHONE#`
  }
};

// Load templates from localStorage or use defaults
function loadEmailTemplates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (stored) {
      const templates = JSON.parse(stored);
      // Merge with defaults to ensure system templates exist
      return { ...DEFAULT_EMAIL_TEMPLATES, ...templates };
    }
  } catch (e) {
    console.warn('Failed to load email templates:', e);
  }
  return DEFAULT_EMAIL_TEMPLATES;
}

function loadSmsTemplates() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_SMS_TEMPLATES);
    if (stored) {
      const templates = JSON.parse(stored);
      return { ...DEFAULT_SMS_TEMPLATES, ...templates };
    }
  } catch (e) {
    console.warn('Failed to load SMS templates:', e);
  }
  return DEFAULT_SMS_TEMPLATES;
}

function saveEmailTemplates(templates) {
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
}

function saveSmsTemplates(templates) {
  localStorage.setItem(STORAGE_KEY_SMS_TEMPLATES, JSON.stringify(templates));
}

// Replace template tags with actual values
function replaceTemplateTags(content, data) {
  if (!content) return '';
  
  let result = content;
  const companyInfo = getCompanyInfo();
  const logo = getCompanyLogo();
  
  // Company tags
  result = result.replace(/#COMP_NAME#/g, companyInfo.name || data.companyName || 'Relia Limo');
  result = result.replace(/#COMP_PHONE#/g, companyInfo.phone || companyInfo.office_phone || data.companyPhone || '');
  result = result.replace(/#COMP_EMAIL#/g, companyInfo.email || data.companyEmail || '');
  result = result.replace(/#COMP_WEBSITE#/g, companyInfo.website || companyInfo.web_url || window.location.origin || '');
  result = result.replace(/#COMP_LOGO#/g, logo || '');
  result = result.replace(/#CURRENT_YEAR#/g, new Date().getFullYear().toString());
  result = result.replace(/#BOOKING_LINK#/g, data.bookingLink || `${window.location.origin}/reservation-form.html`);
  
  // Account tags
  result = result.replace(/#ACCT_NUMBER#/g, data.accountNumber || '');
  result = result.replace(/#ACCT_FIRST_NAME#/g, data.firstName || '');
  result = result.replace(/#ACCT_LAST_NAME#/g, data.lastName || '');
  result = result.replace(/#ACCT_FULL_NAME#/g, `${data.firstName || ''} ${data.lastName || ''}`.trim() || '');
  result = result.replace(/#ACCT_EMAIL#/g, data.email || '');
  result = result.replace(/#ACCT_PHONE#/g, data.phone || data.cellPhone || '');
  result = result.replace(/#ACCT_COMPANY#/g, data.companyName || '');
  
  // Trip tags
  result = result.replace(/#TRIP_CONFNUM#/g, data.confirmationNumber || '');
  result = result.replace(/#TRIP_PAX_NAME#/g, data.passengerName || '');
  result = result.replace(/#TRIP_DATE#/g, data.tripDate || '');
  result = result.replace(/#TRIP_TIME#/g, data.tripTime || '');
  result = result.replace(/#TRIP_PICKUP#/g, data.pickup || '');
  result = result.replace(/#TRIP_DROPOFF#/g, data.dropoff || '');
  result = result.replace(/#TRIP_VEHICLE_TYPE#/g, data.vehicleType || '');
  result = result.replace(/#TRIP_PAX_COUNT#/g, data.passengerCount?.toString() || '1');
  
  // Rate tags (only for billing emails)
  result = result.replace(/#TRIP_RATES_TOTAL#/g, data.total || '$0.00');
  result = result.replace(/#TRIP_RATES_BASE_TOTAL#/g, data.baseFare || '$0.00');
  result = result.replace(/#TRIP_RATES_GRATUITIES_TOTAL#/g, data.gratuity || '$0.00');
  result = result.replace(/#TRIP_RATES_TAXES_TOTAL#/g, data.taxes || '$0.00');
  result = result.replace(/#TRIP_RATES_TOTALDUE#/g, data.totalDue || data.total || '$0.00');
  
  return result;
}

// Send email via API
async function sendEmail(to, subject, html, text = '') {
  console.log('📧 Sending email to:', to, 'Subject:', subject);
  
  try {
    // Try API endpoint first
    const candidateBases = [
      window.location.origin,
      'http://localhost:3001',
      'http://localhost:3002'
    ];
    
    let response = null;
    for (const base of candidateBases) {
      try {
        response = await fetch(`${base}/api/email-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html, text })
        });
        if (response.ok) break;
      } catch (e) {
        continue;
      }
    }
    
    if (response && response.ok) {
      const result = await response.json();
      console.log('✅ Email sent successfully:', result);
      return { success: true, ...result };
    }
    
    // Fallback: Queue for later
    console.log('⏳ Email API not available, queuing for later');
    const pendingEmails = JSON.parse(localStorage.getItem('pendingEmails') || '[]');
    pendingEmails.push({
      id: crypto.randomUUID(),
      to,
      subject,
      html,
      text,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    localStorage.setItem('pendingEmails', JSON.stringify(pendingEmails));
    
    return { success: true, queued: true, message: 'Email queued for sending' };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

// Send SMS via configured provider
async function sendSms(to, message) {
  console.log('📱 Sending SMS to:', to);
  
  try {
    // Get SMS provider config
    const providers = JSON.parse(localStorage.getItem('smsProviders') || '[]');
    const defaultProvider = providers.find(p => p.isDefault) || providers[0];
    
    if (!defaultProvider || !defaultProvider.accountSid) {
      console.warn('⚠️ No SMS provider configured');
      return { success: false, error: 'No SMS provider configured' };
    }
    
    // Try API endpoint
    const response = await fetch('/api/sms-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        body: message,
        provider: defaultProvider
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ SMS sent successfully:', result);
      return { success: true, ...result };
    }
    
    // Fallback: Queue for later
    const pendingSms = JSON.parse(localStorage.getItem('pendingSms') || '[]');
    pendingSms.push({
      id: crypto.randomUUID(),
      to,
      message,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    localStorage.setItem('pendingSms', JSON.stringify(pendingSms));
    
    return { success: true, queued: true, message: 'SMS queued for sending' };
  } catch (error) {
    console.error('❌ Failed to send SMS:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Send welcome email and SMS when a new account is created
 */
async function sendAccountWelcome(account) {
  console.log('🎉 Sending welcome notifications for new account:', account.account_number);
  
  const templates = loadEmailTemplates();
  const smsTemplates = loadSmsTemplates();
  
  const data = {
    accountNumber: account.account_number,
    firstName: account.first_name,
    lastName: account.last_name,
    email: account.email,
    phone: account.cell_phone || account.office_phone || account.home_phone,
    companyName: account.company_name
  };
  
  const results = {
    email: null,
    sms: null,
    skipped: []
  };
  
  // Check send rules for account-welcome template
  const welcomeRules = checkTemplateSendRules('account-welcome', 'new_account');
  
  if (!welcomeRules.shouldSend) {
    console.log('📧 Account welcome notifications disabled by send rules');
    results.skipped.push('account-welcome (disabled by rules)');
    return results;
  }
  
  const channels = welcomeRules.channels || ['email', 'sms'];
  
  // Send welcome email if enabled
  if (account.email && channels.includes('email')) {
    const emailTemplate = templates['account-welcome'];
    if (emailTemplate) {
      const subject = replaceTemplateTags(emailTemplate.subject, data);
      const html = replaceTemplateTags(emailTemplate.html, data);
      results.email = await sendEmail(account.email, subject, html);
    }
  } else if (!channels.includes('email')) {
    results.skipped.push('email (disabled in send rules)');
  }
  
  // Send welcome SMS if enabled
  const phoneNumber = account.cell_phone || account.office_phone;
  if (phoneNumber && channels.includes('sms')) {
    const smsTemplate = smsTemplates['account-welcome'];
    if (smsTemplate) {
      const message = replaceTemplateTags(smsTemplate.message, data);
      results.sms = await sendSms(phoneNumber, message);
    }
  } else if (!channels.includes('sms')) {
    results.skipped.push('sms (disabled in send rules)');
  }
  
  console.log('📬 Welcome notifications sent:', results);
  return results;
}

/**
 * Send reservation confirmation emails
 * - Billing email: includes pricing
 * - Passenger email (if different): excludes pricing
 */
async function sendReservationConfirmation(reservation, account = null) {
  console.log('📧 Sending reservation confirmation for:', reservation.confirmation_number);
  
  const templates = loadEmailTemplates();
  const smsTemplates = loadSmsTemplates();
  
  // Check send rules for confirmation templates
  const billingRules = checkTemplateSendRules('reservation-confirmation-billing', 'new_reservation');
  const passengerRules = checkTemplateSendRules('reservation-confirmation-passenger', 'new_reservation');
  
  if (!billingRules.shouldSend && !passengerRules.shouldSend) {
    console.log('📧 Reservation confirmation notifications disabled by send rules');
    return { skipped: true, reason: 'disabled by send rules' };
  }
  
  // Parse pickup datetime
  let tripDate = '';
  let tripTime = '';
  if (reservation.pickup_datetime) {
    const dt = new Date(reservation.pickup_datetime);
    tripDate = dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    tripTime = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  
  // Format currency values
  const formatCurrency = (val) => {
    if (!val) return '$0.00';
    const num = parseFloat(val);
    return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
  };
  
  const data = {
    confirmationNumber: reservation.confirmation_number,
    passengerName: reservation.passenger_name || `${reservation.first_name || ''} ${reservation.last_name || ''}`.trim(),
    tripDate: tripDate,
    tripTime: tripTime,
    pickup: reservation.pickup_address || reservation.pickup || '',
    dropoff: reservation.dropoff_address || reservation.dropoff || '',
    vehicleType: reservation.vehicle_type || '',
    passengerCount: reservation.passenger_count || 1,
    total: formatCurrency(reservation.grand_total),
    baseFare: formatCurrency(reservation.base_fare),
    gratuity: formatCurrency(reservation.gratuity),
    taxes: formatCurrency(reservation.taxes),
    totalDue: formatCurrency(reservation.total_due || reservation.grand_total)
  };
  
  // Get email addresses
  const billingEmail = account?.email || reservation.billing_email || reservation.account_email || '';
  const passengerEmail = reservation.passenger_email || '';
  
  const results = {
    billingEmail: null,
    passengerEmail: null,
    sms: null,
    skipped: []
  };
  
  // Check recipients from rules
  const billingRecipients = billingRules.recipients || ['billing'];
  const passengerRecipients = passengerRules.recipients || ['passenger'];
  const billingChannels = billingRules.channels || ['email'];
  const passengerChannels = passengerRules.channels || ['email'];
  
  // Send billing confirmation (with price) if enabled
  if (billingEmail && billingRules.shouldSend && billingRecipients.includes('billing') && billingChannels.includes('email')) {
    const template = templates['reservation-confirmation-billing'];
    if (template) {
      const subject = replaceTemplateTags(template.subject, data);
      const html = replaceTemplateTags(template.html, data);
      results.billingEmail = await sendEmail(billingEmail, subject, html);
      console.log('💰 Billing confirmation sent to:', billingEmail);
    }
  } else if (!billingRules.shouldSend) {
    results.skipped.push('billing (disabled by rules)');
  }
  
  // Send passenger confirmation (NO price) if different email and enabled
  const shouldSendToPassenger = passengerRules.shouldSend && 
    passengerRecipients.includes('passenger') && 
    passengerChannels.includes('email');
  const emailsDiffer = passengerEmail && passengerEmail.toLowerCase() !== billingEmail.toLowerCase();
  
  // Check conditions - only send to passenger if emails differ (unless overridden)
  const requireDifferentEmail = passengerRules.conditions?.includes('different_email') !== false;
  
  if (shouldSendToPassenger && (emailsDiffer || !requireDifferentEmail)) {
    const template = templates['reservation-confirmation-passenger'];
    if (template && passengerEmail) {
      const subject = replaceTemplateTags(template.subject, data);
      const html = replaceTemplateTags(template.html, data);
      results.passengerEmail = await sendEmail(passengerEmail, subject, html);
      console.log('🧳 Passenger confirmation (no price) sent to:', passengerEmail);
    }
  } else if (!shouldSendToPassenger) {
    results.skipped.push('passenger (disabled by rules)');
  } else if (!emailsDiffer && requireDifferentEmail) {
    results.skipped.push('passenger (same as billing email)');
  }
  
  // Send SMS confirmation if enabled
  const phoneNumber = reservation.passenger_phone || account?.cell_phone;
  const smsEnabled = (billingChannels.includes('sms') || passengerChannels.includes('sms'));
  
  if (phoneNumber && smsEnabled) {
    const smsTemplate = smsTemplates['reservation-confirmation'];
    if (smsTemplate) {
      const message = replaceTemplateTags(smsTemplate.message, data);
      results.sms = await sendSms(phoneNumber, message);
    }
  } else if (!smsEnabled) {
    results.skipped.push('sms (disabled by rules)');
  }
  
  console.log('📬 Confirmation notifications sent:', results);
  return results;
}

// Expose globally
window.CustomerNotificationService = {
  // Core functions
  sendAccountWelcome,
  sendReservationConfirmation,
  
  // Rule checking
  checkTemplateSendRules,
  getDefaultRulesForEvent,
  
  // Template management
  loadEmailTemplates,
  loadSmsTemplates,
  saveEmailTemplates,
  saveSmsTemplates,
  replaceTemplateTags,
  
  // Utilities
  getCompanyLogo,
  getCompanyInfo,
  sendEmail,
  sendSms,
  
  // Constants
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_SMS_TEMPLATES
};

console.log('✅ CustomerNotificationService loaded');
