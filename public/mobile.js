// ── Config ───────────────────────────────────────────────────
const BASE = '/api';
const ACCTS = [
  { id: 'findem',   name: 'Findem',   color: '#3B82F6' },
  { id: 'jones',    name: 'Jones',    color: '#8B5CF6' },
  { id: 'personal', name: 'Personal', color: '#64748B' },
];
const accColor = id => ACCTS.find(a => a.id === id)?.color || '#9CA3AF';
const accName  = id => ACCTS.find(a => a.id === id)?.name  || id;

// ── State ────────────────────────────────────────────────────
let tasks       = [];
let taskCreationOrder = new Map(); // maps task.id to creation timestamp for sorting
let filter      = 'all'; // 'all' | 'findem' | 'jones' | 'personal'
let showDone    = true;
let filterOpen  = false;
let loading     = true;
let error       = null;
let synced      = false;
let openMenuId  = null; // task id whose menu is open
let viewFilter  = 'all'; // 'all' | 'today' | 'week' | 'parking'
let expandedTasks = new Set(); // which tasks show full editor
let clearedDoneIds = new Set(); // task IDs cleared from "Clear N completed" (persisted)
let addTaskHasValue = false;
let lastAddTaskPills = { due: null, parked: false }; // remember selected pills in add row
let eventsAttached = false;

