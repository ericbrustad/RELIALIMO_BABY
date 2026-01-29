# React Native Driver App - Architecture Plan

## Overview
Rebuild the driver portal as a native mobile app using React Native for iOS and Android.

---

## Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Framework** | React Native + Expo | Fastest development, OTA updates |
| **Navigation** | React Navigation v6 | Industry standard, great UX |
| **State** | Zustand | Simple, fast, works with React |
| **Backend** | Supabase (existing) | Already in use, real-time support |
| **Maps** | react-native-maps + Google Maps SDK | Native performance |
| **Location** | expo-location | Background tracking |
| **Push Notifications** | expo-notifications + FCM/APNs | Reliable delivery |
| **Auth** | Supabase Auth | Already configured |

---

## App Structure

```
/DriverApp
├── /src
│   ├── /screens
│   │   ├── AuthScreen.tsx          # Login/Register
│   │   ├── DashboardScreen.tsx     # Home with map + trip list
│   │   ├── TripDetailScreen.tsx    # Full trip info
│   │   ├── ActiveTripScreen.tsx    # During a trip
│   │   ├── NavigationScreen.tsx    # Turn-by-turn (native maps)
│   │   ├── OffersScreen.tsx        # Trip offers
│   │   ├── ProfileScreen.tsx       # Driver profile
│   │   └── SettingsScreen.tsx      # App settings
│   │
│   ├── /components
│   │   ├── TripCard.tsx
│   │   ├── StatusButton.tsx
│   │   ├── MapView.tsx
│   │   ├── NavigationBar.tsx
│   │   └── OfferOverlay.tsx
│   │
│   ├── /services
│   │   ├── supabase.ts             # Supabase client
│   │   ├── auth.ts                 # Authentication
│   │   ├── trips.ts                # Trip CRUD
│   │   ├── location.ts             # GPS tracking
│   │   ├── notifications.ts        # Push notifications
│   │   └── navigation.ts           # Google Maps / Apple Maps
│   │
│   ├── /store
│   │   ├── useAuthStore.ts
│   │   ├── useTripStore.ts
│   │   └── useLocationStore.ts
│   │
│   ├── /hooks
│   │   ├── useTrips.ts
│   │   ├── useLocation.ts
│   │   └── useRealtime.ts
│   │
│   └── /utils
│       ├── formatters.ts
│       └── constants.ts
│
├── app.json                         # Expo config
├── package.json
└── tsconfig.json
```

---

## Core Features (Phase 1 - MVP)

### 1. Authentication
- [x] Phone OTP login (reuse existing)
- [x] Email/password login
- [x] Remember me / auto-login
- [x] Profile photo upload

### 2. Trip Management
- [x] View offered trips
- [x] Accept/decline offers
- [x] View upcoming trips
- [x] Start trip → status flow
- [x] Status updates: Getting Ready → On The Way → Arrived → Passenger Onboard → Done

### 3. Navigation
- [x] One-tap open Google Maps / Apple Maps / Waze
- [x] In-app route preview (optional)
- [x] Auto-open navigation on status change

### 4. Real-time Updates
- [x] Live trip offers (push + Supabase realtime)
- [x] Status sync across devices
- [x] Dispatch messages

### 5. Location Tracking
- [x] Background GPS tracking
- [x] Auto-status update on geofence (arrived at pickup/dropoff)
- [x] Share location with dispatch

---

## Phase 2 - Enhanced Features

- [ ] Earnings dashboard
- [ ] Trip history with filters
- [ ] Document upload (license, insurance)
- [ ] In-app messaging with dispatch
- [ ] Offline mode with sync
- [ ] Dark/light theme
- [ ] Multiple languages

---

## Development Timeline

| Week | Milestone |
|------|-----------|
| 1 | Project setup, auth screens, Supabase connection |
| 2 | Dashboard, trip list, trip detail screens |
| 3 | Active trip flow, status updates, navigation |
| 4 | Push notifications, background location |
| 5 | Polish, testing, bug fixes |
| 6 | Beta release to TestFlight / Google Play Internal |

**Total: 6 weeks to beta**

---

## App Store Requirements

### Apple (iOS)
- Apple Developer Account: $99/year
- App Review: 1-3 days typically
- Privacy policy required
- Location usage justification

### Google (Android)
- Google Play Developer Account: $25 one-time
- Review: 1-7 days
- Privacy policy required

---

## Key Advantages Over PWA

| Feature | PWA (Current) | React Native |
|---------|---------------|--------------|
| Navigation | External links only | Native Maps SDK |
| Push Notifications | Unreliable | 100% reliable |
| Background Location | Not supported | Full support |
| Offline | Limited | Full support |
| Performance | 60fps on good days | 60fps always |
| App Store | No presence | Professional listing |
| Updates | Instant | Instant (Expo OTA) |

---

## Migration Strategy

1. **Keep PWA running** - Don't break existing drivers
2. **Build React Native app** - In parallel
3. **Beta test** - With 2-3 drivers
4. **Gradual rollout** - Announce new app, keep PWA for 30 days
5. **Full migration** - Retire PWA when all drivers on native

---

## Commands to Start

```bash
# Install Expo CLI
npm install -g expo-cli

# Create new project
npx create-expo-app DriverApp --template expo-template-blank-typescript

# Install core dependencies
cd DriverApp
npx expo install @react-navigation/native @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context
npx expo install @supabase/supabase-js
npx expo install react-native-maps
npx expo install expo-location
npx expo install expo-notifications
npx expo install zustand
```

---

## Questions to Decide

1. **Expo Go vs Custom Dev Build?**
   - Expo Go: Faster iteration, some limitations
   - Custom Build: Full native module access

2. **In-app navigation or always external?**
   - Recommend: External (Google Maps/Waze) for reliability
   - Optional: Show route preview in-app

3. **Branding?**
   - App icon
   - Splash screen
   - Color theme (use existing dark theme?)

---

## Next Steps

1. ✅ Continue fixing PWA issues (current)
2. 📱 Set up React Native project when ready
3. 🔐 Configure Apple/Google developer accounts
4. 🎨 Design app icon and splash screen
5. 🚀 Start building Phase 1

---

*Created: January 28, 2026*
