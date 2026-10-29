# Export & Push Guide: Journal (Web, iOS & Android)

This repository contains the complete cross-platform codebase for **Journal – Mindful AI Nutrition & Calorie Tracker**, including:
1. **Web / PWA**: React 19, Vite, Tailwind CSS, WebAssembly SQLite local database, and Service Worker offline caching.
2. **iOS Project (`ios/`)**: Native Xcode workspace (`ios/App/App.xcworkspace`), ready for Xcode, iOS Simulator, TestFlight, and Apple App Store deployment.
3. **Android Project (`android/`)**: Native Android Studio Gradle project (`android/app/`), ready for Android Studio, APK generation, and Google Play Store release.

---

## 1. Pushing to your GitHub Account (`ParthibanRajasekaran`)

Follow these simple steps on your terminal to create and push to your repository:

### Step A: Create a New Repository on GitHub
1. Go to [https://github.com/new](https://github.com/new)
2. Enter the Repository name: `journal-nutrition` (or your preferred name)
3. Choose **Public** or **Private** (leave "Initialize with README" unchecked)
4. Click **Create repository**

### Step B: Initialize and Push from Local Directory

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Stage all files (excluding ignored build artifacts)
git add .

# 3. Create your initial commit
git commit -m "Initial commit: Journal PWA + iOS & Android Native Projects"

# 4. Set default branch to main
git branch -M main

# 5. Link your GitHub remote
git remote add origin https://github.com/ParthibanRajasekaran/journal-nutrition.git

# 6. Push to GitHub
git push -u origin main
```

*(If prompted for credentials, use your GitHub Personal Access Token or SSH key).*

---

## 2. Opening & Running Native iOS Project

On macOS with Xcode installed:

```bash
# Sync latest web build to iOS
npm run build
npx cap sync ios

# Open in Xcode
npx cap open ios
```

1. In Xcode, select your development team under **App Target -> Signing & Capabilities**.
2. Select your iPhone or iOS Simulator.
3. Press **Run (⌘R)** to launch!

---

## 3. Opening & Running Native Android Project

With Android Studio installed:

```bash
# Sync latest web build to Android
npm run build
npx cap sync android

# Open in Android Studio
npx cap open android
```

1. Android Studio will automatically index the Gradle files in `android/`.
2. Connect your Android phone (or launch an Android Virtual Device / emulator).
3. Click the green **Play / Run** button!

---

## 4. Progressive Web App (PWA) Direct Installation
Users on any phone can also install Journal immediately without downloading from an App Store:
- **iOS Safari**: Tap **Share** -> **Add to Home Screen**.
- **Android Chrome**: Tap the **Install App** button in the header or browser prompt.
