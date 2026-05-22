import React, { useState, useEffect, useRef } from 'react';
import {
  ACCOUNTS, TODAY, fmtLong, addDays,
  Icon, Checkbox, AccountDot, EmojiRain,
} from './shared';

// ============================================================
// Daily Check-In (desktop two-column)
// ============================================================

export function DailyCheckIn({ state, setState, navigateTo }) {
  const today = TODAY;
  const yest = addDays(today, -1);
  const habits = state.habits;
  const routines = state.routines;
  const yKey = yest.toISOString().slice(0, 10);
  const yestHabitStatus = state.habitLog[yKey] || {};
  const yestRoutineStatus = state.routineLog[yKey] || {};

  const [priorities, setPriorities] = useState(state.checkin?.priorities || []);
  const [newPriority, setNewPriority] = useState("");
  const [newAccount, setNewAccount] = useState("getro");
  const [gratitude, setGratitude] = useState(state.checkin?.gratitude || ["", "", ""]);
  const [learnings, setLearnings] = useState(state.checkin?.learnings || ["", "", ""]);
  const [sectionsDone, setSectionsDone] = useState(state.checkin?.sectionsDone || {
    priorities: false, habits: false, gratitude: false, learnings: false,
  });
  const [celebrating, setCelebrating] = useState(false);
  const [showBanner, setShowBanner] = useState(!!state.checkin?.completed);
  const triggeredRef = useRef(!!state.checkin?.completed);

  useEffect(() => {
    setState((s) => ({
      ...s,
      checkin: { ...s.checkin, priorities, gratitude, learnings, sectionsDone },
    }));
  }, [priorities, gratitude, learnings, sectionsDone]);

  const prioritiesReady = priorities.length >= 1;
  const habitsReady = true;
  const gratitudeReady = gratitude.every((g) => g.trim().length > 2);
  const learningsReady = learnings.every((g) => g.trim().length > 2);

  const allDone =
    sectionsDone.priorities && sectionsDone.habits &&
    sectionsDone.gratitude && sectionsDone.learnings;
  const progressDone =
    Number(sectionsDone.priorities) + Number(sectionsDone.habits) +
    Number(sectionsDone.gratitude) + Number(sectionsDone.learnings);

  useEffect(() => {
    if (allDone && !triggeredRef.current) {
      triggeredRef.current = true;
      setCelebrating(true);
    }
  }, [allDone]);

  const finish = () => {
    setCelebrating(false);
    setShowBanner(true);
    setState((s) => ({ ...s, checkin: { ...s.checkin, priorities, gratitude, learnings, sectionsDone, completed: true } }));
    setTimeout(() => navigateTo({ page: "todo" }), 900);
  };

  const addPriority = () => {
    if (!newPriority.trim() || priorities.length >= 5) return;
    setPriorities((arr) => [
      ...arr,
      { id: Date.now(), text: newPriority.trim(), account: newAccount, done: false },
    ]);
    setNewPriority("");
    setSectionsDone((s) => ({ ...s, priorities: false }));
  };
  const togglePriorityDone = (id) => {
    setPriorities((arr) => arr.map((p) => p.id === id ? { ...p, done: !p.done } : p));
  };
  const removePriority = (id) => {
    setPriorities((arr) => arr.filter((p) => p.id !== id));
    setSectionsDone((s) => ({ ...s, priorities: false }));
  };

  const toggleYHabit = (habitId) => {
    setState((s) => {
      const log = { ...(s.habitLog[yKey] || {}) };
      log[habitId] = !log[habitId];
      return { ...s, habitLog: { ...s.habitLog, [yKey]: log } };
    });
  };
  const toggleYRoutine = (rid) => {
    setState((s) => {
      const log = { ...(s.routineLog[yKey] || {}) };
      log[rid] = !log[rid];
      return { ...s, routineLog: { ...s.routineLog, [yKey]: log } };
    });
  };

  const setSectionDone = (key, val) =>
    setSectionsDone((s) => ({ ...s, [key]: val }));

  return (
    <div className="page fade-in" style={{ maxWidth: 960 }}>
      {showBanner && (
        <div className="completion-banner">
          <Icon.Check /> Morning Check-In Complete
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">Daily Check-In</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Today — {fmtLong(today)} · A two-minute morning ritual.
          </p>
        </div>
        <div style={{ minWidth: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
            <span>Progress</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--text)" }}>
              {progressDone}/4
            </span>
          </div>
          <div className={"bar bar--lg " + (progressDone === 4 ? "is-good" : progressDone >= 2 ? "is-warn" : "")}>
            <span style={{ width: (progressDone / 4 * 100) + "%" }} />
          </div>
        </div>
      </div>

      <div className="checkin-grid">
        {/* LEFT column */}
        <div className="col" style={{ gap: 18 }}>

          {/* PRIORITIES */}
          <section>
            <SectionHead label="Today's Priorities" hint={`${priorities.length}/5`} />
            <div className={"card checkin-card" + (sectionsDone.priorities ? " is-complete" : "")}>
              {priorities.length === 0 && (
                <div className="tiny" style={{ padding: "2px 0 10px" }}>
                  What must happen today? Add up to 5 priorities.
                </div>
              )}

              {priorities.length > 0 && (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                  {priorities.map((p) => (
                    <li key={p.id} className="priority-row">
                      <Checkbox checked={p.done} onChange={() => togglePriorityDone(p.id)} accent={p.account} size="sm" circle />
                      <span style={{
                        flex: 1, fontSize: 14.5,
                        color: p.done ? "var(--text-2)" : "var(--text)",
                        textDecoration: p.done ? "line-through" : "none",
                      }}>
                        {p.text}
                      </span>
                      <AccountDot acc={p.account} />
                      <button className="priority-remove" onClick={() => removePriority(p.id)} title="Remove">
                        <Icon.X />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {priorities.length < 5 && !sectionsDone.priorities && (
                <div className="priority-add">
                  <Icon.Plus />
                  <input
                    placeholder={priorities.length === 0 ? "Add your first priority…" : "Add another priority…"}
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addPriority();
                      if (e.key === "Escape") setNewPriority("");
                    }}
                  />
                  <div className="priority-acc">
                    {ACCOUNTS.map((a) => (
                      <button key={a.id}
                        className={"acc-swatch" + (newAccount === a.id ? " is-on" : "")}
                        title={a.name}
                        onClick={() => setNewAccount(a.id)}>
                        <AccountDot acc={a.id} big />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <SectionFooter
                done={sectionsDone.priorities}
                ready={prioritiesReady}
                readyHint={priorities.length === 0 ? "Add at least one priority" : null}
                onMark={() => setSectionDone("priorities", true)}
                onEdit={() => setSectionDone("priorities", false)}
              />
            </div>
          </section>

          {/* YESTERDAY'S HABITS + ROUTINES */}
          <section>
            <SectionHead label="Update Yesterday's Habits & Routines" />
            <div className={"card checkin-card" + (sectionsDone.habits ? " is-complete" : "")}>
              <div className="tiny" style={{ marginBottom: 10 }}>
                Yesterday · {fmtLong(yest)}
              </div>

              <div className="yh-grid">
                <div>
                  <div className="yh-group-label">Habits</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {habits.map((h) => (
                      <li key={h.id}
                        onClick={() => !sectionsDone.habits && toggleYHabit(h.id)}
                        className="yh-row">
                        <span style={{ fontSize: 13.5 }}>{h.name}</span>
                        <Checkbox
                          checked={!!yestHabitStatus[h.id]}
                          onChange={() => !sectionsDone.habits && toggleYHabit(h.id)}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="yh-group-label">Routines</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {routines.map((r) => (
                      <li key={r.id}
                        onClick={() => !sectionsDone.habits && toggleYRoutine(r.id)}
                        className="yh-row"
                        title={r.name}>
                        <span style={{ fontSize: r.useIcon && r.icon ? 18 : 13.5 }}>
                          {r.useIcon && r.icon ? r.icon : r.name}
                        </span>
                        <Checkbox
                          checked={!!yestRoutineStatus[r.id]}
                          onChange={() => !sectionsDone.habits && toggleYRoutine(r.id)}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <SectionFooter
                done={sectionsDone.habits}
                ready={habitsReady}
                onMark={() => setSectionDone("habits", true)}
                onEdit={() => setSectionDone("habits", false)}
                markLabel="Mark reviewed"
              />
            </div>
          </section>
        </div>

        {/* RIGHT column */}
        <div className="col" style={{ gap: 18 }}>
          {/* GRATITUDE */}
          <section>
            <SectionHead label="What I'm Grateful For" hint="3 things" />
            <div className={"card checkin-card" + (sectionsDone.gratitude ? " is-complete" : "")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gratitude.map((g, i) => (
                  <textarea key={i}
                    className={"input" + (g.trim().length > 2 ? " is-filled--green" : "")}
                    placeholder={`Gratitude #${i + 1}…`}
                    value={g}
                    readOnly={sectionsDone.gratitude}
                    onChange={(e) => {
                      const next = [...gratitude];
                      next[i] = e.target.value;
                      setGratitude(next);
                    }}
                    rows={2}
                    style={{ minHeight: 64 }}
                  />
                ))}
              </div>
              <SectionFooter
                done={sectionsDone.gratitude}
                ready={gratitudeReady}
                readyHint={!gratitudeReady ? "Fill all three" : null}
                onMark={() => setSectionDone("gratitude", true)}
                onEdit={() => setSectionDone("gratitude", false)}
              />
            </div>
          </section>

          {/* LEARNINGS */}
          <section>
            <SectionHead label="Highlights & Learnings" hint="3 things" />
            <div className={"card checkin-card" + (sectionsDone.learnings ? " is-complete" : "")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {learnings.map((g, i) => (
                  <textarea key={i}
                    className={"input" + (g.trim().length > 2 ? " is-filled" : "")}
                    placeholder={`Highlight / Learning #${i + 1}…`}
                    value={g}
                    readOnly={sectionsDone.learnings}
                    onChange={(e) => {
                      const next = [...learnings];
                      next[i] = e.target.value;
                      setLearnings(next);
                    }}
                    rows={2}
                    style={{ minHeight: 64 }}
                  />
                ))}
              </div>
              <SectionFooter
                done={sectionsDone.learnings}
                ready={learningsReady}
                readyHint={!learningsReady ? "Fill all three" : null}
                onMark={() => setSectionDone("learnings", true)}
                onEdit={() => setSectionDone("learnings", false)}
              />
            </div>
          </section>
        </div>
      </div>

      <div className="checkin-status">
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            {allDone
              ? "You're ready to start the day."
              : `${progressDone} of 4 sections complete`}
          </div>
          <div className="tiny" style={{ marginTop: 2 }}>
            {allDone
              ? "We'll celebrate, then jump you into your tasks."
              : "Mark each section complete as you finish it."}
          </div>
        </div>
        {!allDone && progressDone > 0 && (
          <button className="btn-text" onClick={() => setSectionsDone({ priorities: false, habits: false, gratitude: false, learnings: false })}>
            Reset sections
          </button>
        )}
      </div>

      {celebrating && <EmojiRain duration={2400} onDone={finish} />}
    </div>
  );
}

function SectionHead({ label, count, hint }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      margin: "0 2px 10px",
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>{label}</h2>
      {typeof count === "number" && count > 0 && (
        <span className="tiny">{count}</span>
      )}
      {hint && <span className="tiny">{hint}</span>}
    </div>
  );
}

function SectionFooter({ done, ready, readyHint, onMark, onEdit, markLabel }) {
  return (
    <div className="section-footer">
      {done ? (
        <>
          <span className="section-done">
            <Icon.Check /> Section complete
          </span>
          <button className="btn-text" onClick={onEdit}>Edit</button>
        </>
      ) : (
        <>
          <span className="tiny">{ready ? "" : (readyHint || "")}</span>
          <button
            className="btn btn-primary section-mark"
            disabled={!ready}
            onClick={onMark}>
            {markLabel || "Mark complete"}
          </button>
        </>
      )}
    </div>
  );
}
