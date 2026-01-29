# ReliaLimo Driver App

React Native mobile app for drivers, built with Expo.

## Project Structure

```
DriverApp/
├── App.tsx                    # App entry point with navigation
├── app.json                   # Expo configuration
├── src/
│   ├── config/
│   │   ├── supabase.ts       # Supabase client with secure storage
│   │   └── theme.ts          # Colors, spacing, typography
│   ├── navigation/
│   │   └── AppNavigator.tsx  # React Navigation stack
│   ├── screens/
│   │   ├── AuthScreen.tsx    # Login screen
│   │   ├── DashboardScreen.tsx # Trip list
│   │   ├── TripDetailScreen.tsx # Trip details
│   │   ├── ActiveTripScreen.tsx # Active trip with status updates
│   │   ├── OffersScreen.tsx  # Pending trip offers
│   │   └── ProfileScreen.tsx # Driver profile
│   ├── store/
│   │   ├── useAuthStore.ts   # Auth state (Zustand)
│   │   ├── useTripStore.ts   # Trip state
│   │   └── useLocationStore.ts # Location tracking
│   └── types/
│       └── index.ts          # TypeScript types
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode (Mac only)
- Android: Android Studio with emulator

### Installation

```bash
cd DriverApp
npm install
```

### Development

```bash
# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Running on Physical Device

1. Install **Expo Go** app on your phone
2. Run `npx expo start`
3. Scan the QR code with Expo Go (Android) or Camera (iOS)

## Features

### Authentication
- Email/password login via Supabase Auth
- Secure token storage with expo-secure-store
- Auto-restore session on app launch

### Dashboard
- View assigned trips for today and upcoming
- Pull-to-refresh
- Trip offer notifications banner

### Trip Management
- View trip details (passenger, route, notes, pay)
- Start trip workflow
- Status progression: Getting Ready → Enroute → Arrived → Waiting → Passenger Onboard → Done
- Navigation integration (Google Maps, Apple Maps, Waze)
- Call/text passenger

### Active Trip
- Large status display with progress indicator
- One-tap navigation to current destination
- Quick contact buttons
- No-show and cancel options

### Trip Offers
- View pending offers with countdown timer
- Accept/decline offers
- See trip details before accepting

### Profile
- View driver info
- Sign out

## Key Dependencies

- **expo** - Development framework
- **@react-navigation/native** - Navigation
- **@supabase/supabase-js** - Database & auth
- **zustand** - State management
- **expo-location** - GPS tracking
- **expo-notifications** - Push notifications (to be implemented)
- **expo-secure-store** - Secure token storage

## Building for Production

### EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### App Store Submission

1. Update `app.json` with your bundle identifier
2. Set up EAS with your Apple/Google credentials
3. Run `eas submit`

## Environment

The app connects to the same Supabase instance as the web portal:
- URL: `https://siumiadylwcrkaqsfwkj.supabase.co`
- Uses the same drivers table and authentication

## Theme

Matches the web portal dark theme:
- Primary: Indigo (#6366f1)
- Background: Dark slate (#0f172a)
- Success/Warning/Error status colors
