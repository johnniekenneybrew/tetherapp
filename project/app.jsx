/* global React, ReactDOM, TODAY, fmtShort, TopBar, DailyCheckIn, TodoList, HabitsHub */
const { useState, useEffect } = React;

// ============================================================
// Seed data
// ============================================================

const HABITS = [
  { id: "h-walk", name: "Morning Walk", target: 5, account: "personal", goals: ["g-weight"] },
  { id: "h-meal", name: "Meal Prep", target: 4, account: "personal", goals: ["g-weight"] },
  { id: "h-cal",  name: "Track Calories", target: 7, account: "personal", goals: ["g-weight"] },
  { id: "h-read", name: "Read 20 min", target: 5, account: "personal", goals: ["g-read"] },
  { id: "h-deep", name: "Deep Work Block", target: 5, account: "getro", goals: ["g-launch"] },
];

const ROUTINES = [
  { id: "r-meds", name: "Take Meds", icon: "💊", useIcon: true, trackOnly: false },
  { id: "r-skin", name: "Skincare", icon: "✨", useIcon: true, trackOnly: false },
  { id: "r-eve",  name: "Evening Reflection", icon: "📓", useIcon: true, trackOnly: false },
  { id: "r-caf",  name: "No Caffeine After 2pm", icon: "☕", useIcon: true, trackOnly: true },
];

const GOALS = [
  {
    id: "g-weight", name: "Lose 10 pounds", description: "Daily movement + measured nutrition",
    status: "in-progress", habitIds: ["h-walk", "h-meal", "h-cal"], weekPct: 75, prevPct: 82,
    target: "Sep 30, 2026", account: "personal",
  },
  {
    id: "g-launch", name: "Ship Onboarding v2", description: "Defend deep-work mornings",
    status: "in-progress", habitIds: ["h-deep"], weekPct: 88, prevPct: 71,
    target: "Jun 14, 2026", account: "getro",
  },
  {
    id: "g-read", name: "Read 12 books this year", description: "Quiet reading ritual",
    status: "in-progress", habitIds: ["h-read"], weekPct: 64, prevPct: 70,
    target: "Dec 31, 2026", account: "personal",
  },
  {
    id: "g-sleep", name: "Sleep before midnight", description: "Wind-down by 11pm",
    status: "completed", habitIds: [], weekPct: 100, prevPct: 100, target: "Q1 2026", account: "personal",
  },
];

const TODOS = [
  { id: 1, title: "Review Q2 onboarding metrics", account: "getro", done: false, priority: true,
    details: "Pull conversion + activation curves. Compare to Q1 launch cohort.",
    due: 2, subtasks: [
      { id: 11, text: "Export funnel CSV", done: true },
      { id: 12, text: "Annotate week 4 dip", done: false },
      { id: 13, text: "Share read-out doc", done: false },
    ]},
  { id: 2, title: "Client call with Jereme", account: "getro", done: false, priority: true,
    details: "Walk through onboarding redesign and the new lifecycle emails.",
    due: 0, subtasks: [] },
  { id: 3, title: "Process refund requests", account: "jones", done: false, priority: true,
    details: null, due: -2, subtasks: [] },
  { id: 4, title: "Outline Quit with Jones newsletter", account: "jones", done: false, priority: false,
    details: "Theme: rituals that survive a bad week.",
    due: 4, subtasks: [
      { id: 41, text: "Three story drafts", done: false },
      { id: 42, text: "Pick lead photo", done: false },
    ]},
  { id: 5, title: "Pay quarterly taxes", account: "personal", done: false, priority: false,
    details: null, due: 8, subtasks: [] },
  { id: 6, title: "Renew gym membership", account: "personal", done: false, priority: false,
    details: null, due: null, subtasks: [] },
  { id: 7, title: "Send follow-up to Jereme", account: "getro", done: true, priority: false,
    completedDay: "today", completedAgo: "2 hours ago",
    details: null, due: null, subtasks: [] },
  { id: 8, title: "Update Slack status", account: "getro", done: true, priority: false,
    completedDay: "today", completedAgo: "30 min ago",
    details: null, due: null, subtasks: [] },
  { id: 9, title: "Draft Q2 board update", account: "getro", done: true, priority: false,
    completedDay: "Mon, May 19", details: null, due: null, subtasks: [] },
  { id: 10, title: "Cancel Sentry trial", account: "jones", done: true, priority: false,
    completedDay: "Tue, May 20", details: null, due: null, subtasks: [] },
  { id: 11, title: "Schedule annual physical", account: "personal", done: true, priority: false,
    completedDay: "Wed, May 21", details: null, due: null, subtasks: [] },
];

const CONTACT_GROUPS = [
  { id: "childhood", name: "Childhood Friends", icon: "🏠" },
  { id: "uni", name: "Uni Friends", icon: "🎓" },
  { id: "work", name: "Work", icon: "💼" },
  { id: "family", name: "Family", icon: "❤️" },
];

