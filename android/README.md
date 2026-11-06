# PNG Alert for Android (native Kotlin)

Native Android version of PNG Alert, built like TenderReady: Kotlin, Jetpack Compose, Room, and a GitHub Actions build that produces a debug APK. It lives in the `android/` folder of this repository.

## What this version does (offline-first)

- Shows the feed layout with search, province and category filters, current-only toggle, and every trust label (Community report, Corroborated, Official source, Officially confirmed, Resolved, Stale), plus linked sources.
- Lets you write reports and share links. They are validated with the same rules as the web app (lengths, no phone numbers or emails, safety triage) and **saved on the phone only** (Room database). You can edit and delete them.
- Freshness rules match the web app: reported-at never changes, roads and utilities go stale after 12 hours without reconfirmation, public services after 24, notices are archive unless they have a validity period. Times are shown in PNG time.
- Community rules, privacy and terms screens, and a delete-everything button.

## What it does not do yet

- **No sync and no shared feed.** The app requests no permissions, including internet, so nothing leaves the phone. Reports saved here are not reviewed or published. Sync to a shared server (Supabase) is a later phase and needs its own approval.
- No moderation, confirm/dispute or accounts in the app (those need the shared server).
- No photos, notifications or maps.
- On a fresh install the feed is empty. The **debug build** has Settings > Load demo data, which adds items clearly labelled `[DEMO]` so every label can be seen. Demo data is never real.

## Getting the APK

1. In GitHub open the **Actions** tab, then the latest *Android build and test* run for this branch.
2. Download the artifact `png-alert-android-debug-apk` (a ZIP) and unzip it.
3. Install `app-debug.apk` on an Android phone. You may need to allow installs from your browser or file manager.

Or run the workflow manually: Actions > *Android build and test* > Run workflow.

## Structure

- `app/src/main/java/com/pngalert/app/core`: plain Kotlin rules (freshness, trust labels, validation, safety, URLs, PNG time). Unit tested without Android.
- `.../data`: Room entities, DAOs, repository, demo data. The repository is the seam where sync will plug in later (outbox rows in `SAVED_ON_PHONE` state).
- `.../ui`: Compose screens, navigation, ViewModel.

## Build notes

CI installs Gradle 8.9 with the pinned `gradle/actions/setup-gradle` action instead of using a Gradle wrapper, because the wrapper jar is a binary file. Add a wrapper later if you want `./gradlew` locally.
