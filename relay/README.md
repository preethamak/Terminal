# Vertex relay

This is the future remote transport for Vertex. The laptop agent and phone both make outbound WebSocket connections; the relay does not open ports on the laptop and does not receive terminal plaintext.

Every payload is AES-256-GCM encrypted by the paired phone and laptop. The Durable Object only groups a laptop and its temporarily connected phones by a random machine ID, then forwards opaque frames.

It is deliberately source-only for now. Deploy it only after creating a Cloudflare account:

```bash
npx wrangler deploy --config relay/wrangler.toml
```

Set the resulting `wss://.../v1/connect` URL as `VERTEX_RELAY_URL` when starting the laptop agent. No Firebase is needed for this relay.
