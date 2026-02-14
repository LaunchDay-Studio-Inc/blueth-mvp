# Blueth City — Android Wrapper (Capacitor)

## Overview

This guide describes how to package the Blueth City web app into a native
Android APK using [Capacitor](https://capacitorjs.com/). This is **optional** —
the PWA works well on Android Chrome without a wrapper. The wrapper is for
publishing to the Google Play Store or distributing a standalone APK.

---

## Prerequisites

- **Node.js >= 20** and **pnpm >= 8**
- **Android Studio** (with Android SDK, platform tools, and an emulator or device)
- **Java 17+** (bundled with Android Studio)
- A working build of the web app

> **Codespaces note:** Android SDK is NOT available in GitHub Codespaces.
> These steps must be run on a local machine with Android Studio installed.

---

## 1. Build the Web App

```bash
# From the monorepo root
pnpm install
pnpm run --filter './packages/*' build

# Build the Next.js app for static export
cd apps/web
NEXT_PUBLIC_API_URL=https://your-api-url.com \
  npx next build
```

For a static export (needed for Capacitor), temporarily set `output: 'export'`
in `next.config.js` (the `build-itch.sh` script does this automatically).

Alternatively, use the itch build script which produces a static output:
```bash
NEXT_PUBLIC_API_URL=https://your-api-url.com pnpm build:itch
# Output is in dist-itch/ (unzip game.zip for the static files)
```

---

## 2. Initialize Capacitor

```bash
cd apps/web

# Install Capacitor
pnpm add @capacitor/core @capacitor/cli

# Initialize (when prompted, set web dir to "out" or point to your static build)
npx cap init "Blueth City" "com.bluethcity.app" --web-dir=out
```

This creates `capacitor.config.ts` in `apps/web/`.

If you used the itch build, copy the static files:
```bash
mkdir -p out
unzip ../../dist-itch/game.zip -d out/
```

---

## 3. Add Android Platform

```bash
npx cap add android
```

This creates an `android/` directory with a full Android Studio project.

---

## 4. Configure the App

Edit `capacitor.config.ts` to set the server URL if needed:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bluethcity.app',
  appName: 'Blueth City',
  webDir: 'out',
  server: {
    // For development: load from your dev server instead of bundled assets
    // url: 'http://10.0.2.2:3000',  // Android emulator → host machine
    // cleartext: true,
  },
};

export default config;
```

---

## 5. Sync and Open in Android Studio

```bash
# Copy web assets to the Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete
2. Select a device or emulator
3. Click **Run** (green play button)

---

## 6. Build a Debug APK

From Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Or from the command line:
```bash
cd android
./gradlew assembleDebug
```

The APK will be at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. Build a Release APK (for Play Store)

### Create a Keystore

```bash
keytool -genkey -v -keystore blueth-release.jks \
  -alias blueth -keyalg RSA -keysize 2048 -validity 10000
```

### Build Signed Release

```bash
cd android
./gradlew assembleRelease \
  -Pandroid.injected.signing.store.file=../blueth-release.jks \
  -Pandroid.injected.signing.store.password=YOUR_PASSWORD \
  -Pandroid.injected.signing.key.alias=blueth \
  -Pandroid.injected.signing.key.password=YOUR_PASSWORD
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Update Workflow

When you update the web app:

```bash
# 1. Rebuild the web app
cd apps/web
NEXT_PUBLIC_API_URL=https://your-api-url.com npx next build

# 2. Sync to Android project
npx cap sync android

# 3. Rebuild APK (from Android Studio or CLI)
cd android && ./gradlew assembleDebug
```

---

## App Icons

Capacitor uses the Android resource system for app icons. To customize:

1. Replace `android/app/src/main/res/mipmap-*/ic_launcher.png` with your icons
2. Or use Android Studio → **Image Asset Studio** (right-click `res` → New → Image Asset)

The PWA SVG icons at `public/icons/` are used for the web version only.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| White screen on launch | Web assets not synced | Run `npx cap sync android` |
| API calls fail | Mixed content / CORS | Ensure API URL is HTTPS and CORS allows the app origin |
| "net::ERR_CLEARTEXT_NOT_PERMITTED" | HTTP URL in prod build | Use HTTPS for `NEXT_PUBLIC_API_URL` |
| Emulator can't reach localhost | Wrong IP | Use `10.0.2.2` instead of `localhost` in emulator |
| Gradle sync fails | Wrong Java version | Ensure Java 17+ is installed |
