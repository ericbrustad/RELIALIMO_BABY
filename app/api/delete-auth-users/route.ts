import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://siumiadylwcrkaqsfwkj.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY2MzMxMywiZXhwIjoyMDgxMjM5MzEzfQ.AwUvDEQNb_U04OveQ6Ia9wFgoIatwV6wigdwSQnsOP4';

// Admin organization ID - only members of this org can delete auth users
const ADMIN_ORG_ID = '54eb6ce7-ba97-4198-8566-6ac075828160';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emails, adminToken } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
    }

    if (!adminToken) {
      return NextResponse.json({ error: 'adminToken is required' }, { status: 401 });
    }

    // Verify the caller is an admin by checking organization_members
    const verifyResp = await fetch(
      `${SUPABASE_URL}/rest/v1/organization_members?organization_id=eq.${ADMIN_ORG_ID}&select=user_id,role`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${adminToken}`,
        }
      }
    );

    if (!verifyResp.ok) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 403 });
    }

    const adminMembers = await verifyResp.json();
    if (!adminMembers || adminMembers.length === 0) {
      return NextResponse.json({ error: 'Unauthorized - not an admin' }, { status: 403 });
    }

    // Get user IDs for the given emails from auth.users
    const results: { email: string; deleted: boolean; error?: string }[] = [];

    for (const email of emails) {
      try {
        // First find the user by email using the admin API
        const listResp = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`,
          {
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            }
          }
        );

        if (!listResp.ok) {
          // Try alternative approach - list all and filter
          const allUsersResp = await fetch(
            `${SUPABASE_URL}/auth/v1/admin/users`,
            {
              headers: {
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              }
            }
          );

          if (allUsersResp.ok) {
            const allUsersData = await allUsersResp.json();
            const users = allUsersData.users || allUsersData || [];
            const user = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
            
            if (user) {
              // Delete the user
              const deleteResp = await fetch(
                `${SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'apikey': SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  }
                }
              );

              if (deleteResp.ok) {
                results.push({ email, deleted: true });
              } else {
                const errText = await deleteResp.text();
                results.push({ email, deleted: false, error: `Delete failed: ${errText}` });
              }
            } else {
              results.push({ email, deleted: false, error: 'User not found' });
            }
          } else {
            results.push({ email, deleted: false, error: 'Could not list users' });
          }
          continue;
        }

        const userData = await listResp.json();
        const users = userData.users || userData || [];
        
        if (users.length === 0) {
          results.push({ email, deleted: false, error: 'User not found' });
          continue;
        }

        const userId = users[0].id;

        // Delete the user
        const deleteResp = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
          {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            }
          }
        );

        if (deleteResp.ok) {
          results.push({ email, deleted: true });
        } else {
          const errText = await deleteResp.text();
          results.push({ email, deleted: false, error: `Delete failed: ${errText}` });
        }

      } catch (err) {
        results.push({ email, deleted: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.deleted).length;
    return NextResponse.json({ 
      success: true, 
      deleted: successCount,
      total: emails.length,
      results 
    });

  } catch (error) {
    console.error('Error deleting auth users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
