import React, { useState, useEffect, useRef } from 'react';
import {
  ACCOUNTS, TODAY, fmtShort, fmtMD, addDays, weekStart, sameDay, DAYS, MONTHS,
  Checkbox, AccountDot, StatusBadge, Icon,
} from './shared';

// ============================================================
// Habits + Health hub
// ============================================================

export function HabitsHub({ state, setState, sub, setSub }) {
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

      {sub === "habits" && <HabitsTab state={state} setState={setState} />}
      {sub === "routines" && <RoutinesTab state={state} setState={setState} />}
      {sub === "goals" && <GoalsTab state={state} setState={setState} />}
      {sub === "wam" && <WamTab state={state} setState={setState} />}
    </div>
  );
}

// ----------- Habits tab -----------

function HabitsTab({ state, setState }) {
  const ws = weekStart(TODAY);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(ws, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const habits = state.habits;
  const [goalFilter, setGoalFilter] = useState("all");
  const [showAddHabit, setShowAddHabit] = useState(false);

  const filteredHabits = habits.filter((h) =>
    goalFilter === "all" || (h.goals || []).includes(goalFilter)
  );

  const toggleHabit = (date, hid) => {
    const key = date.toISOString().slice(0, 10);
    setState((s) => {
      const log = { ...(s.habitLog[key] || {}) };
      log[hid] = !log[hid];
      return { ...s, habitLog: { ...s.habitLog, [key]: log } };
    });
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
                <tr key={h.id}>
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
      {showAddHabit && <AddHabitModal onClose={() => setShowAddHabit(false)} state={state} setState={setState} />}
    </div>
  );
}

// ----------- Add Habit modal -----------

function AddHabitModal({ onClose, state, setState }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(5);
  const [account, setAccount] = useState("personal");
  const [linkedGoals, setLinkedGoals] = useState([]);

  const save = () => {
    if (!name.trim()) return;
    const hid = "h-" + Date.now();
    setState((s) => ({
      ...s,
      habits: [...s.habits, {
        id: hid,
        name: name.trim(),
        target,
        account,
        goals: linkedGoals,
      }],
      goals: s.goals.map((g) =>
        linkedGoals.includes(g.id)
          ? { ...g, habitIds: [...g.habitIds, hid] }
          : g
      ),
    }));
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

function RoutinesTab({ state, setState }) {
  const ws = weekStart(TODAY);
  const [weekOffset, setWeekOffset] = useState(0);
  const start = addDays(ws, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const routines = state.routines;
  const dayLetters = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const [editingId, setEditingId] = useState(null);

  const toggleR = (date, rid) => {
    const key = date.toISOString().slice(0, 10);
    setState((s) => {
      const log = { ...(s.routineLog[key] || {}) };
      log[rid] = !log[rid];
      return { ...s, routineLog: { ...s.routineLog, [key]: log } };
    });
  };

  const updateRoutine = (rid, patch) => {
    setState((s) => ({
      ...s,
      routines: s.routines.map((r) => r.id === rid ? { ...r, ...patch } : r),
    }));
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
                <th key={r.id} className={"cb-cell routine-head-th" + (r.trackOnly ? " is-track-only" : "")} style={{ textAlign: "center" }} title={r.name + (r.trackOnly ? " (tracking only)" : "")}>
                  <button className={"routine-head-btn" + (r.useIcon ? " is-icon" : "")}
                    onClick={() => setEditingId(editingId === r.id ? null : r.id)}>
                    {r.useIcon && r.icon
                      ? <span className="routine-emoji">{r.icon}</span>
                      : <span className="habit-row-name" style={{ fontSize: 13.5 }}>{r.name}</span>}
                  </button>
                  {r.trackOnly && <span className="track-only-label">*</span>}
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

function GoalsTab({ state, setState }) {
  const [menuOpen, setMenuOpen] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [accFilter, setAccFilter] = useState("all");

  const allActive = state.goals.filter((g) => g.status !== "completed");
  const active = allActive.filter((g) => accFilter === "all" || g.account === accFilter);
  const done = state.goals.filter((g) => g.status === "completed");

  const habitsById = Object.fromEntries(state.habits.map((h) => [h.id, h]));

  const completeGoal = (id) => {
    setState((s) => ({ ...s, goals: s.goals.map((g) => g.id === id ? { ...g, status: "completed" } : g) }));
    setMenuOpen(null);
  };
  const delGoal = (id) => {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
    setMenuOpen(null);
  };

  return (
    <div onClick={() => setMenuOpen(null)}>
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
              {g.target && <div className="goal-target">Target {g.target} · {g.description}</div>}
            </div>
            <StatusBadge status={g.status} />
            <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
              <button className="kebab" onClick={() => setMenuOpen(menuOpen === g.id ? null : g.id)}>
                <Icon.Kebab />
              </button>
              {menuOpen === g.id && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4,
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
                  boxShadow: "var(--shadow-pop)", padding: 6, minWidth: 180, zIndex: 5,
                }}>
                  <MenuItem onClick={() => setMenuOpen(null)}>Edit goal</MenuItem>
                  <MenuItem onClick={() => setMenuOpen(null)}>Add / remove habits</MenuItem>
                  <MenuItem onClick={() => completeGoal(g.id)}>Mark complete</MenuItem>
                  <MenuItem destructive onClick={() => delGoal(g.id)}>Delete goal</MenuItem>
                </div>
              )}
            </div>
          </div>
          <div className="habit-bubbles">
            {g.habitIds.map((hid) => (
              <span key={hid} className="pill">
                <AccountDot acc={habitsById[hid]?.account || "personal"} />
                {habitsById[hid]?.name || "—"}
              </span>
            ))}
            <button className="pill" style={{ background: "var(--bg)", color: "var(--text-2)", borderStyle: "dashed" }}>
              <Icon.Plus /> Add habit
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
            <div className={"bar " + (g.weekPct >= 80 ? "is-good" : "is-warn")} style={{ flex: 1 }}>
              <span style={{ width: g.weekPct + "%" }} />
            </div>
            <span className="tiny" style={{ fontVariantNumeric: "tabular-nums", color: "var(--text)", fontWeight: 600 }}>
              {g.weekPct}% this week
            </span>
          </div>
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

      {showAdd && <AddGoalModal onClose={() => setShowAdd(false)} state={state} setState={setState} />}
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

function AddGoalModal({ onClose, state, setState }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState([]);
  const [account, setAccount] = useState("personal");
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitTarget, setNewHabitTarget] = useState(5);

  const createHabit = () => {
    if (!newHabitName.trim()) return;
    const hid = "h-" + Date.now();
    setState((s) => ({
      ...s,
      habits: [...s.habits, {
        id: hid,
        name: newHabitName.trim(),
        target: newHabitTarget,
        account: "personal",
        goals: [],
      }],
    }));
    setSelected((s) => [...s, hid]);
    setNewHabitName("");
    setShowNewHabit(false);
  };

  const save = () => {
    if (!name.trim()) return;
    const goalId = "g-" + Date.now();
    setState((s) => ({
      ...s,
      goals: [...s.goals, {
        id: goalId,
        name: name.trim(),
        description: desc.trim() || "—",
        status: "in-progress",
        habitIds: selected,
        account,
        weekPct: 0,
        prevPct: 0,
        target: "End of Q2",
      }],
      habits: s.habits.map((h) =>
        selected.includes(h.id) ? { ...h, goals: [...(h.goals || []), goalId] } : h
      ),
    }));
    onClose();
  };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New goal</h3>
        <div className="tiny">Define an outcome and link the habits that get you there.</div>
        <div className="field">
          <label>Goal name</label>
          <input className="input" placeholder="e.g. Lose 10 pounds" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>Description (optional)</label>
          <textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Why does this matter right now?" />
        </div>
        <div className="field">
          <label>Account</label>
          <div style={{ display: "flex", gap: 6 }}>
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
        <div className="field">
          <label>Link habits</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {state.habits.map((h) => {
              const on = selected.includes(h.id);
              return (
                <button key={h.id} className="pill"
                  style={{
                    background: on ? "var(--text)" : "var(--surface-2)",
                    color: on ? "#fff" : "var(--text)",
                    borderColor: on ? "var(--text)" : "var(--border-soft)",
                  }}
                  onClick={() => setSelected((s) => on ? s.filter((x) => x !== h.id) : [...s, h.id])}>
                  {on && <Icon.Check />} {h.name}
                </button>
              );
            })}
            <button className="pill"
              style={{ borderStyle: "dashed", color: "var(--text-2)" }}
              onClick={() => setShowNewHabit(true)}>
              <Icon.Plus /> New habit
            </button>
          </div>
          {showNewHabit && (
            <div className="fade-in" style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <input className="input" style={{ flex: 1 }}
                placeholder="Habit name"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createHabit(); if (e.key === "Escape") setShowNewHabit(false); }}
                autoFocus />
              <select className="btn" style={{ fontSize: 12 }}
                value={newHabitTarget}
                onChange={(e) => setNewHabitTarget(Number(e.target.value))}>
                {[3,4,5,6,7].map((n) => (
                  <option key={n} value={n}>{n}×/wk</option>
                ))}
              </select>
              <button className="btn btn-primary" onClick={createHabit} disabled={!newHabitName.trim()}>Add</button>
              <button className="btn-text" onClick={() => setShowNewHabit(false)}><Icon.X /></button>
            </div>
          )}
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>Save goal</button>
        </div>
      </div>
    </div>
  );
}

// ----------- WAM tab -----------

function WamTab({ state }) {
  const [selectedGoal, setSelectedGoal] = useState("all");
  const [weekOffset, setWeekOffset] = useState(-1);
  const habitsById = Object.fromEntries(state.habits.map((h) => [h.id, h]));

  const isLast = weekOffset === -1;
  const weekLabel = isLast ? "Last week" : "This week";
  const weekNumLabel = isLast ? "Week 6 of Q2 · May 11 – 17" : "Week 7 of Q2 · May 18 – 24";

  const goalPct = (g) => (isLast ? g.prevPct : g.weekPct);

  const WeekNav = () => (
    <div className="row" style={{ gap: 6 }}>
      <button className="btn-text" onClick={() => setWeekOffset((o) => o - 1)} disabled={weekOffset <= -1}>
        <Icon.ChevL /> Previous
      </button>
      <span style={{ fontSize: 13.5, fontWeight: 600, minWidth: 200, textAlign: "center" }}>
        {weekNumLabel}
      </span>
      <button className="btn-text" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
        Next <Icon.ChevR />
      </button>
    </div>
  );

  if (selectedGoal === "all") {
    const active = state.goals.filter((g) => g.status !== "completed");
    const avg = Math.round(active.reduce((a, g) => a + goalPct(g), 0) / (active.length || 1));
    const compareAvg = Math.round(active.reduce((a, g) => a + (isLast ? g.weekPct : g.prevPct), 0) / (active.length || 1));
    const compareLabel = isLast ? "this week (in progress)" : "previous week";
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
            Across {active.length} active goals · {compareLabel} {compareAvg}%
          </div>
        </div>

        <h3 className="section-title">Goals breakdown</h3>
        <div className="card">
          {active.map((g) => {
            const p = goalPct(g);
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
        </div>
      </div>
    );
  }

  const g = state.goals.find((x) => x.id === selectedGoal);
  if (!g) return null;
  const pct = goalPct(g);
  const comparePct = isLast ? g.weekPct : g.prevPct;
  const compareLabel = isLast ? "This week (in progress)" : "Previous week";

  const habitPcts = g.habitIds.map((hid, i) => {
    const seed = (hid + i + g.id).length;
    const base = [71, 78, 89, 65, 92, 83, 70][seed % 7];
    const adj = isLast ? Math.round(base * 0.94) : base;
    return { id: hid, name: habitsById[hid]?.name || "—", account: habitsById[hid]?.account, pct: adj };
  });

  const trendBase = [68, 72, 65, 80, 74, 82, g.weekPct];
  const trend = [...trendBase, 0, 0, 0, 0, 0];

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

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <div className={"wam-hero " + (pct >= 80 ? "is-good" : "is-warn")} style={{ margin: 0 }}>
          <div className="tiny" style={{ marginBottom: 6 }}>{weekLabel}</div>
          <span className="wam-num">{pct}%</span>
          <div className="wam-meta">{pct >= 80 ? "On track" : `${Math.max(0, 80 - pct)} points below target`}</div>
          <div className={"bar bar--lg " + (pct >= 80 ? "is-good" : "is-warn")} style={{ marginTop: 14 }}>
            <span style={{ width: pct + "%" }} />
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <div className="tiny">{compareLabel}</div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 4 }}>
            {comparePct}%
          </div>
          <div className="bar" style={{ marginTop: 10 }}><span style={{ width: comparePct + "%", background: "var(--text-3)" }} /></div>
          <div className="tiny" style={{ marginTop: 6 }}>{comparePct >= 80 ? "On track" : "Below target"}</div>
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: 28 }}>Linked habits · {weekLabel.toLowerCase()}</h3>
      <div className="card">
        {habitPcts.map((h) => (
          <div key={h.id} className="habit-perf">
            <div className="row" style={{ gap: 8 }}>
              <AccountDot acc={h.account} /> <span className="hp-name">{h.name}</span>
            </div>
            <span className="hp-pct">{h.pct}%</span>
            <div className={"bar " + (h.pct >= 80 ? "is-good" : "is-warn")}>
              <span style={{ width: h.pct + "%" }} />
            </div>
            <StatusBadge status={h.pct >= 80 ? "on-track" : "needs"} />
          </div>
        ))}
      </div>

      <h3 className="section-title" style={{ marginTop: 28 }}>Quarterly trend</h3>
      <div className="card">
        <div className="chart">
          {trend.map((v, i) => {
            const isCurrent = i === 6;
            const future = v === 0;
            const h = future ? 6 : Math.max(8, (v / 100) * 140);
            const cls = future ? "" : v >= 80 ? "is-good" : "is-warn";
            return (
              <div key={i} className="bar-col">
                <div className="bar-val">{future ? "" : v + "%"}</div>
                <div className={"bar-fill " + cls + (isCurrent ? " is-current" : "")}
                  style={{ height: h, background: future ? "var(--surface-2)" : undefined }} />
                <div className="bar-label">W{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------- Settings tab -----------

export function SettingsTab({ state, setState }) {
  const [notifs, setNotifs] = useState({ checkin: true, habits: false });
  const [editingAcc, setEditingAcc] = useState(null);

  const COLORS = ["#3B82F6", "#8B5CF6", "#64748B", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#1A1A1A"];

  const accounts = state.accounts || ACCOUNTS.map((a) => ({
    ...a,
    color: a.id === "getro" ? "#3B82F6" : a.id === "jones" ? "#8B5CF6" : "#64748B",
    emails: a.emails || [a.email || ""],
  }));

  const updateAccount = (id, patch) => {
    setState((s) => ({
      ...s,
      accounts: (s.accounts || accounts).map((a) => a.id === id ? { ...a, ...patch } : a),
    }));
  };

  const addEmail = (accId) => {
    setState((s) => ({
      ...s,
      accounts: (s.accounts || accounts).map((a) =>
        a.id === accId ? { ...a, emails: [...(a.emails || []), ""] } : a
      ),
    }));
  };

  const updateEmail = (accId, idx, val) => {
    setState((s) => ({
      ...s,
      accounts: (s.accounts || accounts).map((a) => {
        if (a.id !== accId) return a;
        const emails = [...(a.emails || [])];
        emails[idx] = val;
        return { ...a, emails };
      }),
    }));
  };

  const removeEmail = (accId, idx) => {
    setState((s) => ({
      ...s,
      accounts: (s.accounts || accounts).map((a) => {
        if (a.id !== accId) return a;
        const emails = (a.emails || []).filter((_, i) => i !== idx);
        return { ...a, emails: emails.length ? emails : [""] };
      }),
    }));
  };

  return (
    <div>
      <h3 className="section-title">Connected accounts</h3>
      {accounts.map((a) => {
        const isEditing = editingAcc === a.id;
        return (
          <div key={a.id} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: a.color || "#64748B",
              color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13,
              flexShrink: 0,
            }}>{a.short}</span>
            <div style={{ flex: 1 }}>
              {isEditing ? (
                <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input className="input" style={{ fontSize: 14, padding: "6px 10px" }}
                    value={a.name} autoFocus
                    onChange={(e) => updateAccount(a.id, { name: e.target.value })} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span className="tiny">Connected emails</span>
                    {(a.emails || []).map((em, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input className="input" style={{ flex: 1, fontSize: 13, padding: "5px 10px" }}
                          value={em} placeholder="email@example.com"
                          onChange={(e) => updateEmail(a.id, i, e.target.value)} />
                        {(a.emails || []).length > 1 && (
                          <button className="btn-text" style={{ color: "var(--error)", padding: 4 }}
                            onClick={() => removeEmail(a.id, i)}>
                            <Icon.X />
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="btn-text" style={{ alignSelf: "flex-start", fontSize: 12 }}
                      onClick={() => addEmail(a.id)}>
                      <Icon.Plus /> Add email
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="tiny">Color</span>
                    {COLORS.map((c) => (
                      <button key={c}
                        onClick={() => updateAccount(a.id, { color: c })}
                        style={{
                          width: 20, height: 20, borderRadius: 5,
                          background: c, border: a.color === c ? "2px solid var(--text)" : "2px solid transparent",
                          cursor: "pointer", transition: "border-color 100ms",
                        }} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                  <div className="tiny">
                    {(a.emails || []).join(", ")} · last synced 2 min ago
                  </div>
                </>
              )}
            </div>
            <span className="badge badge--green"><Icon.Check /> Synced</span>
            <button className="btn-text" onClick={() => setEditingAcc(isEditing ? null : a.id)}>
              {isEditing ? "Done" : "Edit"}
            </button>
            <button className="btn-text">Re-sync</button>
            <button className="btn-text" style={{ color: "var(--error)" }}>Disconnect</button>
          </div>
        );
      })}

      <h3 className="section-title" style={{ marginTop: 28 }}>Integrations</h3>
      <div className="card">
        <div className="setting-row">
          <div>
            <div className="sr-label">Google Tasks</div>
            <div className="sr-sub">3 lists synced · last 4 min ago</div>
          </div>
          <button className="btn-text">Manage</button>
        </div>
        <div className="setting-row">
          <div>
            <div className="sr-label">Notion</div>
            <div className="sr-sub">2 databases synced · last 8 min ago</div>
          </div>
          <button className="btn-text">Manage</button>
        </div>
      </div>

      <h3 className="section-title" style={{ marginTop: 28 }}>Notifications</h3>
      <div className="card">
        <div className="setting-row">
          <div>
            <div className="sr-label">Daily Check-In reminder</div>
            <div className="sr-sub">Every morning at 8:00 AM</div>
          </div>
          <div className={"switch" + (notifs.checkin ? " on" : "")} onClick={() => setNotifs((n) => ({ ...n, checkin: !n.checkin }))} />
        </div>
        <div className="setting-row">
          <div>
            <div className="sr-label">Habit check-in reminder</div>
            <div className="sr-sub">Every evening at 9:00 PM</div>
          </div>
          <div className={"switch" + (notifs.habits ? " on" : "")} onClick={() => setNotifs((n) => ({ ...n, habits: !n.habits }))} />
        </div>
      </div>
    </div>
  );
}
