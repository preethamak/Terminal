# Android push notifications

Vertex push is now wired end to end, but deliberately disabled until the native Android wrapper and Firebase sender are configured. The Worker—not the browser, Vercel app, or laptop—holds Firebase sender credentials.

## What is sent

For a task that needs attention, completes, or fails, Vertex sends only:

- a short title, such as `AI task needs your input`;
- event type;
- task ID and session name; and
- a deep link back to Vertex.

Terminal output, prompts, source code, paths, and diffs are never in the push body. After tapping, the app reconnects through the existing encrypted relay and fetches the real activity from the laptop.

## One-time Firebase setup

1. In the [Firebase console](https://console.firebase.google.com/), create a project and register the Android package produced by Nativine.
2. Download `google-services.json` and put it in the private Nativine/native Android build configuration. Do not add it to this repository.
3. Create a Firebase service account with Firebase Cloud Messaging permission. Keep its `project_id`, `client_email`, and `private_key` private.
4. Update the Nativine wrapper to request Android notification permission and receive Firebase messages. When it receives a registration token, call this already-exposed web function:

   ```js
   window.vertexRegisterPushToken(firebaseRegistrationToken)
   ```

   Vertex stores that token only in the paired laptop's mode-0600 device file.

## Configure the Cloudflare Worker

From `~/vertex`, set these Worker secrets interactively—never put their values in Git, Vercel, or a command line:

```bash
npx wrangler secret put VERTEX_PUSH_KEY --config relay/wrangler.toml
npx wrangler secret put FCM_PROJECT_ID --config relay/wrangler.toml
npx wrangler secret put FCM_CLIENT_EMAIL --config relay/wrangler.toml
npx wrangler secret put FCM_PRIVATE_KEY --config relay/wrangler.toml
npx wrangler deploy --config relay/wrangler.toml
```

`VERTEX_PUSH_KEY` is a new random secret shared only with the laptop agent. `FCM_PRIVATE_KEY` is the service account private key, including its PEM markers and line breaks.

## Configure the laptop agent

Add these values to the environment used by `vertex-agent.service`:

```ini
VERTEX_PUSH_ENDPOINT=https://vertex-relay.arc-terminal.workers.dev/v1/push
VERTEX_PUSH_KEY=the-same-random-secret
VERTEX_APP_URL=https://vertex-cyan-phi.vercel.app
```

Then restart it:

```bash
systemctl --user restart vertex-agent.service
```

Open Vertex → Account → Setup & test. **Background push** becomes Ready only after the Worker sender is configured and this Android phone has registered its token.

## Native tap behaviour

The Android wrapper should open the `link` carried in the FCM data payload. Vertex supports `?task=<task-id>` and `?session=<session-name>` and opens the associated task/session after pairing.