// ── localStorage helpers (mirror chrome.storage.local API used in extension) ─
function _lsGet(key, fallback) {
  try { const v = localStorage.getItem('tether_' + key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function _lsSet(key, value) {
  try { localStorage.setItem('tether_' + key, JSON.stringify(value)); } catch {}
}

function getClearedDone() {
  return Promise.resolve(new Set(_lsGet('clearedDoneIds', [])));
}
function setClearedDone(set) {
  _lsSet('clearedDoneIds', Array.from(set));
}

function getCompletedSubs() {
  return Promise.resolve(_lsGet('completedSubs', {}));
}
function setCompletedSubs(v) { _lsSet('completedSubs', v); }

function getIdeaIds() {
  return Promise.resolve(new Set(_lsGet('ideaIds', [])));
}
function setIdeaIds(set) {
  _lsSet('ideaIds', Array.from(set));
}

// ── Subtask helpers ───────────────────────────────────────────
function moveCursorToEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ── API ──────────────────────────────────────────────────────
async function apiFetch(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(e.error || res.statusText);
  }
  return res.json();
}

async function loadTasks() {
  loading = true; error = null;
  renderList();
  try {
    const [raw, completedSubs, cleared, ideaIds] = await Promise.all([
      apiFetch('GET', '/tasks'),
      getCompletedSubs(),
      getClearedDone(),
      getIdeaIds(),
    ]);
    tasks = (raw || []).map(task => {
      const isIdea = ideaIds.has(task.id) || !!task.isIdea;
      const extra = (completedSubs[task.id] || []).filter(cs => !task.subtasks.find(s => s.id === cs.id));
      const merged = extra.length ? { ...task, subtasks: [...task.subtasks, ...extra] } : task;
      return isIdea ? { ...merged, isIdea: true } : merged;
    });
    clearedDoneIds = cleared;
    taskCreationOrder.clear();
    tasks.forEach((t, idx) => {
      if (!taskCreationOrder.has(t.id)) {
        taskCreationOrder.set(t.id, -tasks.length + idx);
      }
    });
    synced = true;
  } catch (err) {
    error = err.message;
    synced = false;
  } finally {
    loading = false;
  }
  renderHeader();
  renderList();
  renderFooter();
}

async function apiToggleDone(task) {
  const newDone = !task.done;
  tasks = tasks.map(t => t.id === task.id ? { ...t, done: newDone } : t);
  if (newDone) {
    clearedDoneIds.delete(task.id);
    setClearedDone(clearedDoneIds);
  }
  renderHeader();
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, done: newDone });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiToggleSub(task, subId) {
  const sub = task.subtasks.find(s => s.id === subId);
  const newDone = !sub?.done;
  const newSubs = task.subtasks.map(s => s.id === subId ? { ...s, done: newDone } : s);
  tasks = tasks.map(t => t.id === task.id ? { ...t, subtasks: newSubs } : t);
  renderList();
  getCompletedSubs().then(cs => {
    if (newDone) {
      cs[task.id] = [...(cs[task.id] || []).filter(s => s.id !== subId), { id: subId, text: sub.text, done: true }];
    } else {
      if (cs[task.id]) {
        cs[task.id] = cs[task.id].filter(s => s.id !== subId);
        if (!cs[task.id].length) delete cs[task.id];
      }
    }
    setCompletedSubs(cs);
  });
  try {
    await apiFetch('PATCH', '/tasks', { id: subId, done: newDone });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiSetAccount(task, account) {
  tasks = tasks.map(t => t.id === task.id ? { ...t, account } : t);
  openMenuId = null;
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, account });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiToggleParked(task) {
  const newParked = !task.parked;
  tasks = tasks.map(t => t.id === task.id ? { ...t, parked: newParked } : t);
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, parked: newParked });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiSetDue(task, due) {
  tasks = tasks.map(t => t.id === task.id ? { ...t, due } : t);
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, due });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiDelete(task) {
  openMenuId = null;
  tasks = tasks.filter(t => t.id !== task.id);
  clearedDoneIds.delete(task.id);
  setClearedDone(clearedDoneIds);
  renderList();
  getCompletedSubs().then(cs => { if (cs[task.id]) { delete cs[task.id]; setCompletedSubs(cs); } });
  getIdeaIds().then(ids => { if (ids.has(task.id)) { ids.delete(task.id); setIdeaIds(ids); } });
  try {
    await apiFetch('DELETE', '/tasks', { id: task.id });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiCreate(title, details, opts = {}) {
  const account = filter !== 'all' ? filter : 'personal';
  const isIdea = !!opts.isIdea;
  // Apply view-based defaults if user didn't explicitly set pills
  let due = lastAddTaskPills.due;
  let parked = lastAddTaskPills.parked;
  if (!isIdea && due === null && viewFilter === 'today') due = 0;
  if (!isIdea && due === null && viewFilter === 'week') due = daysUntilNextMonday() - 3; // mid-week (e.g., Friday)
  if (!isIdea && !parked && viewFilter === 'parking') parked = true;
  if (isIdea) { due = null; parked = false; }
  const tempId = 'tmp-' + Date.now();
  const temp = { id: tempId, title, account, done: false, parked, isIdea, due, subtasks: [], details: details || null };
  taskCreationOrder.set(tempId, Date.now());
  tasks = [temp, ...tasks];
  renderList();
  try {
    const created = await apiFetch('POST', '/tasks', {
      title, account, done: false, due, parked, isIdea, details: details || null
    });
    tasks = tasks.map(t => t.id === tempId ? { ...temp, ...created, isIdea } : t);
    taskCreationOrder.set(created.id, taskCreationOrder.get(tempId));
    taskCreationOrder.delete(tempId);
    if (isIdea) {
      getIdeaIds().then(ids => { ids.add(created.id); setIdeaIds(ids); });
    }
    synced = true;
  } catch { synced = false; }
  if (!isIdea) {
    lastAddTaskPills.due = null;
    lastAddTaskPills.parked = false;
    addTaskHasValue = false;
  }
  renderList();
  renderFooter();
}

async function apiAddSub(task, text) {
  const temp = { id: 'tmp-sub-' + Date.now(), text, done: false };
  tasks = tasks.map(t => t.id === task.id ? { ...t, subtasks: [...t.subtasks, temp] } : t);
  renderList();
  try {
    const created = await apiFetch('POST', '/tasks', { title: text, done: false, parentId: task.id });
    tasks = tasks.map(t =>
      t.id === task.id
        ? { ...t, subtasks: t.subtasks.map(s => s.id === temp.id ? { ...temp, id: created.id } : s) }
        : t
    );
    synced = true;
  } catch { synced = false; }
  renderList();
  renderFooter();
}

async function apiDeleteSub(task, subId) {
  tasks = tasks.map(t => t.id === task.id
    ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) }
    : t
  );
  renderList();
  getCompletedSubs().then(cs => {
    if (cs[task.id]) {
      cs[task.id] = cs[task.id].filter(s => s.id !== subId);
      if (!cs[task.id].length) delete cs[task.id];
      setCompletedSubs(cs);
    }
  });
  try {
    await apiFetch('DELETE', '/tasks', { id: subId });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiRename(tid, newTitle) {
  tasks = tasks.map(t => t.id === tid ? { ...t, title: newTitle } : t);
  try {
    await apiFetch('PATCH', '/tasks', { id: tid, title: newTitle });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

// Create empty sibling task after prevTaskId (local draft - not synced until user types)
function createDraftAfter(prevTaskId) {
  const account = filter !== 'all' ? filter : 'personal';
  // Apply view-based defaults
  let due = null, parked = false;
  if (viewFilter === 'today') due = 0;
  if (viewFilter === 'week') due = daysUntilNextMonday() - 3;
  if (viewFilter === 'parking') parked = true;

  const tempId = 'tmp-draft-' + Date.now();
  const temp = { id: tempId, title: '', account, done: false, parked, due, subtasks: [], details: null, _draft: true };

  const prevIdx = tasks.findIndex(t => t.id === prevTaskId);
  tasks = [...tasks.slice(0, prevIdx + 1), temp, ...tasks.slice(prevIdx + 1)];
  const prevTime = taskCreationOrder.get(prevTaskId) || 0;
  taskCreationOrder.set(tempId, prevTime - 0.001);

  // Don't auto-expand draft - just focus its title
  expandedTasks.delete(prevTaskId);
  renderList();
  setTimeout(() => {
    const el = document.querySelector(`[data-title-tid="${tempId}"]`);
    if (el) { el.focus(); moveCursorToEnd(el); }
  }, 0);
}

// Commit draft task to API (called on blur or when content is typed and Enter pressed)
async function commitDraft(tempId, title) {
  const task = tasks.find(t => t.id === tempId);
  if (!task) return null;
  if (!title.trim()) {
    // Empty draft - remove locally
    tasks = tasks.filter(t => t.id !== tempId);
    taskCreationOrder.delete(tempId);
    expandedTasks.delete(tempId);
    renderList();
    return null;
  }
  // Update local title
  tasks = tasks.map(t => t.id === tempId ? { ...t, title, _draft: false } : t);
  try {
    const created = await apiFetch('POST', '/tasks', {
      title, account: task.account, done: false,
      parked: task.parked, due: task.due, details: task.details
    });
    tasks = tasks.map(t => t.id === tempId ? { ...t, id: created.id } : t);
    taskCreationOrder.set(created.id, taskCreationOrder.get(tempId));
    taskCreationOrder.delete(tempId);
    if (expandedTasks.has(tempId)) {
      expandedTasks.delete(tempId);
      expandedTasks.add(created.id);
    }
    synced = true;
    renderFooter();
    return created.id;
  } catch {
    synced = false;
    renderFooter();
    return tempId;
  }
}

// Demote a task to subtask of previous task
async function demoteToSubtask(tid) {
  const idx = tasks.findIndex(t => t.id === tid);
  if (idx <= 0) return; // no previous task
  const task = tasks[idx];
  const prev = tasks[idx - 1];
  const title = task.title.trim() || '';

  // If draft with no title, just convert locally
  if (task._draft && !title) {
    // Remove draft, add empty subtask placeholder to prev
    tasks = tasks.filter(t => t.id !== tid);
    taskCreationOrder.delete(tid);
    expandedTasks.delete(tid);
    expandedTasks.add(prev.id);
    const subTempId = 'tmp-sub-draft-' + Date.now();
    tasks = tasks.map(t => t.id === prev.id
      ? { ...t, subtasks: [...t.subtasks, { id: subTempId, text: '', done: false, _draft: true }] }
      : t);
    renderList();
    setTimeout(() => {
      const el = document.querySelector(`[data-sub-text="${subTempId}"]`);
      if (el) { el.focus(); moveCursorToEnd(el); }
    }, 0);
    return;
  }

  // Real task: delete it and recreate as subtask of prev
  if (!title) return;
  expandedTasks.add(prev.id);
  // Remove from local tasks
  tasks = tasks.filter(t => t.id !== tid);
  // Add as subtask locally
  const subTempId = 'tmp-sub-' + Date.now();
  tasks = tasks.map(t => t.id === prev.id
    ? { ...t, subtasks: [...t.subtasks, { id: subTempId, text: title, done: false }] }
    : t);
  renderList();
  try {
    if (!task._draft) await apiFetch('DELETE', '/tasks', { id: tid });
    const created = await apiFetch('POST', '/tasks', { title, done: false, parentId: prev.id });
    tasks = tasks.map(t => t.id === prev.id
      ? { ...t, subtasks: t.subtasks.map(s => s.id === subTempId ? { id: created.id, text: title, done: false } : s) }
      : t);
    synced = true;
  } catch { synced = false; }
  renderList();
  renderFooter();
}

// Create empty sibling subtask after a given subtask
function createSubtaskDraftAfter(parentId, prevSubId) {
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;
  const subTempId = 'tmp-sub-draft-' + Date.now();
  const draft = { id: subTempId, text: '', done: false, _draft: true };
  const prevIdx = parent.subtasks.findIndex(s => s.id === prevSubId);
  const newSubs = [...parent.subtasks];
  if (prevIdx >= 0) newSubs.splice(prevIdx + 1, 0, draft);
  else newSubs.push(draft);
  tasks = tasks.map(t => t.id === parentId ? { ...t, subtasks: newSubs } : t);
  renderList();
  setTimeout(() => {
    const el = document.querySelector(`[data-sub-text="${subTempId}"]`);
    if (el) { el.focus(); moveCursorToEnd(el); }
  }, 0);
}

// Commit subtask draft to API (or remove if empty)
async function commitSubDraft(parentId, subTempId, text) {
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;
  if (!text.trim()) {
    // Remove draft
    tasks = tasks.map(t => t.id === parentId
      ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subTempId) }
      : t);
    renderList();
    return;
  }
  // Update local
  tasks = tasks.map(t => t.id === parentId
    ? { ...t, subtasks: t.subtasks.map(s => s.id === subTempId ? { ...s, text, _draft: false } : s) }
    : t);
  try {
    const created = await apiFetch('POST', '/tasks', { title: text, done: false, parentId });
    tasks = tasks.map(t => t.id === parentId
      ? { ...t, subtasks: t.subtasks.map(s => s.id === subTempId ? { id: created.id, text, done: false } : s) }
      : t);
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

// Promote subtask to sibling task (Shift+Tab)
async function promoteSubtask(parentId, subId) {
  const parent = tasks.find(t => t.id === parentId);
  if (!parent) return;
  const sub = parent.subtasks.find(s => s.id === subId);
  if (!sub) return;
  const title = sub.text.trim();

  // Remove from parent's subtasks
  tasks = tasks.map(t => t.id === parentId
    ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) }
    : t);

  if (!title && sub._draft) {
    renderList();
    return;
  }

  // Insert as sibling task after parent
  const parentIdx = tasks.findIndex(t => t.id === parentId);
  const tempId = 'tmp-promoted-' + Date.now();
  const newTask = { id: tempId, title, account: parent.account, done: false, parked: parent.parked, due: null, subtasks: [], details: null };
  tasks = [...tasks.slice(0, parentIdx + 1), newTask, ...tasks.slice(parentIdx + 1)];
  const parentTime = taskCreationOrder.get(parentId) || 0;
  taskCreationOrder.set(tempId, parentTime - 0.001);
  renderList();

  try {
    if (!sub._draft) await apiFetch('DELETE', '/tasks', { id: subId });
    const created = await apiFetch('POST', '/tasks', { title: title || 'Untitled', account: parent.account, done: false });
    tasks = tasks.map(t => t.id === tempId ? { ...t, id: created.id } : t);
    taskCreationOrder.set(created.id, taskCreationOrder.get(tempId));
    taskCreationOrder.delete(tempId);
    synced = true;
  } catch { synced = false; }
  renderList();
  renderFooter();
}

async function apiRenameSubtask(tid, subId, newText) {
  tasks = tasks.map(t =>
    t.id === tid
      ? { ...t, subtasks: t.subtasks.map(s => s.id === subId ? { ...s, text: newText } : s) }
      : t
  );
  try {
    await apiFetch('PATCH', '/tasks', { id: subId, title: newText });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiSaveDetails(tid, details) {
  tasks = tasks.map(t => t.id === tid ? { ...t, details } : t);
  try {
    await apiFetch('PATCH', '/tasks', { id: tid, details });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

// ── Helpers ──────────────────────────────────────────────────
function dueLabel(due) {
  if (due === null || due === undefined) return null;
  if (due < 0) return 'Overdue';
  if (due === 0) return 'Today';
  if (due === 1) return 'Tomorrow';
  const d = new Date(Date.now() + due * 86400000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dateToday() {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function escHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return (text || '').replace(/[&<>"']/g, m => map[m]);
}

// ── SVG icons ────────────────────────────────────────────────
const LOGO_SVG = `<svg width="25" height="14" viewBox="0 0 36 20" fill="none"><line x1="4" y1="10" x2="10" y2="4" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="4" x2="16" y2="10" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round"/><line x1="4" y1="10" x2="10" y2="16" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/><line x1="10" y1="16" x2="16" y2="10" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/><circle cx="4" cy="10" r="2" fill="#6C63FF"/><circle cx="10" cy="4" r="2" fill="#6C63FF"/><circle cx="16" cy="10" r="2" fill="#6C63FF"/><circle cx="10" cy="16" r="1.4" fill="#6C63FF" opacity="0.35"/></svg>`;

const ICO_CHECK = `<svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_PLUS  = `<svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICO_DOTS  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/></svg>`;
const ICO_PIN   = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 2L3 6v5l4 1 4-1V6l-4-4z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" fill="currentColor" opacity="0.6"/></svg>`;
const ICO_CHEV  = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3.5 4.5L6 7l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_SUN   = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 2v1.2M7 10.8v1.2M2 7h1.2M10.8 7H12M3.5 3.5l.8.8M9.7 9.7l.8.8M3.5 10.5l.8-.8M9.7 4.3l.8-.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
const ICO_ARR   = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_CLOCK = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_TRASH = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4.5h8M5.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5l.5 7h4l.5-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Render: Header ────────────────────────────────────────────
function renderHeader() {
  const h = document.getElementById('s-header');
  const filterLabel = filter === 'all' ? 'All' : ACCTS.find(a => a.id === filter)?.name.split(' ')[0];
  const completedCount = tasks.filter(t => t.done && (filter === 'all' || t.account === filter) && !clearedDoneIds.has(t.id)).length;

  h.innerHTML = `
    <div class="s-header-row">
      <a class="s-brand" href="https://to-tether.app" target="_blank" style="text-decoration:none;cursor:pointer">
        ${LOGO_SVG}
        <span class="s-brand-name"><em>teth</em><strong>er</strong></span>
      </a>
      <div class="s-header-right">
        ${completedCount > 0 ? `<button class="s-clear-btn" id="s-clear-btn">Clear ${completedCount} completed</button>` : ''}
        <div class="s-filter-wrap">
          <button class="s-filter-btn" id="s-filter-btn">
            ${filter !== 'all' ? `<span style="width:6px;height:6px;border-radius:50%;background:${accColor(filter)};flex-shrink:0"></span>` : ''}
            <span>${filterLabel}</span>
            <span style="color:var(--text-3);margin-left:2px">${ICO_CHEV}</span>
          </button>
          ${filterOpen ? `
          <div class="s-filter-dropdown" id="s-filter-dropdown">
            <button class="s-filter-opt ${filter === 'all' ? 'is-active' : ''}" data-filter="all">All accounts</button>
            ${ACCTS.map(a => `
              <button class="s-filter-opt ${filter === a.id ? 'is-active' : ''}" data-filter="${a.id}">
                <span style="width:6px;height:6px;border-radius:50%;background:${a.color}"></span>
                ${a.name}
              </button>
            `).join('')}
          </div>` : ''}
        </div>
      </div>
    </div>
    <div class="s-view-tabs">
      <button class="s-view-tab ${viewFilter === 'all' ? 'is-on' : ''}" id="s-view-all">All</button>
      <button class="s-view-tab ${viewFilter === 'today' ? 'is-on' : ''}" id="s-view-today">Today</button>
      <button class="s-view-tab ${viewFilter === 'week' ? 'is-on' : ''}" id="s-view-week">This week</button>
      <button class="s-view-tab ${viewFilter === 'parking' ? 'is-on' : ''}" id="s-view-parking">Parking</button>
    </div>
  `;

  // Events
  document.getElementById('s-clear-btn')?.addEventListener('click', () => {
    tasks.filter(t => t.done && (filter === 'all' || t.account === filter))
      .forEach(t => clearedDoneIds.add(t.id));
    setClearedDone(clearedDoneIds);
    renderList();
    renderHeader();
  });

  document.getElementById('s-filter-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    filterOpen = !filterOpen;
    renderHeader();
  });

  document.getElementById('s-filter-dropdown')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter = btn.dataset.filter;
    filterOpen = false;
    renderHeader();
    renderList();
  });

  ['all', 'today', 'week', 'parking'].forEach(v => {
    document.getElementById(`s-view-${v}`)?.addEventListener('click', () => {
      viewFilter = v;
      renderHeader();
      renderList();
    });
  });
}

// ── Helper: daysUntilNextMonday ──────────────────────────────
function daysUntilNextMonday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  let days = (1 - dayOfWeek + 7) % 7; // days until next Monday
  if (days === 0) days = 7; // if today is Monday, next Monday is 7 days away
  return days;
}

// ── Render: Task card ─────────────────────────────────────────
function makeTaskEl(task) {
  const color  = accColor(task.account);
  const isOpen = openMenuId === task.id;
  const isExpanded = expandedTasks.has(task.id);
  const dl     = dueLabel(task.due);
  const hasSubs = task.subtasks && task.subtasks.length > 0;

  const div = document.createElement('div');
  div.className = `s-task${task.done ? ' is-done' : ''}${isExpanded ? ' is-expanded' : ''}`;

  // Collapsed header row
  div.innerHTML = `
    <div class="s-task-header">
      <button class="s-check ${task.done ? 'is-checked' : ''}" style="${task.done ? `background:${color}` : ''}" data-tid="${task.id}">
        ${task.done ? `<span style="color:#fff">${ICO_CHECK}</span>` : ''}
      </button>
      <div class="s-task-body" data-body="${task.id}">
        <span class="s-task-title" contenteditable="plaintext-only" data-title-tid="${task.id}" data-placeholder="New task" spellcheck="false">${escHtml(task.title)}</span>
        ${!hasSubs && dl && !task.done ? (
          task.due < 0
            ? `<span class="s-overdue-dot" title="Overdue"></span>`
            : `<span class="s-due-pill" style="color:${task.due === 0 ? 'var(--brand)' : 'var(--text-3)'}">${dl}</span>`
        ) : ''}
      </div>
      ${!task.done ? `
      <div class="s-actions-hover">
        <div class="s-menu-wrap">
          <button class="s-action-btn" data-menu="${task.id}" title="More options">${ICO_DOTS}</button>
          ${isOpen ? `
          <div class="s-menu-popup">
            <div class="s-menu-label">AREA</div>
            ${ACCTS.map(a => `
              <button class="s-menu-item ${task.account === a.id ? 'is-active' : ''}" data-action="account" data-val="${a.id}" data-tid="${task.id}">
                <span style="width:8px;height:8px;border-radius:50%;background:${a.color}"></span>
                ${a.name}
                ${task.account === a.id ? `<span style="margin-left:auto;font-size:11px;color:var(--text-3)">✓</span>` : ''}
              </button>
            `).join('')}
            <div class="s-menu-divider"></div>
            <button class="s-menu-item is-danger" data-action="delete" data-tid="${task.id}">${ICO_TRASH} Delete</button>
          </div>` : ''}
        </div>
        <button class="s-action-btn s-park-btn" data-park="${task.id}" title="${task.parked ? 'Unpark' : 'Park'}">${ICO_PIN}</button>
      </div>` : ''}
    </div>
  `;

  // Expanded editor
  if (isExpanded) {
    const editor = document.createElement('div');
    editor.className = 's-task-editor';
    editor.innerHTML = `
      <div class="s-editor-body">
        ${hasSubs ? `
        <div class="s-subtasks" data-subtasks="${task.id}">
          ${task.subtasks.map(s => `
            <div class="s-subtask ${s.done ? 'is-done' : ''}">
              <button class="s-subtask-check ${s.done ? 'is-checked' : ''}" style="${s.done ? `background:${color}` : ''}" data-sub="${s.id}" data-tid="${task.id}">
                ${s.done ? `<span style="color:#fff">${ICO_CHECK}</span>` : ''}
              </button>
              <span class="s-subtask-text" contenteditable="plaintext-only" data-sub-text="${s.id}" data-sub-tid="${task.id}" data-placeholder="Subtask" spellcheck="false">${escHtml(s.text)}</span>
            </div>
          `).join('')}
        </div>` : ''}
        <textarea class="s-details-input" placeholder="Add details…" data-notes="${task.id}" spellcheck="false">${escHtml(task.details || '')}</textarea>
        <div class="s-pill-row">
          <button class="s-pill ${task.due === 0 ? 'is-on' : ''}" data-due="0" data-tid="${task.id}">${ICO_SUN} Today</button>
          <button class="s-pill ${task.due === 1 ? 'is-on' : ''}" data-due="1" data-tid="${task.id}">${ICO_ARR} Tomorrow</button>
          <button class="s-pill ${task.due && task.due > 1 && task.due < daysUntilNextMonday() ? 'is-on' : ''}" data-due-week="${task.id}">This week</button>
          <div style="position:relative;display:inline-flex">
            <button class="s-pill icon-only" data-due-custom="${task.id}" title="Pick date">${ICO_CLOCK}</button>
            <input type="date" data-date-pick="${task.id}" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none" />
          </div>
          <button class="s-pill ${task.parked ? 'is-on' : ''} s-park-pill" data-park-pill="${task.id}">Park for later</button>
          <button class="s-delete-btn" data-delete="${task.id}">${ICO_TRASH}</button>
        </div>
      </div>
    `;
    div.appendChild(editor);
  }

  // Subtasks inline when collapsed (if has subs)
  if (hasSubs && !isExpanded && !task.done) {
    const subList = document.createElement('div');
    subList.className = 's-subtasks-inline';
    subList.innerHTML = task.subtasks.map(s => `
      <div class="s-subtask ${s.done ? 'is-done' : ''}">
        <button class="s-subtask-check ${s.done ? 'is-checked' : ''}" style="${s.done ? `background:${color}` : ''}" data-sub="${s.id}" data-tid="${task.id}">
          ${s.done ? `<span style="color:#fff">${ICO_CHECK}</span>` : ''}
        </button>
        <span class="s-subtask-text-inline" contenteditable="plaintext-only" data-sub-text="${s.id}" data-sub-tid="${task.id}" data-placeholder="Subtask" spellcheck="false">${escHtml(s.text)}</span>
        ${dl ? `<span class="s-due-pill s-due-pill-inline" style="color:${task.due < 0 ? 'var(--error)' : task.due === 0 ? 'var(--brand)' : 'var(--text-3)'}">${dl}</span>` : ''}
      </div>
    `).join('');
    div.appendChild(subList);
  }

  return div;
}

// ── Render: Full list ─────────────────────────────────────────
function renderList() {
  const listEl = document.getElementById('s-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (loading) {
    listEl.innerHTML = `<div class="s-spinner-wrap"><div class="s-spinner"></div></div>`;
    return;
  }
  if (error) {
    const wrap = document.createElement('div');
    wrap.className = 's-error-msg';
    wrap.innerHTML = `<div>${escHtml(error)}</div>`;
    const btn = document.createElement('button');
    btn.className = 's-retry-btn';
    btn.textContent = 'Retry';
    btn.addEventListener('click', loadTasks);
    wrap.appendChild(btn);
    listEl.appendChild(wrap);
    return;
  }

  // Add task row
  const addRow = document.createElement('div');
  addRow.className = 's-add-row';
  addRow.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="color:var(--text-3);flex-shrink:0">${ICO_PLUS}</span>
      <input class="s-add-input" id="s-add-input" placeholder="Add a task" autocomplete="off" />
    </div>
    <div class="s-add-expanded" style="${addTaskHasValue ? '' : 'display:none'}">
      <textarea class="s-add-details" placeholder="Details…" spellcheck="false"></textarea>
      <div class="s-add-hint">Press Enter to add subtasks · Esc to cancel</div>
      <div class="s-pill-row">
        <button class="s-pill ${lastAddTaskPills.due === 0 ? 'is-on' : ''}" data-add-due="0">${ICO_SUN} Today</button>
        <button class="s-pill ${lastAddTaskPills.due === 1 ? 'is-on' : ''}" data-add-due="1">${ICO_ARR} Tomorrow</button>
        <button class="s-pill ${lastAddTaskPills.due && lastAddTaskPills.due > 1 && lastAddTaskPills.due < daysUntilNextMonday() ? 'is-on' : ''}" data-add-due-week>This week</button>
        <div style="position:relative;display:inline-flex">
          <button class="s-pill icon-only" data-add-due-custom title="Pick date">${ICO_CLOCK}</button>
          <input type="date" data-add-date-pick style="position:absolute;opacity:0;width:0;height:0;pointer-events:none" />
        </div>
        <button class="s-pill s-park-pill" data-add-park>Park for later</button>
      </div>
    </div>
  `;
  listEl.appendChild(addRow);

  // Filter and sort tasks
  let visible = tasks.filter(t => {
    if (viewFilter === 'parking') return !t.done && t.parked && !t.isIdea && (filter === 'all' || t.account === filter);
    if (t.done) return false; // active tasks only for non-parking views
    if (t.parked) return false; // parked tasks hidden from all/today/week
    if (t.isIdea) return false; // ideas only show in parking view
    if (filter !== 'all' && t.account !== filter) return false;
    if (viewFilter === 'today') return t.due === 0;
    if (viewFilter === 'week') return t.due !== null && t.due > 0 && t.due < daysUntilNextMonday();
    return true; // all
  });

  visible.sort((a, b) => {
    const aTime = taskCreationOrder.get(a.id) || 0;
    const bTime = taskCreationOrder.get(b.id) || 0;
    return bTime - aTime; // newest first
  });

  if (visible.length === 0) {
    const msg = document.createElement('div');
    msg.className = 's-empty-msg';
    if (viewFilter === 'parking') msg.textContent = 'No parked tasks.';
    else if (viewFilter === 'today') msg.textContent = 'All clear for today.';
    else if (viewFilter === 'week') msg.textContent = 'No tasks this week.';
    else msg.textContent = filter !== 'all' ? 'No tasks for this account.' : 'All clear — nice work.';
    listEl.appendChild(msg);
  } else {
    visible.forEach(task => listEl.appendChild(makeTaskEl(task)));
  }

  // Ideas section (parking view only)
  if (viewFilter === 'parking') {
    const ideasHeader = document.createElement('div');
    ideasHeader.className = 's-section-header';
    ideasHeader.textContent = 'Ideas';
    listEl.appendChild(ideasHeader);

    const ideaAddRow = document.createElement('div');
    ideaAddRow.className = 's-add-row s-idea-add-row';
    ideaAddRow.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="color:var(--text-3);flex-shrink:0;margin-top:2px">${ICO_PLUS}</span>
        <textarea class="s-add-input s-idea-input" id="s-add-idea-input" placeholder="Add idea" autocomplete="off" rows="1" spellcheck="false"></textarea>
      </div>
    `;
    listEl.appendChild(ideaAddRow);

    let ideas = tasks.filter(t => !t.done && t.isIdea && (filter === 'all' || t.account === filter));
    ideas.sort((a, b) => {
      const aTime = taskCreationOrder.get(a.id) || 0;
      const bTime = taskCreationOrder.get(b.id) || 0;
      return bTime - aTime;
    });
    if (ideas.length === 0) {
      const msg = document.createElement('div');
      msg.className = 's-empty-msg';
      msg.textContent = 'No ideas yet.';
      listEl.appendChild(msg);
    } else {
      ideas.forEach(task => listEl.appendChild(makeTaskEl(task)));
    }
  }

  // Completed tasks (inline at bottom, not in parking view)
  if (viewFilter !== 'parking') {
    let completed = tasks.filter(t => t.done && (filter === 'all' || t.account === filter) && !clearedDoneIds.has(t.id));
    completed.sort((a, b) => {
      const aTime = taskCreationOrder.get(a.id) || 0;
      const bTime = taskCreationOrder.get(b.id) || 0;
      return bTime - aTime;
    });
    completed.forEach(task => listEl.appendChild(makeTaskEl(task)));
  }

  if (!eventsAttached) {
    setupEvents();
  }
}

// ── Event setup ──────────────────────────────────────────────
function setupEvents() {
  const listEl = document.getElementById('s-list');
  if (eventsAttached) return;
  eventsAttached = true;

  // Keydown: add input, title, subtask input, subtask text
  listEl.addEventListener('keydown', e => {
    // Add task input: Enter
    if (e.target.id === 's-add-input' && e.key === 'Enter') {
      const title = e.target.value.trim();
      const addRow = e.target.closest('.s-add-row');
      const details = addRow.querySelector('.s-add-details')?.value.trim() || null;
      if (title) {
        apiCreate(title, details);
        // Expand new task for subtask input
        const newTask = tasks[0]; // newly created task is first
        if (newTask) {
          expandedTasks.add(newTask.id);
        }
        e.target.value = '';
        addRow.querySelector('.s-add-details').value = '';
        addTaskHasValue = false;
        const expanded = listEl.querySelector('.s-add-expanded');
        if (expanded) expanded.style.display = 'none';
      }
      return;
    }
    // Add idea input: Enter
    if (e.target.id === 's-add-idea-input' && e.key === 'Enter') {
      e.preventDefault();
      const title = e.target.value.trim();
      if (title) {
        apiCreate(title, null, { isIdea: true });
        e.target.value = '';
        e.target.style.height = 'auto';
      }
      return;
    }
    if (e.target.id === 's-add-idea-input' && e.key === 'Escape') {
      e.target.value = '';
      return;
    }
    // Add task input: Escape
    if (e.target.id === 's-add-input' && e.key === 'Escape') {
      e.target.value = '';
      addTaskHasValue = false;
      const expanded = listEl.querySelector('.s-add-expanded');
      if (expanded) expanded.style.display = 'none';
      return;
    }

    // Subtask text edit
    const subText = e.target.closest('[data-sub-text]');
    if (subText) {
      const tid = subText.dataset.subTid;
      const subId = subText.dataset.subText;
      const task = tasks.find(t => t.id === tid);
      const sub = task?.subtasks.find(s => s.id === subId);

      // Backspace on empty subtask: delete it, move focus to previous
      if (e.key === 'Backspace' && !subText.textContent.trim()) {
        e.preventDefault();
        const subtasksDiv = subText.closest('[data-subtasks]');
        const allSubTexts = subtasksDiv ? [...subtasksDiv.querySelectorAll('[data-sub-text]')] : [];
        const idx = allSubTexts.indexOf(subText);
        if (sub?._draft) {
          // Just remove draft locally
          tasks = tasks.map(t => t.id === tid ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) } : t);
          renderList();
        } else if (task) {
          apiDeleteSub(task, subId);
        }
        setTimeout(() => {
          const prevText = listEl.querySelectorAll(`[data-subtasks="${tid}"] [data-sub-text]`)[idx - 1];
          if (prevText) moveCursorToEnd(prevText);
          else listEl.querySelector(`[data-title-tid="${tid}"]`)?.focus();
        }, 0);
        return;
      }

      // Shift+Tab on subtask: promote to sibling task
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        promoteSubtask(tid, subId);
        return;
      }

      // Enter on subtask: save and create new subtask below
      if (e.key === 'Enter') {
        e.preventDefault();
        const newText = subText.textContent.trim();
        if (sub?._draft) {
          commitSubDraft(tid, subId, newText).then(() => {
            createSubtaskDraftAfter(tid, subId);
          });
        } else if (task && sub && newText !== sub.text) {
          if (newText) apiRenameSubtask(tid, subId, newText);
          createSubtaskDraftAfter(tid, subId);
        } else {
          createSubtaskDraftAfter(tid, subId);
        }
        return;
      }
      if (e.key === 'Escape') { subText.blur(); return; }
      return;
    }

    // Title edit
    const titleEl = e.target.closest('[data-title-tid]');
    if (titleEl) {
      const tid = titleEl.dataset.titleTid;
      const task = tasks.find(t => t.id === tid);

      // Enter: save title, create new sibling task below
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTitle = titleEl.textContent.trim();
        if (task?._draft) {
          commitDraft(tid, newTitle).then((realId) => {
            if (realId) createDraftAfter(realId);
          });
        } else if (task && newTitle && newTitle !== task.title) {
          apiRename(tid, newTitle);
          createDraftAfter(tid);
        } else if (task) {
          createDraftAfter(tid);
        }
        return;
      }

      // Tab: demote to subtask of previous task
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const newTitle = titleEl.textContent.trim();
        // Save current title if existing task
        if (task && !task._draft && newTitle && newTitle !== task.title) {
          tasks = tasks.map(t => t.id === tid ? { ...t, title: newTitle } : t);
        }
        if (task?._draft) {
          tasks = tasks.map(t => t.id === tid ? { ...t, title: newTitle } : t);
        }
        demoteToSubtask(tid);
        return;
      }

      if (e.key === 'Escape') { titleEl.blur(); return; }
      return;
    }
  });

  // Auto-resize idea textarea as user types
  listEl.addEventListener('input', e => {
    if (e.target.id === 's-add-idea-input') {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  });

  // Click: all interactions
  listEl.addEventListener('click', e => {
    // Close menu if clicking outside
    if (!e.target.closest('[data-menu]') && !e.target.closest('.s-menu-popup')) {
      if (openMenuId) { openMenuId = null; renderList(); return; }
    }

    // Task checkbox
    const check = e.target.closest('.s-check[data-tid]');
    if (check) {
      const task = tasks.find(t => t.id === check.dataset.tid);
      if (task) apiToggleDone(task);
      return;
    }

    // Subtask checkbox
    const subCheck = e.target.closest('.s-subtask-check[data-sub]');
    if (subCheck) {
      const task = tasks.find(t => t.id === subCheck.dataset.tid);
      if (task) apiToggleSub(task, subCheck.dataset.sub);
      return;
    }

    // Menu button
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) {
      e.stopPropagation();
      openMenuId = openMenuId === menuBtn.dataset.menu ? null : menuBtn.dataset.menu;
      renderList();
      return;
    }

    // Menu item
    const menuItem = e.target.closest('[data-action]');
    if (menuItem) {
      const task = tasks.find(t => t.id === menuItem.dataset.tid);
      if (task) {
        if (menuItem.dataset.action === 'account') apiSetAccount(task, menuItem.dataset.val);
        if (menuItem.dataset.action === 'delete') apiDelete(task);
      }
      return;
    }

    // Due pills (task editor)
    const duePill = e.target.closest('[data-due]');
    if (duePill) {
      const task = tasks.find(t => t.id === duePill.dataset.tid);
      if (task) {
        const val = parseInt(duePill.dataset.due);
        apiSetDue(task, task.due === val ? null : val);
      }
      return;
    }

    // This week pill
    const weekPill = e.target.closest('[data-due-week]');
    if (weekPill) {
      const tid = weekPill.dataset.dueWeek;
      const task = tasks.find(t => t.id === tid);
      if (task) {
        const friday = daysUntilNextMonday() - 2; // Friday of this week
        apiSetDue(task, task.due === friday ? null : friday);
      }
      return;
    }

    // Custom date picker (task)
    const customDue = e.target.closest('[data-due-custom]');
    if (customDue) {
      const inp = customDue.parentElement.querySelector('[data-date-pick]');
      if (inp) inp.showPicker?.() || inp.click();
      return;
    }

    // Park button on task
    const parkBtn = e.target.closest('[data-park]');
    if (parkBtn) {
      const task = tasks.find(t => t.id === parkBtn.dataset.park);
      if (task) apiToggleParked(task);
      return;
    }

    // Park pill in editor
    const parkPill = e.target.closest('[data-park-pill]');
    if (parkPill) {
      const task = tasks.find(t => t.id === parkPill.dataset.parkPill);
      if (task) apiToggleParked(task);
      return;
    }

    // Delete button in editor
    const deleteBtn = e.target.closest('[data-delete]');
    if (deleteBtn) {
      const task = tasks.find(t => t.id === deleteBtn.dataset.delete);
      if (task) apiDelete(task);
      return;
    }

    // Expand task (click on body)
    const taskBody = e.target.closest('[data-body]');
    if (taskBody && !e.target.closest('.s-task-title')) {
      const tid = taskBody.dataset.body;
      if (!expandedTasks.has(tid)) {
        expandedTasks.add(tid);
        renderList();
      }
      return;
    }

    // Add due pills
    const addDuePill = e.target.closest('[data-add-due]');
    if (addDuePill) {
      const val = parseInt(addDuePill.dataset.addDue);
      lastAddTaskPills.due = lastAddTaskPills.due === val ? null : val;
      renderList();
      return;
    }

    // Add this week pill
    const addWeekPill = e.target.closest('[data-add-due-week]');
    if (addWeekPill) {
      const friday = daysUntilNextMonday() - 2;
      lastAddTaskPills.due = lastAddTaskPills.due === friday ? null : friday;
      renderList();
      return;
    }

    // Add custom date picker
    const addCustomDue = e.target.closest('[data-add-due-custom]');
    if (addCustomDue) {
      const inp = addCustomDue.parentElement.querySelector('[data-add-date-pick]');
      if (inp) inp.showPicker?.() || inp.click();
      return;
    }

    // Add park pill
    const addParkPill = e.target.closest('[data-add-park]');
    if (addParkPill) {
      // Not implemented in add flow (only in editor)
      return;
    }
  });

  // Input: add task typing
  listEl.addEventListener('input', e => {
    if (e.target.id === 's-add-input') {
      addTaskHasValue = e.target.value.trim().length > 0;
      const expanded = listEl.querySelector('.s-add-expanded');
      if (expanded) expanded.style.display = addTaskHasValue ? '' : 'none';
    }
  });

  // Change: date pickers
  listEl.addEventListener('change', e => {
    const dp = e.target.closest('[data-date-pick]');
    if (dp && dp.value) {
      const today = new Date(); today.setHours(0,0,0,0);
      const sel = new Date(dp.value + 'T00:00:00');
      const due = Math.round((sel - today) / 86400000);
      const task = tasks.find(t => t.id === dp.dataset.datePick);
      if (task) apiSetDue(task, due);
    }
    const addDp = e.target.closest('[data-add-date-pick]');
    if (addDp && addDp.value) {
      const today = new Date(); today.setHours(0,0,0,0);
      const sel = new Date(addDp.value + 'T00:00:00');
      lastAddTaskPills.due = Math.round((sel - today) / 86400000);
    }
  });

  // Focusout: save title, details, subtask text
  listEl.addEventListener('focusout', e => {
    const titleEl = e.target.closest('[data-title-tid]');
    if (titleEl) {
      const tid = titleEl.dataset.titleTid;
      const newTitle = titleEl.textContent.trim();
      const task = tasks.find(t => t.id === tid);
      if (task?._draft) {
        // Commit or remove draft
        commitDraft(tid, newTitle);
      } else if (task && newTitle && newTitle !== task.title) {
        apiRename(tid, newTitle);
      }
      return;
    }

    const detailsEl = e.target.closest('[data-notes]');
    if (detailsEl) {
      const tid = detailsEl.dataset.notes;
      const newDetails = detailsEl.value.trim();
      const task = tasks.find(t => t.id === tid);
      if (task && !task._draft && newDetails !== (task.details || '')) apiSaveDetails(tid, newDetails);
      return;
    }

    const subTextEl = e.target.closest('[data-sub-text]');
    if (subTextEl) {
      const tid = subTextEl.dataset.subTid;
      const subId = subTextEl.dataset.subText;
      const newText = subTextEl.textContent.trim();
      const task = tasks.find(t => t.id === tid);
      const sub = task?.subtasks.find(s => s.id === subId);
      if (sub?._draft) {
        commitSubDraft(tid, subId, newText);
      } else if (task && sub && newText && newText !== sub.text) {
        apiRenameSubtask(tid, subId, newText);
      }
      return;
    }
  });
}

// ── Render: Footer ─────────────────────────────────────────────
function renderFooter() {
  const f = document.getElementById('s-footer');
  f.innerHTML = `
    <span class="s-sync-status ${synced ? 'is-synced' : 'is-error'}">
      ${synced ? '● Synced' : '● Error'}
    </span>
    <span class="s-date">${dateToday()}</span>
  `;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  getClearedDone().then(cleared => {
    clearedDoneIds = cleared;
    loadTasks();
  });

  // Click outside expanded task → collapse it (use capture phase to run before list handlers re-render)
  document.addEventListener('mousedown', (e) => {
    if (expandedTasks.size === 0) return;
    const clickedTask = e.target.closest('.s-task.is-expanded');
    if (clickedTask) return; // click inside expanded task, keep open
    // Click outside any expanded task → collapse all
    expandedTasks.clear();
    renderList();
  });
});
