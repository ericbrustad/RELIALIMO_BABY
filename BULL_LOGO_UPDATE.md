# RELIAhttps://github.com/user-attachments/assets/d7d111cc-186d-4a88-bac3-7b39c313b25cLIMO™ Red Bull Logo Master Reference

This document is the authoritative guide for using the RELIA LIMO red bull logo across the application. Follow these specifications for every placement to ensure consistency.

## Status
- **Update:** Complete ✅
- **Last Updated:** 2025
- **Scope:** All RELIA LIMO web pages and assets

## Logo Asset
- **Name:** `bull head`
- **URL:** https://github.com/user-attachments/assets/d7d111cc-186d-4a88-bac3-7b39c313b25c
- **Format:** PNG with transparency
- **Size:** 127×127 pixels
- **Style:** Professional red bull head icon with prominent horns and white eye highlights

## Where the Logo Appears
Use the logo in these locations (and any new pages that include the RELIA LIMO brand header):

1. **Main Dashboard** — `/index.html`
2. **Authentication** — `/auth.html`
3. **Calendar** — `/calendar.html`
4. **Reservations Dashboard** — `/index-reservations.html`
5. **Reservations List** — `/reservations-list.html`
6. **Dispatch Grid** — `/dispatch-grid.html`

## HTML Implementation
Use this markup for headings that include the logo:

```html
<h1 class="logo">
  RELIA<img src="https://github.com/user-attachments/assets/d7d111cc-186d-4a88-bac3-7b39c313b25c" alt="RELIA bull" class="logo-bull">LIMO™
</h1>
```

## CSS Styling
Apply these styles globally; page-specific variants override the shared defaults where noted.

```css
/* Default sizing */
.logo-bull {
  height: 16px;
  width: auto;
  vertical-align: middle;
  display: inline-block;
}

/* Auth page variant */
.auth-logo-bull {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

/* Dispatch page variant */
.dispatch-logo .logo-bull {
  width: 30px;
  height: 30px;
}
```

## Responsive Guidance
- **Auth Page:** 36×36px (prominent)
- **Dispatch Page:** 30×30px (medium)
- **Other Pages:** 16px height (compact)

## Performance and Compatibility
- **Format:** WebP delivered via CDN (fast, cached)
- **Transparency:** Supported
- **Compatibility:** Chrome/Edge, Firefox, Safari, and modern mobile browsers

## Accessibility
- Always include `alt="RELIA bull"` for screen readers.

## Change Log
- All bull emoji references replaced with the branded red bull logo image across all scoped pages.
- This document is the master reference for future placements and updates.
