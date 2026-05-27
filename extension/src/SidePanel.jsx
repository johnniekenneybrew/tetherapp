import React, { useState, useEffect, useCallback } from "react";
import { useUser, useAuth, SignOutButton } from "@clerk/chrome-extension";
import { tasksApi, checkinApi } from "./api.js";

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const diff = Math.floor((d - new Date(TODAY + "T00:00:00")) / 86400000);
  if (diff === 0) return { label: "Today", color: "#ef4444" };
  if (diff === 1) return { label: "Tomorrow", color: "#f97316" };
  if (diff < 0) return { label: "Overdue", color: "#dc2626" };
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), color: "#6b7280" };
}

function DueBadge({ date }) {
  const info = formatDate(date);
  if (!info) return null;
  return (
    <span className="due-badge" style={{ background: info.color + "18", color: info.color }}>
      {info.label === "Today" ? "Today" : info.label === "Tomorrow" ? "Tomorrow" : info.label === "Overdue" ? "Overdue" : info.label}
    </span>
  );
}

function TaskItem({ task, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className={`task-item ${task.completed ? "completed" : ""}`}>
      <button
        className="task-check"
        onClick={() => onToggle(task)}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed ? (
          <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" stroke="currentColor" /><path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" stroke="currentColor" /></svg>
        )}
      </button>
      <div className="task-body">
        <span className="task-text">{task.title || task.text || task.name || "(untitled)"}</span>
        {task.dueDate && <DueBadge date={task.dueDate} />}
      </div>
      <button
        className="task-delete"
        onClick={async () => { setDeleting(true); await onDelete(task); }}
        disabled={deleting}
        aria-label="Delete task"
      >
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

function AddTaskRow({ onAdd }) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    await onAdd(text.trim());
    setText("");
    setAdding(false);
  }

  return (
    <form className="add-task-row" onSubmit={submit}>
      <input
        className="add-task-input"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add a task..."
        disabled={adding}
      />
      <button className="add-task-btn" type="submit" disabled={adding || !text.trim()}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
    </form>
  );
}

export default function SidePanel() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState("today"); // "today" | "all"

  const getAuthToken = useCallback(() => getToken(), [getToken]);

  const fetchTasks = useCallback(async () => {
    try {
      setError(null);
      const token = await getAuthToken();
      const data = await tasksApi.list(token);
      setTasks(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleToggle = useCallback(async (task) => {
    const token = await getAuthToken();
    const updated = await tasksApi.update(token, task.id, { completed: !task.completed });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t));
  }, [getAuthToken]);

  const handleAdd = useCallback(async (title) => {
    const token = await getAuthToken();
    const created = await tasksApi.create(token, { title, dueDate: TODAY });
    setTasks(prev => [...prev, created]);
  }, [getAuthToken]);

  const handleDelete = useCallback(async (task) => {
    const token = await getAuthToken();
    await tasksApi.delete(token, task.id);
    setTasks(prev => prev.filter(t => t.id !== task.id));
  }, [getAuthToken]);

  const todayTasks = tasks.filter(t => !t.completed && t.dueDate === TODAY);
  const allPending = tasks.filter(t => !t.completed);
  const displayed  = tab === "today" ? todayTasks : allPending;

  return (
    <div className="panel">
      {/* Header */}
      <header className="panel-header">
        <div className="panel-header-left">
          <img src="icons/icon16.png" alt="" className="panel-logo" />
          <span className="panel-title">Tether</span>
        </div>
        <div className="panel-header-right">
          <img
            src={user?.imageUrl}
            alt={user?.firstName || "User"}
            className="avatar"
          />
          <SignOutButton>
            <button className="signout-btn" title="Sign out">
              <svg viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </SignOutButton>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${tab === "today" ? "active" : ""}`}
          onClick={() => setTab("today")}
        >
          Today
          {todayTasks.length > 0 && <span className="tab-count">{todayTasks.length}</span>}
        </button>
        <button
          className={`tab ${tab === "all" ? "active" : ""}`}
          onClick={() => setTab("all")}
        >
          All tasks
          {allPending.length > 0 && <span className="tab-count">{allPending.length}</span>}
        </button>
      </div>

      {/* Task list */}
      <div className="task-list">
        {loading && (
          <div className="state-message">
            <div className="spinner" />
          </div>
        )}
        {!loading && error && (
          <div className="state-message error">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchTasks}>Retry</button>
          </div>
        )}
        {!loading && !error && displayed.length === 0 && (
          <div className="state-message empty">
            <p>{tab === "today" ? "No tasks due today" : "No pending tasks"}</p>
          </div>
        )}
        {!loading && !error && displayed.map(task => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {/* Add task */}
      {!loading && !error && (
        <div className="panel-footer">
          <AddTaskRow onAdd={handleAdd} />
        </div>
      )}
    </div>
  );
}
