# Driver Portal Migration Plan

## Overview
Migrate driver portal files to a dedicated `/drivers` folder for deployment to `driver.relialimo.com` subdomain.

## Folder Structure

```
/drivers/                    → driver.relialimo.com
  index.html                 (entry point - redirects to driver-portal.html)
  driver-portal.html
  driver-portal.js
  driver-portal.css
  driver-portal-manifest.json
  driver-portal-sw.js
  driver-portal-offline.html
  driver-trip-status.html/.js/.css
  driver-availability.html/.js/.css
  driver-trip-monitor.html/.js/.css
  driver-active-list.html/.js/.css
  driver-index.html
  driver-field-config.js
  favicon.ico

/shared/                     → Shared dependencies
  api-service.js
  env.js
  sms-service.js
  supabase-db.js
  supabase-client.js
  config.js
```

## Files to Copy

### Driver Portal Core Files
- driver-portal.html
- driver-portal.js
- driver-portal.css
- driver-portal-manifest.json
- driver-portal-sw.js
- driver-portal-offline.html

### Driver Sub-pages
- driver-trip-status.html, .js, .css
- driver-availability.html, .js, .css
- driver-trip-monitor.html, .js, .css
- driver-active-list.html, .js, .css
- driver-index.html
- driver-field-config.js

### Assets
- favicon.ico

### Shared Dependencies
- api-service.js
- env.js
- sms-service.js
- supabase-db.js
- supabase-client.js
- config.js

## Import Path Updates Required

### In drivers/driver-portal.js
```javascript
// Change line ~32:
// FROM: apiService = await import('./api-service.js');
// TO:   apiService = await import('../shared/api-service.js');
```

### In drivers/driver-portal.html
```html
<!-- Change line 22: -->
<!-- FROM: <script src="env.js"></script> -->
<!-- TO:   <script src="../shared/env.js"></script> -->

<!-- Change line 1458: -->
<!-- FROM: <script src="sms-service.js"></script> -->
<!-- TO:   <script src="../shared/sms-service.js"></script> -->
```

## New File: drivers/index.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Driver Portal - RELIALIMO</title>
    <script>
        window.location.replace('driver-portal.html' + window.location.search + window.location.hash);
    </script>
</head>
<body>
    <p>Redirecting to Driver Portal...</p>
    <p><a href="driver-portal.html">Click here if not redirected</a></p>
</body>
</html>
```

## Vercel Configuration (vercel.json update)
```json
{
  "rewrites": [
    {
      "source": "/:path*",
      "has": [{ "type": "host", "value": "driver.relialimo.com" }],
      "destination": "/drivers/:path*"
    }
  ]
}
```

## Testing Checklist
- [ ] Original files still work at root: http://localhost:3001/driver-portal.html
- [ ] New files work at: http://localhost:3001/drivers/driver-portal.html
- [ ] Driver login works in new location
- [ ] Trip status updates work
- [ ] SMS notifications work
- [ ] Service worker registers correctly
- [ ] PWA manifest loads correctly

## Rollback Plan
If anything breaks:
1. Original files remain in root - they still work
2. Delete /drivers folder to revert
3. Delete /shared folder (originals still in root)

## Execution Order
1. Create /shared folder and copy dependencies
2. Create /drivers folder and copy driver files
3. Create drivers/index.html entry point
4. Update import paths in /drivers files
5. Test both locations
6. Update vercel.json for subdomain routing
7. Deploy and test on Vercel
