import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ACCOUNTS, TODAY, fmtMD, addDays,
  AccountDot, Icon,
} from './shared';

// ============================================================
// To-Do List — column-by-area board with full parity to the
// Chrome extension sidebar (Focus mode, parking, now tags, pills).
// ============================================================

const VIEWS = [
  { id: 'focus',   label: 'Focus' },
  { id: 'active',  label: 'Active' },
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'Week' },
  { id: 'parking', label: 'Parking' },
];

// ---- Focus timer persistence (survives navigation / reload) ----
const FOCUS_KEY = 'tether_focus_timer';
const loadTimer = () => { try { return JSON.parse(localStorage.getItem(FOCUS_KEY)) || null; } catch { return null; } };
const saveTimer = (t) => { try { t ? localStorage.setItem(FOCUS_KEY, JSON.stringify(t)) : localStorage.removeItem(FOCUS_KEY); } catch {} };

const fmtTime = (secs) => {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const remainingSeconds = (t) => {
  if (!t || !t.active) return 0;
  if (t.paused) return t.pausedRemaining;
  return Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
};

const DURATIONS = [
  { id: '25/5',  work: 25, brk: 5,  label: '25 / 5'  },
  { id: '50/10', work: 50, brk: 10, label: '50 / 10' },
];

// ============================================================
// Main board
// ============================================================
export function TodoList({ state, actions }) {
  const [view, setView] = useState('active');
  const [labelFilter, setLabelFilter] = useState(null);
  const todos = state.todos;

  const update      = (id, patch) => actions.updateTodo(id, patch);
  const toggleDone  = (id) => actions.toggleDone(id);
  const delTodo     = (id) => actions.deleteTodo(id);
  const addSubtask  = (id, text) => actions.addSubtask(id, text);
  const toggleSub   = (todoId, subId) => actions.toggleSubtask(todoId, subId);

  const focusCount = todos.filter((t) => t.now && !t.done).length;
  const parkedCount = todos.filter((t) => t.parked && !t.done).length;

  // Collect all unique non-system labels from active tasks
  const availableLabels = useMemo(() => {
    const seen = new Set();
    todos.forEach((t) => (t.labels || []).forEach((l) => seen.add(l)));
    return [...seen].sort();
  }, [todos]);

  return (
    <div className="page tdx-page fade-in">
      <div className="tdx-tabs">
        {VIEWS.map((v) => {
          const badge = v.id === 'focus' ? focusCount : v.id === 'parking' ? parkedCount : 0;
          return (
            <button
              key={v.id}
              className={'tdx-tab' + (view === v.id ? ' is-on' : '') + (v.id === 'focus' ? ' is-focus' : '')}
              onClick={() => setView(v.id)}>
              {v.id === 'focus' && <Icon.Clock />}
              {v.label}
              {badge > 0 && <span className="tdx-tab-badge">{badge}</span>}
            </button>
          );
        })}
      </div>

      {availableLabels.length > 0 && view !== 'focus' && (
        <div className="tdx-label-filters">
          <button
            className={'tdx-label-filter' + (!labelFilter ? ' is-on' : '')}
            onClick={() => setLabelFilter(null)}>
            All
          </button>
          {availableLabels.map((l) => (
            <button
              key={l}
              className={'tdx-label-filter' + (labelFilter === l ? ' is-on' : '')}
              onClick={() => setLabelFilter(labelFilter === l ? null : l)}>
              {l}
            </button>
          ))}
        </div>
      )}

      {view === 'focus' ? (
        <FocusView todos={todos} actions={actions} />
      ) : (
        <div className="tdx-board">
          {ACCOUNTS.map((acc) => (
            <BoardColumn
              key={acc.id}
              acc={acc}
              view={view}
              todos={todos}
              labelFilter={labelFilter}
              actions={actions}
              update={update}
              toggleDone={toggleDone}
              delTodo={delTodo}
              addSubtask={addSubtask}
              toggleSub={toggleSub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// A single area column
// ============================================================
function BoardColumn({ acc, view, todos, labelFilter, actions, update, toggleDone, delTodo, addSubtask, toggleSub }) {
  const [newTitle, setNewTitle] = useState('');

  const areaTodos = useMemo(
    () => todos.filter((t) => t.account === acc.id),
    [todos, acc.id]
  );

  const isToday = (t) => t.due === 0 || (t.due != null && t.due < 0);
  const isThisWeek = (t) => t.due != null && t.due >= 0 && t.due <= 7;

  let incomplete = areaTodos.filter((t) => !t.done && !t.parked);
  if (view === 'today')   incomplete = incomplete.filter(isToday);
  if (view === 'week')    incomplete = incomplete.filter(isThisWeek);
  if (view === 'parking') incomplete = areaTodos.filter((t) => !t.done && t.parked);
  if (labelFilter)        incomplete = incomplete.filter((t) => (t.labels || []).includes(labelFilter));

  // Sort: overdue first, then priority, then due date
  const sorted = [...incomplete].sort((a, b) => {
    const aOver = a.due != null && a.due < 0;
    const bOver = b.due != null && b.due < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
    const ad = a.due == null ? Infinity : a.due;
    const bd = b.due == null ? Infinity : b.due;
    return ad - bd;
  });

  const doneToday = areaTodos.filter((t) => t.done && t.completedDay === 'today');
  const [showDone, setShowDone] = useState(false);

  const addTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    actions.addTodo({
      id: Date.now(),
      title,
      account: acc.id,
      done: false,
      priority: false,
      details: null,
      due: view === 'today' ? 0 : null,
      parked: view === 'parking',
      now: false,
      subtasks: [],
    });
    setNewTitle('');
  };

  return (
    <div className="tdx-col">
      <div className="tdx-col-head">
        <AccountDot acc={acc.id} />
        <span className="tdx-col-name">{acc.name}</span>
        <span className="tdx-col-count">{sorted.length}</span>
      </div>

      {view !== 'parking' && (
        <div className="tdx-add">
          <span className="tdx-add-icon"><Icon.Plus /></span>
          <input
            className="tdx-add-input"
            placeholder="Add a task…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTask();
              if (e.key === 'Escape') setNewTitle('');
            }}
          />
        </div>
      )}

      <div className="tdx-col-list">
        {sorted.map((t) => (
          <TaskCard
            key={t.id} t={t}
            onToggle={() => toggleDone(t.id)}
            onDelete={() => delTodo(t.id)}
            onUpdate={(patch) => update(t.id, patch)}
            onToggleSub={(sid) => toggleSub(t.id, sid)}
            onAddSub={(txt) => addSubtask(t.id, txt)}
          />
        ))}

        {sorted.length === 0 && (
          <div className="tdx-col-empty">
            {view === 'parking' ? 'Nothing parked.' : 'All clear.'}
          </div>
        )}
      </div>

      {doneToday.length > 0 && (
        <div className="tdx-done">
          <button className="tdx-done-toggle" onClick={() => setShowDone((s) => !s)}>
            <Icon.Chevron style={{ transform: showDone ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
            Done today · {doneToday.length}
          </button>
          {showDone && doneToday.map((t) => (
            <TaskCard
              key={t.id} t={t} compact
              onToggle={() => toggleDone(t.id)}
              onDelete={() => delTodo(t.id)}
              onUpdate={(patch) => update(t.id, patch)}
              onToggleSub={(sid) => toggleSub(t.id, sid)}
              onAddSub={(txt) => addSubtask(t.id, txt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Task card — collapsed row + expandable editor (pill row)
// ============================================================
function TaskCard({ t, onToggle, onDelete, onUpdate, onToggleSub, onAddSub, compact }) {
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(t.title);
  const [subText, setSubText] = useState('');
  const [pickDate, setPickDate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const titleRef = useRef(null);

  const overdue = t.due != null && t.due < 0 && !t.done;
  const doneSubs = t.subtasks.filter((s) => s.done).length;

  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== t.title) onUpdate({ title: trimmed });
    else setEditTitle(t.title);
    setEditingTitle(false);
  };

  const todayISO = TODAY.toISOString().slice(0, 10);
  const dueISO = t.due != null ? addDays(TODAY, t.due).toISOString().slice(0, 10) : '';
  const saveDate = (val) => {
    if (!val) onUpdate({ due: null });
    else {
      const days = Math.round((new Date(val + 'T12:00:00') - new Date(todayISO + 'T12:00:00')) / 86400000);
      onUpdate({ due: days });
    }
    setPickDate(false);
  };

  const dueLabel = t.due == null ? null
    : t.due === 0 ? 'Today'
    : t.due === 1 ? 'Tmrw'
    : t.due < 0 ? `${Math.abs(t.due)}d late`
    : fmtMD(addDays(TODAY, t.due));

  return (
    <div className={'tdx-task' + (t.done ? ' is-done' : '') + (expanded ? ' is-expanded' : '')}>
      <div className="tdx-task-head">
        <button
          type="button"
          className={'tdx-check' + (t.done ? ' is-checked' : '')}
          data-acc={t.account}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-pressed={t.done}>
          <Icon.Check />
        </button>

        <div className="tdx-task-body" onClick={() => !editingTitle && setExpanded((v) => !v)}>
          {editingTitle ? (
            <input
              ref={titleRef}
              className="tdx-title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={saveTitle}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveTitle();
                if (e.key === 'Escape') { setEditTitle(t.title); setEditingTitle(false); }
              }}
            />
          ) : (
            <span
              className="tdx-title"
              onDoubleClick={(e) => { e.stopPropagation(); setEditTitle(t.title); setEditingTitle(true); }}>
              {t.title}
            </span>
          )}

          {t.priority && !t.done && <span className="tdx-flag">★</span>}
          {t.now && !t.done && <span className="tdx-now">now</span>}
          {t.labels?.map(l => (
            <span key={l} className="tdx-label">{l}</span>
          ))}
          {dueLabel && (
            <span className={'tdx-due' + (overdue ? ' is-overdue' : '')}>{dueLabel}</span>
          )}
          {t.subtasks.length > 0 && (
            <span className="tdx-sub-count">{doneSubs}/{t.subtasks.length}</span>
          )}
        </div>

        {!compact && (
          <div className="tdx-actions">
            <button
              className={'tdx-act' + (t.parked ? ' is-on' : '')}
              title={t.parked ? 'Un-park' : 'Park'}
              onClick={(e) => { e.stopPropagation(); onUpdate({ parked: !t.parked }); }}>
              <Icon.Clock />
            </button>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className={'tdx-act' + (menuOpen ? ' is-on' : '')}
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} title="More">
                <Icon.Kebab />
              </button>
              {menuOpen && (
                <div className="tdx-menu">
                  <button onClick={() => { setEditTitle(t.title); setEditingTitle(true); setMenuOpen(false); }}>Edit title</button>
                  <button onClick={() => { onUpdate({ now: !t.now }); setMenuOpen(false); }}>
                    {t.now ? 'Remove from Focus' : 'Add to Focus'}
                  </button>
                  <button onClick={() => { onUpdate({ parked: !t.parked }); setMenuOpen(false); }}>
                    {t.parked ? 'Un-park' : 'Park'}
                  </button>
                  <div className="tdx-menu-sep" />
                  <button className="is-danger" onClick={() => { onDelete(); setMenuOpen(false); }}>Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!expanded && !compact && !t.done && t.subtasks.length > 0 && (
        <div className="tdx-subs-inline">
          {t.subtasks.map((s) => (
            <div key={s.id} className={'tdx-sub-inline' + (s.done ? ' is-done' : '')}>
              <button
                type="button"
                className={'tdx-check tdx-check-sm' + (s.done ? ' is-checked' : '')}
                data-acc={t.account}
                onClick={(e) => { e.stopPropagation(); onToggleSub(s.id); }}>
                <Icon.Check />
              </button>
              <span className="tdx-sub-inline-text">{s.text}</span>
            </div>
          ))}
        </div>
      )}

      {expanded && !compact && (
        <div className="tdx-editor fade-in">
          <div className="tdx-pills">
            <button className={'tdx-pill' + (t.due === 0 ? ' is-on' : '')}
              onClick={() => onUpdate({ due: t.due === 0 ? null : 0 })} title="Due today">!</button>
            <button className={'tdx-pill' + (t.due === 1 ? ' is-on' : '')}
              onClick={() => onUpdate({ due: t.due === 1 ? null : 1 })} title="Due tomorrow">!!</button>
            <button className={'tdx-pill' + (t.due === 7 ? ' is-on' : '')}
              onClick={() => onUpdate({ due: t.due === 7 ? null : 7 })} title="End of week">EOW</button>
            <button className={'tdx-pill icon-only' + (pickDate ? ' is-on' : '')}
              onClick={() => setPickDate((v) => !v)} title="Pick a date"><Icon.Clock /></button>
            <button className={'tdx-pill' + (t.priority ? ' is-on' : '')}
              onClick={() => onUpdate({ priority: !t.priority })} title="Flag priority">★</button>
            <button className={'tdx-pill focus-pill' + (t.now ? ' is-on' : '')}
              onClick={() => onUpdate({ now: !t.now })} title="Add to Focus">＋ Focus</button>
            <button className={'tdx-pill park-pill' + (t.parked ? ' is-on' : '')}
              onClick={() => onUpdate({ parked: !t.parked })}>Park</button>
            <button className="tdx-pill del-pill" onClick={onDelete} title="Delete"><Icon.X /></button>
          </div>

          {pickDate && (
            <div className="tdx-datepick">
              <input type="date" defaultValue={dueISO} autoFocus onChange={(e) => saveDate(e.target.value)} />
              {t.due != null && <button className="tdx-link-danger" onClick={() => saveDate('')}>Clear</button>}
            </div>
          )}

          <textarea
            className="tdx-notes"
            placeholder="Add notes…"
            defaultValue={t.details || ''}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (t.details || '')) onUpdate({ details: v || null });
            }}
          />

          <div className="tdx-subs">
            {t.subtasks.map((s) => (
              <div key={s.id} className={'tdx-sub' + (s.done ? ' is-done' : '')}>
                <button
                  type="button"
                  className={'tdx-check tdx-check-sm' + (s.done ? ' is-checked' : '')}
                  data-acc={t.account}
                  onClick={() => onToggleSub(s.id)}>
                  <Icon.Check />
                </button>
                <span>{s.text}</span>
              </div>
            ))}
            <div className="tdx-sub-add">
              <Icon.Plus />
              <input
                placeholder="Add subtask"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { onAddSub(subText); setSubText(''); }
                  if (e.key === 'Escape') setSubText('');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Focus mode — self-contained timer + cross-area "now" list
// ============================================================
function FocusView({ todos, actions }) {
  const [timer, setTimer] = useState(loadTimer);
  const [choice, setChoice] = useState('25/5');
  const [, forceTick] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [newAccount, setNewAccount] = useState('findem');
  const notifiedRef = useRef(false);

  // persist on every change
  useEffect(() => { saveTimer(timer); }, [timer]);

  // tick once a second while running
  useEffect(() => {
    if (!timer || !timer.active || timer.paused) return;
    const i = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [timer]);

  const remaining = remainingSeconds(timer);
  const ended = timer && timer.active && !timer.paused && remaining <= 0;

  // fire a notification + chime once when a phase ends
  useEffect(() => {
    if (!ended) { notifiedRef.current = false; return; }
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(timer.phase === 'work' ? 'Focus block complete' : 'Break over', {
            body: timer.phase === 'work' ? 'Time for a break.' : 'Back to it.',
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 660; gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, [ended, timer]);

  const nowTasks = todos.filter((t) => t.now);

  const startSession = () => {
    const d = DURATIONS.find((x) => x.id === choice) || DURATIONS[0];
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    setTimer({
      active: true, paused: false, phase: 'work',
      workMin: d.work, breakMin: d.brk,
      endsAt: Date.now() + d.work * 60000,
      pausedRemaining: 0, pomodoros: 0,
    });
  };

  const pauseResume = () => setTimer((t) => {
    if (!t) return t;
    if (t.paused) return { ...t, paused: false, endsAt: Date.now() + t.pausedRemaining * 1000 };
    return { ...t, paused: true, pausedRemaining: remainingSeconds(t) };
  });

  const addFive = () => setTimer((t) => t ? { ...t, endsAt: (t.paused ? Date.now() : t.endsAt) + 5 * 60000, pausedRemaining: t.paused ? t.pausedRemaining + 300 : t.pausedRemaining } : t);

  const stop = () => setTimer(null);

  const startBreak = () => setTimer((t) => ({
    ...t, phase: 'break', paused: false,
    endsAt: Date.now() + t.breakMin * 60000,
    pomodoros: (t.pomodoros || 0) + 1,
  }));

  const newSession = (carryOver) => {
    if (!carryOver) nowTasks.forEach((t) => actions.updateTodo(t.id, { now: false }));
    setTimer(null);
  };

  const addFocusTask = () => {
    const title = newTitle.trim();
    if (!title) return;
    actions.addTodo({
      id: Date.now(), title, account: newAccount,
      done: false, priority: false, details: null, due: null,
      parked: false, now: true, subtasks: [],
    });
    setNewTitle('');
  };

  const isBreak = timer && timer.phase === 'break';
  const total = timer ? (isBreak ? timer.breakMin : timer.workMin) * 60 : 1;
  const progress = timer ? Math.min(100, Math.max(0, (1 - remaining / total) * 100)) : 0;

  const focusList = (
    <div className="tdx-focus-list">
      {nowTasks.length === 0 ? (
        <div className="tdx-focus-empty">No focus tasks yet — add one below.</div>
      ) : nowTasks.map((t) => (
        <div key={t.id} className={'tdx-focus-task' + (t.done ? ' is-done' : '')}>
          <button
            type="button"
            className={'tdx-check' + (t.done ? ' is-checked' : '')}
            data-acc={t.account}
            onClick={() => actions.toggleDone(t.id)}>
            <Icon.Check />
          </button>
          <span className="tdx-focus-task-text">{t.title}</span>
          <button className="tdx-focus-remove" title="Remove from Focus"
            onClick={() => actions.updateTodo(t.id, { now: false })}>
            <Icon.X />
          </button>
        </div>
      ))}
    </div>
  );

  const addField = (
    <div className="tdx-focus-add">
      <span className="tdx-add-icon"><Icon.Plus /></span>
      <input
        placeholder="Add a task to focus on…"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') addFocusTask(); }}
      />
      <div className="tdx-focus-acc">
        {ACCOUNTS.map((a) => (
          <button key={a.id}
            className={'tdx-acc-dot' + (newAccount === a.id ? ' is-on' : '')}
            title={a.name}
            onClick={() => setNewAccount(a.id)}>
            <AccountDot acc={a.id} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="tdx-focus">
      {!timer ? (
        // ---- setup ----
        <>
          <div className="tdx-chips">
            {DURATIONS.map((d) => (
              <button key={d.id}
                className={'tdx-chip' + (choice === d.id ? ' is-on' : '')}
                onClick={() => setChoice(d.id)}>
                <span className="tdx-chip-time">{d.label}</span>
                <span className="tdx-chip-label">work / break</span>
              </button>
            ))}
          </div>
          {addField}
          {focusList}
          <button className="tdx-focus-start" onClick={startSession} disabled={nowTasks.length === 0}>
            Start focus session
          </button>
        </>
      ) : ended ? (
        // ---- ended ----
        <div className="tdx-timer-card">
          <div className="tdx-timer-top">
            <div className="tdx-timer-phase">{isBreak ? 'Break over' : 'Focus block complete'}</div>
            <div className="tdx-timer-time">{isBreak ? '☕' : '✓'}</div>
            <div className="tdx-timer-meta">{(timer.pomodoros || 0)} pomodoro{(timer.pomodoros || 0) === 1 ? '' : 's'} done</div>
          </div>
          {!isBreak && (
            <button className="tdx-break-btn" onClick={startBreak}>Start {timer.breakMin}-min break</button>
          )}
          <div className="tdx-new-label">New session</div>
          <div className="tdx-session-opts">
            <button className="tdx-session-opt" onClick={() => newSession(true)}>Carry over</button>
            <button className="tdx-session-opt" onClick={() => newSession(false)}>Start fresh</button>
          </div>
        </div>
      ) : (
        // ---- running ----
        <>
          <div className="tdx-timer-card">
            <div className="tdx-timer-top">
              <div className={'tdx-timer-phase' + (isBreak ? ' is-break' : '')}>{isBreak ? 'Break' : 'Focus'}</div>
              <div className="tdx-timer-time">{fmtTime(remaining)}</div>
              <div className="tdx-timer-meta">{timer.paused ? 'Paused' : (isBreak ? `${timer.breakMin}-min break` : `${timer.workMin}-min block`)}</div>
            </div>
            <div className="tdx-progress">
              <div className={'tdx-progress-fill' + (isBreak ? ' is-break' : '')} style={{ width: progress + '%' }} />
            </div>
            <div className="tdx-timer-controls">
              <button className="tdx-timer-btn" onClick={pauseResume}>{timer.paused ? 'Resume' : 'Pause'}</button>
              <button className="tdx-timer-btn" onClick={addFive}>+5 min</button>
              <button className="tdx-timer-btn is-danger" onClick={stop}>Stop</button>
            </div>
            {(timer.pomodoros || 0) > 0 && (
              <div className="tdx-pomo">{'🍅'.repeat(timer.pomodoros)}</div>
            )}
          </div>
          {!isBreak && (
            <>
              {addField}
              {focusList}
            </>
          )}
        </>
      )}
    </div>
  );
}
