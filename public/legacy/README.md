# Legacy Files

This folder contains deprecated files that have been replaced by cleaner architecture.

## Why These Files Are Here

Files moved here are kept for reference but are **no longer in use**.

---

## admin.html (Deprecated Jan 2026)

**Reason:** Was a login wrapper that loaded `index.html` in an iframe after authentication.

**Replaced by:** 
- `index.html` is now served directly as the admin shell
- `auth-guard.js` module handles authentication
- `auth.html` provides the login interface when needed

**Old flow:**
```
admin.html (login gate) → authenticates → loads index.html in iframe
```

**New flow:**
```
index.html → auth-guard.js checks session → redirects to auth.html if needed
```

**Features preserved:**
- Splash screen animation (nice to have, but not critical - could be added to auth.html if desired)
- Magic link login (available in auth.html)
- Password reset (available in auth.html)
- Admin organization check (handled by auth-guard.js)

---

## Do Not Delete

These files are kept for:
1. Reference if something breaks
2. Copying specific features (like splash animation) if needed
3. Historical documentation of architecture evolution
