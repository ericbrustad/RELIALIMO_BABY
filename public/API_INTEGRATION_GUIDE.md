# API Integration Guide - RELIA🐂LIMO™

Complete guide to API functionality for reservations, airports, and address geocoding.

## Overview

The system now includes comprehensive API integration for:
- ✅ Saving reservations to Supabase database
- ✅ Fetching and updating reservations
- ✅ Airport lookup and search
- ✅ Address geocoding and reverse geocoding
- ✅ Distance calculations between locations

## API Functions

### Reservations

#### Create Reservation
```javascript
import { setupAPI, createReservation } from './api-service.js';

await setupAPI();

const reservationData = {
  passenger: {
    firstName: 'John',
    lastName: 'Doe',
    phone: '(555) 123-4567',
    email: 'john@example.com'
  },
  routing: {
    stops: [
      { type: 'pickup', address: '123 Main St, Minneapolis, MN' },
      { type: 'dropoff', address: '456 Oak Ave, St. Paul, MN' }
    ],
    tripNotes: 'VIP client - call on arrival'
  },
  billingAccount: {
    account: 'ACC-001',
    company: 'ABC Corp'
  },
  grandTotal: 150.00
};

const result = await createReservation(reservationData);
console.log('Saved reservation:', result);
```

#### Update Reservation
```javascript
await updateReservation(reservationId, updatedData);
```

#### Fetch All Reservations
```javascript
const reservations = await fetchReservations();
```

#### Get Single Reservation
```javascript
const reservation = await getReservation(reservationId);
```

### Airports

#### Search Airports
```javascript
import { searchAirports } from './api-service.js';

const airports = await searchAirports('Minneapolis');
// Returns: [
//   { code: 'MSP', name: 'Minneapolis-Saint Paul International', city: 'Minneapolis', state: 'MN' }
// ]

const airports = await searchAirports('MSP');
// Returns same results by code
```

**Features:**
- Searches by code (MSP, JFK)
- Searches by city name
- Searches by airport name
- Falls back to built-in airport list if API unavailable
- Returns: 10 major US airports by default

### Address APIs

#### Geocode Address
```javascript
import { geocodeAddress } from './api-service.js';

const results = await geocodeAddress('1600 Pennsylvania Avenue, Washington DC');
// Returns:
// [
//   {
//     name: 'The White House',
//     address: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
//     latitude: 38.8975,
//     longitude: -77.0369,
//     context: {
//       city: 'Washington',
//       state: 'District of Columbia',
//       zipcode: '20500',
//       country: 'United States'
//     }
//   }
// ]
```

#### Reverse Geocode (Coordinates to Address)
```javascript
import { reverseGeocode } from './api-service.js';

const address = await reverseGeocode(38.8975, -77.0369);
// Returns address data for those coordinates
```

#### Calculate Distance
```javascript
import { calculateDistance } from './api-service.js';

const startPoint = { lat: 44.9537, lon: -93.0900 }; // Minneapolis
const endPoint = { lat: 44.9441, lon: -93.0994 };   // St. Paul

const distance = await calculateDistance(startPoint, endPoint);
// Returns:
// {
//   distance_miles: '4.22',
//   distance_km: '6.79',
//   duration_minutes: 12,
//   duration_hours: '0.20'
// }
```

## Integration in Reservation Form

### Automatic Address Lookup
When user enters an address in the form:
1. After 3 characters, triggers address search
2. Shows suggestions from geocoding API
3. User selects one
4. City, state, zip auto-populate

### Airport Selection
1. When "Airport" location type selected
2. Airport dropdown appears
3. Type airline code or city name
4. Select from suggestions
5. Flight number autocomplete activates

### Distance Calculations
Automatically calculated when:
- Multiple stops added to reservation
- Used for cost calculations
- Stored with reservation data

## Save Button Workflow

