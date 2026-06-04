import { setCors } from "./_notion.js";
import {
  listTasks, listCompletedTasks, getTask,
  createTask, updateTask, closeTask, reopenTask, deleteTask,
  listLabels, createLabel,
} from "./_todoist.js";

// Ensure account labels exist in Todoist (runs once per cold start)
let labelsEnsured = false;
async function ensureAccountLabels() {
  if (labelsEnsured) return;
  const raw = await listLabels();
  const existing = Array.isArray(raw) ? raw : (raw?.results || raw?.items || []);
  const existingNames = new Set(existing.map(l => l.name));
  await Promise.all(
    ACCOUNT_LABELS
      .filter(name => !existingNames.has(name))
      .map(name => createLabel(name))
  );
  labelsEnsured = true;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const TODAY_MS  = new Date(TODAY_ISO + "T00:00:00").getTime();

// These label names must match the account IDs in the frontend (getro, jones, personal)
const ACCOUNT_LABELS = ["getro", "jones", "personal"];

function isoToDue(iso) {
  if (!iso) return null;
  const ms = new Date(iso + "T00:00:00").getTime();
  return Math.round((ms - TODAY_MS) / 86400000);
}

function dueToIso(days) {
  if (days == null) return null;
  const d = new Date(TODAY_MS + days * 86400000);
  return d.toISOString().slice(0, 10);
}

function completedDayLabel(isoString) {
  if (!isoString) return null;
  const iso = isoString.slice(0, 10);
  if (iso === TODAY_ISO) return "today";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(iso + "T12:00:00").getDay()];
}

// Todoist priority: 4 = urgent (p1 in UI) → our priority:true
//                  1 = normal (p4 in UI) → our priority:false
function toTetherPriority(todoistPriority) {
  return todoistPriority === 4;
}
function toTodoistPriority(tetherPriority) {
  return tetherPriority ? 4 : 1;
}

function accountFromLabels(labels = []) {
  return labels.find(l => ACCOUNT_LABELS.includes(l)) || "personal";
}

function isParked(labels = []) {
  return labels.includes("parked");
}

function isNow(labels = []) {
  return labels.includes("now");
}

function toTask(t, subtasksMap = {}) {
  const completedAt = t.completed_at || t.completedAt || null;
  return {
    id:           t.id,
    title:        t.content,
    account:      accountFromLabels(t.labels),
    parked:       isParked(t.labels),
    now:          isNow(t.labels),
    done:         !!(t.is_completed || completedAt),
    priority:     toTetherPriority(t.priority),
    details:      t.description || null,
    due:          isoToDue(t.due?.date || null),
    completedDay: completedAt ? completedDayLabel(completedAt) : null,
    completedAgo: null,
    subtasks:     subtasksMap[t.id] || [],
    _parentId:    t.parent_id || null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await ensureAccountLabels();

    // ── GET ──────────────────────────────────────────────────
    if (req.method === "GET") {
      // Active tasks
      const activeRaw = await listTasks();
      const active = Array.isArray(activeRaw) ? activeRaw : (activeRaw?.results || activeRaw?.items || []);

      // Recently completed tasks (last 7 days) for "completed this week" display
      let completed = [];
      try {
        const since = new Date(TODAY_MS - 6 * 86400000).toISOString();
        const result = await listCompletedTasks({ since });
        // v1 may return { items: [...] } or an array directly
        completed = Array.isArray(result) ? result : (result?.items || []);
      } catch {
        // endpoint may require premium — silently skip
      }

      const all = [...active, ...completed];

      // Build subtask map: parentId → [{ id, text, done }]
      const subtasksMap = {};
      for (const t of all) {
        if (t.parent_id) {
          if (!subtasksMap[t.parent_id]) subtasksMap[t.parent_id] = [];
          subtasksMap[t.parent_id].push({
            id:   t.id,
            text: t.content,
            done: !!(t.is_completed || t.completed_at),
          });
        }
      }

      // Top-level tasks only
      const tasks = all
        .filter(t => !t.parent_id)
        .map(t => { const mapped = toTask(t, subtasksMap); delete mapped._parentId; return mapped; });

      return res.json(tasks);
    }

    // ── POST (create) ─────────────────────────────────────────
    if (req.method === "POST") {
      const { title, account, done, priority, details, due, parentId, parked, now } = req.body;

      const labels = ACCOUNT_LABELS.includes(account) ? [account] : ["personal"];
      if (parked) labels.push("parked");
      if (now) labels.push("now");
      const payload = {
        content:     title,
        description: details || "",
        labels,
        priority:    toTodoistPriority(priority),
      };
      if (due != null) payload.due_date = dueToIso(due);
      if (parentId)    payload.parent_id = parentId;

      const task = await createTask(payload);
      if (done) await closeTask(task.id);

      const mapped = toTask(done ? { ...task, is_completed: true, completed_at: new Date().toISOString() } : task);
      delete mapped._parentId;
      return res.json(mapped);
    }

    // ── PATCH (update) ────────────────────────────────────────
    if (req.method === "PATCH") {
      const { id, ...patch } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });

      const updates = {};
      if (patch.title    !== undefined) updates.content     = patch.title;
      if (patch.details  !== undefined) updates.description = patch.details || "";
      if (patch.priority !== undefined) updates.priority    = toTodoistPriority(patch.priority);
      if (patch.due      !== undefined) updates.due_date    = dueToIso(patch.due);

      // Handle account, parked, and now labels together
      if (patch.account !== undefined || patch.parked !== undefined || patch.now !== undefined) {
        let existing = null;
        if (patch.account === undefined || patch.parked === undefined || patch.now === undefined) {
          try { existing = await getTask(id); } catch { /* task not fetchable */ }
        }
        const account = patch.account !== undefined ? patch.account : accountFromLabels(existing?.labels || []);
        const parked = patch.parked !== undefined ? patch.parked : isParked(existing?.labels || []);
        const now = patch.now !== undefined ? patch.now : isNow(existing?.labels || []);
        const labels = ACCOUNT_LABELS.includes(account) ? [account] : ["personal"];
        if (parked) labels.push("parked");
        if (now) labels.push("now");
        updates.labels = labels;
      }

      if (Object.keys(updates).length > 0) await updateTask(id, updates);

      // Completion toggle
      if (patch.done === true)  await closeTask(id);
      if (patch.done === false) await reopenTask(id);

      // Return updated shape (getTask fails for closed tasks, so reconstruct)
      let fresh = null;
      if (patch.done !== true) {
        try { fresh = await getTask(id); } catch { /* closed tasks not fetchable */ }
      }

      const result = fresh
        ? toTask(fresh)
        : { id, ...patch, completedDay: patch.done ? "today" : null };
      delete result._parentId;
      return res.json(result);
    }

    // ── DELETE ────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "id required" });
      await deleteTask(id);
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("tasks error", err);
    return res.status(500).json({ error: err.message });
  }
}
