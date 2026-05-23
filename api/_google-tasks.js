import { getPref, setPref } from "./_prefs.js";

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const TASKS_BASE    = "https://tasks.googleapis.com/tasks/v1/lists/@default/tasks";

// Module-level token cache (warm lambda instances)
let _accessToken  = null;
let _tokenExpiry  = 0;
let _refreshToken = null;

export async function getRefreshToken() {
  if (_refreshToken) return _refreshToken;
  _refreshToken = await getPref("google-refresh-token", "_system");
  return _refreshToken;
}

export async function saveRefreshToken(token) {
  _refreshToken = token;
  await setPref("google-refresh-token", token, "_system");
}

export async function clearRefreshToken() {
  _refreshToken = null;
  _accessToken  = null;
  await setPref("google-refresh-token", null, "_system");
}

export async function isConnected() {
  const t = await getRefreshToken();
  return !!t;
}

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry - 60_000) return _accessToken;
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("Google Tasks not connected");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    // Refresh token revoked — clear it
    if (res.status === 400) { await clearRefreshToken(); }
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

async function gtFetch(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1${path}`, {
    method,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 200 && method === "DELETE") return null;
  if (!res.ok) { const e = await res.text(); throw new Error(`Google Tasks ${method} ${path}: ${e}`); }
  return res.json();
}

export async function gtCreate(title) {
  return gtFetch("POST", "/lists/@default/tasks", { title, status: "needsAction" });
}

export async function gtUpdate(googleId, patch) {
  return gtFetch("PATCH", `/lists/@default/tasks/${googleId}`, patch);
}

export async function gtDelete(googleId) {
  return gtFetch("DELETE", `/lists/@default/tasks/${googleId}`);
}

export async function gtListAll() {
  const res = await gtFetch("GET", "/lists/@default/tasks?showCompleted=true&showHidden=true&showDeleted=true&maxResults=100");
  return res?.items || [];
}