1. **Click Save** → `saveReservation()` called
2. **Validation** → Check required fields
3. **Collect Data** → All form fields gathered
4. **API Call** → `createReservation(data)` executes
5. **Loading State** → Button shows "⏳ Saving..."
6. **Success** → Button shows "✓ Saved!" (green)
7. **Confirm** → User asked to return to dashboard
8. **Redirect** → Navigate to `/index.html`

## Database Schema

Reservations are saved with:
```sql
pickup_location       (string)
dropoff_location      (string)
passenger_first_name  (string)
passenger_last_name   (string)
passenger_phone       (string)
passenger_email       (string)
billing_account       (string)
booked_by_name        (string)
booked_by_email       (string)
trip_notes            (text)
billing_notes         (text)
dispatch_notes        (text)
total_cost            (decimal)
status                (string - 'pending')
created_at            (timestamp)
updated_at            (timestamp)
```

## External APIs Used

### Nominatim (OpenStreetMap)
- **Purpose:** Address geocoding and reverse geocoding
- **Endpoint:** `https://nominatim.openstreetmap.org`
- **Rate Limit:** 1 request/second
- **Cost:** Free

### OSRM (Open Source Routing Machine)
- **Purpose:** Distance and routing calculations
- **Endpoint:** `https://router.project-osrm.org`
- **Rate Limit:** Unlimited on public instance
- **Cost:** Free

### FlightAPI (Fallback)
- **Purpose:** Airport search (optional)
- **Fallback:** Built-in 10-airport list always available
- **No CORS Issues:** Handled with static fallback

## Error Handling

All API functions include try-catch blocks:

```javascript
try {
  const result = await createReservation(data);
  if (result) {
    // Success - show saved message
  } else {
    // Graceful failure
    alert('Failed to save reservation');
  }
} catch (error) {
  console.error('Error:', error);
  alert(`Error: ${error.message}`);
}
```

## Performance Tips

1. **Geocoding Debounce:** 300ms delay after user stops typing
2. **Address Suggestions:** Limited to 5 results
3. **Airport Search:** Instant with built-in list
4. **Distance Calc:** Only on demand (multiple stops)
5. **Caching:** Session-based for repeated searches

## Testing

### Test Reservation Save
```javascript
// Open browser console on reservation form
const testData = {
  passenger: {
    firstName: 'Test',
    lastName: 'User',
    phone: '555-1234',
    email: 'test@example.com'
  },
  routing: {
    stops: [
      { type: 'pickup', address: '123 Main St' },
      { type: 'dropoff', address: '456 Oak Ave' }
    ]
  },
  grandTotal: 100
};

const { setupAPI, createReservation } = await import('./api-service.js');
await setupAPI();
const result = await createReservation(testData);
console.log(result);
```

### Test Airport Search
```javascript
const { searchAirports } = await import('./api-service.js');
const airports = await searchAirports('New York');
console.log(airports);
```

### Test Address Geocoding
```javascript
const { geocodeAddress } = await import('./api-service.js');
const addresses = await geocodeAddress('Times Square New York');
console.log(addresses);
```

## Troubleshooting

### "Failed to resolve module specifier"
- Make sure no SDK imports (`@supabase/supabase-js`)
- Use relative imports: `import { func } from './api-service.js'`

### Geocoding returns empty array
- Check address spelling and format
- Try broader search (city name only)
- Check browser console for errors

### Distance calculation fails
- Ensure coordinates are valid (lat/lon format)
- Both points must be within reasonable distance
- Check OSRM service status

### Reservation save shows error
- Verify Supabase credentials in `/env.js`
- Check all required fields are filled
- Look at browser console for detailed error

## Future Enhancements

- [ ] Real-time flight status integration
- [ ] Payment processing integration
- [ ] Email confirmation sending
- [ ] SMS notifications
- [ ] Calendar sync
- [ ] Analytics dashboard
- [ ] Invoice generation
- [ ] Driver assignment optimization

---

**Status:** ✅ Fully Integrated  
**Last Updated:** 2025  
**System:** RELIA🐂LIMO™ Management System
