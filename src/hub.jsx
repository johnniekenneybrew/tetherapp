import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ACCOUNTS, TODAY, fmtShort, fmtMD, addDays, weekStart, sameDay, DAYS, MONTHS,
  Checkbox, AccountDot, StatusBadge, Icon,
} from './shared';
import { useOrder } from './useOrder';
import versionData from '../version.json';

// ============================================================
// Habits + Health hub
// ============================================================

export function HabitsHub({ state, setState, sub, setSub, actions }) {
  const tabs = [
    { id: "habits", label: "Habits" },
    { id: "routines", label: "Routines" },
    { id: "goals", label: "Goals" },
    { id: "wam", label: "WAM" },
  ];
  return (
    <div className="page fade-in">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="page-title">Habits + Health</h1>
        <span className="tiny">Q2 2026 · Week 7 of 12</span>
      </div>
      <p className="page-sub">Track habits, build routines, and watch quarterly goals move.</p>

      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t.id} className={sub === t.id ? "active" : ""} onClick={() => setSub(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {sub === "habits" && <HabitsTab state={state} setState={setState} actions={actions} />}
      {sub === "routines" && <RoutinesTab state={state} setState={setState} actions={actions} />}
      {sub === "goals" && <GoalsTab state={state} setState={setState} actions={actions} />}
      {sub === "wam" && <WamTab state={state} setState={setState} />}
    </div>
  );
}

// ----------- Habits tab -----------

function HabitsTab({ state, setState, actions }) {
  const ws = weekStart(TODAY);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(ws, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [goalFilter, setGoalFilter] = useState("all");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const { ordered: habits, reorder } = useOrder("habitOrder", state.habits);
  const filteredHabits = habits.filter((h) =>
    goalFilter === "all" || (h.goals || []).includes(goalFilter)
  );

  const toggleHabit = (date, hid) => {
    actions.toggleHabitLog(date, hid);
  };

  const dayLetters = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-text" onClick={() => setWeekOffset((o) => o - 1)}>
            <Icon.ChevL /> Previous Week
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {fmtShort(start)} – {fmtShort(addDays(start, 6))}, 2026
          </span>
          <button className="btn-text" onClick={() => setWeekOffset((o) => o + 1)}>
            Next Week <Icon.ChevR />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select className="btn" style={{ fontSize: 13 }} defaultValue="week">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
          <select className="btn" style={{ fontSize: 13 }}
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}>
            <option value="all">All habits</option>
            {state.goals.map((g) => (
              <option key={g.id} value={g.id}>Goal: {g.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="habits-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th style={{ width: 240 }}>Habit</th>
              {days.map((d, i) => {
                const isToday = sameDay(d, TODAY);
                return (
                  <th key={d.toISOString()} className={"cb-cell day-head" + (isToday ? " is-today" : "")}>
                    <div className="day-letter">{dayLetters[i]}</div>
                  </th>
                );
              })}
              <th style={{ width: 110, textAlign: "right" }}>Completion</th>
            </tr>
          </thead>
          <tbody>
            {filteredHabits.map((h) => {
              const counts = days.map((d) => {
                const key = d.toISOString().slice(0, 10);
                return !!(state.habitLog[key] || {})[h.id];
              });
              const completed = counts.filter(Boolean).length;
              const pct = Math.min(1, completed / h.target);
              const cls = pct >= 1 ? "is-good" : pct >= 0.5 ? "is-warn" : "";
              const linkedGoals = (h.goals || []).map((gid) => state.goals.find((g) => g.id === gid)).filter(Boolean);
              return (
                <tr key={h.id}
                  draggable
                  onDragStart={() => setDragId(h.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(h.id); }}
                  onDrop={() => { reorder(dragId, h.id); setDragId(null); setDragOverId(null); }}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                  className={(dragId === h.id ? "dragging-row " : "") + (dragOverId === h.id && dragId !== h.id ? "drag-over-row" : "")}>
                  <td style={{ padding: "0 4px" }}>
                    <span className="drag-handle"><Icon.Grip /></span>
                  </td>
                  <td className="col-habit">
                    <div className="habit-row-name">{h.name}</div>
                    <div className="habit-row-meta">
                      {linkedGoals.length > 0 && linkedGoals.map((g) => (
                        <span key={g.id} className="goal-tag">{g.name}</span>
                      ))}
                      <span className="habit-row-goal">{h.target}× per week</span>
                    </div>
                  </td>
                  {days.map((d, i) => {
                    const isToday = sameDay(d, TODAY);
                    const future = d > TODAY;
                    return (
                      <td key={i} className={"cb-cell" + (isToday ? " is-today" : "")}>
                        {future ? (
                          <span style={{ color: "var(--text-3)" }}>·</span>
                        ) : (
                          <Checkbox checked={counts[i]} onChange={() => toggleHabit(d, h.id)} size="sm" />
                        )}
                      </td>
                    );
                  })}
                  <td className="col-pct">
                    <div className="pct-row">
                      <div className={"bar " + cls} style={{ flex: 1 }}>
                        <span style={{ width: (pct * 100) + "%" }} />
                      </div>
                      <span className="pct-perc">{Math.round(pct * 100)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn-link" onClick={() => setShowAddHabit(true)}><Icon.Plus /> Add habit</button>
      </div>
      {showAddHabit && <AddHabitModal onClose={() => setShowAddHabit(false)} state={state} setState={setState} actions={actions} />}
    </div>
  );
}

// ----------- Add Habit modal -----------

function AddHabitModal({ onClose, state, setState, actions }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(5);
  const [account, setAccount] = useState("personal");
  const [linkedGoals, setLinkedGoals] = useState([]);

  const save = () => {
    if (!name.trim()) return;
    actions.addHabit({
      name: name.trim(),
      target,
      account,
      goals: linkedGoals,
    });
    onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New habit</h3>
        <div className="tiny">Track a recurring behavior toward a goal.</div>
        <div className="field">
          <label>Habit name</label>
          <input className="input" placeholder="e.g. Morning Walk" value={name}
            onChange={(e) => setName(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        </div>
        <div className="field" style={{ display: "flex", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <label>Frequency</label>
            <select className="input" value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {[3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n}× per week</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label>Account</label>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              {ACCOUNTS.map((a) => (
                <button key={a.id}
                  className={"acc-chip" + (account === a.id ? " is-on" : "")}
                  onClick={() => setAccount(a.id)}>
                  <AccountDot acc={a.id} />
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="field">
          <label>Link to goals (optional)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.goals.filter((g) => g.status !== "completed").map((g) => {
              const on = linkedGoals.includes(g.id);
              return (
                <button key={g.id} className="pill"
                  style={{
                    background: on ? "var(--text)" : "var(--surface-2)",
                    color: on ? "#fff" : "var(--text)",
                    borderColor: on ? "var(--text)" : "var(--border-soft)",
                  }}
                  onClick={() => setLinkedGoals((s) => on ? s.filter((x) => x !== g.id) : [...s, g.id])}>
                  {on && <Icon.Check />} {g.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Add habit</button>
        </div>
      </div>
    </div>
  );
}

// ----------- Routines tab -----------

function RoutinesTab({ state, setState, actions }) {
  const ws = weekStart(TODAY);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(ws, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayLetters = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [editingId, setEditingId] = useState(null);
  const [dragColId, setDragColId] = useState(null);
  const [dragOverColId, setDragOverColId] = useState(null);

  const { ordered: routines, reorder } = useOrder("routineOrder", state.routines);

  const toggleR = (date, rid) => {
    actions.toggleRoutineLog(date, rid);
  };

  const updateRoutine = (rid, patch) => {
    actions.updateRoutine(rid, patch);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-text" onClick={() => setWeekOffset((o) => o - 1)}>
            <Icon.ChevL /> Previous Week
          </button>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>
            {fmtShort(start)} – {fmtShort(addDays(start, 6))}, 2026
          </span>
          <button className="btn-text" onClick={() => setWeekOffset((o) => o + 1)}>
            Next Week <Icon.ChevR />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select className="btn" style={{ fontSize: 13 }} defaultValue="week">
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>
      </div>

      <p className="tiny" style={{ marginBottom: 16 }}>
        Routines are non-negotiable. Aim for 100% — every day, every box.
        {routines.some((r) => r.trackOnly) && (
          <span style={{ marginLeft: 6, opacity: 0.7 }}>Tracking-only items don't count toward the daily goal.</span>
        )}
      </p>
      <div className="habits-table">
        <table>
          <thead>
            <tr>
              <th style={{ width: 120 }}>Day</th>
              {routines.map((r) => (
                <th key={r.id}
                  className={"cb-cell routine-head-th" + (r.trackOnly ? " is-track-only" : "") + (dragColId === r.id ? " dragging-row" : "") + (dragOverColId === r.id && dragColId !== r.id ? " drag-over-col" : "")}
                  style={{ textAlign: "center" }}
                  title={r.name + (r.trackOnly ? " (tracking only)" : "")}
                  draggable
                  onDragStart={() => setDragColId(r.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverColId(r.id); }}
                  onDrop={() => { reorder(dragColId, r.id); setDragColId(null); setDragOverColId(null); }}
                  onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <span className="drag-handle drag-handle--h"><Icon.GripH /></span>
                    <button className={"routine-head-btn" + (r.useIcon ? " is-icon" : "")}
                      onClick={() => setEditingId(editingId === r.id ? null : r.id)}>
                      {r.useIcon && r.icon
                        ? <span className="routine-emoji">{r.icon}</span>
                        : <span className="habit-row-name" style={{ fontSize: 13.5 }}>{r.name}</span>}
                    </button>
                    {r.trackOnly && <span className="track-only-label">*</span>}
                  </div>
                  {editingId === r.id && (
                    <RoutineEditor routine={r}
                      onClose={() => setEditingId(null)}
                      onSave={(patch) => { updateRoutine(r.id, patch); setEditingId(null); }} />
                  )}
                </th>
              ))}
              <th style={{ width: 110, textAlign: "right" }}>Completion</th>
              <th style={{ width: 36, padding: "9px 4px" }}>
                <button className="routine-add-btn" title="Add routine">
                  <Icon.Plus />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const key = d.toISOString().slice(0, 10);
              const log = state.routineLog[key] || {};
              const isToday = sameDay(d, TODAY);
              const future = d > TODAY;
              const counted = routines.filter((r) => !r.trackOnly);
              const completed = counted.filter((r) => log[r.id]).length;
              const pct = counted.length === 0 ? 0 : completed / counted.length;
              const cls = pct >= 1 ? "is-good" : "";
              return (
                <tr key={key} className={isToday ? "is-today" : ""}>
                  <td className={"col-day" + (isToday ? " is-today" : "")}>
                    <span className="day-pill">{dayLetters[i]}</span>
                  </td>
                  {routines.map((r) => (
                    <td key={r.id} className={"cb-cell" + (r.trackOnly ? " is-track-only" : "")}>
                      {future ? (
                        <span style={{ color: "var(--text-3)" }}>·</span>
                      ) : (
                        <Checkbox checked={!!log[r.id]} onChange={() => toggleR(d, r.id)} size="sm" />
                      )}
                    </td>
                  ))}
                  <td className="col-pct">
                    <div className="pct-row">
                      <div className={"bar " + cls} style={{ flex: 1 }}>
                        <span style={{ width: (pct * 100) + "%" }} />
                      </div>
                      <span className="pct-perc">{future ? "—" : Math.round(pct * 100) + "%"}</span>
                    </div>
                  </td>
                  <td></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----------- Routine editor popover -----------

const EMOJI_PRESETS = ["💊","✨","📓","🛏️","🦷","🧘","🏃","💪","🥗","💧","☀️","🌙","📖","🎯","🧠","🌱","⏰","🪥"];

function RoutineEditor({ routine, onSave, onClose }) {
  const [name, setName] = useState(routine.name);
  const [icon, setIcon] = useState(routine.icon || "✨");
  const [useIcon, setUseIcon] = useState(!!routine.useIcon);
  const [trackOnly, setTrackOnly] = useState(!!routine.trackOnly);
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const submit = () => onSave({ name: name.trim() || routine.name, icon, useIcon, trackOnly });

  return (
    <div ref={ref} className="routine-editor" onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input className="input" autoFocus value={name} style={{ flex: 1 }}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Routine name" />
        <div className="re-toggle">
          <button className={!useIcon ? "is-on" : ""} onClick={() => setUseIcon(false)}>Aa</button>
          <button className={useIcon ? "is-on" : ""} onClick={() => setUseIcon(true)}>😊</button>
        </div>
      </div>

      {useIcon && (
        <div style={{ marginBottom: 10 }}>
          <div className="re-emoji-grid">
            {EMOJI_PRESETS.map((e) => (
              <button key={e}
                className={"re-emoji" + (icon === e ? " is-on" : "")}
                onClick={() => setIcon(e)}>{e}</button>
            ))}
          </div>
          <input className="input" style={{ marginTop: 6, fontSize: 13 }} value={icon} maxLength={4}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="…or paste emoji" />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border-soft)" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-2)" }}>Tracking only</span>
        <div className={"switch" + (trackOnly ? " on" : "")} onClick={() => setTrackOnly(!trackOnly)} />
      </div>

      <div className="re-actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit}>Save</button>
      </div>
    </div>
  );
}

// ----------- Goals tab -----------

function GoalsTab({ state, setState, actions }) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [accFilter, setAccFilter] = useState("all");

  const allActive = state.goals.filter((g) => g.status !== "completed");
  const active = allActive.filter((g) => accFilter === "all" || g.account === accFilter);
  const done = state.goals.filter((g) => g.status === "completed");

  const habitsById    = Object.fromEntries(state.habits.map((h) => [h.id, h]));
  const goalTasksById = Object.fromEntries((state.goalTasks || []).map((t) => [t.id, t]));

  const completeGoal = (id) => { actions.updateGoal(id, { status: "completed" }); setMenuOpen(null); };
  const delGoal      = (id) => { actions.deleteGoal(id); setMenuOpen(null); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="tiny">Active goals · {active.length}</span>
          <div className="filter-row">
            <button
              className={"filter-btn" + (accFilter === "all" ? " is-active" : "")}
              onClick={(e) => { e.stopPropagation(); setAccFilter("all"); }}>
              All
            </button>
            {ACCOUNTS.map((a) => (
              <button key={a.id}
                className={"filter-btn filter-btn--dot" + (accFilter === a.id ? " is-active" : "")}
                onClick={(e) => { e.stopPropagation(); setAccFilter(a.id); }}
                title={a.name}>
                <AccountDot acc={a.id} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); setShowAdd(true); }}>
          <Icon.Plus /> Add goal
        </button>
      </div>

      {active.map((g) => (
        <div key={g.id} className="goal-card">
          <div className="goal-head">
            <div style={{ flex: 1 }}>
              <h3 className="goal-name">{g.name}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                {g.kpi && (
                  <span style={{
                    fontSize: 11.5, padding: "2px 8px", borderRadius: 20,
                    background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                    color: "var(--accent)", fontWeight: 500,
                  }}>
                    🎯 {g.kpi}
                  </span>
                )}
                {g.target && (
                  <span className="tiny" style={{ color: "var(--text-3)" }}>
                    Target {g.target}
                  </span>
                )}
              </div>
              {g.description && g.description !== "—" && (
                <div className="tiny" style={{ marginTop: 4, color: "var(--text-2)" }}>{g.description}</div>
              )}
            </div>
            <StatusBadge status={g.status} />
            <div style={{ position: "relative" }}
              onMouseEnter={() => setMenuOpen(g.id)}
              onMouseLeave={() => setMenuOpen(null)}>
              <button className="kebab"><Icon.Kebab /></button>
              {menuOpen === g.id && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4,
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
                  boxShadow: "var(--shadow-pop)", padding: 6, minWidth: 160, zIndex: 5,
                }}>
                  <MenuItem onClick={() => { setEditGoal(g); setMenuOpen(null); }}>Edit goal</MenuItem>
                  <MenuItem onClick={() => completeGoal(g.id)}>Mark complete</MenuItem>
                  <MenuItem destructive onClick={() => delGoal(g.id)}>Delete goal</MenuItem>
                </div>
              )}
            </div>
          </div>

          {/* Linked habits */}
          {g.habitIds.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="tiny" style={{ color: "var(--text-3)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Habits</div>
              <div className="habit-bubbles">
                {g.habitIds.map((hid) => (
                  <span key={hid} className="pill">
                    <AccountDot acc={habitsById[hid]?.account || "personal"} />
                    {habitsById[hid]?.name || "—"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Linked tasks */}
          {(g.taskIds || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="tiny" style={{ color: "var(--text-3)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Tasks</div>
              <div className="habit-bubbles">
                {(g.taskIds || []).map((tid) => {
                  const task = goalTasksById[tid];
                  return (
                    <span key={tid} className="pill"
                      style={{ textDecoration: task?.done ? "line-through" : "none", opacity: task?.done ? 0.5 : 1, cursor: "pointer" }}
                      onClick={() => task && actions.toggleGoalTaskDone(task.id)}>
                      {task?.done && <Icon.Check />}
                      {task?.name || "—"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {g.habitIds.length === 0 && (g.taskIds || []).length === 0 && (
            <div className="tiny" style={{ marginTop: 10, color: "var(--text-3)" }}>No habits or tasks linked</div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 28 }}>
        <button
          onClick={() => setShowCompleted((s) => !s)}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-2)", fontWeight: 500 }}>
          <Icon.Chevron style={{ transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms" }} />
          Completed goals · {done.length}
        </button>
        {showCompleted && (
          <div style={{ marginTop: 12, opacity: 0.7 }}>
            {done.map((g) => (
              <div key={g.id} className="goal-card">
                <div className="goal-head">
                  <h3 className="goal-name" style={{ textDecoration: "line-through" }}>{g.name}</h3>
                  <StatusBadge status="completed" />
                </div>
              </div>
            ))}
            {done.length === 0 && <div className="tiny">No completed goals yet.</div>}
          </div>
        )}
      </div>

      {showAdd && <GoalModal onClose={() => setShowAdd(false)} state={state} actions={actions} />}
      {editGoal && <GoalModal goal={editGoal} onClose={() => setEditGoal(null)} state={state} actions={actions} />}
    </div>
  );
}

function MenuItem({ children, onClick, destructive }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "8px 10px", fontSize: 13, borderRadius: 6,
        color: destructive ? "var(--error)" : "var(--text)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      {children}
    </button>
  );
}

function GoalModal({ goal, onClose, state, actions }) {
  const isEdit = !!goal;
  const [name, setName]       = useState(goal?.name || "");
  const [desc, setDesc]       = useState(goal?.description === "—" ? "" : (goal?.description || ""));
  const [kpi, setKpi]         = useState(goal?.kpi || "");
  const [account, setAccount] = useState(goal?.account || "personal");
  const [selectedHabits, setHabits] = useState(goal?.habitIds || []);
  const [selectedTasks, setTasks]   = useState(goal?.taskIds || []);

  const [showNewHabit, setShowNewHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitTarget, setNewHabitTarget] = useState(5);

  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);

  const toggleHabit = (id) => setHabits((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const toggleTask  = (id) => setTasks((s)  => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const createHabit = () => {
    if (!newHabitName.trim()) return;
    const hid = "h-" + Date.now();
    actions.addHabit({ id: hid, name: newHabitName.trim(), target: newHabitTarget, account: "personal", goals: [] });
    setHabits((s) => [...s, hid]);
    setNewHabitName("");
    setShowNewHabit(false);
  };

  const createTask = async () => {
    if (!newTaskName.trim() || creatingTask) return;
    setCreatingTask(true);
    try {
      const created = await actions.addGoalTask(newTaskName.trim());
      setTasks((s) => [...s, created.id]);
      setNewTaskName("");
      setShowNewTask(false);
    } finally {
      setCreatingTask(false);
    }
  };

  const save = () => {
    if (!name.trim()) return;
    const data = {
      name:        name.trim(),
      description: desc.trim() || "",
      kpi:         kpi.trim(),
      status:      goal?.status || "in-progress",
      account,
      habitIds:    selectedHabits,
      taskIds:     selectedTasks,
    };
    if (isEdit) {
      actions.updateGoal(goal.id, data);
    } else {
      actions.addGoal(data);
    }
    onClose();
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" style={{ maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Edit goal" : "New goal"}</h3>
        <div className="tiny" style={{ marginBottom: 16, color: "var(--text-2)" }}>
          {isEdit ? "Update goal details, KPI, and linked habits or tasks." : "Define an outcome, set a KPI, and link what gets you there."}
        </div>

        <div className="field">
          <label>Goal name</label>
          <input className="input" placeholder="e.g. Lose 10 pounds" value={name}
            onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="field">
          <label>KPI <span style={{ fontWeight: 400, color: "var(--text-3)" }}>— how you'll measure success (optional)</span></label>
          <input className="input" placeholder="e.g. Reach 185 lbs · Land 3 interviews · Hit $5k MRR"
            value={kpi} onChange={(e) => setKpi(e.target.value)} />
        </div>

        <div className="field">
          <label>Description <span style={{ fontWeight: 400, color: "var(--text-3)" }}>(optional)</span></label>
          <textarea className="input" rows={2} value={desc}
            onChange={(e) => setDesc(e.target.value)} placeholder="Why does this matter right now?" />
        </div>

        <div className="field">
          <label>Area</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ACCOUNTS.map((a) => (
              <button key={a.id} className={"acc-chip" + (account === a.id ? " is-on" : "")}
                onClick={() => setAccount(a.id)}>
                <AccountDot acc={a.id} /><span>{a.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Habits — recurring weekly */}
        <div className="field">
          <label>Link habits <span style={{ fontWeight: 400, color: "var(--text-3)" }}>— recurring weekly activities</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.habits.map((h) => {
              const on = selectedHabits.includes(h.id);
              return (
                <button key={h.id} className="pill"
                  style={{
                    background: on ? "var(--text)" : "var(--surface-2)",
                    color: on ? "#fff" : "var(--text)",
                    borderColor: on ? "var(--text)" : "var(--border-soft)",
                  }}
                  onClick={() => toggleHabit(h.id)}>
                  {on && <Icon.Check />} {h.name}
                </button>
              );
            })}
            <button className="pill" style={{ borderStyle: "dashed", color: "var(--text-2)" }}
              onClick={() => setShowNewHabit(true)}>
              <Icon.Plus /> New habit
            </button>
          </div>
          {showNewHabit && (
            <div className="fade-in" style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input className="input" style={{ flex: 1 }} placeholder="Habit name"
                value={newHabitName} onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createHabit(); if (e.key === "Escape") setShowNewHabit(false); }}
                autoFocus />
              <select className="btn" style={{ fontSize: 12 }} value={newHabitTarget}
                onChange={(e) => setNewHabitTarget(Number(e.target.value))}>
                {[3,4,5,6,7].map((n) => <option key={n} value={n}>{n}×/wk</option>)}
              </select>
              <button className="btn btn-primary" onClick={createHabit} disabled={!newHabitName.trim()}>Add</button>
              <button className="btn-text" onClick={() => setShowNewHabit(false)}><Icon.X /></button>
            </div>
          )}
        </div>

        {/* Tasks — one-off actions */}
        <div className="field">
          <label>Link tasks <span style={{ fontWeight: 400, color: "var(--text-3)" }}>— one-off actions that move this forward</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.goalTasks.map((t) => {
              const on = selectedTasks.includes(t.id);
              return (
                <button key={t.id} className="pill"
                  style={{
                    background: on ? "var(--text)" : "var(--surface-2)",
                    color: on ? "#fff" : "var(--text)",
                    borderColor: on ? "var(--text)" : "var(--border-soft)",
                    textDecoration: t.done ? "line-through" : "none",
                    opacity: t.done && !on ? 0.5 : 1,
                  }}
                  onClick={() => toggleTask(t.id)}>
                  {on && <Icon.Check />} {t.name}
                </button>
              );
            })}
            <button className="pill" style={{ borderStyle: "dashed", color: "var(--text-2)" }}
              onClick={() => setShowNewTask(true)}>
              <Icon.Plus /> New task
            </button>
          </div>
          {showNewTask && (
            <div className="fade-in" style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input className="input" style={{ flex: 1 }} placeholder="Task name"
                value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createTask(); if (e.key === "Escape") setShowNewTask(false); }}
                autoFocus />
              <button className="btn btn-primary" onClick={createTask}
                disabled={!newTaskName.trim() || creatingTask}>
                {creatingTask ? "Adding…" : "Add"}
              </button>
              <button className="btn-text" onClick={() => setShowNewTask(false)}><Icon.X /></button>
            </div>
          )}
        </div>

        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            {isEdit ? "Save changes" : "Save goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------- WAM tab -----------

function WamTab({ state }) {
  const [selectedGoal, setSelectedGoal] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  const habitsById = useMemo(
    () => Object.fromEntries(state.habits.map((h) => [h.id, h])),
    [state.habits]
  );

  const viewWeekStart = useMemo(
    () => addDays(weekStart(TODAY), weekOffset * 7),
    [weekOffset]
  );
  const viewWeekEnd = addDays(viewWeekStart, 6);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(viewWeekStart, i).toISOString().slice(0, 10)),
    [viewWeekStart]
  );

  const computeGoalPct = useCallback((goal) => {
    const pcts = goal.habitIds
      .map((hid) => {
        const h = habitsById[hid];
        if (!h) return null;
        const target = Math.max(1, h.target || 7);
        const done = weekDays.filter((d) => state.habitLog[d]?.[hid]).length;
        return Math.min(100, Math.round((done / target) * 100));
      })
      .filter((p) => p !== null);
    return pcts.length === 0 ? 0 : Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  }, [habitsById, weekDays, state.habitLog]);

  const fmtRange = (s, e) => {
    const start = `${MONTHS[s.getMonth()].slice(0, 3)} ${s.getDate()}`;
    const end = s.getMonth() === e.getMonth()
      ? String(e.getDate())
      : `${MONTHS[e.getMonth()].slice(0, 3)} ${e.getDate()}`;
    return `${start} – ${end}`;
  };

  const qWeekLabel = useMemo(() => {
    const m = viewWeekStart.getMonth();
    const q = Math.floor(m / 3) + 1;
    const qStart = new Date(viewWeekStart.getFullYear(), Math.floor(m / 3) * 3, 1);
    const wNum = Math.floor((viewWeekStart - qStart) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return `Week ${wNum} of Q${q}`;
  }, [viewWeekStart]);

  const weekLabel = weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : fmtRange(viewWeekStart, viewWeekEnd);

  const WeekNav = () => (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn-text" onClick={() => setWeekOffset((o) => o - 1)} disabled={weekOffset <= -8}>
        <Icon.ChevL /> Previous
      </button>
      <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 220, textAlign: "center" }}>
        {qWeekLabel} · {fmtRange(viewWeekStart, viewWeekEnd)}
      </span>
      <button className="btn-text" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
        Next <Icon.ChevR />
      </button>
    </div>
  );

  if (selectedGoal === "all") {
    const active = state.goals.filter((g) => g.status !== "completed");
    const goalPcts = active.map((g) => computeGoalPct(g));
    const avg = active.length === 0 ? 0 : Math.round(goalPcts.reduce((a, b) => a + b, 0) / active.length);

    return (
      <div>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
          <WeekNav />
          <select className="btn" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
            <option value="all">All goals</option>
            {state.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className={"wam-hero " + (avg >= 80 ? "is-good" : avg >= 60 ? "is-warn" : "is-bad")}>
          <div className="tiny" style={{ marginBottom: 6 }}>
            {weekLabel}'s performance · target 80%
          </div>
          <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
            <span className="wam-num">{avg}%</span>
            <StatusBadge status={avg >= 80 ? "on-track" : "below"} />
          </div>
          <div className={"bar bar--lg " + (avg >= 80 ? "is-good" : "is-warn")} style={{ marginTop: 14, maxWidth: 420 }}>
            <span style={{ width: avg + "%" }} />
          </div>
          <div className="wam-meta">
            Across {active.length} active goal{active.length !== 1 ? "s" : ""}
            {weekOffset === 0 ? " · in progress" : ""}
          </div>
        </div>

        <h3 className="section-title">Goals breakdown</h3>
        <div className="card">
          {active.map((g, i) => {
            const p = goalPcts[i];
            return (
              <div key={g.id} className="habit-perf">
                <div style={{ minWidth: 0 }}>
                  <div className="hp-name">{g.name}</div>
                  <div className="hp-tags">
                    {g.habitIds.length === 0 && <span className="tiny">No habits linked</span>}
                    {g.habitIds.map((hid) => (
                      <span key={hid} className="hp-tag">{habitsById[hid]?.name || "—"}</span>
                    ))}
                  </div>
                </div>
                <span className="hp-pct">{p}%</span>
                <div className={"bar " + (p >= 80 ? "is-good" : "is-warn")}>
                  <span style={{ width: p + "%" }} />
                </div>
                <StatusBadge status={p >= 80 ? "on-track" : "below"} />
              </div>
            );
          })}
          {active.length === 0 && (
            <div className="tiny" style={{ padding: 12, color: "var(--text-3)" }}>No active goals.</div>
          )}
        </div>
      </div>
    );
  }

  const g = state.goals.find((x) => x.id === selectedGoal);
  if (!g) return null;
  const pct = computeGoalPct(g);

  const habitBreakdown = g.habitIds.map((hid) => {
    const h = habitsById[hid];
    if (!h) return { id: hid, name: "—", completions: 0, target: 1, pct: 0 };
    const target = Math.max(1, h.target || 7);
    const completions = weekDays.filter((d) => state.habitLog[d]?.[hid]).length;
    return { id: hid, name: h.name, account: h.account, completions, target, pct: Math.min(100, Math.round((completions / target) * 100)) };
  });

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <WeekNav />
        <select className="btn" value={selectedGoal} onChange={(e) => setSelectedGoal(e.target.value)}>
          <option value="all">All goals</option>
          {state.goals.map((gg) => <option key={gg.id} value={gg.id}>{gg.name}</option>)}
        </select>
      </div>

      <div className="row" style={{ gap: 12, alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>{g.name}</h2>
        <StatusBadge status={g.status} />
      </div>
      <p className="tiny" style={{ marginBottom: 22 }}>Target: {g.target} · {g.description}</p>

      <div className={"wam-hero " + (pct >= 80 ? "is-good" : "is-warn")} style={{ margin: 0, marginBottom: 20 }}>
        <div className="tiny" style={{ marginBottom: 6 }}>{weekLabel}'s performance · target 80%</div>
        <div className="row" style={{ alignItems: "baseline", gap: 14 }}>
          <span className="wam-num">{pct}%</span>
          <StatusBadge status={pct >= 80 ? "on-track" : "below"} />
        </div>
        <div className={"bar bar--lg " + (pct >= 80 ? "is-good" : "is-warn")} style={{ marginTop: 14 }}>
          <span style={{ width: pct + "%" }} />
        </div>
        <div className="wam-meta">{pct >= 80 ? "On track" : `${Math.max(0, 80 - pct)} points below target`}</div>
      </div>

      <h3 className="section-title">Linked habits · {weekLabel.toLowerCase()}</h3>
      <div className="card">
        {habitBreakdown.map((h) => (
          <div key={h.id} className="habit-perf">
            <div style={{ minWidth: 0 }}>
              <div className="hp-name">{h.name}</div>
              <div className="tiny" style={{ color: "var(--text-3)" }}>{h.completions}/{h.target} days</div>
            </div>
            <span className="hp-pct">{h.pct}%</span>
            <div className={"bar " + (h.pct >= 80 ? "is-good" : "is-warn")}>
              <span style={{ width: h.pct + "%" }} />
            </div>
            <StatusBadge status={h.pct >= 80 ? "on-track" : "needs"} />
          </div>
        ))}
        {habitBreakdown.length === 0 && (
          <div className="tiny" style={{ padding: 12, color: "var(--text-3)" }}>No habits linked to this goal.</div>
        )}
      </div>
    </div>
  );
}

// ----------- Settings tab -----------

const APP_VERSION = versionData.version;
const VERSION_CHANGELOG = versionData.changelog;

const DEFAULT_AREA_COLORS = { findem: "#FF9500", jones: "#10B981", personal: "#6366F1" };
const AREA_PALETTE = ["#3B82F6", "#8B5CF6", "#64748B", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#6C63FF", "#1A1A1A"];

const NOTION_DBS = [
  { name: "Daily Check-Ins", id: "e0e02d06" },
  { name: "Tasks",           id: "751eca9e" },
  { name: "Goals",           id: "2414b2e0" },
  { name: "Habits",          id: "0a274c5f" },
  { name: "Habit Log",       id: "4dabaabd" },
  { name: "Routines",        id: "df0a549e" },
  { name: "Routine Log",     id: "b6bae775" },
  { name: "Contacts",        id: "e8023bd0" },
  { name: "Contact Groups",  id: "e5fc6aaf" },
  { name: "Contact Notes",   id: "c02a9437" },
];

export function SettingsTab({ state, setState }) {
  const areas = state.accounts || ACCOUNTS.map((a) => ({
    ...a,
    color: DEFAULT_AREA_COLORS[a.id] || "#64748B",
  }));

  const updateArea = (id, patch) => {
    setState((s) => ({
      ...s,
      accounts: (s.accounts || areas).map((a) => a.id === id ? { ...a, ...patch } : a),
    }));
  };

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Areas */}
      <h3 className="section-title">Areas</h3>
      <p className="tiny" style={{ marginBottom: 14, color: "var(--text-3)" }}>
        Areas group your habits, tasks, and goals. Colors sync across the whole app.
      </p>
      <div className="card" style={{ padding: "6px 0" }}>
        {areas.map((a, i) => (
          <AreaRow key={a.id} area={a} onUpdate={(patch) => updateArea(a.id, patch)}
            showDivider={i < areas.length - 1} />
        ))}
      </div>

      {/* Integrations */}
      <h3 className="section-title" style={{ marginTop: 32 }}>Integrations</h3>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>

        {/* Notion */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <NotionIcon />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Notion</span>
            <span className="badge badge--green" style={{ marginLeft: "auto" }}>
              <Icon.Check /> Sync active
            </span>
          </div>
          <p className="tiny" style={{ marginBottom: 12, color: "var(--text-2)" }}>
            Bidirectional sync is live. All reads and writes go directly to your Notion workspace in real time — no cache, no delay.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {NOTION_DBS.map((db) => (
              <span key={db.id} style={{
                fontSize: 11.5, padding: "2px 8px", borderRadius: 4,
                background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border-soft)",
              }}>{db.name}</span>
            ))}
          </div>
          <a
            href="https://www.notion.so"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--text-3)", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
            Open Notion workspace ↗
          </a>
        </div>

      </div>

      {/* Version & Updates */}
      <h3 className="section-title" style={{ marginTop: 32 }}>About</h3>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>Version</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>v{APP_VERSION}</div>
          </div>

          <div style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 12 }}>Recent Updates</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {VERSION_CHANGELOG.map((entry, i) => (
                <div key={i} style={{
                  paddingBottom: i < VERSION_CHANGELOG.length - 1 ? 10 : 0,
                  borderBottom: i < VERSION_CHANGELOG.length - 1 ? "1px solid var(--border-soft)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-1)" }}>v{entry.version}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                      background: entry.type === "major" ? "#ef4444" : entry.type === "minor" ? "#3b82f6" : "#10b981",
                      color: "white",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}>
                      {entry.type}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-3)", marginLeft: "auto" }}>{entry.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.4 }}>{entry.notes}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AreaRow({ area, onUpdate, showDivider }) {
  const [editingColor, setEditingColor] = useState(false);
  const [name, setName] = useState(area.name);
  const ref = useRef(null);

  useEffect(() => { setName(area.name); }, [area.name]);

  useEffect(() => {
    if (!editingColor) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setEditingColor(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [editingColor]);

  const saveName = () => {
    if (name.trim() && name.trim() !== area.name) onUpdate({ name: name.trim() });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px" }}>
        {/* Color swatch */}
        <div style={{ position: "relative" }} ref={ref}>
          <button
            onClick={() => setEditingColor((v) => !v)}
            style={{
              width: 28, height: 28, borderRadius: 7,
              background: area.color || "#64748B",
              border: "none", cursor: "pointer", flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              transition: "transform 100ms",
            }}
            title="Change color"
          />
          {editingColor && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              background: "var(--surface)", border: "1.5px solid var(--border)",
              borderRadius: 10, padding: 10, zIndex: 300,
              display: "flex", flexWrap: "wrap", gap: 6, width: 152,
              boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            }}>
              {AREA_PALETTE.map((c) => (
                <button key={c}
                  onClick={() => { onUpdate({ color: c }); setEditingColor(false); }}
                  style={{
                    width: 22, height: 22, borderRadius: 5, background: c,
                    border: area.color === c ? "2.5px solid var(--text)" : "2px solid transparent",
                    cursor: "pointer",
                  }} />
              ))}
            </div>
          )}
        </div>

        {/* Editable name */}
        <input
          className="input"
          style={{ flex: 1, fontSize: 13.5, fontWeight: 500, padding: "5px 8px", background: "transparent", border: "1px solid transparent" }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => { if (e.key === "Enter") { saveName(); e.target.blur(); } }}
          onFocus={(e) => (e.target.style.borderColor = "var(--border)")}
        />

        {/* Live dot preview */}
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: area.color || "#64748B", flexShrink: 0,
        }} />
      </div>
      {showDivider && <div style={{ height: 1, background: "var(--border-soft)", margin: "0 18px" }} />}
    </>
  );
}

function NotionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933z"/>
    </svg>
  );
}