const CONTACTS = [
  { id: "c-1", name: "Alex Rivera", city: "San Francisco", birthday: "1994-08-15", group: "uni", lastSeen: "2 weeks ago",
    giftIdeas: "Vinyl records, camping gear", tags: ["tech", "foodie", "close"],
    notes: [
      { id: "n-1", text: "Mentioned they're moving to Portland in September", timestamp: "2026-05-10T14:30:00Z" },
      { id: "n-2", text: "Working on a startup — AI for restaurant menus", timestamp: "2026-04-22T09:15:00Z" },
    ]},
  { id: "c-2", name: "Maya Chen", city: "New York", birthday: "1993-06-03", group: "work", lastSeen: "Last week",
    giftIdeas: "Books on design, matcha set", tags: ["design", "close", "mentor"],
    notes: [
      { id: "n-3", text: "Recommended the book 'Four Thousand Weeks'", timestamp: "2026-05-18T16:00:00Z" },
    ]},
  { id: "c-3", name: "Sam Okafor", city: "London", birthday: "1995-05-28", group: "uni", lastSeen: "3 months ago",
    giftIdeas: "", tags: ["travel", "music"],
    notes: [] },
  { id: "c-4", name: "Priya Sharma", city: "Austin", birthday: "1992-12-01", group: "childhood", lastSeen: "January 2026",
    giftIdeas: "Baby clothes, photo album", tags: ["close", "new-parent"],
    notes: [
      { id: "n-4", text: "Had a baby girl in March — send gift", timestamp: "2026-03-15T11:00:00Z" },
      { id: "n-5", text: "Planning a group trip to Mexico for NYE", timestamp: "2026-02-28T20:00:00Z" },
    ]},
  { id: "c-5", name: "Jordan Kim", city: "Chicago", birthday: "1994-09-22", group: "work", lastSeen: "Yesterday",
    giftIdeas: "", tags: ["tech", "fitness"],
    notes: [] },
  { id: "c-6", name: "Lena Müller", city: "Berlin", birthday: "1993-01-14", group: "uni", lastSeen: "6 months ago",
    giftIdeas: "Stationery, Berlin guidebook", tags: ["travel", "creative"],
    notes: [
      { id: "n-6", text: "Got engaged! Wedding in fall 2027", timestamp: "2026-04-01T12:00:00Z" },
    ]},
  { id: "c-7", name: "Dad", city: "Miami", birthday: "1960-03-08", group: "family", lastSeen: "Last weekend",
    giftIdeas: "Golf accessories, whiskey", tags: ["close"],
    notes: [] },
  { id: "c-8", name: "Mom", city: "Miami", birthday: "1962-11-20", group: "family", lastSeen: "Last weekend",
    giftIdeas: "Spa voucher, gardening tools", tags: ["close"],
    notes: [] },
];

// Seed habit + routine logs across the visible week (Mon May 18 → Sun May 24)
function seedLogs() {
  const habitLog = {};
  const routineLog = {};
  // pattern per habit across the week
  const patterns = {
    "h-walk": [1, 0, 1, 1, 0, 1, 0],
    "h-meal": [0, 1, 1, 1, 0, 1, 0],
    "h-cal":  [1, 1, 1, 1, 1, 0, 0],
    "h-read": [0, 1, 0, 1, 0, 0, 0],
    "h-deep": [1, 1, 1, 0, 0, 0, 0],
  };
  const routinePatterns = {
    "r-meds": [1, 1, 1, 1, 1, 0, 0],
    "r-skin": [1, 0, 1, 1, 0, 0, 0],
    "r-eve":  [1, 1, 1, 0, 0, 0, 0],
  };
  // week start: Monday May 18
  const ws = new Date(2026, 4, 18);
  for (let i = 0; i < 7; i++) {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    habitLog[key] = {};
    routineLog[key] = {};
    Object.entries(patterns).forEach(([hid, arr]) => { habitLog[key][hid] = !!arr[i]; });
    Object.entries(routinePatterns).forEach(([rid, arr]) => { routineLog[key][rid] = !!arr[i]; });
  }
  return { habitLog, routineLog };
}

const SEED = (() => {
  const { habitLog, routineLog } = seedLogs();
  return {
    todos: TODOS,
    habits: HABITS,
    routines: ROUTINES,
    goals: GOALS,
    habitLog,
    routineLog,
    checkin: { gratitude: ["", "", ""], learnings: ["", "", ""], habitsUpdatedConfirmed: false, completed: false },
    contacts: CONTACTS,
    contactGroups: CONTACT_GROUPS,
  };
})();

// ============================================================
// App
// ============================================================

function App() {
  const [state, setState] = useState(SEED);
  const [route, setRoute] = useState({ page: "checkin" });
  const [hubSub, setHubSub] = useState("habits");

  const dateLabel = fmtShort(TODAY).split(", ")[1];

  const navigateTo = (r) => setRoute(r);

  return (
    <div className="app" data-screen-label={
      route.page === "checkin" ? "01 Daily Check-In"
      : route.page === "todo" ? "02 To-Do List"
      : route.page === "hub" ? `03 Habits + Health · ${hubSub}`
      : route.page === "settings" ? "04 Settings"
      : route.page === "social" ? "05 Social"
      : "App"
    }>
      <TopBar route={route} setRoute={setRoute} dateLabel={dateLabel} onHubTab={{ current: hubSub, set: setHubSub }} />
      {route.page === "checkin" && (
        <DailyCheckIn state={state} setState={setState} navigateTo={navigateTo} />
      )}
      {route.page === "todo" && (
        <TodoList state={state} setState={setState} />
      )}
      {route.page === "hub" && (
        <HabitsHub state={state} setState={setState} sub={hubSub} setSub={setHubSub} />
      )}
      {route.page === "settings" && (
        <div className="page fade-in">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage accounts, integrations, and how the app feels.</p>
          <SettingsTab state={state} setState={setState} />
        </div>
      )}
      {route.page === "social" && (
        <SocialPage state={state} setState={setState} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
