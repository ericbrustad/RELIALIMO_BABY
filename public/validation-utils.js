/**
 * Phone and Email Validation Utility
 * Shared validation logic for phone and email fields across the application
 * Default country: USA (+1)
 */

// Phone validation regex (supports international formats)
const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
const PHONE_DIGITS_MIN = 10; // Minimum 10 digits for US phone
const DEFAULT_COUNTRY_CODE = '+1'; // USA default

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Format phone number as +1 (XXX) XXX-XXXX (USA default)
 * @param {string} value - Raw phone input
 * @param {string} countryCode - Country code (default: +1 for USA)
 * @returns {string} Formatted phone number
 */
export function formatPhone(value, countryCode = DEFAULT_COUNTRY_CODE) {
  if (!value) return value;
  let digits = value.replace(/\D/g, '');
  
  // If 10 digits, assume USA and add +1
  if (digits.length === 10) {
    return `${countryCode} (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // If 11 digits starting with 1, format as USA
  else if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // If more than 11 digits, likely international - keep as-is with formatting
  else if (digits.length > 11) {
    // Try to detect country code and format accordingly
    if (digits.startsWith('1')) {
      // USA/Canada
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}${digits.length > 11 ? ' ext. ' + digits.slice(11) : ''}`;
    }
    // Other international - just add + and spaces for readability
    return '+' + digits.replace(/(\d{1,3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4').trim();
  }
  return value;
}

/**
 * Validate phone number (international support, USA default)
 * @param {string} value - Phone number to validate
 * @returns {boolean} True if valid or empty
 */
export function isValidPhone(value) {
  if (!value || !value.trim()) return true; // Empty is ok
  const digits = value.replace(/\D/g, '');
  // Accept 10+ digits for valid phone
  return digits.length >= PHONE_DIGITS_MIN && PHONE_REGEX.test(value);
}

/**
 * Validate email address
 * @param {string} value - Email to validate
 * @returns {boolean} True if valid or empty
 */
export function isValidEmail(value) {
  if (!value || !value.trim()) return true; // Empty is ok
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Validate and style a phone field element
 * @param {HTMLElement} el - Input element
 * @returns {boolean} True if valid
 */
export function validatePhoneField(el) {
  if (!el) return true;
  const value = el.value.trim();
  if (!value) {
    el.classList.remove('invalid', 'valid');
    return true;
  }
  
  const isValid = isValidPhone(value);
  el.classList.toggle('invalid', !isValid);
  el.classList.toggle('valid', isValid);
  return isValid;
}

/**
 * Validate and style an email field element
 * @param {HTMLElement} el - Input element
 * @returns {boolean} True if valid
 */
export function validateEmailField(el) {
  if (!el) return true;
  const value = el.value.trim();
  if (!value) {
    el.classList.remove('invalid', 'valid');
    return true;
  }
  
  const isValid = isValidEmail(value);
  el.classList.toggle('invalid', !isValid);
  el.classList.toggle('valid', isValid);
  return isValid;
}

/**
 * Setup validation listeners on phone and email fields
 * @param {string[]} phoneFieldIds - Array of phone field IDs
 * @param {string[]} emailFieldIds - Array of email field IDs
 */
export function setupPhoneEmailValidation(phoneFieldIds = [], emailFieldIds = []) {
  // Setup phone field listeners
  phoneFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.addEventListener('blur', () => {
      // Format on blur
      const formatted = formatPhone(el.value);
      if (formatted !== el.value) {
        el.value = formatted;
      }
      validatePhoneField(el);
    });
    
    el.addEventListener('input', () => {
      validatePhoneField(el);
    });
  });
  
  // Setup email field listeners
  emailFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.addEventListener('blur', () => {
      validateEmailField(el);
    });
    
    el.addEventListener('input', () => {
      validateEmailField(el);
    });
  });
  
  console.log('✅ Phone/email validation setup complete for', phoneFieldIds.length, 'phone fields and', emailFieldIds.length, 'email fields');
}

/**
 * Validate all phone and email fields
 * @param {string[]} phoneFieldIds - Array of phone field IDs
 * @param {string[]} emailFieldIds - Array of email field IDs
 * @returns {boolean} True if all fields are valid
 */
export function validateAllFields(phoneFieldIds = [], emailFieldIds = []) {
  let allValid = true;
  
  phoneFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !validatePhoneField(el)) {
      allValid = false;
    }
  });
  
  emailFieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el && !validateEmailField(el)) {
      allValid = false;
    }
  });
  
  return allValid;
}

// Default export for convenience
export default {
  formatPhone,
  isValidPhone,
  isValidEmail,
  validatePhoneField,
  validateEmailField,
  setupPhoneEmailValidation,
  validateAllFields
};
