import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, email } = await request.json();

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      );
    }

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

    let userIdToDelete = userId;

    // If no userId but have email, find the user by email
    if (!userIdToDelete && email) {
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

      if (listError) {
        console.error('Error listing users:', listError);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }

      const foundUser = users.users.find(u => 
        u.email?.toLowerCase() === email.toLowerCase()
      );

      if (foundUser) {
        userIdToDelete = foundUser.id;
        console.log(`Found user by email ${email}: ${userIdToDelete}`);
      } else {
        console.log(`No auth user found for email: ${email}`);
        return NextResponse.json({ 
          success: true, 
          deleted: false, 
          message: 'No auth user found with that email' 
        });
      }
    }

    // Delete the auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userIdToDelete);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`✅ Deleted auth user: ${userIdToDelete} (${email || 'no email'})`);

    return NextResponse.json({
      success: true,
      deleted: true,
      userId: userIdToDelete,
      email: email || null,
      message: 'Auth user deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete auth user error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
