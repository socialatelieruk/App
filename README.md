# Content Planner

A social media content planner for iPhone and Android. Plan posts on a calendar, tag them by platform (Instagram, TikTok, Facebook, LinkedIn, X, YouTube, Pinterest), track their status (Idea → Draft → Scheduled → Posted), and copy captions and hashtags in one tap when it's time to post. Posts are stored on the device.

It's a React web app wrapped as a native app with [Capacitor](https://capacitorjs.com), so one codebase produces both the iOS and Android apps.

- App ID / bundle ID: `uk.socialatelier.planner`
- App name: `Content Planner` (change `appName` in `capacitor.config.ts`, then `npx cap sync`)

## Running it locally

```bash
npm install
npm run dev          # open in the browser at http://localhost:5173
```

After changing the web code, copy it into the native projects:

```bash
npm run build && npx cap sync
npx cap open android   # opens Android Studio
npx cap open ios       # opens Xcode (Mac only)
```

## Builds on GitHub

Every push to `main` runs two GitHub Actions workflows (see the **Actions** tab):

| Workflow | What you get |
| --- | --- |
| **Android build** | `content-planner-debug-apk`: install it directly on an Android phone to test. `content-planner-release-aab`: the file you upload to Google Play (signed once the secrets below are set). |
| **iOS build** | Checks the iOS app compiles. Run it manually with **upload** ticked to send a build to TestFlight / App Store Connect. |

Download the files from the workflow run page under **Artifacts**.

## Publishing to Google Play

1. Create a [Google Play Console](https://play.google.com/console) developer account (one-off $25 fee).
2. Create an upload keystore. Do this once and **back it up**, because you need it for every future update:
   ```bash
   keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -i upload.keystore | pbcopy     # macOS; on Linux: base64 -w0 upload.keystore
   ```
3. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - `ANDROID_KEYSTORE_BASE64`: the base64 text from step 2
   - `ANDROID_KEYSTORE_PASSWORD`: the keystore password
   - `ANDROID_KEY_ALIAS`: `upload`
   - `ANDROID_KEY_PASSWORD`: the key password (same as the keystore password unless you chose another)
4. Re-run **Android build** and download `content-planner-release-aab`.
5. In Play Console: create the app, fill in the store listing, content rating, data safety form (the app collects no data) and privacy policy URL, then upload the `.aab` to **Internal testing** first and promote it to **Production**.

The version code increases automatically with each workflow run. Change the visible version in `android/app/build.gradle` (`versionName`).

## Publishing to the Apple App Store

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In [App Store Connect](https://appstoreconnect.apple.com), create a new app with bundle ID `uk.socialatelier.planner` (register it under Certificates, IDs & Profiles first if prompted).
3. Under **Users and Access → Integrations → App Store Connect API**, create a key with the **Admin** role (needed so the build can create signing certificates). Download the `.p8` file.
4. Add these GitHub secrets:
   - `APPLE_TEAM_ID`: your 10-character Team ID (shown under Membership details)
   - `ASC_KEY_ID`: the key ID
   - `ASC_ISSUER_ID`: the issuer ID shown above the keys list
   - `ASC_KEY_P8`: the full contents of the `.p8` file
5. Go to **Actions → iOS build → Run workflow**, tick **upload**, and run it. The build appears in App Store Connect under TestFlight after processing (about 10–30 minutes).
6. Fill in the App Store listing (screenshots, description, privacy details, privacy policy URL), select the build, and submit it for review.

Change the visible iOS version in Xcode or in `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`).

## App icon and splash screen

The source images are in `assets/`. To change them, replace `assets/icon.svg`, regenerate the PNGs, and run:

```bash
npx capacitor-assets generate --iconBackgroundColor '#b5651d' --splashBackgroundColor '#faf8f5' --splashBackgroundColorDark '#15120f'
```
