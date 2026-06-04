import { setCors } from "./_notion.js";
import {
  listTasks, listCompletedTasks, getTask,
  createTask, updateTask, closeTask, reopenTask, deleteTask,
  listProjects, createProject,
} from "./_todoist.js";

// Account → Todoist project mapping
const ACCOUNT_PROJECTS = [
  { id: "findem",   name: "Findem"   },
  { id: "jones",    name: "Jones"    },
  { id: "personal", name: "Personal" },
];
const ACCOUNT_IDS = new Set(ACCOUNT_PROJECTS.map(p => p.id));

// Project cache (populated on first request per cold start)
let projectsEnsured = false;
let accToProjectId  = {};  // { findem: "123", jones: "456", personal: "789" }
let projectIdToAcc  = {};  // { "123": "findem", ... }

async function ensureProjects() {
  if (projectsEnsured) return;
  const raw = await listProjects();
  const existing = Array.isArray(raw) ? raw : (raw?.results || raw?.items || []);

  const byName = {};
  for (const p of existing) byName[p.name.toLowerCase()] = p.id;

  for (const { id: accId, name } of ACCOUNT_PROJECTS) {
    let projId = byName[name.toLowerCase()];
    if (!projId) {
      const created = await createProject(name);
      projId = created.id;
    }
    accToProjectId[accId] = projId;
    projectIdToAcc[projId] = accId;
  }

  projectsEnsured = true;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const TODAY_MS  = new Date(TODAY_ISO + "T00:00:00").getTime();

// Special labels handled as booleans in the Tether model
const SPECIAL_LABELS = new Set(["parked", "now"]);

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

function accountFromProjectId(projectId) {
  return projectIdToAcc[projectId] || "personal";
}

function isParked(labels = []) {
  return labels.includes("parked");
}

function isNow(labels = []) {
  return labels.includes("now");
}

// Non-special labels (Internal, Design, Call Follow Ups, Onboarding, etc.)
function getTaskLabels(labels = []) {
  return labels.filter(l => !SPECIAL_LABELS.has(l));
}

function toTask(t, subtasksMap = {}) {
  const completedAt = t.completed_at || t.completedAt || null;
  return {
    id:           t.id,
    title:        t.content,
    account:      accountFromProjectId(t.project_id),
    parked:       isParked(t.labels),
    now:          isNow(t.labels),
    done:         !!(t.is_completed || completedAt),
    priority:     toTetherPriority(t.priority),
    details:      t.description || null,
    due:          isoToDue(t.due?.date || null),
    completedDay: completedAt ? completedDayLabel(completedAt) : null,
    completedAgo: null,
    labels:       getTaskLabels(t.labels || []),
    subtasks:     subtasksMap[t.id] || [],
    _parentId:    t.parent_id || null,
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    await ensureProjects();

    // ── GET ──────────────────────────────────────────────────
    if (req.method === "GET") {
      const activeRaw = await listTasks();
      const active = Array.isArray(activeRaw) ? activeRaw : (activeRaw?.results || activeRaw?.items || []);

      let completed = [];
      try {
        const since = new Date(TODAY_MS - 6 * 86400000).toISOString();
        const result = await listCompletedTasks({ since });
        completed = Array.isArray(result) ? result : (result?.items || []);
      } catch {
        // endpoint may require premium — silently skip
      }

      const all = [...active, ...completed];

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

      const tasks = all
        .filter(t => !t.parent_id)
        .map(t => { const mapped = toTask(t, subtasksMap); delete mapped._parentId; return mapped; });

      return res.json(tasks);
    }

    // ── POST (create) ─────────────────────────────────────────
    if (req.method === "POST") {
      const { title, account, done, priority, details, due, parentId, parked, now, labels } = req.body;

      const acc = ACCOUNT_IDS.has(account) ? account : "personal";
      const taskLabels = [];
      if (parked) taskLabels.push("parked");
      if (now)    taskLabels.push("now");
      if (Array.isArray(labels)) taskLabels.push(...labels.filter(l => !SPECIAL_LABELS.has(l)));

      const payload = {
        content:     title,
        description: details || "",
        project_id:  accToProjectId[acc],
        labels:      taskLabels,
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

      // Account change → move to different project
      if (patch.account !== undefined) {
        const acc = ACCOUNT_IDS.has(patch.account) ? patch.account : "personal";
        updates.project_id = accToProjectId[acc];
      }

      // Label changes (parked, now, user-defined labels)
      if (patch.parked !== undefined || patch.now !== undefined || patch.labels !== undefined) {
        let existing = null;
        const needsExisting = patch.parked === undefined || patch.now === undefined || patch.labels === undefined;
        if (needsExisting) {
          try { existing = await getTask(id); } catch {}
        }
        const parked     = patch.parked  !== undefined ? patch.parked  : isParked(existing?.labels || []);
        const now        = patch.now     !== undefined ? patch.now     : isNow(existing?.labels || []);
        const userLabels = patch.labels  !== undefined
          ? patch.labels.filter(l => !SPECIAL_LABELS.has(l))
          : getTaskLabels(existing?.labels || []);

        const newLabels = [];
        if (parked) newLabels.push("parked");
        if (now)    newLabels.push("now");
        newLabels.push(...userLabels);
        updates.labels = newLabels;
      }

      if (Object.keys(updates).length > 0) await updateTask(id, updates);

      // Completion toggle
      if (patch.done === true)  await closeTask(id);
      if (patch.done === false) await reopenTask(id);

      let fresh = null;
      if (patch.done !== true) {
        try { fresh = await getTask(id); } catch {}
      }

      const result = fresh
        ? toTask(fresh)
        : { id, ...patch, labels: patch.labels || [], completedDay: patch.done ? "today" : null };
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
