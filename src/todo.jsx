import React, { useState, useMemo } from 'react';
import {
  ACCOUNTS, TODAY, fmtShort, fmtMD, addDays,
  Checkbox, AccountDot, Icon,
} from './shared';

// ============================================================
// To-Do List
// ============================================================

export function TodoList({ state, setState }) {
  const [filter, setFilter] = useState("all");
  const [showWeek, setShowWeek] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newAccount, setNewAccount] = useState("getro");
  const [newDetails, setNewDetails] = useState("");
  const [expandedDetails, setExpandedDetails] = useState({});

  const todos = state.todos;
  const filtered = useMemo(
    () => todos.filter((t) => filter === "all" || t.account === filter),
    [todos, filter]
  );

  const incomplete = filtered.filter((t) => !t.done);
  const doneToday = filtered.filter((t) => t.done && t.completedDay === "today");
  const doneWeek = filtered.filter((t) => t.done && t.completedDay !== "today");

  const sortedIncomplete = [...incomplete].sort((a, b) => {
    const aOver = a.due != null && a.due < 0;
    const bOver = b.due != null && b.due < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
    return a.id - b.id;
  });

  const update = (id, patch) => {
    setState((s) => ({ ...s, todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  };
  const toggleDone = (id) => {
    setState((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, done: !t.done, completedDay: !t.done ? "today" : null } : t
      ),
    }));
  };
  const delTodo = (id) => setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
  const addTodo = () => {
    if (!newTitle.trim()) return;
    const next = {
      id: Date.now(),
      title: newTitle.trim(),
      account: newAccount,
      done: false,
      priority: false,
      details: newDetails.trim() || null,
      due: null,
      subtasks: [],
    };
    setState((s) => ({ ...s, todos: [next, ...s.todos] }));
    setNewTitle(""); setNewDetails(""); setNewOpen(false);
  };
  const addSubtask = (id, text) => {
    if (!text.trim()) return;
    setState((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === id
          ? { ...t, subtasks: [...t.subtasks, { id: Date.now(), text: text.trim(), done: false }] }
          : t
      ),
    }));
  };
  const toggleSub = (todoId, subId) => {
    setState((s) => ({
      ...s,
      todos: s.todos.map((t) =>
        t.id === todoId
          ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subId ? { ...st, done: !st.done } : st)) }
          : t
      ),
    }));
  };

  return (
    <div className="page page--narrow fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span className="date-chip">
          <span className="cal-icon" />
          {fmtShort(TODAY)}
        </span>
        <div className="filter-row">
          <button
            className={"filter-btn" + (filter === "all" ? " is-active" : "")}
            onClick={() => setFilter("all")}>
            All
          </button>
          {ACCOUNTS.map((a) => (
            <button key={a.id}
              className={"filter-btn filter-btn--dot" + (filter === a.id ? " is-active" : "")}
              onClick={() => setFilter(a.id)}
              title={a.name}>
              <AccountDot acc={a.id} />
            </button>
          ))}
        </div>
      </div>

      <div className="todo-list">
        {/* Add row */}
        <div className={"todo todo-add" + (newOpen ? " is-open" : "")}>
          <button className="todo-add-plus" onClick={() => setNewOpen(true)}>
            <Icon.Plus />
          </button>
          <div className="todo-main">
            <input
              className="todo-add-input"
              placeholder="Add a task…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onFocus={() => setNewOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTodo();
                if (e.key === "Escape") { setNewTitle(""); setNewDetails(""); setNewOpen(false); }
              }}
            />
            {newOpen && (
              <div className="todo-add-expand fade-in">
                <input
                  className="todo-add-details"
                  placeholder="Add details (optional)"
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
                />
                <div className="todo-add-controls">
                  <span className="tiny">Account</span>
                  {ACCOUNTS.map((a) => (
                    <button key={a.id}
                      className={"acc-chip" + (newAccount === a.id ? " is-on" : "")}
                      onClick={() => setNewAccount(a.id)}
                      title={a.name}>
                      <AccountDot acc={a.id} />
                      <span>{a.short}</span>
                    </button>
                  ))}
                  <div className="spacer" />
                  <button className="btn-text" onClick={() => { setNewTitle(""); setNewDetails(""); setNewOpen(false); }}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={addTodo} disabled={!newTitle.trim()}>
                    Add task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {sortedIncomplete.map((t) => (
          <TodoRow key={t.id} t={t}
            expanded={!!expandedDetails[t.id]}
            onExpand={() => setExpandedDetails((s) => ({ ...s, [t.id]: !s[t.id] }))}
            onToggle={() => toggleDone(t.id)}
            onTogglePriority={() => update(t.id, { priority: !t.priority })}
            onDelete={() => delTodo(t.id)}
            onToggleSub={(sid) => toggleSub(t.id, sid)}
            onAddSub={(txt) => addSubtask(t.id, txt)}
          />
        ))}

        {doneToday.length > 0 && sortedIncomplete.length > 0 && (
          <div className="todo-divider" />
        )}

        {doneToday.map((t) => (
          <TodoRow key={t.id} t={t}
            expanded={false}
            onToggle={() => toggleDone(t.id)}
            onTogglePriority={() => update(t.id, { priority: !t.priority })}
            onDelete={() => delTodo(t.id)}
            onExpand={() => {}}
            onToggleSub={(sid) => toggleSub(t.id, sid)}
            onAddSub={() => {}}
            showCompletedAgo
          />
        ))}

        {sortedIncomplete.length === 0 && doneToday.length === 0 && (
          <div className="tiny" style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-3)" }}>
            Nothing on the list. Type above to add the first task.
          </div>
        )}
      </div>

      <div style={{ marginTop: 28 }}>
        <button
          onClick={() => setShowWeek((s) => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 8, fontSize: 13.5,
            color: "var(--text-2)", fontWeight: 500, padding: "8px 0",
          }}>
          <Icon.Chevron style={{ transform: showWeek ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms" }} />
          Completed this week · {doneWeek.length}
        </button>
        {showWeek && (
          <div className="todo-list fade-in">
            {doneWeek.map((t) => (
              <div key={t.id} className="todo is-done">
                <Checkbox checked accent={t.account} onChange={() => toggleDone(t.id)} circle size="sm" />
                <div className="todo-main">
                  <div className="todo-title-row">
                    <span className="todo-title">{t.title}</span>
                    <AccountDot acc={t.account} />
                  </div>
                  <div className="todo-meta">
                    <span>{t.completedDay}</span>
                  </div>
                </div>
              </div>
            ))}
            {doneWeek.length === 0 && (
              <div className="tiny" style={{ padding: 12 }}>Nothing archived yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TodoRow({ t, expanded, onExpand, onToggle, onTogglePriority, onDelete, onToggleSub, onAddSub, showCompletedAgo }) {
  const [subText, setSubText] = useState("");
  const overdue = t.due != null && t.due < 0 && !t.done;
  return (
    <div className={"todo" + (t.done ? " is-done" : "")}>
      {overdue && <span className="overdue-dot" />}
      <Checkbox checked={t.done} accent={t.account} onChange={onToggle} circle size="sm" />
      <div className="todo-main">
        <div className="todo-title-row">
          <span className="todo-title">{t.title}</span>
          <AccountDot acc={t.account} />
          {t.priority && !t.done && (
            <span style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>★</span>
          )}
          {(t.details || t.due || t.subtasks.length > 0) && (
            <button className="btn-text" style={{ padding: "2px 6px", fontSize: 12 }}
              onClick={onExpand}>
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
        <div className="todo-meta">
          {t.due != null && (
            <span className={"meta-due" + (overdue ? " is-overdue" : "")}>
              {overdue
                ? `Overdue — Due ${fmtMD(addDays(TODAY, t.due))}`
                : `Due ${fmtMD(addDays(TODAY, t.due))}`}
            </span>
          )}
          {t.subtasks.length > 0 && (
            <span>
              {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtasks
            </span>
          )}
          {showCompletedAgo && <span>Completed {t.completedAgo || "earlier today"}</span>}
        </div>

        {expanded && (
          <div className="fade-in" style={{ marginTop: 10, padding: "10px 12px", background: "var(--surface)", borderRadius: 8, fontSize: 13, color: "var(--text-2)" }}>
            {t.details || <span className="muted">No details yet.</span>}
          </div>
        )}

        {t.subtasks.length > 0 && (
          <div className="subtasks">
            {t.subtasks.map((s) => (
              <div key={s.id} className={"subtask" + (s.done ? " is-done" : "")}>
                <Checkbox checked={s.done} onChange={() => onToggleSub(s.id)} accent={t.account} size="xs" circle />
                <span>{s.text}</span>
              </div>
            ))}
            {!t.done && (
              <div className="subtask-add">
                <Icon.Plus />
                <input
                  placeholder="Add subtask"
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { onAddSub(subText); setSubText(""); }
                    if (e.key === "Escape") setSubText("");
                  }}
                  style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontSize: 13 }}
                />
              </div>
            )}
          </div>
        )}
        {t.subtasks.length === 0 && !t.done && expanded && (
          <div className="subtasks">
            <div className="subtask-add">
              <Icon.Plus />
              <input
                placeholder="Add subtask"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onAddSub(subText); setSubText(""); }
                }}
                style={{ border: "none", background: "transparent", outline: "none", flex: 1, fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="todo-actions">
        <button onClick={onTogglePriority} title="Toggle priority"
          className={t.priority ? "is-on" : ""}>
          {t.priority ? <Icon.StarFill /> : <Icon.Star />}
        </button>
        <button onClick={onDelete} title="Delete"><Icon.X /></button>
        <button title="More"><Icon.Kebab /></button>
      </div>
    </div>
  );
}
