import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials. Set SUPABASE_SERVICE_ROLE_KEY in environment.' },
        { status: 500 }
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // First, get all emails and phones from the accounts table
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('email, phone');

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: accountsError.message }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No accounts found - no auth users to delete' });
    }

    // Build a set of emails and phones from accounts
    const accountEmails = new Set(accounts.map(a => a.email?.toLowerCase()).filter(Boolean));
    const accountPhones = new Set(accounts.map(a => a.phone?.replace(/\D/g, '')).filter(Boolean));

    console.log(`Found ${accountEmails.size} account emails and ${accountPhones.size} account phones`);

    // Get all users from auth.users
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000 // Get up to 1000 users
    });

    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    if (!users || users.users.length === 0) {
      return NextResponse.json({ deleted: 0, message: 'No auth users found' });
    }

    let deleted = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Delete only users that match an account email or phone
    for (const user of users.users) {
      const userEmail = user.email?.toLowerCase();
      const userPhone = user.phone?.replace(/\D/g, '');
      
      // Check if this auth user has a matching account
      const hasMatchingAccount = 
        (userEmail && accountEmails.has(userEmail)) ||
        (userPhone && accountPhones.has(userPhone));
      
      if (!hasMatchingAccount) {
        console.log(`⏭️ Skipping auth user (no matching account): ${user.email || user.phone}`);
        skipped++;
        continue;
      }

      try {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`Failed to delete user ${user.id}:`, deleteError);
          errors.push(`${user.email || user.phone}: ${deleteError.message}`);
        } else {
          deleted++;
          console.log(`✅ Deleted auth user: ${user.email || user.phone}`);
        }
      } catch (e: any) {
        console.error(`Error deleting user ${user.id}:`, e);
        errors.push(`${user.email || user.phone}: ${e.message}`);
      }
    }

    return NextResponse.json({
      deleted,
      skipped,
      total: users.users.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Deleted ${deleted} auth users with matching accounts (skipped ${skipped} admin/system users)`
    });

  } catch (error: any) {
    console.error('Delete all auth users error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
