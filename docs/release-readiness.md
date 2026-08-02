# Vertex release-readiness check

Checked on 2026-08-02 against the React/Vite application, Linux agent, local relay, and an Android-sized browser viewport.

## Passed

- `npm run build` produces a Vercel-ready static application. Initial JavaScript is about 213 KB, and the terminal renderer is lazy-loaded as a separate 340 KB chunk.
- `npm test` passes 10 test files. Coverage includes terminal output ordering, resize validation, task state, project indexing, device revocation, encrypted relay frames, relay routing, and missing-peer safety.
- Direct flow: token pairing, first project scan, dashboard loading, task creation, terminal attach, terminal output, and an interactive Codex trust prompt all worked in an isolated temporary project.
- Relay flow: QR pairing from the hosted-style web app, encrypted task creation, terminal attach, completed-task output, and reconnect after stopping and restarting the relay/agent all worked without re-pairing.
- Mobile UI: tested at 360 × 800. No confirmed accessibility violations; the dashboard fits without horizontal overflow. The terminal instance remains mounted while output arrives and uses ordered animation-frame flushing.
- Local production-agent measurements: project lookup was about 20 ms and session lookup about 117 ms. Browser local direct rendering measured FCP/LCP around 540 ms. Development-server measurements are intentionally excluded because Vite startup/HMR distorts them.

## Personal-beta readiness

Vertex is ready to deploy for personal use after creating the deployment accounts:

1. Deploy `relay/worker.js` to Cloudflare Workers + Durable Objects.
2. Deploy the result of `npm run build` to Vercel.
3. Start the laptop agent with the relay and Vercel URLs.
4. Convert the Vercel URL with Nativine.

## Still required before a public production launch

- Real-device testing on Android mobile data and different Wi-Fi/NAT environments.
- Cloudflare production monitoring, rate limits, abuse controls, and account/device management.
- Native Nativine build verification, Android signing, biometric bridge, and background-notification integration.
- Firebase push credentials if background task-complete notifications are desired.

These are deployment/product hardening items, not blockers for the current personal-beta terminal workflow.
