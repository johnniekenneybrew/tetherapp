import { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/clerk-react';
import { TODAY, addDays, weekStart, showToast } from './shared';
import {
  tasksApi, checkinApi, habitsApi, habitLogApi,
  routinesApi, routineLogApi, goalsApi, goalTasksApi,
  contactsApi, contactNotesApi, contactGroupsApi,
  prefsApi, googleTasksApi,
} from './api';

// ============================================================
// Date helpers
// ============================================================
const iso = (d) => d.toISOString().slice(0, 10);

// Load habit/routine logs for a wide window (8 weeks back, 1 week forward)
const LOG_FROM = iso(addDays(weekStart(TODAY), -49));
const LOG_TO   = iso(addDays(TODAY, 7));
const TODAY_ISO = iso(TODAY);

// ============================================================
// Empty / loading state
// ============================================================
const EMPTY = {
  todos:         [],
  habits:        [],
  routines:      [],
  goals:         [],
  goalTasks:     [],
  habitLog:      {},
  routineLog:    {},
  checkin:       { priorities: [], gratitude: ["", "", ""], learnings: ["", "", ""], sectionsDone: {}, completed: false, habitsUpdatedConfirmed: false },
  contacts:      [],
  contactGroups: [],
};

// ============================================================
// Hook
// ============================================================
export function useAppData() {
  const { user } = useUser();
  const userId = user?.id;

  const [state, setStateRaw] = useState(() => {
    try {
      const key = userId ? `tether_accounts_${userId}` : 'tether_accounts';
      const saved = JSON.parse(localStorage.getItem(key));
      return { ...EMPTY, accounts: saved || null };
    } catch {
      return EMPTY;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const areasSaveTimer = useRef(null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  // Save area settings — localStorage immediately, Notion debounced
  useEffect(() => {
    if (!state.accounts) return;
    const uid = userId;
    // Local cache for instant reload
    try {
      const localKey = uid ? `tether_accounts_${uid}` : 'tether_accounts';
      localStorage.setItem(localKey, JSON.stringify(state.accounts));
    } catch {}
    // Notion save debounced (avoids API calls on every keypress)
    if (uid) {
      clearTimeout(areasSaveTimer.current);
      areasSaveTimer.current = setTimeout(() => {
        prefsApi.set('areas', state.accounts, uid).catch(console.error);
      }, 800);
    }
  }, [state.accounts, userId]);

  // Checkin page ID (needed for PATCH)
  const [checkinPageId, setCheckinPageId] = useState(null);

  // ---- merge helper ----
  const mergeState = useCallback((patch) => {
    setStateRaw((s) => ({ ...s, ...patch }));
  }, []);

  // ============================================================
  // Load everything on mount
  // ============================================================
  useEffect(() => {
    async function loadAll() {
      try {
        const [
          todos, habits, routines, goals, goalTasks,
          habitLog, routineLog,
          checkin,
          contacts, contactGroups,
          notesFlat,
        ] = await Promise.all([
          tasksApi.list(),
          habitsApi.list(),
          routinesApi.list(),
          goalsApi.list(),
          goalTasksApi.list(),
          habitLogApi.range(LOG_FROM, LOG_TO),
          routineLogApi.range(LOG_FROM, LOG_TO),
          checkinApi.get(TODAY_ISO),
          contactsApi.list(),
          contactGroupsApi.list(),
          contactNotesApi.forContact(""), // loads all notes
        ]);

        // Attach notes to contacts
        const notesByContact = {};
        for (const n of notesFlat) {
          if (!notesByContact[n.contactId]) notesByContact[n.contactId] = [];
          notesByContact[n.contactId].push(n);
        }
        const contactsWithNotes = contacts.map((c) => ({
          ...c,
          notes: (notesByContact[c.id] || []).sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
          ),
        }));

        setCheckinPageId(checkin._pageId);

        setStateRaw((prev) => ({
          todos,
          habits,
          routines,
          goals,
          goalTasks,
          habitLog,
          routineLog,
          checkin: {
            priorities:             checkin.priorities || [],
            gratitude:              checkin.gratitude || ["", "", ""],
            learnings:              checkin.learnings || ["", "", ""],
            sectionsDone:           checkin.sectionsDone || {},
            completed:              checkin.completed || false,
            habitsUpdatedConfirmed: checkin.habitsUpdatedConfirmed || false,
          },
          contacts: contactsWithNotes,
          contactGroups,
          accounts: prev.accounts, // keep already-loaded localStorage value until Notion resolves
        }));

        // Load area preferences from Notion (cross-device source of truth)
        const uid = userIdRef.current;
        if (uid) {
          prefsApi.get('areas', uid)
            .then(({ value }) => {
              if (value && Array.isArray(value)) {
                setStateRaw((s) => ({ ...s, accounts: value }));
                try {
                  localStorage.setItem(`tether_accounts_${uid}`, JSON.stringify(value));
                } catch {}
              }
            })
            .catch(() => {}); // localStorage fallback already loaded
        }

        // Kick off Google Tasks sync in background (picks up changes from phone/other clients)
        googleTasksApi.sync().then((result) => {
          if (result?.synced > 0) {
            // Re-fetch todos to show any new/updated tasks from Google
            tasksApi.list().then((todos) => {
              setStateRaw((s) => ({ ...s, todos }));
            }).catch(() => {});
          }
        }).catch(() => {}); // Google sync is best-effort
      } catch (err) {
        console.error("loadAll failed", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // ============================================================
  // setState shim — keeps components working as-is
  // ============================================================
  const setState = useCallback((updater) => {
    setStateRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  }, []);

  // ============================================================
  // Actions — optimistic update + background Notion sync
  // ============================================================
  const actions = {

    // ---------- TASKS ----------

    addTodo(todo) {
      setState((s) => ({ ...s, todos: [todo, ...s.todos] }));
      tasksApi.create(todo).then((created) => {
        setState((s) => ({
          ...s,
          todos: s.todos.map((t) => t.id === todo.id ? { ...t, id: created.id, _pageId: created.id } : t),
        }));
        showToast("Task saved");
      }).catch(console.error);
    },

    toggleDone(id) {
      setState((s) => ({
        ...s,
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, done: !t.done, completedDay: !t.done ? "today" : null } : t
        ),
      }));
      const todo = state.todos.find((t) => t.id === id);
      if (todo) {
        const newDone = !todo.done;
        tasksApi.update(id, {
          done: newDone,
          completedDay: newDone ? "today" : "",
          completedAgo: newDone ? "just now" : "",
        }).catch(console.error);
      }
    },

    updateTodo(id, patch) {
      setState((s) => ({ ...s, todos: s.todos.map((t) => t.id === id ? { ...t, ...patch } : t) }));
      tasksApi.update(id, patch).then(() => showToast("Saved")).catch(console.error);
    },

    deleteTodo(id) {
      setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
      tasksApi.delete(id).then(() => showToast("Deleted")).catch(console.error);
    },

    addSubtask(todoId, text) {
      if (!text.trim()) return;
      const sub = { id: Date.now(), text: text.trim(), done: false };
      setState((s) => ({
        ...s,
        todos: s.todos.map((t) =>
          t.id === todoId ? { ...t, subtasks: [...t.subtasks, sub] } : t
        ),
      }));
      const todo = state.todos.find((t) => t.id === todoId);
      if (todo) {
        const newSubs = [...todo.subtasks, sub];
        tasksApi.update(todoId, { subtasks: newSubs }).catch(console.error);
      }
    },

    toggleSubtask(todoId, subId) {
      setState((s) => ({
        ...s,
        todos: s.todos.map((t) =>
          t.id === todoId
            ? { ...t, subtasks: t.subtasks.map((st) => st.id === subId ? { ...st, done: !st.done } : st) }
            : t
        ),
      }));
      setStateRaw((s) => {
        const todo = s.todos.find((t) => t.id === todoId);
        if (todo) {
          tasksApi.update(todoId, { subtasks: todo.subtasks }).catch(console.error);
        }
        return s;
      });
    },

    // ---------- HABIT LOG ----------

    toggleHabitLog(date, habitId) {
      const key = typeof date === "string" ? date : iso(date);
      setState((s) => {
        const log = { ...(s.habitLog[key] || {}) };
        log[habitId] = !log[habitId];
        return { ...s, habitLog: { ...s.habitLog, [key]: log } };
      });
      setStateRaw((s) => {
        const newVal = !!(s.habitLog[key] || {})[habitId];
        habitLogApi.toggle(key, habitId, newVal).catch(console.error);
        return s;
      });
    },

    // ---------- ROUTINE LOG ----------

    toggleRoutineLog(date, routineId) {
      const key = typeof date === "string" ? date : iso(date);
      setState((s) => {
        const log = { ...(s.routineLog[key] || {}) };
        log[routineId] = !log[routineId];
        return { ...s, routineLog: { ...s.routineLog, [key]: log } };
      });
      setStateRaw((s) => {
        const newVal = !!(s.routineLog[key] || {})[routineId];
        routineLogApi.toggle(key, routineId, newVal).catch(console.error);
        return s;
      });
    },

    // ---------- ROUTINES ----------

    updateRoutine(id, patch) {
      setState((s) => ({
        ...s,
        routines: s.routines.map((r) => r.id === id ? { ...r, ...patch } : r),
      }));
      routinesApi.update(id, patch).catch(console.error);
    },

    // ---------- HABITS ----------

    addHabit(habit) {
      const tempId = "h-" + Date.now();
      const newHabit = { ...habit, id: tempId };
      setState((s) => ({
        ...s,
        habits: [...s.habits, newHabit],
        goals: s.goals.map((g) =>
          (habit.goals || []).includes(g.id)
            ? { ...g, habitIds: [...g.habitIds, tempId] }
            : g
        ),
      }));
      habitsApi.create(habit).then((created) => {
        setState((s) => ({
          ...s,
          habits: s.habits.map((h) => h.id === tempId ? { ...h, id: created.id, _pageId: created.id } : h),
          goals: s.goals.map((g) => ({
            ...g,
            habitIds: g.habitIds.map((hid) => hid === tempId ? created.id : hid),
          })),
        }));
      }).catch(console.error);
    },

    // ---------- GOALS ----------

    addGoal(goal) {
      const tempId = "g-" + Date.now();
      const newGoal = { ...goal, id: tempId };
      setState((s) => ({ ...s, goals: [...s.goals, newGoal] }));
      goalsApi.create(goal).then((created) => {
        setState((s) => ({
          ...s,
          goals: s.goals.map((g) => g.id === tempId ? { ...g, id: created.id, _pageId: created.id } : g),
        }));
      }).catch(console.error);
    },

    updateGoal(id, patch) {
      setState((s) => ({ ...s, goals: s.goals.map((g) => g.id === id ? { ...g, ...patch } : g) }));
      goalsApi.update(id, patch).catch(console.error);
    },

    deleteGoal(id) {
      setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
      goalsApi.delete(id).catch(console.error);
    },

    // ---------- GOAL TASKS ----------

    addGoalTask(name) {
      const tempId = "gt-" + Date.now();
      const task = { id: tempId, name: name.trim(), done: false };
      setState((s) => ({ ...s, goalTasks: [...s.goalTasks, task] }));
      return goalTasksApi.create({ name: name.trim() }).then((created) => {
        setState((s) => ({
          ...s,
          goalTasks: s.goalTasks.map((t) => t.id === tempId ? { ...t, id: created.id, _pageId: created.id } : t),
        }));
        return created;
      });
    },

    toggleGoalTaskDone(id) {
      setState((s) => ({
        ...s,
        goalTasks: s.goalTasks.map((t) => t.id === id ? { ...t, done: !t.done } : t),
      }));
      setStateRaw((s) => {
        const task = s.goalTasks.find((t) => t.id === id);
        if (task) goalTasksApi.update(id, { done: !task.done }).catch(console.error);
        return s;
      });
    },

    deleteGoalTask(id) {
      setState((s) => ({
        ...s,
        goalTasks: s.goalTasks.filter((t) => t.id !== id),
        goals: s.goals.map((g) => ({ ...g, taskIds: (g.taskIds || []).filter((tid) => tid !== id) })),
      }));
      goalTasksApi.delete(id).catch(console.error);
    },

    // ---------- CHECK-IN ----------

    updateCheckin(patch) {
      setState((s) => ({ ...s, checkin: { ...s.checkin, ...patch } }));
      if (checkinPageId) {
        checkinApi.update(checkinPageId, patch).then(() => showToast("Saved")).catch(console.error);
      }
    },

    // ---------- CONTACTS ----------

    updateContact(id, patch) {
      setState((s) => ({
        ...s,
        contacts: s.contacts.map((c) => c.id === id ? { ...c, ...patch } : c),
      }));
      contactsApi.update(id, patch).then(() => showToast("Saved")).catch(console.error);
    },

    deleteContact(id) {
      setState((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== id) }));
      contactsApi.delete(id).then(() => showToast("Deleted")).catch(console.error);
    },

    addContact(contact) {
      const tempId = "c-" + Date.now();
      const newContact = { ...contact, id: tempId, notes: [] };
      setState((s) => ({ ...s, contacts: [...s.contacts, newContact] }));
      contactsApi.create(contact).then((created) => {
        setState((s) => ({
          ...s,
          contacts: s.contacts.map((c) => c.id === tempId ? { ...c, id: created.id, _pageId: created.id } : c),
        }));
        showToast("Contact saved");
      }).catch(console.error);
    },

    addNote(contactId, text) {
      if (!text.trim()) return;
      const tempId = "n-" + Date.now();
      const note = { id: tempId, text: text.trim(), timestamp: new Date().toISOString(), contactId };
      setState((s) => ({
        ...s,
        contacts: s.contacts.map((c) =>
          c.id === contactId ? { ...c, notes: [note, ...(c.notes || [])] } : c
        ),
      }));
      contactNotesApi.create({ contactId, text: text.trim(), timestamp: note.timestamp })
        .then((created) => {
          setState((s) => ({
            ...s,
            contacts: s.contacts.map((c) =>
              c.id === contactId
                ? { ...c, notes: c.notes.map((n) => n.id === tempId ? { ...n, id: created.id, _pageId: created.id } : n) }
                : c
            ),
          }));
          showToast("Note saved");
        }).catch(console.error);
    },

    deleteNote(contactId, noteId) {
      setState((s) => ({
        ...s,
        contacts: s.contacts.map((c) =>
          c.id === contactId
            ? { ...c, notes: (c.notes || []).filter((n) => n.id !== noteId) }
            : c
        ),
      }));
      contactNotesApi.delete(noteId).then(() => showToast("Deleted")).catch(console.error);
    },

    // ---------- GOOGLE TASKS ----------

    syncGoogleTasks() {
      return googleTasksApi.sync().then((result) => {
        if (result?.synced > 0) {
          tasksApi.list().then((todos) => {
            setStateRaw((s) => ({ ...s, todos }));
          }).catch(() => {});
        }
        return result;
      });
    },

    saveContactGroups(newGroups) {
      const prev = state.contactGroups;
      setState((s) => ({ ...s, contactGroups: newGroups }));

      // Diff: delete removed, create added, update changed
      const prevIds = new Set(prev.map((g) => g.id));
      const newIds  = new Set(newGroups.map((g) => g.id));

      // Delete removed
      for (const g of prev) {
        if (!newIds.has(g.id)) {
          contactGroupsApi.delete(g.id).catch(console.error);
        }
      }
      // Create added (temp ids start with "grp-")
      for (const g of newGroups) {
        if (!prevIds.has(g.id)) {
          contactGroupsApi.create({ name: g.name, icon: g.icon }).then((created) => {
            setState((s) => ({
              ...s,
              contactGroups: s.contactGroups.map((cg) => cg.id === g.id ? { ...cg, id: created.id } : cg),
            }));
          }).catch(console.error);
        } else {
          // Update existing if changed
          const old = prev.find((p) => p.id === g.id);
          if (old && (old.name !== g.name || old.icon !== g.icon)) {
            contactGroupsApi.update(g.id, { name: g.name, icon: g.icon }).catch(console.error);
          }
        }
      }
    },
  };

  return { state, setState, loading, error, actions };
}
