import { getPref, setPref } from "./_prefs.js";

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PEOPLE_API    = "https://people.googleapis.com/v1";

let _accessToken  = null;
let _tokenExpiry  = 0;
let _refreshToken = null;

export async function getRefreshToken() {
  if (process.env.GOOGLE_REFRESH_TOKEN) return process.env.GOOGLE_REFRESH_TOKEN;
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
  if (!refreshToken) throw new Error("Google Contacts not connected");

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
    if (res.status === 400) { await clearRefreshToken(); }
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  return _accessToken;
}

async function peopleFetch(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${PEOPLE_API}${path}`, {
    method,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 200 && method === "DELETE") return null;
  if (!res.ok) { const e = await res.text(); throw new Error(`Google People ${method} ${path}: ${e}`); }
  return res.json();
}

// List all contacts (connections)
export async function listContacts() {
  const personFields = [
    "names", "phoneNumbers", "emailAddresses", "birthdays",
    "addresses", "relations", "userDefined", "memberships"
  ].join(",");

  let allConnections = [];
  let pageToken = null;

  do {
    const path = `/people/me/connections?personFields=${personFields}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const data = await peopleFetch("GET", path);
    if (data.connections) {
      allConnections = allConnections.concat(data.connections);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allConnections;
}

// Get single contact
export async function getContact(resourceName) {
  const personFields = [
    "names", "phoneNumbers", "emailAddresses", "birthdays",
    "addresses", "relations", "userDefined", "memberships"
  ].join(",");

  return peopleFetch("GET", `/people/${resourceName}?personFields=${personFields}`);
}

// Create contact
export async function createContact(personData) {
  return peopleFetch("POST", "/people:createContact", { names: personData.names || [] });
}

// Update contact
export async function updateContact(resourceName, personData) {
  const updatePersonFields = Object.keys(personData).join(",");
  const path = `/people/${resourceName}:updateContact?updatePersonFields=${updatePersonFields}`;
  return peopleFetch("PATCH", path, personData);
}

// Delete contact
export async function deleteContact(resourceName) {
  return peopleFetch("DELETE", `/people/${resourceName}`);
}

// List contact groups
export async function listContactGroups() {
  const data = await peopleFetch("GET", "/contactGroups?groupFields=metadata,formattedName");
  return data.contactGroups || [];
}

// Create contact group
export async function createContactGroup(name) {
  return peopleFetch("POST", "/contactGroups", {
    contactGroup: { formattedName: name }
  });
}

// Update contact group
export async function updateContactGroup(resourceName, name) {
  const path = `/contactGroups/${encodeURIComponent(resourceName)}?updateGroupFields=formattedName`;
  return peopleFetch("PATCH", path, {
    contactGroup: { resourceName, formattedName: name }
  });
}

// Delete contact group
export async function deleteContactGroup(resourceName) {
  return peopleFetch("DELETE", `/contactGroups/${encodeURIComponent(resourceName)}`);
}

// Add contact to group
export async function addContactToGroup(contactResourceName, groupResourceName) {
  const path = `/contactGroups/${encodeURIComponent(groupResourceName)}/members:modify`;
  return peopleFetch("POST", path, {
    resourceNamesToAdd: [contactResourceName]
  });
}

// Remove contact from group
export async function removeContactFromGroup(contactResourceName, groupResourceName) {
  const path = `/contactGroups/${encodeURIComponent(groupResourceName)}/members:modify`;
  return peopleFetch("POST", path, {
    resourceNamesToRemove: [contactResourceName]
  });
}

// Helper: Extract custom field value
export function getCustomField(userDefinedArray, key) {
  if (!userDefinedArray) return null;
  const field = userDefinedArray.find(f => f.metadata?.userDefined?.key === key);
  return field ? field.value : null;
}

// Helper: Set/update custom field
export function setCustomField(userDefinedArray, key, value) {
  if (!userDefinedArray) userDefinedArray = [];
  const idx = userDefinedArray.findIndex(f => f.metadata?.userDefined?.key === key);

  if (value === null || value === undefined || value === "") {
    // Remove field
    if (idx >= 0) userDefinedArray.splice(idx, 1);
  } else {
    // Update or add field
    if (idx >= 0) {
      userDefinedArray[idx].value = value;
    } else {
      userDefinedArray.push({
        value,
        metadata: { userDefined: { key } }
      });
    }
  }

  return userDefinedArray;
}
