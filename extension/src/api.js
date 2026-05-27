const BASE = "https://to-tether.app/api";

async function req(method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const get  = (path, token, params) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return req("GET", path + qs, undefined, token);
};
const post  = (path, token, body) => req("POST",   path, body, token);
const patch = (path, token, body) => req("PATCH",  path, body, token);
const del   = (path, token, body) => req("DELETE", path, body, token);

export const tasksApi = {
  list:   (token)             => get("/tasks", token),
  create: (token, data)       => post("/tasks", token, data),
  update: (token, id, patch_) => patch("/tasks", token, { id, ...patch_ }),
  delete: (token, id)         => del("/tasks", token, { id }),
};

export const checkinApi = {
  get:    (token, date) => get("/checkin", token, { date }),
};
