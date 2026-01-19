/**
 * International Phone Input Component with Flag Emojis
 * Provides country code selection, formatting, and validation
 */

// Country data with flag emojis, dial codes, and phone patterns
const COUNTRIES = [
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', pattern: /^\+1[2-9]\d{2}[2-9]\d{6}$/, format: '+1 (###) ###-####', maxLength: 10 },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', pattern: /^\+1[2-9]\d{2}[2-9]\d{6}$/, format: '+1 (###) ###-####', maxLength: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', pattern: /^\+44\d{10}$/, format: '+44 #### ######', maxLength: 10 },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽', pattern: /^\+52\d{10}$/, format: '+52 ## #### ####', maxLength: 10 },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', pattern: /^\+49\d{10,11}$/, format: '+49 ### #######', maxLength: 11 },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', pattern: /^\+33\d{9}$/, format: '+33 # ## ## ## ##', maxLength: 9 },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', pattern: /^\+39\d{10}$/, format: '+39 ### ### ####', maxLength: 10 },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', pattern: /^\+34\d{9}$/, format: '+34 ### ### ###', maxLength: 9 },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', pattern: /^\+61\d{9}$/, format: '+61 ### ### ###', maxLength: 9 },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', pattern: /^\+81\d{10}$/, format: '+81 ## #### ####', maxLength: 10 },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳', pattern: /^\+86\d{11}$/, format: '+86 ### #### ####', maxLength: 11 },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', pattern: /^\+91\d{10}$/, format: '+91 ##### #####', maxLength: 10 },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', pattern: /^\+55\d{10,11}$/, format: '+55 ## #####-####', maxLength: 11 },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺', pattern: /^\+7\d{10}$/, format: '+7 ### ###-##-##', maxLength: 10 },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷', pattern: /^\+82\d{9,10}$/, format: '+82 ## #### ####', maxLength: 10 },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', pattern: /^\+31\d{9}$/, format: '+31 # ########', maxLength: 9 },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪', pattern: /^\+32\d{8,9}$/, format: '+32 ### ## ## ##', maxLength: 9 },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭', pattern: /^\+41\d{9}$/, format: '+41 ## ### ## ##', maxLength: 9 },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹', pattern: /^\+43\d{10}$/, format: '+43 ### #######', maxLength: 10 },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪', pattern: /^\+46\d{9}$/, format: '+46 ## ### ## ##', maxLength: 9 },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴', pattern: /^\+47\d{8}$/, format: '+47 ### ## ###', maxLength: 8 },
  { code: 'DK', name: 'Denmark', dial: '+45', flag: '🇩🇰', pattern: /^\+45\d{8}$/, format: '+45 ## ## ## ##', maxLength: 8 },
  { code: 'FI', name: 'Finland', dial: '+358', flag: '🇫🇮', pattern: /^\+358\d{9}$/, format: '+358 ## ### ####', maxLength: 9 },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱', pattern: /^\+48\d{9}$/, format: '+48 ### ### ###', maxLength: 9 },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪', pattern: /^\+353\d{9}$/, format: '+353 ## ### ####', maxLength: 9 },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹', pattern: /^\+351\d{9}$/, format: '+351 ### ### ###', maxLength: 9 },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷', pattern: /^\+30\d{10}$/, format: '+30 ### ### ####', maxLength: 10 },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱', pattern: /^\+972\d{9}$/, format: '+972 ## ### ####', maxLength: 9 },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪', pattern: /^\+971\d{9}$/, format: '+971 ## ### ####', maxLength: 9 },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', pattern: /^\+966\d{9}$/, format: '+966 ## ### ####', maxLength: 9 },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', pattern: /^\+65\d{8}$/, format: '+65 #### ####', maxLength: 8 },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰', pattern: /^\+852\d{8}$/, format: '+852 #### ####', maxLength: 8 },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿', pattern: /^\+64\d{9}$/, format: '+64 ## ### ####', maxLength: 9 },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦', pattern: /^\+27\d{9}$/, format: '+27 ## ### ####', maxLength: 9 },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭', pattern: /^\+63\d{10}$/, format: '+63 ### ### ####', maxLength: 10 },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭', pattern: /^\+66\d{9}$/, format: '+66 ## ### ####', maxLength: 9 },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', pattern: /^\+60\d{9,10}$/, format: '+60 ## ### ####', maxLength: 10 },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩', pattern: /^\+62\d{10,12}$/, format: '+62 ### #### ####', maxLength: 12 },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳', pattern: /^\+84\d{9,10}$/, format: '+84 ## ### ####', maxLength: 10 },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷', pattern: /^\+54\d{10}$/, format: '+54 ## ####-####', maxLength: 10 },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱', pattern: /^\+56\d{9}$/, format: '+56 # #### ####', maxLength: 9 },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴', pattern: /^\+57\d{10}$/, format: '+57 ### ### ####', maxLength: 10 },
  { code: 'PE', name: 'Peru', dial: '+51', flag: '🇵🇪', pattern: /^\+51\d{9}$/, format: '+51 ### ### ###', maxLength: 9 },
];

// Get country by code
function getCountryByCode(code) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0];
}

