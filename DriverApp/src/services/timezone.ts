/**
 * Timezone Service for Driver App
 * Syncs with organization timezone from Supabase
 */

import { supabase } from '../config/supabase';

const CACHE_KEY = 'organization_timezone';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface TimezoneCache {
  timezone: string;
  expiry: number;
}

// Common US timezones
export const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -5 },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: -6 },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -7 },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)', offset: -7 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -8 },
  { value: 'America/Anchorage', label: 'Alaska Time (AK)', offset: -9 },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)', offset: -10 },
] as const;

let cachedTimezone: string | null = null;
let cacheExpiry: number | null = null;

/**
 * Get the organization's timezone from Supabase
 */
export async function getOrganizationTimezone(): Promise<string> {
  // Check memory cache
  if (cachedTimezone && cacheExpiry && Date.now() < cacheExpiry) {
    return cachedTimezone;
  }

  // Fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('timezone')
      .single();

    if (error) {
      console.error('[TimezoneService] Error fetching timezone:', error);
      return cachedTimezone || 'America/Chicago';
    }

    const timezone = data?.timezone || 'America/Chicago';

    // Update memory cache
    cachedTimezone = timezone;
    cacheExpiry = Date.now() + CACHE_DURATION_MS;

    return timezone;
  } catch (err) {
    console.error('[TimezoneService] Error:', err);
    return cachedTimezone || 'America/Chicago';
  }
}

/**
 * Parse a datetime string as LOCAL time (no timezone conversion)
 * This treats the stored datetime as a literal "wall clock" time
 */
export function parseAsLocalTime(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  if (!dateString) return new Date();

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
 * Format a datetime for storage (without timezone suffix)
 */
export function formatForStorage(date: Date): string {
  if (!date) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * Get timezone display label
 */
export function getTimezoneLabel(timezone: string): string {
  const tz = TIMEZONES.find(t => t.value === timezone);
  return tz ? tz.label : timezone;
}

/**
 * Clear the timezone cache (call when organization settings change)
 */
export function clearTimezoneCache(): void {
  cachedTimezone = null;
  cacheExpiry = null;
}

export default {
  getOrganizationTimezone,
  parseAsLocalTime,
  formatForStorage,
  getTimezoneLabel,
  clearTimezoneCache,
  TIMEZONES
};
