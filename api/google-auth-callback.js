import { setCors } from "./_notion.js";
import { saveRefreshToken } from "./_google-tasks.js";

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
      // Can happen if the user previously authorized — revoke and re-auth with prompt=consent
      return res.redirect(302, "/?google_auth=error&reason=no_refresh_token");
    }

    await saveRefreshToken(refresh_token);

    res.redirect(302, "/?google_auth=success");
  } catch (err) {
    console.error("google-auth-callback error", err);
    res.redirect(302, `/?google_auth=error&reason=${encodeURIComponent(err.message)}`);
  }
}
