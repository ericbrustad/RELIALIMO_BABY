/**
 * Formatters Utility
 * Common formatting functions for the app
 */

/**
 * Parse datetime string as LOCAL time (no timezone conversion)
 * Strips timezone offset to treat the time as wall-clock time
 */
function parseAsLocalTime(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  
  // Strip timezone offset like +00:00 or Z to prevent conversion
  const stripped = dateString.replace(/[+-]\d{2}:\d{2}$/, '').replace(/Z$/, '');
  
  // Parse components manually
  const [datePart, timePart] = stripped.split('T');
  if (datePart && timePart) {
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(n => parseInt(n) || 0);
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }
  if (datePart) {
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Fallback
  return new Date(dateString);
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | Date): string {
  const date = parseAsLocalTime(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time for display
 */
export function formatTime(dateString: string | Date): string {
  const date = parseAsLocalTime(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date and time together
 */
export function formatDateTime(dateString: string | Date): string {
  const date = parseAsLocalTime(dateString);
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Format relative time (e.g., "in 2 hours", "5 minutes ago")
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = parseAsLocalTime(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 1) return 'now';
  
  if (diffMins > 0) {
    if (diffMins < 60) return `in ${diffMins} min`;
    if (diffHours < 24) return `in ${diffHours} hr`;
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else {
    if (Math.abs(diffMins) < 60) return `${Math.abs(diffMins)} min ago`;
    if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)} hr ago`;
    return `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} ago`;
  }
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone;
}

/**
 * Format passenger name
 */
export function formatPassengerName(
  firstName?: string,
  lastName?: string,
  fullName?: string
): string {
  if (fullName) return fullName;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return 'Passenger';
}

/**
 * Format address for single line display
 */
export function formatAddressSingleLine(address: string): string {
  // Remove extra whitespace and newlines
  return address.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format countdown timer (for offer expiry)
 */
export function formatCountdown(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `0:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance in miles
 */
export function formatMiles(meters: number): string {
  const miles = meters / 1609.34;
  if (miles < 0.1) return '< 0.1 mi';
  return `${miles.toFixed(1)} mi`;
}

/**
 * Format duration in hours and minutes
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
