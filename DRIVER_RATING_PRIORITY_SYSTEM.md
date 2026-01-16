# Driver Rating Priority System Documentation

## Overview
The Driver Rating Priority System enables automatic ordering of farmout reservation offers based on driver ratings (1-10 scale) with alphabetical sorting as a tiebreaker. This system is controlled by a toggle switch in the Farmout Automation Settings.

## How It Works

### When Driver Rating Priority is ENABLED:
1. **Primary Sort:** Driver rating (10 → 1, highest to lowest)
2. **Secondary Sort:** Alphabetical by name (A → Z) for drivers with the same rating
3. **Example Order:**
   - Alice Johnson (Rating 10)
   - Bob Smith (Rating 10) [same rating as Alice, sorted alphabetically]
   - Charlie Brown (Rating 9)
   - Diana Ross (Rating 8)
   - Edward King (Rating 7)
   - Frank Wilson (Rating 7) [same rating as Edward, sorted alphabetically]

### When Driver Rating Priority is DISABLED:
1. **Primary Sort:** Alphabetical by name only (A → Z)
2. Driver ratings are completely ignored in the sorting process
3. **Example Order:**
   - Alice Johnson (any rating)
   - Bob Smith (any rating)
   - Charlie Brown (any rating)
   - [continues alphabetically...]

## Configuration

### Location
**Office → System Settings → Farmout Automation → Driver Rating Priority**

### Toggle Control
- **ON:** Enables rating-based priority (10 → 1) with alphabetical fallback
- **OFF:** Disables rating priority, uses alphabetical order only

### Driver Rating Field
- Driver ratings are stored in the `driver_rating` field (1-10 scale)
- Default rating is 5 if no rating is specified
- Can be managed in the driver management system

## Technical Implementation

### Priority Scoring System
When rating priority is enabled:
- Each rating level gets a base score of `rating × 1000`
- Rating 10 = 10,000 points
- Rating 1 = 1,000 points
- Service area matching adds +500 points
- Vehicle type matching adds +300 points
- On-demand availability adds +100 points

### Sorting Algorithm
```javascript
// 1. Primary: Score (includes rating if enabled)
if (b.score !== a.score) return b.score - a.score;

// 2. Secondary: Direct rating comparison (10→1) when enabled
if (ratingPriorityEnabled && b.rating !== a.rating) {
    return b.rating - a.rating;
}

// 3. Tertiary: Alphabetical by name (A→Z)
return nameA.localeCompare(nameB);
```

## Testing

### Test Page
Access `test-driver-rating-priority.html` to:
- Toggle rating priority on/off
- View driver sorting results in real-time
- Run automated verification tests
- See console output with detailed sorting logic

### Test Scenarios
1. **Rating Priority ON:** Verifies rating-based sorting with alphabetical tiebreaker
2. **Rating Priority OFF:** Verifies alphabetical-only sorting

## Benefits

### For Dispatchers
- **Quality Control:** Higher-rated drivers get first opportunity
- **Flexibility:** Can disable rating priority when needed
- **Transparency:** Clear sorting logic and visual feedback

### For Customers
- **Better Service:** Higher-rated drivers handle more trips
- **Reliability:** Consistent driver quality through priority system

### for Drivers
- **Performance Incentive:** Higher ratings lead to more trip opportunities
- **Fair System:** Alphabetical fallback ensures equal opportunity within rating tiers

## Logging and Monitoring

### Automation Logs
- Shows when rating priority is enabled/disabled
- Displays driver selection order with ratings
- Indicates if rating priority affected selection

### Example Log Messages
```
Found 15 eligible drivers. (Rating priority: ENABLED) (On-demand priority)
🏠 Offer sent to Alice Johnson (Rating: 10/10) - +1-555-0123
🏠 Offer sent to Bob Smith (Rating: 10/10) - +1-555-0456
```

When disabled:
```
Found 15 eligible drivers. (Rating priority: OFF)
🏠 Offer sent to Alice Johnson (Rating priority OFF) - +1-555-0123
```

## Maintenance

### Rating Updates
- Driver ratings can be updated through the driver management system
- Changes take effect immediately for new reservations
- No restart required

### Setting Persistence
- Toggle state saved to Supabase (primary) and localStorage (fallback)
- Settings sync across all admin users
- Automatic fallback to localStorage if database unavailable

## Troubleshooting

### Common Issues
1. **Rating priority not working:** Check toggle state in settings
2. **Drivers not sorting correctly:** Verify driver ratings are set (1-10)
3. **Alphabetical sorting issues:** Check driver name field completeness

### Debug Tools
- Use `test-driver-rating-priority.html` for testing
- Check browser console for farmout automation logs
- Verify settings in localStorage under `farmout_settings`

## Future Enhancements
- Rating history and performance tracking
- Dynamic rating adjustments based on customer feedback
- Integration with driver performance metrics
- Advanced filtering options for rating ranges