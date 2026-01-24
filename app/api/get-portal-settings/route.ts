import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Get portal settings that are safe for public/customer access
// Uses service role to bypass RLS
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[get-portal-settings] Missing Supabase credentials');
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Fetch specific public settings
    const publicSettingKeys = [
      'default_vehicle_type',
      'default_service_type',
      'auto_farm_enabled',
      'send_confirmation_sms',
      'send_confirmation_email'
    ];

    const { data: settings, error } = await supabase
      .from('portal_settings')
      .select('setting_key, setting_value')
      .in('setting_key', publicSettingKeys);

    if (error) {
      console.error('[get-portal-settings] Database error:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch settings' 
      }, { status: 500 });
    }

    // Convert to object
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { setting_key: string; setting_value: string }) => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    console.log('[get-portal-settings] Returning settings:', Object.keys(settingsMap));

    return NextResponse.json({
      success: true,
      settings: settingsMap
    });

  } catch (err) {
    console.error('[get-portal-settings] Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
