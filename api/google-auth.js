import { setCors } from "./_notion.js";

export default function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: "GOOGLE_CLIENT_ID not configured" });

  const redirectUri = `https://${req.headers.host}/api/google-auth-callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",     clientId);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         "https://www.googleapis.com/auth/tasks");
  url.searchParams.set("access_type",   "offline");
  url.searchParams.set("prompt",        "consent"); // always ask, to ensure refresh token

  res.redirect(302, url.toString());
}
