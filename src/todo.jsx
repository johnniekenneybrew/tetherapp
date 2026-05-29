import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ACCOUNTS, TODAY, fmtShort, fmtMD, addDays,
  Checkbox, AccountDot, Icon,
} from './shared';

// ============================================================
// To-Do List
// ============================================================

export function TodoList({ state, setState, actions }) {
  const [filter, setFilter] = useState("all");
  const [showWeek, setShowWeek] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newAccount, setNewAccount] = useState("getro");
  const [newDetails, setNewDetails] = useState("");
  const [expandedDetails, setExpandedDetails] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [mobileTab, setMobileTab] = useState("all");
  const [mobileNewTitle, setMobileNewTitle] = useState("");

  const todos = state.todos;
  const filtered = useMemo(
    () => todos.filter((t) => filter === "all" || t.account === filter),
    [todos, filter]
  );

  const incomplete = filtered.filter((t) => !t.done);
  const doneToday = filtered.filter((t) => t.done && t.completedDay === "today");
  const doneWeek = filtered.filter((t) => t.done && t.completedDay !== "today");
  const todayCount = incomplete.filter(t => t.due === 0).length;

  const sortedIncomplete = [...incomplete].sort((a, b) => {
    const aOver = a.due != null && a.due < 0;
    const bOver = b.due != null && b.due < 0;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (!!a.priority !== !!b.priority) return a.priority ? -1 : 1;
    return 0;
  });

  const mobileSorted = mobileTab === "today"
    ? sortedIncomplete.filter(t => t.due === 0)
    : sortedIncomplete;

  const update = (id, patch) => actions.updateTodo(id, patch);
  const toggleDone = (id) => actions.toggleDone(id);
  const delTodo = (id) => actions.deleteTodo(id);

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
    actions.addTodo(next);
    setNewTitle(""); setNewDetails(""); setNewOpen(false);
  };

  const addSubtask = (id, text) => actions.addSubtask(id, text);
  const toggleSub = (todoId, subId) => actions.toggleSubtask(todoId, subId);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleIds = [...sortedIncomplete, ...doneToday].map(t => t.id);
  const allSelected = selectMode && visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); visibleIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); visibleIds.forEach(id => n.add(id)); return n; });
    }
  };

  const bulkMarkDone = () => {
    [...selectedIds].forEach(id => {
      const t = todos.find(t => t.id === id);
      if (t && !t.done) actions.toggleDone(id);
    });
    exitSelect();
  };

  const bulkDelete = () => {
    [...selectedIds].forEach(id => actions.deleteTodo(id));
    exitSelect();
  };

  const exitSelect = () => { setSelectedIds(new Set()); setSelectMode(false); };

  const mobileAddTodo = () => {
    if (!mobileNewTitle.trim()) return;
    actions.addTodo({
      id: Date.now(),
      title: mobileNewTitle.trim(),
      account: "getro",
      done: false,
      priority: false,
      details: null,
      due: null,
      subtasks: [],
    });
    setMobileNewTitle("");
  };

  return (
    <div className="page page--narrow fade-in">
      {/* Mobile tabs — hidden on desktop via CSS */}
      <div className="mob-tabs">
        <button className={"mob-tab" + (mobileTab === "today" ? " is-active" : "")} onClick={() => setMobileTab("today")}>
          Today
          {todayCount > 0 && <span className="mob-tab-count">{todayCount}</span>}
        </button>
        <button className={"mob-tab" + (mobileTab === "all" ? " is-active" : "")} onClick={() => setMobileTab("all")}>
          All tasks
          {incomplete.length > 0 && <span className="mob-tab-count">{incomplete.length}</span>}
        </button>
      </div>

      <div className="todo-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <span className="date-chip">
          <span className="cal-icon" />
          {fmtShort(TODAY)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <button
            onClick={() => selectMode ? exitSelect() : setSelectMode(true)}
            style={{
              fontSize: 12.5, fontWeight: 500, padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border)", background: selectMode ? "var(--accent)" : "transparent",
              color: selectMode ? "#fff" : "var(--text-3)", cursor: "pointer",
            }}>
            {selectMode ? "Cancel" : "Select"}
          </button>
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

        {selectMode && visibleIds.length > 0 && (
          <label style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px", cursor: "pointer" }}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
              style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }} />
            <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>Select all</span>
          </label>
        )}

        {mobileSorted.map((t) => (
          <TodoRow key={t.id} t={t}
            expanded={!!expandedDetails[t.id]}
            onExpand={() => setExpandedDetails((s) => ({ ...s, [t.id]: !s[t.id] }))}
            onToggle={() => toggleDone(t.id)}
            onTogglePriority={() => update(t.id, { priority: !t.priority })}
            onDelete={() => delTodo(t.id)}
            onUpdate={(patch) => update(t.id, patch)}
            onToggleSub={(sid) => toggleSub(t.id, sid)}
            onAddSub={(txt) => addSubtask(t.id, txt)}
            selectMode={selectMode}
            selected={selectedIds.has(t.id)}
            onSelect={() => toggleSelect(t.id)}
          />
        ))}

        {doneToday.length > 0 && mobileSorted.length > 0 && (
          <div className="todo-divider" />
        )}

        {doneToday.map((t) => (
          <TodoRow key={t.id} t={t}
            expanded={false}
            onToggle={() => toggleDone(t.id)}
            onTogglePriority={() => update(t.id, { priority: !t.priority })}
            onDelete={() => delTodo(t.id)}
            onUpdate={(patch) => update(t.id, patch)}
            onExpand={() => {}}
            onToggleSub={(sid) => toggleSub(t.id, sid)}
            onAddSub={() => {}}
            showCompletedAgo
            selectMode={selectMode}
            selected={selectedIds.has(t.id)}
            onSelect={() => toggleSelect(t.id)}
          />
        ))}

        {mobileSorted.length === 0 && doneToday.length === 0 && (
          <div className="tiny" style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-3)" }}>
            Nothing on the list. Type above to add the first task.
          </div>
        )}
      </div>

      <div className="todo-week-section" style={{ marginTop: 28 }}>
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-bar">
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)" }}>
            {selectedIds.size} selected
          </span>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={bulkMarkDone}>
              Mark done
            </button>
            <button className="btn" style={{ fontSize: 12.5, color: "var(--error)", borderColor: "var(--error)" }}
              onClick={bulkDelete}>
              Delete
            </button>
            <button className="btn-text" style={{ fontSize: 12.5, color: "var(--text-3)" }} onClick={exitSelect}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile add task footer — hidden on desktop via CSS */}
      <div className="mob-add-footer">
        <form className="mob-add-row" onSubmit={e => { e.preventDefault(); mobileAddTodo(); }}>
          <input
            className="mob-add-input"
            placeholder="Add a task..."
            value={mobileNewTitle}
            onChange={e => setMobileNewTitle(e.target.value)}
          />
          <button className="mob-add-btn" type="submit" disabled={!mobileNewTitle.trim()}>
            <Icon.Plus />
          </button>
        </form>
      </div>
    </div>
  );
}

