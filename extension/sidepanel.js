// ── Config ───────────────────────────────────────────────────
const BASE = 'https://to-tether.app/api';
const ACCTS = [
  { id: 'findem',   name: 'Findem',          color: '#3B82F6' },
  { id: 'jones',    name: 'Quit with Jones', color: '#8B5CF6' },
  { id: 'personal', name: 'Personal',        color: '#64748B' },
];
const accColor = id => ACCTS.find(a => a.id === id)?.color || '#9CA3AF';
const accName  = id => ACCTS.find(a => a.id === id)?.name  || id;

// ── State ────────────────────────────────────────────────────
let tasks       = [];
let filter      = 'all';
let priorityOnly= false;
let showDone    = true;
let filterOpen  = false;
let loading     = true;
let error       = null;
let synced      = false;
let openMenuId  = null; // task id whose 3-dot menu is open

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
    tasks = await apiFetch('GET', '/tasks') || [];
    synced = true;
  } catch (err) {
    error = err.message;
    synced = false;
  } finally {
    loading = false;
  }
  renderList();
  renderFooter();
}

async function apiToggleDone(task) {
  const newDone = !task.done;
  tasks = tasks.map(t => t.id === task.id ? { ...t, done: newDone } : t);
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, done: newDone });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiToggleSub(task, subId) {
  const newSubs = task.subtasks.map(s => s.id === subId ? { ...s, done: !s.done } : s);
  tasks = tasks.map(t => t.id === task.id ? { ...t, subtasks: newSubs } : t);
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: subId, done: !task.subtasks.find(s => s.id === subId)?.done });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiSetPriority(task, val) {
  tasks = tasks.map(t => t.id === task.id ? { ...t, priority: val } : t);
  openMenuId = null;
  renderList();
  try {
    await apiFetch('PATCH', '/tasks', { id: task.id, priority: val });
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
  renderList();
  try {
    await apiFetch('DELETE', '/tasks', { id: task.id });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiCreate(title) {
  const account = filter !== 'all' ? filter : 'personal';
  const temp = { id: 'tmp-' + Date.now(), title, account, done: false, priority: false, due: null, subtasks: [] };
  tasks = [temp, ...tasks];
  renderList();
  try {
    const created = await apiFetch('POST', '/tasks', { title, account, done: false, priority: false });
    tasks = tasks.map(t => t.id === temp.id ? { ...temp, ...created } : t);
    synced = true;
  } catch { synced = false; }
  renderList();
  renderFooter();
}

async function apiAddSub(task, text) {
  const temp = { id: 'tmp-sub-' + Date.now(), text, done: false };
  tasks = tasks.map(t => t.id === task.id ? { ...t, subtasks: [...t.subtasks, temp] } : t);
  renderList();
  try {
    const created = await apiFetch('POST', '/tasks', { title: text, account: task.account, done: false, parentId: task.id });
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

async function apiRename(tid, newTitle) {
  tasks = tasks.map(t => t.id === tid ? { ...t, title: newTitle } : t);
  try {
    await apiFetch('PATCH', '/tasks', { id: tid, title: newTitle });
    synced = true;
  } catch { synced = false; }
  renderFooter();
}

async function apiSaveNotes(tid, details) {
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

// ── SVG icons ────────────────────────────────────────────────
const LOGO_SVG = `
<svg width="25" height="14" viewBox="0 0 36 20" fill="none">
  <line x1="4" y1="10" x2="10" y2="4" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="10" y1="4" x2="16" y2="10" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="4" y1="10" x2="10" y2="16" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/>
  <line x1="10" y1="16" x2="16" y2="10" stroke="#6C63FF" stroke-width="1.6" stroke-linecap="round" opacity="0.35"/>
  <circle cx="4" cy="10" r="2" fill="#6C63FF"/>
  <circle cx="10" cy="4" r="2" fill="#6C63FF"/>
  <circle cx="16" cy="10" r="2" fill="#6C63FF"/>
  <circle cx="10" cy="16" r="1.4" fill="#6C63FF" opacity="0.35"/>
</svg>`;

const ICO_CHECK = `<svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_PLUS  = `<svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICO_DOTS  = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/></svg>`;
const ICO_CHEV  = `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3.5 4.5L6 7l2.5-2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_FLAG  = `<svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor"><path d="M3.5 2v10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M3.5 2.5h7l-2.2 2.8 2.2 2.7h-7z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`;
const ICO_SUN   = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M7 2v1.2M7 10.8v1.2M2 7h1.2M10.8 7H12M3.5 3.5l.8.8M9.7 9.7l.8.8M3.5 10.5l.8-.8M9.7 4.3l.8-.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
const ICO_ARR   = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_CLOCK = `<svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.3"/><path d="M7 4v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICO_TRASH = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 4.5h8M5.5 4.5V3a1 1 0 011-1h1a1 1 0 011 1v1.5M4.5 4.5l.5 7h4l.5-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ── Render: Header ────────────────────────────────────────────
function renderHeader() {
  const h = document.getElementById('s-header');
  const filterLabel = filter === 'all'
    ? 'All'
    : ACCTS.find(a => a.id === filter)?.name.split(' ')[0];

  h.innerHTML = `
    <div class="s-header-row">
      <a class="s-brand" href="https://to-tether.app" target="_blank" style="text-decoration:none;cursor:pointer">
        ${LOGO_SVG}
        <span class="s-brand-name"><em>teth</em><strong>er</strong></span>
      </a>
      <div class="s-header-right">
        <button class="s-prio-toggle ${priorityOnly ? 'is-on' : ''}" id="s-prio-btn">
          ${ICO_FLAG}
        </button>
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
    </div>`;

  // Events
  document.getElementById('s-prio-btn').addEventListener('click', () => {
    priorityOnly = !priorityOnly;
    renderHeader();
    renderList();
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
}

// ── Render: Task card ─────────────────────────────────────────
function makeTaskEl(task) {
  const color  = accColor(task.account);
  const isOpen = openMenuId === task.id;
  const dl     = dueLabel(task.due);
  const hasCustomDue = task.due !== null && task.due !== undefined && task.due > 1;

  const div = document.createElement('div');
  div.className = `s-task${task.priority && !task.done ? ' is-priority' : ''}${task.done ? ' is-done' : ''}`;
  if (task.priority && !task.done) div.style.borderLeftColor = color;

  // Build HTML
  div.innerHTML = `
    <div class="s-task-top">
      <button class="s-check ${task.done ? 'is-checked' : ''}" style="${task.done ? `background:${color}` : ''}" data-tid="${task.id}">
        ${task.done ? `<span style="color:${color === '#64748B' ? '#fff' : '#fff'}">${ICO_CHECK}</span>` : ''}
      </button>
      <div class="s-task-body">
        <div class="s-task-title-row">
          <span class="s-task-title" contenteditable="plaintext-only" data-title-tid="${task.id}" spellcheck="false">${escHtml(task.title)}</span>
          <span class="s-acc-dot" style="background:${color}"></span>
          ${task.priority && !task.done ? `<span class="s-prio-badge" style="color:${color};background:${color}18">PRIORITY</span>` : ''}
          ${(task.labels || []).map(l => `<span class="s-label-badge">${escHtml(l)}</span>`).join('')}
        </div>
        ${dl && !task.done ? `<div style="margin-top:3px">
          <span style="font-size:11px;font-weight:500;color:${task.due < 0 ? 'var(--error)' : task.due === 0 ? 'var(--brand)' : 'var(--text-3)'}">
            ${dl === 'Today' || dl === 'Tomorrow' ? '' : ''}${dl}
          </span>
        </div>` : ''}
      </div>
      ${!task.done ? `
      <div class="s-menu-wrap">
        <button class="s-menu-btn ${isOpen ? 'is-open' : ''}" data-menu="${task.id}">${ICO_DOTS}</button>
        ${isOpen ? `
        <div class="s-menu-popup">
          <div class="s-menu-label">PRIORITY</div>
          <button class="s-menu-item ${task.priority ? 'is-active' : ''}" data-action="priority" data-tid="${task.id}">
            <span style="width:8px;height:8px;border-radius:2px;background:${color};opacity:${task.priority ? 1 : 0.4}"></span>
            ${task.priority ? 'Remove priority' : 'Mark as priority'}
            ${task.priority ? `<span style="margin-left:auto;font-size:11px;color:var(--text-3)">✓</span>` : ''}
          </button>
          <div class="s-menu-divider"></div>
          <button class="s-menu-item is-danger" data-action="delete" data-tid="${task.id}">${ICO_TRASH} Delete</button>
        </div>` : ''}
      </div>` : ''}
    </div>

    ${!task.done ? `
    <div class="s-subtasks" data-subtasks="${task.id}">
      ${task.subtasks.map(s => `
        <div class="s-subtask ${s.done ? 'is-done' : ''}">
          <button class="s-subtask-check ${s.done ? 'is-checked' : ''}" style="${s.done ? `background:${color}` : ''}" data-sub="${s.id}" data-tid="${task.id}">
            ${s.done ? `<span style="color:#fff">${ICO_CHECK}</span>` : ''}
          </button>
          <span class="s-subtask-text">${escHtml(s.text)}</span>
        </div>
      `).join('')}
      <div class="s-subtask-add">
        <span style="color:var(--text-3);flex-shrink:0">${ICO_PLUS}</span>
        <input class="s-subtask-input" placeholder="Add subtask…" data-sub-add="${task.id}" />
      </div>
      <textarea class="s-notes-input" placeholder="Notes…" data-notes="${task.id}" rows="1">${escHtml(task.details || '')}</textarea>
    </div>` : ''}

    ${!task.done ? `
    <div class="s-due-bubbles">
      <button class="s-due-bubble ${task.due === 0 ? 'is-on' : ''}" data-due="0" data-tid="${task.id}">
        ${ICO_SUN} Today
      </button>
      <button class="s-due-bubble ${task.due === 1 ? 'is-on' : ''}" data-due="1" data-tid="${task.id}">
        ${ICO_ARR} Tomorrow
      </button>
      <div style="position:relative;display:inline-flex">
        <button class="s-due-bubble icon-only ${hasCustomDue ? 'is-on' : ''}" data-due-custom="${task.id}" title="Pick date">
          ${ICO_CLOCK}${hasCustomDue ? ` <span style="margin-left:2px">${dl}</span>` : ''}
        </button>
        <input type="date" data-date-pick="${task.id}" style="position:absolute;opacity:0;width:0;height:0;pointer-events:none" />
      </div>
    </div>` : ''}
  `;

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
    <div class="s-add-circle">${ICO_PLUS}</div>
    <input class="s-add-input" id="s-add-input" placeholder="Add a task" autocomplete="off" />
  `;
  listEl.appendChild(addRow);

  // Filter and sort tasks
  let visible = tasks.filter(t => !t.done && (filter === 'all' || t.account === filter));
  if (priorityOnly) visible = visible.filter(t => t.priority);
  visible.sort((a, b) => {
    if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
    return 0;
  });

  if (visible.length === 0 && !priorityOnly) {
    const msg = document.createElement('div');
    msg.className = 's-empty-msg';
    msg.textContent = filter !== 'all' ? 'No tasks for this account.' : 'All clear — nice work.';
    listEl.appendChild(msg);
  } else {
    visible.forEach(task => listEl.appendChild(makeTaskEl(task)));
  }

  // Completed section
  const done = tasks.filter(t => t.done && (filter === 'all' || t.account === filter));
  if (done.length > 0) {
    const toggle = document.createElement('button');
    toggle.className = 's-completed-toggle';
    toggle.innerHTML = `<span class="s-chev ${showDone ? 'is-up' : 'is-down'}">${ICO_CHEV}</span> Completed · ${done.length}`;
    toggle.addEventListener('click', () => { showDone = !showDone; renderList(); });
    listEl.appendChild(toggle);

    if (showDone) {
      done.forEach(task => listEl.appendChild(makeTaskEl(task)));
    }
  }

  // Attach all events via delegation
  attachListEvents(listEl);
}

function attachListEvents(listEl) {
  // Add task
  const addInput = document.getElementById('s-add-input');
  addInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && addInput.value.trim()) {
      apiCreate(addInput.value.trim());
      addInput.value = '';
    }
  });

  // All clicks in list
  listEl.addEventListener('click', e => {
    // Close menu on outside click
    if (!e.target.closest('[data-menu]') && !e.target.closest('.s-menu-popup')) {
      if (openMenuId) { openMenuId = null; renderList(); return; }
    }

    // Toggle done
    const check = e.target.closest('[data-tid].s-check');
    if (check) {
      const task = tasks.find(t => t.id === check.dataset.tid);
      if (task) apiToggleDone(task);
      return;
    }

    // Subtask toggle
    const subCheck = e.target.closest('[data-sub][data-tid]');
    if (subCheck && subCheck.classList.contains('s-subtask-check')) {
      const task = tasks.find(t => t.id === subCheck.dataset.tid);
      if (task) apiToggleSub(task, subCheck.dataset.sub);
      return;
    }

    // 3-dot menu open/close
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) {
      e.stopPropagation();
      openMenuId = openMenuId === menuBtn.dataset.menu ? null : menuBtn.dataset.menu;
      renderList();
      return;
    }

    // Menu actions
    const menuItem = e.target.closest('[data-action]');
    if (menuItem) {
      const task = tasks.find(t => t.id === menuItem.dataset.tid);
      if (!task) return;
      if (menuItem.dataset.action === 'priority') apiSetPriority(task, !task.priority);
      if (menuItem.dataset.action === 'delete') apiDelete(task);
      return;
    }

    // Due bubbles
    const dueBubble = e.target.closest('[data-due]');
    if (dueBubble) {
      const task = tasks.find(t => t.id === dueBubble.dataset.tid);
      if (!task) return;
      const val = parseInt(dueBubble.dataset.due);
      apiSetDue(task, task.due === val ? null : val);
      return;
    }

    // Custom date picker trigger
    const customDue = e.target.closest('[data-due-custom]');
    if (customDue) {
      const input = customDue.parentElement.querySelector('[data-date-pick]');
      if (input) input.showPicker?.() || input.click();
      return;
    }
  });

  // Custom date change
  listEl.querySelectorAll('[data-date-pick]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.value) return;
      const today = new Date(); today.setHours(0,0,0,0);
      const sel = new Date(input.value + 'T00:00:00');
      const due = Math.round((sel - today) / 86400000);
      const task = tasks.find(t => t.id === input.dataset.datePick);
      if (task) apiSetDue(task, due);
    });
  });

  // Subtask add
  listEl.querySelectorAll('[data-sub-add]').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim()) {
        const task = tasks.find(t => t.id === input.dataset.subAdd);
        if (task) { apiAddSub(task, input.value.trim()); input.value = ''; }
      }
    });
  });

  // Title inline edit: Enter → save + jump to subtask input
  listEl.addEventListener('keydown', e => {
    const titleEl = e.target.closest('[data-title-tid]');
    if (!titleEl) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const tid = titleEl.dataset.titleTid;
      const newTitle = titleEl.textContent.trim();
      const task = tasks.find(t => t.id === tid);
      if (task && newTitle && newTitle !== task.title) apiRename(tid, newTitle);
      const subtaskInput = listEl.querySelector(`[data-sub-add="${tid}"]`);
      subtaskInput?.focus();
    }
    if (e.key === 'Escape') titleEl.blur();
  }, false);

  // Title inline edit: blur → save if changed
  // Notes textarea: blur → save
  listEl.addEventListener('focusout', e => {
    const titleEl = e.target.closest('[data-title-tid]');
    if (titleEl) {
      const tid = titleEl.dataset.titleTid;
      const newTitle = titleEl.textContent.trim();
      const task = tasks.find(t => t.id === tid);
      if (task && newTitle && newTitle !== task.title) apiRename(tid, newTitle);
      if (!newTitle) titleEl.textContent = task?.title || ''; // restore if cleared
    }
    const notesEl = e.target.closest('[data-notes]');
    if (notesEl) {
      const tid = notesEl.dataset.notes;
      const task = tasks.find(t => t.id === tid);
      if (task && notesEl.value !== (task.details || '')) apiSaveNotes(tid, notesEl.value);
    }
  }, false);
}

// ── Render: Footer ────────────────────────────────────────────
function renderFooter() {
  const f = document.getElementById('s-footer');
  if (!f) return;
  f.innerHTML = `
    <div class="s-sync">
      <span class="s-sync-dot ${synced ? 'ok' : 'err'}"></span>
      ${synced ? 'Synced' : 'Offline'}
    </div>
    <span>${dateToday()}</span>
  `;
}

// ── Util ──────────────────────────────────────────────────────
function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Close filter dropdown on outside click
document.addEventListener('click', () => {
  if (filterOpen) { filterOpen = false; renderHeader(); }
  if (openMenuId) { openMenuId = null; renderList(); }
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  loadTasks();
});
