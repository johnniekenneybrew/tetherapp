// ============================================================
// Fetch helpers for all Vercel API endpoints
// ============================================================

const BASE = "/api";

async function req(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const get    = (path, params) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return req("GET", path + qs);
};
const post   = (path, body) => req("POST",   path, body);
const patch  = (path, body) => req("PATCH",  path, body);
const del    = (path, body) => req("DELETE", path, body);

// ============================================================
// Tasks
// ============================================================
export const tasksApi = {
  list:   ()           => get("/tasks"),
  create: (data)       => post("/tasks", data),
  update: (id, patch_) => patch("/tasks", { id, ...patch_ }),
  delete: (id)         => del("/tasks", { id }),
};

// ============================================================
// Check-in
// ============================================================
export const checkinApi = {
  get:    (date)       => get("/checkin", { date }),
  update: (id, patch_) => patch("/checkin", { id, ...patch_ }),
};

// ============================================================
// Habits
// ============================================================
export const habitsApi = {
  list:   ()           => get("/habits"),
  create: (data)       => post("/habits", data),
  update: (id, patch_) => patch("/habits", { id, ...patch_ }),
  delete: (id)         => del("/habits", { id }),
};

// ============================================================
// Habit log
// ============================================================
export const habitLogApi = {
  range:  (from, to)              => get("/habits", { log: 1, from, to }),
  toggle: (date, habitId, done)   => patch("/habits?log=1", { date, habitId, done }),
};

// ============================================================
// Routines
// ============================================================
export const routinesApi = {
  list:   ()           => get("/routines"),
  create: (data)       => post("/routines", data),
  update: (id, patch_) => patch("/routines", { id, ...patch_ }),
  delete: (id)         => del("/routines", { id }),
};

// ============================================================
// Routine log
// ============================================================
export const routineLogApi = {
  range:  (from, to)              => get("/routines", { log: 1, from, to }),
  toggle: (date, routineId, done) => patch("/routines?log=1", { date, routineId, done }),
};

// ============================================================
// Goals
// ============================================================
export const goalsApi = {
  list:   ()           => get("/goals"),
  create: (data)       => post("/goals", data),
  update: (id, patch_) => patch("/goals", { id, ...patch_ }),
  delete: (id)         => del("/goals", { id }),
};

// ============================================================
// Contacts
// ============================================================
export const contactsApi = {
  list:   ()           => get("/contacts"),
  create: (data)       => post("/contacts", data),
  update: (id, patch_) => patch("/contacts", { id, ...patch_ }),
  delete: (id)         => del("/contacts", { id }),
};

// ============================================================
// Contact notes
// ============================================================
export const contactNotesApi = {
  forContact: (contactId) => get("/contact-notes", { contactId }),
  create:     (data)      => post("/contact-notes", data),
  delete:     (id)        => del("/contact-notes", { id }),
};

// ============================================================
// Contact groups
// ============================================================
export const contactGroupsApi = {
  list:   ()           => get("/contact-groups"),
  create: (data)       => post("/contact-groups", data),
  update: (id, patch_) => patch("/contact-groups", { id, ...patch_ }),
  delete: (id)         => del("/contact-groups", { id }),
};

// ============================================================
// Goal tasks (separate from to-do list)
// ============================================================
export const goalTasksApi = {
  list:   ()           => get("/goals", { tasks: 1 }),
  create: (data)       => post("/goals?tasks=1", data),
  update: (id, patch_) => patch("/goals?tasks=1", { id, ...patch_ }),
  delete: (id)         => del("/goals?tasks=1", { id }),
};

// ============================================================
// User preferences (cross-device, Notion-backed)
// ============================================================
export const prefsApi = {
  get: (key, userId) => get("/prefs", { key, userId }),
  set: (key, value, userId) => post("/prefs", { key, value, userId }),
};
