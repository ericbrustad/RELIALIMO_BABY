# Mapbox Setup Instructions

## Overview

This application uses **Mapbox GL JS** for maps and **Mapbox APIs** for geocoding (address search) and routing (directions).

## What Works Without a Token

- ✅ **Maps display** - Uses OpenStreetMap tiles (free, no token required)
- ✅ **Markers and popups** - Full functionality
- ✅ **Map navigation** - Zoom, pan, rotate

## What Requires a Mapbox Token

- ❌ **Address autocomplete** - When typing addresses in the New Reservation form
- ❌ **Geocoding** - Converting addresses to coordinates
- ❌ **Route calculations** - Distance, duration, and turn-by-turn directions

## How to Get a Free Mapbox Token

1. **Sign up** at [https://www.mapbox.com/](https://www.mapbox.com/)
   - It's free - no credit card required
   - Free tier includes 50,000 geocoding requests per month
   - Free tier includes 100,000 direction requests per month

2. **Get your token**
   - After signing up, go to your Account page
   - Copy your "Default public token"

3. **Add token to the code**
   - Open `MapboxService.js`
   - Find line 6: `this.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';`
   - Replace `'YOUR_MAPBOX_TOKEN_HERE'` with your actual token
   - Example: `this.accessToken = 'pk.eyJ1IjoieW91cnVzZXJuYW1lIiwiYSI6ImNrZ...';`

## Example Token Setup

```javascript
// In MapboxService.js, line 6:
this.accessToken = 'pk.eyJ1IjoibXl1c2VybmFtZSIsImEiOiJja3BhYmNkZWYwMXh5MnVzMXV6aXJsZG1rIn0.abcdefghijklmnopqrstuvwxyz';
```

## Current Status

- **Maps**: ✅ Working (using OpenStreetMap)
- **Geocoding/Routing**: ⚠️ Requires Mapbox token

Once you add your token, the address autocomplete and routing features will work automatically!

## Free Tier Limits

Mapbox's free tier is very generous:
- 50,000 geocoding requests/month
- 100,000 direction requests/month
- Unlimited map loads

For a small to medium limousine service, this should be more than enough.
