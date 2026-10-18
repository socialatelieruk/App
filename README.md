# The Social Atelier

An invite-only collaborations app for iPhone and Android. Influencers sign up, The Social Atelier approves their profile, and approved influencers browse gifted collabs and apply in one tap. The Social Atelier posts the collabs, reviews applicants and accepts or declines them, all from inside the same app.

**Influencers can**
- create an account and submit their profile (Instagram, TikTok, follower count, city, bio) for review
- browse open collabs by type (Booking, Event, Walk-in), category and city
- see what they get and what they need to post, then apply with a short pitch and a preferred date
- track their applications (waiting, accepted, not this time) and withdraw a pending one
- edit their profile and delete their account

**The Social Atelier admins can**
- post, edit, close and delete collabs (brand, offer, deliverables, follower minimum, spots, dates, image)
- see everyone who applied for a collab, with links to their Instagram/TikTok, and accept or decline them
- approve or reject new influencers

Influencers can't apply until they're approved, can't apply below a collab's follower minimum, and can never see each other's details or applications. These rules are enforced in the database, not just in the app.

It's a React app wrapped as a native app with [Capacitor](https://capacitorjs.com). Data and logins are stored in [Supabase](https://supabase.com).

- App ID / bundle ID: `uk.socialatelier.app`
- App name: `The Social Atelier` (change `appName` in `capacitor.config.ts`, then `npx cap sync`)

## Demo mode

Until Supabase is connected, the app runs in **demo mode** with sample collabs and influencers stored on the device. The sign-in screen offers "Try as an influencer" and "Try as The Social Atelier (admin)". Don't submit a demo-mode build to the stores.

## Connecting Supabase (do this first)

