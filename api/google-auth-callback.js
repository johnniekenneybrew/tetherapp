import { saveRefreshToken } from "./_google-people.js";
import { setCors } from "./_notion.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { code, error } = req.query;

  if (error) {
    return res.redirect(302, `/?google_auth=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const redirectUri = `https://${req.headers.host}/api/google-auth-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return res.redirect(302, "/?google_auth=error&reason=token_exchange");
    }

    const { refresh_token } = await tokenRes.json();

    if (!refresh_token) {
      return res.redirect(302, "/?google_auth=error&reason=no_refresh_token");
    }

    await saveRefreshToken(refresh_token);

    const alreadySet = !!process.env.GOOGLE_REFRESH_TOKEN;
    if (alreadySet) {
      return res.redirect(302, "/?google_auth=success");
    }

    return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Google Contacts Connected</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 520px; margin: 60px auto; padding: 0 20px; color: #111; }
  h2 { font-size: 20px; margin-bottom: 8px; }
  p  { color: #555; font-size: 14px; line-height: 1.5; margin-bottom: 16px; }
  .token-box { background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px 14px;
               font-family: monospace; font-size: 13px; word-break: break-all; margin-bottom: 12px; }
  button { background: #6C63FF; color: #fff; border: none; border-radius: 8px;
           padding: 10px 18px; font-size: 14px; cursor: pointer; margin-right: 8px; }
  button:hover { background: #5b52ee; }
  a { color: #6C63FF; font-size: 14px; }
  .note { font-size: 12px; color: #888; margin-top: 20px; }
</style>
</head>
<body>
  <h2>✓ Google Contacts connected</h2>
  <p>Copy this refresh token and add it as <strong>GOOGLE_REFRESH_TOKEN</strong> in your
     <a href="https://vercel.com" target="_blank">Vercel environment variables</a>.
     Once set, the app will use it directly without touching Notion.</p>
  <div class="token-box" id="token">${refresh_token}</div>
  <button onclick="navigator.clipboard.writeText(document.getElementById('token').textContent).then(()=>this.textContent='Copied!')">Copy token</button>
  <a href="/">Go to app →</a>
  <p class="note">The token is also saved to Notion as a fallback if you skip this step.</p>
</body>
</html>`);
  } catch (err) {
    console.error("google-auth-callback error", err);
    res.redirect(302, `/?google_auth=error&reason=${encodeURIComponent(err.message)}`);
  }
}
