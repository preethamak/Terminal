const encoder = new TextEncoder();

function base64url(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value); let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function privateKeyBytes(pem) {
  const raw = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""); const binary = atob(raw);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sameSecret(actual, expected) {
  if (!actual || !expected) return false;
  const [actualDigest, expectedDigest] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(actual)), crypto.subtle.digest("SHA-256", encoder.encode(expected))]);
  const a = new Uint8Array(actualDigest); const b = new Uint8Array(expectedDigest); let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index % a.length] || 0) ^ (b[index % b.length] || 0);
  return difference === 0;
}

async function accessToken(env) {
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY) throw new Error("Firebase sender secrets are not configured.");
  const now = Math.floor(Date.now() / 1000); const header = base64url(JSON.stringify({ alg:"RS256", typ:"JWT" })); const payload = base64url(JSON.stringify({ iss:env.FCM_CLIENT_EMAIL, scope:"https://www.googleapis.com/auth/firebase.messaging", aud:"https://oauth2.googleapis.com/token", iat:now, exp:now + 3600 })); const input = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", privateKeyBytes(env.FCM_PRIVATE_KEY), { name:"RSASSA-PKCS1-v1_5", hash:"SHA-256" }, false, ["sign"]); const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(input));
  const response = await fetch("https://oauth2.googleapis.com/token", { method:"POST", headers:{ "content-type":"application/x-www-form-urlencoded" }, body:new URLSearchParams({ grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", assertion:`${input}.${base64url(signature)}` }) });
  if (!response.ok) throw new Error(`Firebase OAuth failed with ${response.status}.`); const body = await response.json(); if (!body.access_token) throw new Error("Firebase OAuth did not return an access token."); return body.access_token;
}

export async function sendPush(request, env) {
  if (!(await sameSecret(request.headers.get("x-vertex-push-key"), env.VERTEX_PUSH_KEY))) return Response.json({ error:"Unauthorized" }, { status:401 });
  const length = Number(request.headers.get("content-length") || 0); if (!length || length > 32768) return Response.json({ error:"Invalid push payload." }, { status:400 });
  let body; try { body = await request.json(); } catch { return Response.json({ error:"Invalid push payload." }, { status:400 }); }
  const tokens = [...new Set(Array.isArray(body.tokens) ? body.tokens.filter((token) => typeof token === "string" && token.length >= 20 && token.length <= 4096) : [])].slice(0, 10);
  if (!tokens.length || !["attention", "completed", "failed"].includes(body.type)) return Response.json({ error:"Invalid push payload." }, { status:400 });
  try {
    const token = await accessToken(env); const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FCM_PROJECT_ID)}/messages:send`; const query = body.taskId ? `task=${encodeURIComponent(body.taskId)}` : `session=${encodeURIComponent(body.session || "")}`; const link = `${String(env.VERTEX_APP_URL || "").replace(/\/$/, "")}/?${query}`;
    const results = await Promise.all(tokens.map(async (deviceToken) => {
      const response = await fetch(url, { method:"POST", headers:{ authorization:`Bearer ${token}`, "content-type":"application/json" }, body:JSON.stringify({ message:{ token:deviceToken, notification:{ title:String(body.title || "Vertex").slice(0, 120), body:"Open Vertex to continue on your laptop." }, data:{ type:body.type, task:String(body.taskId || ""), session:String(body.session || ""), link }, android:{ priority:"high", notification:{ channel_id:"vertex_tasks" } } } }) });
      return { delivered:response.ok, token:deviceToken, invalid:response.status === 404 };
    }));
    return Response.json({ delivered:results.filter((item) => item.delivered).length, invalidTokens:results.filter((item) => item.invalid).map((item) => item.token) });
  } catch (error) { return Response.json({ error:error.message }, { status:503 }); }
}