1. Create a free account and a new project at [supabase.com](https://supabase.com). Pick a London (eu-west-2) region.
2. Open **SQL Editor → New query**, paste in all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. Under **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. In GitHub, go to **Settings → Secrets and variables → Actions** and add:
   - `SUPABASE_URL`: the Project URL
   - `SUPABASE_ANON_KEY`: the anon public key
5. For running locally, copy `.env.example` to `.env` and fill in the same two values.
6. Under **Authentication → Sign In / Providers → Email**, decide on **Confirm email**. With it on, new users must click a link in their email before they can sign in. Turning it off makes sign-up smoother in the app.
7. Make yourself an admin: sign up in the app with your email, then run this in the SQL Editor:
   ```sql
   update profiles set role = 'admin', status = 'approved', full_name = 'The Social Atelier'
   where email = 'you@example.com';
   ```
   Sign out and back in, and you'll see the admin tabs. Repeat for any team member.

## Notifications and Google Calendar

When you accept an influencer, you pick the confirmed **date, time and length** of their booking. Walk-ins can be accepted with no fixed time. You can change the time later with **Change time**. The influencer is then told:

- **In the app** (works as soon as Supabase is connected): a gold dot on **My collabs**, a "You're in" banner on Explore, and a **New** tag on the accepted collab with its booked time. They also get an **Add to Google Calendar** button that pre-fills the event.
- **On their phone's lock screen** (push notification): "You're in. *Brand* accepted you for *Collab* on *Sat 24 Oct, 13:00*." Tapping it opens My collabs.
- **In their Google Calendar, automatically**, if they've tapped **Connect Google Calendar** in their Profile. The event has the brand, collab, address, the date and time you set, and what they get and post. Changing the time moves the event. Declining them, or deleting the collab, removes it.

Push notifications and Google Calendar need the one-off setup below. Until then the app works normally without them. All keys go in GitHub under **Settings → Secrets and variables → Actions**.

**1. Let GitHub deploy the server functions to Supabase**
- `SUPABASE_PROJECT_REF`: the ID in your Supabase project URL (`https://<this part>.supabase.co`)
- `SUPABASE_ACCESS_TOKEN`: create one at supabase.com → Account → Access Tokens
- `WEBHOOK_SECRET`: any long random password you make up. It stops anyone else triggering notifications or calendar connections.

**2. Android push (Firebase, free)**
1. At [console.firebase.google.com](https://console.firebase.google.com), create a project, then add an **Android app** with package name `uk.socialatelier.app`.
2. Download `google-services.json` and add its full contents as the secret `GOOGLE_SERVICES_JSON`.
3. In Firebase, go to **Project settings → Service accounts → Generate new private key**. Add the downloaded file's full contents as the secret `FIREBASE_SERVICE_ACCOUNT`.

**3. iPhone push (Apple push key)**
1. At [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list), go to **Keys → +**, tick **Apple Push Notifications service (APNs)**, and download the `.p8` file. This is a different key from the App Store Connect one.
2. Add the secrets `APNS_KEY_P8` (the full contents of the `.p8` file) and `APNS_KEY_ID` (the key's ID). `APPLE_TEAM_ID` is already set if you followed the App Store steps.

**4. Google Calendar (Google Cloud, free)**
1. At [console.cloud.google.com](https://console.cloud.google.com), pick your Firebase project (or create one) and enable the **Google Calendar API** under **APIs & Services → Library**.
2. Under **APIs & Services → OAuth consent screen**, set it up as **External**. Use the app name "The Social Atelier", add your logo, support email and privacy policy link, and add the scope `.../auth/calendar.events`.
3. Under **Credentials → Create credentials → OAuth client ID**, choose **Web application**. Add this as an authorised redirect URI: `https://<your project ref>.supabase.co/functions/v1/google-calendar/callback`
4. Add the client ID and secret as the secrets `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. **Before launch, publish the consent screen and submit it for Google's verification.** Calendar access is a "sensitive" permission. While the screen is in **Testing**, only people you add as test users (up to 100) can connect, and their connection lapses after 7 days. Verification is free and usually takes a few days to a few weeks. Google will ask for your privacy policy and a short screen recording of the Connect flow.

**5. Deploy and connect**
1. In GitHub, go to **Actions → Deploy Supabase functions → Run workflow**.
2. In Supabase, go to **Database → Webhooks → Create a new hook**:
   - Table: `applications`. Events: **Update** and **Delete**.
   - Type: **Supabase Edge Functions**, function `on-application-change`, method POST.
   - Add an HTTP header `x-webhook-secret` with the same value as your `WEBHOOK_SECRET`.
3. Re-run the **Android build** and **iOS build** workflows so the apps include push. The app asks influencers for permission to send notifications the first time they open it.

## Running it locally

```bash
npm install
npm run dev          # opens at http://localhost:5173
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
| **Android build** | `social-atelier-debug-apk`: install it directly on an Android phone to test. `social-atelier-release-aab`: the file you upload to Google Play (signed once the secrets below are set). |
| **iOS build** | Checks the iOS app compiles. Run it manually with **upload** ticked to send a build to TestFlight / App Store Connect. |

Download the files from the workflow run page under **Artifacts**.

## Publishing to Google Play

1. Create a [Google Play Console](https://play.google.com/console) developer account (one-off $25 fee).
2. Create an upload keystore. Do this once and **back it up**, because you need it for every future update:
   ```bash
   keytool -genkeypair -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -i upload.keystore | pbcopy     # macOS; on Linux: base64 -w0 upload.keystore
   ```
3. Add these GitHub secrets:
   - `ANDROID_KEYSTORE_BASE64`: the base64 text from step 2
   - `ANDROID_KEYSTORE_PASSWORD`: the keystore password
   - `ANDROID_KEY_ALIAS`: `upload`
   - `ANDROID_KEY_PASSWORD`: the key password (same as the keystore password unless you chose another)
4. Re-run **Android build** and download `social-atelier-release-aab`.
5. In Play Console, create the app and fill in the store listing, content rating, privacy policy URL and data safety form. For the data safety form, declare that the app collects name, email and social handles for account management. Upload the `.aab` to **Internal testing** first, then promote it to **Production**.

The version code increases automatically with each workflow run. Change the visible version in `android/app/build.gradle` (`versionName`).

## Publishing to the Apple App Store

1. Join the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In [App Store Connect](https://appstoreconnect.apple.com), create a new app with bundle ID `uk.socialatelier.app` (register it under Certificates, IDs & Profiles first if prompted).
3. Under **Users and Access → Integrations → App Store Connect API**, create a key with the **Admin** role (needed so the build can create signing certificates). Download the `.p8` file.
4. Add these GitHub secrets:
   - `APPLE_TEAM_ID`: your 10-character Team ID (shown under Membership details)
   - `ASC_KEY_ID`: the key ID
   - `ASC_ISSUER_ID`: the issuer ID shown above the keys list
   - `ASC_KEY_P8`: the full contents of the `.p8` file
5. Go to **Actions → iOS build → Run workflow**, tick **upload**, and run it. The build appears in App Store Connect under TestFlight after processing (about 10–30 minutes).
6. Fill in the App Store listing (screenshots, description, privacy details, privacy policy URL) and select the build. Because sign-up needs approval, add a **demo account** for Apple's reviewer under App Review Information: create an influencer account, approve it, and give Apple the email and password. Then submit it for review.

Change the visible iOS version in Xcode or in `ios/App/App.xcodeproj/project.pbxproj` (`MARKETING_VERSION`).

## App icon and splash screen

The source images are in `assets/`. To change them, replace the PNGs there (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`) and run:

```bash
npx capacitor-assets generate --android --ios --iconBackgroundColor '#b5651d' --splashBackgroundColor '#faf8f5' --splashBackgroundColorDark '#15120f'
```
