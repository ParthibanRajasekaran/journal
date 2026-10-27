# Journal - Nutrition Tracking App

A cross-platform nutrition tracking application built with React, TypeScript, and Capacitor. Track meals, monitor micronutrients, and achieve your health goals with an intelligent coaching system.

## Features

- 📱 Cross-platform (iOS, Android, Web)
- 🍽️ Meal tracking with AI optimization
- 📊 Nutrition analytics and micronutrient dashboard
- 💪 Protein trend tracking
- 🎯 Adaptive daily goals
- 🔐 Biometric authentication
- 📱 PWA with offline support
- 🎉 Achievement badges and streak counter

## Prerequisites

- **Node.js** (v18+)
- **npm** or **bun**
- **Xcode** (for iOS builds)
- **Android Studio** (for Android builds)

## Setup

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```

## Development

Run the web app locally:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building

### Web Build
```bash
npm run build
npm run preview
```

### iOS Deployment

1. Build the web app:
   ```bash
   npm run build
   ```

2. Sync with Capacitor:
   ```bash
   npx cap sync ios
   ```

3. Open in Xcode:
   ```bash
   npx cap open ios
   ```

4. Select your iPhone device and click the Play button to build and deploy

### Android Deployment

1. Build the web app:
   ```bash
   npm run build
   ```

2. Sync with Capacitor:
   ```bash
   npx cap sync android
   ```

3. Open in Android Studio:
   ```bash
   npx cap open android
   ```

4. Select your emulator or device and click Run

## Project Structure

```
journal/
├── src/
│   ├── components/     # React components
│   ├── data/          # Seed data and meal database
│   ├── db/            # SQLite database management
│   ├── services/      # Authentication and biometric services
│   ├── types/         # TypeScript type definitions
│   └── utils/         # Utility functions
├── ios/               # iOS native project
├── android/           # Android native project
├── public/            # Static assets
└── server.ts          # Express server for local development
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Mobile:** Capacitor 8
- **Database:** SQLite (via sql.js)
- **Animations:** Motion UI
- **Icons:** Lucide React

## License

MIT