function TodoRow({ t, expanded, onExpand, onToggle, onTogglePriority, onDelete, onUpdate, onToggleSub, onAddSub, showCompletedAgo, selectMode, selected, onSelect }) {
  const [subText, setSubText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(t.title);
  const [editingDate, setEditingDate] = useState(false);
  const [editingArea, setEditingArea] = useState(false);
  const menuRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  useEffect(() => {
    if (editingTitle) titleRef.current?.focus();
  }, [editingTitle]);

  const overdue = t.due != null && t.due < 0 && !t.done;

  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== t.title) onUpdate({ title: trimmed });
    else setEditTitle(t.title);
    setEditingTitle(false);
  };

  const todayISO = TODAY.toISOString().slice(0, 10);
  const dueISO = t.due != null ? addDays(TODAY, t.due).toISOString().slice(0, 10) : "";

  const saveDate = (val) => {
    if (!val) {
      onUpdate({ due: null });
    } else {
      const days = Math.round(
        (new Date(val + "T12:00:00") - new Date(todayISO + "T12:00:00")) / 86400000
      );
      onUpdate({ due: days });
    }
    setEditingDate(false);
  };

  return (
    <div className={"todo" + (t.done ? " is-done" : "") + (selected ? " is-selected" : "")}>
      {selectMode && (
        <input type="checkbox" checked={!!selected} onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2, accentColor: "var(--accent)", cursor: "pointer" }}
        />
      )}
      {overdue && !selectMode && <span className="overdue-dot" />}
      <Checkbox checked={t.done} accent={t.account} onChange={onToggle} circle size="sm" />
      <div className="todo-main">
        <div className="todo-title-row">
          {editingTitle ? (
            <input ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") { setEditTitle(t.title); setEditingTitle(false); }
              }}
              style={{
                flex: 1, border: "none", borderBottom: "1.5px solid var(--accent)", outline: "none",
                fontSize: "14.5px", fontWeight: 500, background: "transparent", padding: "1px 0",
              }}
            />
          ) : (
            <span className="todo-title">{t.title}</span>
          )}
          <AccountDot acc={t.account} />
          {t.priority && !t.done && (
            <span style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>★</span>
          )}
          {(t.details || t.due != null || t.subtasks.length > 0) && !editingTitle && (
            <button className="btn-text" style={{ padding: "2px 6px", fontSize: 12 }} onClick={onExpand}>
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>

        {/* Inline area picker */}
        {editingArea && (
          <div className="fade-in" style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
            {ACCOUNTS.map((a) => (
              <button key={a.id}
                className={"acc-chip" + (t.account === a.id ? " is-on" : "")}
                onClick={() => { onUpdate({ account: a.id }); setEditingArea(false); }}
                style={{ fontSize: 12 }}>
                <AccountDot acc={a.id} />
                <span>{a.short}</span>
              </button>
            ))}
            <button className="btn-text" style={{ fontSize: 12, color: "var(--text-3)" }}
              onClick={() => setEditingArea(false)}>Cancel</button>
          </div>
        )}

        {/* Inline date picker */}
        {editingDate && (
          <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input type="date" defaultValue={dueISO} autoFocus
              onChange={(e) => saveDate(e.target.value)}
              style={{
                fontSize: 13, padding: "4px 8px",
                border: "1.5px solid var(--border)", borderRadius: 6,
                background: "var(--surface)", color: "var(--text)",
              }}
            />
            {t.due != null && (
              <button className="btn-text" style={{ fontSize: 12, color: "var(--error)" }}
                onClick={() => saveDate("")}>Clear</button>
            )}
            <button className="btn-text" style={{ fontSize: 12, color: "var(--text-3)" }}
              onClick={() => setEditingDate(false)}>Cancel</button>
          </div>
        )}

        <div className="todo-meta">
          {t.due != null && (
            <span className={"meta-due" + (overdue ? " is-overdue" : "")}>
              {overdue
                ? `Overdue — Due ${fmtMD(addDays(TODAY, t.due))}`
                : `Due ${fmtMD(addDays(TODAY, t.due))}`}
            </span>
          )}
          {t.subtasks.length > 0 && (
            <span>{t.subtasks.filter((s) => s.done).length}/{t.subtasks.length} subtasks</span>
          )}
          {showCompletedAgo && <span>Completed {t.completedAgo || "earlier today"}</span>}
        </div>

        {!t.done && (
          <div className="due-bubbles">
            <button
              className={"due-bubble" + (t.due === 0 ? " is-active" : "")}
              onClick={() => onUpdate({ due: t.due === 0 ? null : 0 })}
              title="Due today">
              <Icon.Sun /> Today
            </button>
            <button
              className={"due-bubble" + (t.due === 1 ? " is-active" : "")}
              onClick={() => onUpdate({ due: t.due === 1 ? null : 1 })}
              title="Due tomorrow">
              <Icon.Cal /> Tmrw
            </button>
            <button
              className={"due-bubble" + (editingDate ? " is-active" : "")}
              onClick={() => setEditingDate(v => !v)}
              title="Pick a date">
              <Icon.Clock />
            </button>
          </div>
        )}

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
        <button onClick={onTogglePriority} title="Toggle priority" className={t.priority ? "is-on" : ""}>
          {t.priority ? <Icon.StarFill /> : <Icon.Star />}
        </button>
        <button onClick={onDelete} title="Delete"><Icon.X /></button>
        <div style={{ position: "relative" }} ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} title="More" className={menuOpen ? "is-on" : ""}>
            <Icon.Kebab />
          </button>
          {menuOpen && (
            <div className="todo-menu">
              <button onClick={() => { setEditTitle(t.title); setEditingTitle(true); setMenuOpen(false); }}>
                Edit title
              </button>
              <button onClick={() => { setEditingArea(true); setMenuOpen(false); }}>
                Change area
              </button>
              <button onClick={() => { setEditingDate(true); setMenuOpen(false); }}>
                {t.due != null ? "Change due date" : "Set due date"}
              </button>
              <div className="todo-menu-sep" />
              <button className="is-danger" onClick={() => { onDelete(); setMenuOpen(false); }}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