// Get country by dial code
function getCountryByDialCode(dialCode) {
  return COUNTRIES.find(c => c.dial === dialCode) || COUNTRIES[0];
}

// Strip all non-digits from phone number
function stripNonDigits(phone) {
  return phone.replace(/\D/g, '');
}

// Format phone number based on country format
function formatPhoneNumber(phone, countryCode = 'US') {
  const country = getCountryByCode(countryCode);
  const digits = stripNonDigits(phone);
  
  // For US/CA, format as (XXX) XXX-XXXX
  if (countryCode === 'US' || countryCode === 'CA') {
    if (digits.length === 0) return '';
    if (digits.length <= 3) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
  
  // For other countries, use generic formatting
  return digits;
}

// Parse international phone string to get country and number
function parseInternationalPhone(phone) {
  if (!phone) return { country: getCountryByCode('US'), number: '' };
  
  const cleaned = phone.trim();
  
  // Check if starts with +
  if (cleaned.startsWith('+')) {
    // Find matching country by dial code (try longest first)
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const country of sortedCountries) {
      if (cleaned.startsWith(country.dial)) {
        const number = cleaned.slice(country.dial.length).replace(/\D/g, '');
        return { country, number };
      }
    }
  }
  
  // Default to US
  return { country: getCountryByCode('US'), number: stripNonDigits(cleaned) };
}

// Validate phone number
function validatePhone(phone, countryCode = 'US') {
  if (!phone) return { valid: false, error: 'Phone number is required' };
  
  const country = getCountryByCode(countryCode);
  const digits = stripNonDigits(phone);
  
  // Check minimum length
  if (digits.length < 7) {
    return { valid: false, error: 'Phone number is too short' };
  }
  
  // Check maximum length
  if (digits.length > country.maxLength + 3) {
    return { valid: false, error: 'Phone number is too long' };
  }
  
  // For US/CA, validate area code (first digit can't be 0 or 1)
  if ((countryCode === 'US' || countryCode === 'CA') && digits.length >= 3) {
    if (digits[0] === '0' || digits[0] === '1') {
      return { valid: false, error: 'Invalid area code' };
    }
    if (digits.length >= 10 && (digits[3] === '0' || digits[3] === '1')) {
      return { valid: false, error: 'Invalid exchange code' };
    }
  }
  
  // Check against country pattern if we have full number
  const fullNumber = country.dial + digits;
  if (country.pattern && digits.length >= country.maxLength) {
    if (!country.pattern.test(fullNumber)) {
      return { valid: false, error: 'Invalid phone number format' };
    }
  }
  
  return { valid: true, formatted: fullNumber };
}

// Get full international format
function getInternationalFormat(phone, countryCode = 'US') {
  const country = getCountryByCode(countryCode);
  const digits = stripNonDigits(phone);
  return country.dial + digits;
}

