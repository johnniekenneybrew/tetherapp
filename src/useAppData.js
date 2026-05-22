import { useState, useEffect, useCallback } from 'react';
import { TODAY, addDays, weekStart } from './shared';
import {
  tasksApi, checkinApi, habitsApi, habitLogApi,
  routinesApi, routineLogApi, goalsApi,
  contactsApi, contactNotesApi, contactGroupsApi,
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
  habitLog:      {},
  routineLog:    {},
  checkin:       { gratitude: ["", "", ""], learnings: ["", "", ""], sectionsDone: {}, completed: false, habitsUpdatedConfirmed: false },
  contacts:      [],
  contactGroups: [],
};

// ============================================================
// Hook
// ============================================================
export function useAppData() {
  const [state, setStateRaw] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

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
          todos, habits, routines, goals,
          habitLog, routineLog,
          checkin,
          contacts, contactGroups,
          notesFlat,
        ] = await Promise.all([
          tasksApi.list(),
          habitsApi.list(),
          routinesApi.list(),
          goalsApi.list(),
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

        setStateRaw({
          todos,
          habits,
          routines,
          goals,
          habitLog,
          routineLog,
          checkin: {
            gratitude:              checkin.gratitude || ["", "", ""],
            learnings:              checkin.learnings || ["", "", ""],
            sectionsDone:           checkin.sectionsDone || {},
            completed:              checkin.completed || false,
            habitsUpdatedConfirmed: checkin.habitsUpdatedConfirmed || false,
          },
          contacts: contactsWithNotes,
          contactGroups,
        });
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
      // Optimistic: already has temp id from caller
      setState((s) => ({ ...s, todos: [todo, ...s.todos] }));
      tasksApi.create(todo).then((created) => {
        // Replace temp id with real Notion page id
        setState((s) => ({
          ...s,
          todos: s.todos.map((t) => t.id === todo.id ? { ...t, id: created.id, _pageId: created.id } : t),
        }));
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
      tasksApi.update(id, patch).catch(console.error);
    },

    deleteTodo(id) {
      setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
      tasksApi.delete(id).catch(console.error);
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

    // ---------- CHECK-IN ----------

    updateCheckin(patch) {
      setState((s) => ({ ...s, checkin: { ...s.checkin, ...patch } }));
      if (checkinPageId) {
        checkinApi.update(checkinPageId, patch).catch(console.error);
      }
    },

    // ---------- CONTACTS ----------

    updateContact(id, patch) {
      setState((s) => ({
        ...s,
        contacts: s.contacts.map((c) => c.id === id ? { ...c, ...patch } : c),
      }));
      contactsApi.update(id, patch).catch(console.error);
    },

    deleteContact(id) {
      setState((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== id) }));
      contactsApi.delete(id).catch(console.error);
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
      contactNotesApi.delete(noteId).catch(console.error);
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
