# RELIA🐂LIMO™ - Authentication Setup Guide

## Overview

Complete authentication system with:
- ✅ Sign-in/Sign-out flows
- ✅ Demo accounts for testing
- ✅ User menu with profile options
- ✅ Protected routes
- ✅ Session management
- ✅ Role-based access (admin, dispatcher, driver)

## Files Created

### Authentication Files
- **`/auth.html`** - Sign-in page
- **`/auth.css`** - Sign-in styling
- **`/auth.js`** - Authentication logic
- **`/auth-guard.js`** - Route protection
- **`/user-menu.js`** - User menu component
- **`/user-menu.css`** - User menu styling

## Setup Instructions

### 1. Update index.html

The main app page (index.html) now includes:
```html
<link rel="stylesheet" href="user-menu.css" />
<script type="module" src="user-menu.js"></script>
<script type="module" src="auth-guard.js"></script>
```

### 2. Add Scripts to Your Main App

Make sure your main app (index.html) includes these scripts at the end of body:

```html
<!-- User Menu (shows logged-in user info) -->
<script type="module" src="user-menu.js"></script>

<!-- Auth Guard (protects pages) -->
<script type="module" src="auth-guard.js"></script>
```

### 3. Create Demo Users (One-time Setup)

Run this in Supabase SQL Editor to create demo accounts:

```sql
-- Insert demo users via Auth if they don't exist
-- You can also sign up through the app's demo buttons

-- Note: Supabase Auth handles user creation
-- Demo credentials are defined in auth.js
```

Or use the **Demo Account Buttons** on auth.html:
- 👨‍💼 Admin
- 📋 Dispatcher  
- 🚗 Driver

## Authentication Flow

### 1. User Arrives at App
```
User visits relialimo.netlify.app
    ↓
auth-guard.js checks for session
    ↓
No session? → Redirect to auth.html
Has session? → Show app, load user menu
```

### 2. Sign In Process
```
User enters email/password or clicks demo button
    ↓
auth.js calls supabase.auth.signInWithPassword()
    ↓
Success? → Store session, show user menu, redirect to app
Error? → Show error message
```

### 3. User Session Active
```
User menu shows their email and role
    ↓
Click menu → See profile, settings, help, sign out
    ↓
Click sign out → Clear session, redirect to auth.html
```

## Using the Demo Accounts

On `auth.html`, click demo buttons to test different roles:

### Admin Account
- **Email**: eric@relialimo.com
- **Password**: Newhouse2025!
- **Role**: admin
- **Access**: Full system access

### Dispatcher Account
- **Email**: dispatcher@relialimo.demo
- **Password**: DemoDispatcher123!
- **Role**: dispatcher
- **Access**: Manage reservations and assignments

### Driver Account
- **Email**: driver@relialimo.demo
- **Password**: DemoDriver123!
- **Role**: driver
- **Access**: View and accept assignments

## API Reference

### auth.js

```javascript
// Get current session
const session = await getSession();

// Get current user
const user = await getCurrentUser();

// Sign out
await signOut();
```

### auth-guard.js

```javascript
// Check if user is authenticated
const isAuth = await AuthGuard.checkAuth();

// Protect current page from unauthenticated users
await AuthGuard.protectPage();

// Listen to auth state changes
AuthGuard.setupAuthListener((event, session) => {
  console.log('Auth changed:', event);
});
```

### user-menu.js

```javascript
// User menu auto-initializes
// Shows logged-in user info and provides sign-out button
```

## Customizing Authentication

### Change Demo Credentials

Edit `/auth.js`:

```javascript
const DEMO_ACCOUNTS = {
  admin: {
    email: 'eric@relialimo.com',
    password: 'Newhouse2025!'
  },
  // ... modify as needed
};
```

### Add More Demo Roles

1. Add to `DEMO_ACCOUNTS` in `auth.js`
2. Add button in `auth.html`:

```html
<button type="button" class="demo-btn" data-role="newrole">
  <span class="demo-icon">🎯</span>
  <span class="demo-text">New Role</span>
</button>
```

### Customize User Menu

Edit `/user-menu.js` to add more menu items:

```javascript
<button class="menu-item" id="newBtn">
  <span class="menu-icon">🎯</span>
  <span>New Feature</span>
</button>
```

Then add event listener:

```javascript
const newBtn = document.getElementById('newBtn');
newBtn?.addEventListener('click', () => {
  console.log('Custom action');
});
```

## Security Best Practices

✅ **Implemented:**
- Session tokens stored in browser memory (not localStorage for sensitive token)
- Protected routes with auth-guard.js
- Sign-out clears all session data
- CORS configured in Supabase
- RLS policies protect database

⚠️ **Remember:**
- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend
- Always validate on backend before sensitive operations
- Implement rate limiting on auth endpoints
- Use HTTPS in production (automatic with Netlify)

## Troubleshooting

### "Invalid login credentials"
- Check email/password are correct
- Verify user exists in Supabase Auth
- Check Supabase Auth email confirmation settings

### "User already signed in but menu doesn't show"
- Make sure `user-menu.js` script is loaded
- Check browser console for errors
- Clear localStorage and reload

### "Demo buttons don't work"
- Demo accounts might not exist yet
- Click a demo button to create the account
- Or manually create in Supabase Auth

### User gets redirected to auth.html
- auth-guard.js detected no active session
- Sign in again or check session storage
- Browser might have cleared cookies

## Testing Checklist

- [ ] Sign in with demo Admin account
- [ ] User menu appears in header
- [ ] Click menu to see profile options
- [ ] Click sign out → redirects to auth.html
- [ ] Try signing in again
- [ ] Test with Dispatcher account
- [ ] Test with Driver account
- [ ] Test with invalid credentials
- [ ] Test on mobile (responsive design)

## Next Steps

1. ✅ Set up authentication page (auth.html)
2. ✅ Create demo accounts
3. ✅ Test sign-in/sign-out flow
4. ✅ Implement role-based features
5. ✅ Add more user menu options
6. ⏭️ Connect to reservation system
7. ⏭️ Implement real-time updates

## Files Checklist

| File | Purpose | Status |
|------|---------|--------|
| auth.html | Sign-in page | ✅ Created |
| auth.css | Sign-in styles | ✅ Created |
| auth.js | Auth logic | ✅ Created |
| auth-guard.js | Route protection | ✅ Created |
| user-menu.js | User menu component | ✅ Created |
| user-menu.css | User menu styles | ✅ Created |
| env.js | Environment vars | ✅ Exists |
| config.js | Config | ✅ Exists |
| supabase-client.js | Supabase client | ✅ Exists |

## Support

For issues:
1. Check browser console for error messages
2. Verify Supabase credentials in env.js
3. Check network tab for failed requests
4. Review Supabase Auth logs in dashboard
5. Ensure RLS policies allow your user role