// Create phone input HTML
function createPhoneInputHTML(inputId, options = {}) {
  const {
    label = 'Phone',
    required = false,
    defaultCountry = 'US',
    showExt = false,
    extId = null,
    placeholder = 'Enter phone number'
  } = options;
  
  const country = getCountryByCode(defaultCountry);
  const extHtml = showExt ? `
    <label class="ext-label">Ext</label>
    <input type="text" id="${extId || inputId + 'Ext'}" class="ext-input phone-ext-input" maxlength="6" />
  ` : '';
  
  return `
    <div class="phone-input-wrapper" data-input-id="${inputId}">
      <button type="button" class="phone-country-btn" aria-label="Select country" data-country="${defaultCountry}">
        <span class="phone-country-flag">${country.flag}</span>
        <span class="phone-country-code">${country.dial}</span>
        <svg class="phone-dropdown-arrow" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      </button>
      <input 
        type="tel" 
        id="${inputId}" 
        class="phone-number-input" 
        placeholder="${placeholder}"
        inputmode="tel"
        autocomplete="tel"
        ${required ? 'required' : ''}
      />
      ${extHtml}
      <div class="phone-validation-message"></div>
    </div>
    <div class="phone-country-dropdown" data-for="${inputId}" hidden>
      <input type="text" class="phone-country-search" placeholder="Search countries..." />
      <div class="phone-country-list">
        ${COUNTRIES.map(c => `
          <button type="button" class="phone-country-option" data-code="${c.code}" data-dial="${c.dial}">
            <span class="country-flag">${c.flag}</span>
            <span class="country-name">${c.name}</span>
            <span class="country-dial">${c.dial}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// Initialize phone input with event listeners
function initPhoneInput(inputId) {
  const wrapper = document.querySelector(`.phone-input-wrapper[data-input-id="${inputId}"]`);
  if (!wrapper) return;
  
  const countryBtn = wrapper.querySelector('.phone-country-btn');
  const input = wrapper.querySelector('.phone-number-input');
  const validationMsg = wrapper.querySelector('.phone-validation-message');
  const dropdown = document.querySelector(`.phone-country-dropdown[data-for="${inputId}"]`);
  const searchInput = dropdown?.querySelector('.phone-country-search');
  const countryList = dropdown?.querySelector('.phone-country-list');
  
  let currentCountry = countryBtn?.dataset.country || 'US';
  
  // Toggle dropdown
  countryBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
    if (!dropdown.hidden) {
      searchInput?.focus();
      positionDropdown();
    }
  });
  
  // Position dropdown
  function positionDropdown() {
    if (!dropdown) return;
    const rect = wrapper.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.width = `${Math.max(rect.width, 280)}px`;
    dropdown.style.zIndex = '10000';
  }
  
  // Search countries
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    const options = countryList?.querySelectorAll('.phone-country-option');
    options?.forEach(opt => {
      const name = opt.querySelector('.country-name')?.textContent.toLowerCase() || '';
      const dial = opt.dataset.dial || '';
      opt.hidden = !name.includes(query) && !dial.includes(query);
    });
  });
  
  // Select country
  countryList?.addEventListener('click', (e) => {
    const option = e.target.closest('.phone-country-option');
    if (!option) return;
    
    currentCountry = option.dataset.code;
    const country = getCountryByCode(currentCountry);
    
    countryBtn.dataset.country = currentCountry;
    countryBtn.querySelector('.phone-country-flag').textContent = country.flag;
    countryBtn.querySelector('.phone-country-code').textContent = country.dial;
    
    dropdown.hidden = true;
    input.focus();
    formatInput();
  });
  
  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.hidden = true;
    }
  });
  
  // Format input on change
  function formatInput() {
    const formatted = formatPhoneNumber(input.value, currentCountry);
    input.value = formatted;
    validateInput();
  }
  
  // Validate input
  function validateInput() {
    const result = validatePhone(input.value, currentCountry);
    wrapper.classList.toggle('phone-invalid', !result.valid && input.value.length > 0);
    wrapper.classList.toggle('phone-valid', result.valid);
    
    if (validationMsg) {
      validationMsg.textContent = !result.valid && input.value.length > 3 ? result.error : '';
    }
    
    return result;
  }
  
  // Input events
  input?.addEventListener('input', formatInput);
  input?.addEventListener('blur', validateInput);
  
  // Handle paste - try to detect country from pasted number
  input?.addEventListener('paste', (e) => {
    setTimeout(() => {
      const parsed = parseInternationalPhone(input.value);
      if (parsed.country.code !== currentCountry) {
        currentCountry = parsed.country.code;
        countryBtn.dataset.country = currentCountry;
        countryBtn.querySelector('.phone-country-flag').textContent = parsed.country.flag;
        countryBtn.querySelector('.phone-country-code').textContent = parsed.country.dial;
        input.value = parsed.number;
      }
      formatInput();
    }, 0);
  });
  
  // Return API
  return {
    getValue: () => getInternationalFormat(input.value, currentCountry),
    setValue: (phone) => {
      const parsed = parseInternationalPhone(phone);
      currentCountry = parsed.country.code;
      countryBtn.dataset.country = currentCountry;
      countryBtn.querySelector('.phone-country-flag').textContent = parsed.country.flag;
      countryBtn.querySelector('.phone-country-code').textContent = parsed.country.dial;
      input.value = formatPhoneNumber(parsed.number, currentCountry);
    },
    isValid: () => validatePhone(input.value, currentCountry).valid,
    getCountry: () => currentCountry,
    setCountry: (code) => {
      currentCountry = code;
      const country = getCountryByCode(code);
      countryBtn.dataset.country = code;
      countryBtn.querySelector('.phone-country-flag').textContent = country.flag;
      countryBtn.querySelector('.phone-country-code').textContent = country.dial;
      formatInput();
    }
  };
}

// Upgrade existing phone inputs to international format
function upgradePhoneInput(existingInputId, options = {}) {
  const existingInput = document.getElementById(existingInputId);
  if (!existingInput) return null;
  
  const parent = existingInput.parentElement;
  const currentValue = existingInput.value;
  
  // Create wrapper
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = createPhoneInputHTML(existingInputId, options);
  
  // Replace old input structure
  const wrapper = tempDiv.querySelector('.phone-input-wrapper');
  const dropdown = tempDiv.querySelector('.phone-country-dropdown');
  
  // Copy relevant attributes
  const newInput = wrapper.querySelector('.phone-number-input');
  newInput.id = existingInputId;
  newInput.className = existingInput.className + ' phone-number-input';
  if (existingInput.required) newInput.required = true;
  
  // Insert new elements
  existingInput.replaceWith(wrapper);
  document.body.appendChild(dropdown);
  
  // Initialize and set value
  const api = initPhoneInput(existingInputId);
  if (currentValue) {
    api.setValue(currentValue);
  }
  
  return api;
}

// Export functions
window.PhoneInput = {
  COUNTRIES,
  createHTML: createPhoneInputHTML,
  init: initPhoneInput,
  upgrade: upgradePhoneInput,
  validate: validatePhone,
  format: formatPhoneNumber,
  parse: parseInternationalPhone,
  getInternational: getInternationalFormat,
  getCountryByCode,
  getCountryByDialCode
};
