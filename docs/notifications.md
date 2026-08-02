# Android push and biometric setup

## Current behaviour

Vertex is already complete for in-app activity: the laptop writes task completion, failure, and approval-like prompt events to `~/.vertex/activity.json`. The encrypted phone connection fetches those events when the app is open or reconnects. No terminal text is sent to the relay.

## Firebase Cloud Messaging

This requires a Firebase project owned by the Vertex account owner. It cannot be enabled safely from JavaScript alone or by placing a server credential in Vercel.

1. Create or select a Firebase project and register the Nativine-generated Android package.
2. Download `google-services.json` from that Firebase Android app registration and add it only to the private native Android build configuration.
3. Configure the native wrapper to request Android's notification permission on Android 13 or later and to receive FCM messages.
4. Use a trusted server environment, such as a private Cloudflare Worker or Firebase Cloud Function, with Firebase Admin credentials to send a notification to the app registration token. Never embed those credentials in the web app, Git repository, or laptop-agent environment.
5. Send only a task identifier and a short status in push payloads. The app must retrieve the actual activity over the existing encrypted Vertex relay after opening.
6. Configure the native notification tap action to open `https://vertex-cyan-phi.vercel.app/?task=<task-id>` or the equivalent final production URL.

Firebase requires a trusted sender and a registered Android client; its Android documentation covers the client receiver and the Android notification permission. [Firebase Cloud Messaging overview](https://firebase.google.com/docs/cloud-messaging) and [Android setup guide](https://firebase.google.com/docs/cloud-messaging/android/get-started).

## Biometric unlock

Enable a biometric/app-lock option only in the Nativine native wrapper after confirming that its Android bridge exposes Android BiometricPrompt or an equivalent protected native API. The web app must never claim biometric protection when it has only browser storage. Device revocation in Vertex remains the recovery mechanism for a lost phone.
