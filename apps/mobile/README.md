# Inklly mobile app

Expo (React Native) app for Inklly: one app, two modes.

- **I want to print** (customer): find nearby print shops on a map, scan a shop's QR, upload and pay inside the shop portal, and keep a list of your order tracking links.
- **I run a print shop** (merchant): the Inklly Counter and Orders screens in a WebView that keeps you signed in.

The mode is chosen on first launch and can be switched in **Settings**.

> This folder is **not** part of the root npm workspaces. It has its own `package.json` and
> `package-lock.json` so Expo's React/React Native versions never affect the web build.
> Always run npm commands **inside `apps/mobile`**, never `npm install` at the repo root.

- Expo SDK 58, React Native 0.88, Expo Router (file-based routes in `src/app/`)
- Works in **Expo Go**. It only uses modules bundled in Expo Go: `react-native-maps`, `expo-location`, `expo-camera`, `react-native-webview`, `expo-linking`, `expo-haptics`, `@react-native-async-storage/async-storage`.

## Run it on your phone with Expo Go

1. Install **Expo Go** from the Play Store or App Store. It must support SDK 58.
2. From this folder:

   ```bash
   cd apps/mobile
   npm install
   npx expo start          # or: npm start
   ```

3. Scan the QR code shown in the terminal. On Android, scan it from the Expo Go app. On iOS, use the Camera app.
   Your phone and computer must be on the same Wi-Fi. If they can't reach each other, use `npx expo start --tunnel`.

Notes for Expo Go:
- UPI deep links (`upi://pay?...`) open PhonePe, Google Pay, Paytm and other UPI apps from Expo Go too.
- The Android `<queries>` entries, intent filters and icons only apply to real builds (APK/AAB). Expo Go uses its own manifest.

## Build an installable APK (EAS Build)

The APK is built in Expo's cloud, so you don't need Android Studio. This needs a **free Expo account**, which the owner has to create at https://expo.dev/signup.

```bash
cd apps/mobile
npx eas-cli login              # sign in with your Expo account
npx eas-cli init               # first time only: links the project and writes extra.eas.projectId into app.json
npm run build:apk              # = eas build -p android --profile preview
```

When the build finishes, EAS prints a link and a QR code to download the `.apk`. Open it on an Android phone to install. You may need to allow "Install unknown apps".

Profiles in `eas.json`:

| Profile       | Output                | Use                                                                 |
|---------------|-----------------------|---------------------------------------------------------------------|
| `development` | APK with dev client   | Needs `npx expo install expo-dev-client` first. Only for custom native code. |
| `preview`     | **APK**               | Share or sideload for testing (`npm run build:apk`).                |
| `production`  | AAB (app bundle)      | Upload to the Google Play Console (`npm run build:aab`).            |

The first Android build asks EAS to generate a signing keystore. Say yes and EAS stores it for you.

### Google Maps key for real Android builds

Expo Go has its own Google Maps key, so the map works there out of the box. A standalone APK or AAB needs your own key:

1. In Google Cloud Console, enable **Maps SDK for Android** and create an API key. Restrict it to package `in.inklly.app` and your signing SHA-1, which `npx eas-cli credentials` shows.
2. Add it to `app.json` under `expo.android.config.googleMaps.apiKey`, or through the `react-native-maps` config plugin with `androidGoogleMapsApiKey`.

Without a key, the Nearby map renders blank in standalone Android builds. The shop list still works. iOS uses Apple Maps and needs no key.

## Configure the web/API URLs

All URLs are in **`src/config.ts`**:

```ts
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'https://inklly.vercel.app';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://inklly.onrender.com/api/v1';
```

To override them without editing code, set the env vars when you start or build:

```bash
EXPO_PUBLIC_WEB_URL=https://staging.inklly.in \
EXPO_PUBLIC_API_URL=https://staging-api.inklly.in/api/v1 \
npx expo start
```

You can also put them in `apps/mobile/.env.local`, which is git-ignored. For EAS builds, add an `env` block to the profile in `eas.json`. `EXPO_PUBLIC_*` values are inlined into the JS bundle, so never put secrets in them.

## How it works

```
src/
  config.ts                  base URLs + URL helpers (shop code extraction, track URL detection)
  theme.ts                   brand colours (indigo #4F46E5, violet accent), radii, spacing
  app/                       Expo Router routes
    _layout.tsx              root stack + ModeProvider
    index.tsx                gate: onboarding or the remembered mode
    onboarding.tsx           "I want to print" / "I run a print shop"
    (customer)/              bottom tabs: nearby, scan, orders, settings
    (merchant)/              bottom tabs: counter, merchant-orders, merchant-settings
    shop/[code].tsx          shop portal WebView: <WEB_URL>/p/<code>?app=1
    web.tsx                  any Inklly URL in a WebView (tracking links, scanned links)
    p/[shopCode].tsx         deep link https://inklly.vercel.app/p/<code> or inklly://p/<code>
  components/InkWebView.tsx  the shared WebView (link interception, progress, refresh, back, offline)
  lib/api.ts                 GET /portal/shops/nearby (404/empty handled as "no shops yet")
  lib/links.ts               opens upi:, phonepe:, paytmmp:, tez:, gpay:, intent:, tel:, mailto:, whatsapp:
  lib/storage.ts             AsyncStorage: mode + saved tracking links
plugins/withAndroidQueries.js  adds Android 11+ <queries> for UPI apps, tel, mailto, whatsapp
```

- **Payments.** The WebView loads every page with `originWhitelist={['*']}`, so non-http(s) URLs reach `onShouldStartLoadWithRequest`. They are opened with `Linking.openURL`. Android `intent://…#Intent;scheme=upi;…` URLs are converted to `upi://…` first, then the `S.browser_fallback_url` is tried. If nothing can handle the link, the user sees **"No UPI app found"**.
- **App detection.** The WebView user agent ends in `InkllyApp/1.0` and every URL carries `?app=1`, which the web `UpiPaySheet` already checks.
- **My orders.** A small script injected into the WebView reports SPA `pushState`/`replaceState` navigations. Any `/track?...` URL is saved on the phone, newest first, up to 50.
- **Merchant session.** The merchant WebView uses `sharedCookiesEnabled`, `thirdPartyCookiesEnabled` and `domStorageEnabled`, and the web app's localStorage persists, so the owner stays signed in.
- **Uploads.** `<input type="file">` works natively on both platforms (`allowFileAccess` on Android).

### Icons

`assets/icon.svg` is the brand mark (same as the website's `apps/web/public/favicon.svg`). The PNGs in `assets/` were rendered from it with `@resvg/resvg-js`; re-render them from the SVG if the logo changes.

## Checks

```bash
npx tsc --noEmit                    # typecheck
npx expo-doctor                     # dependency/config health
npx expo export --platform android  # proves the JS bundle builds
```
