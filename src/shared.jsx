import React, { useState, useEffect, useRef, useMemo } from 'react';

export { useState, useEffect, useRef, useMemo };

// ============================================================
// Shared primitives + data helpers
// ============================================================

export const ACCOUNTS = [
  { id: "getro", short: "G", name: "Getro", emails: ["j@getro.com"] },
  { id: "jones", short: "Q", name: "Quit with Jones", emails: ["j@quitwithjones.com"] },
  { id: "personal", short: "P", name: "Personal", emails: ["j@me.com", "jordan.m@gmail.com"] },
];
export const accLookup = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));

// Fixed "today" so the prototype is stable
export const TODAY = new Date(2026, 4, 22); // May 22 2026, a Thursday

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAYS_LONG = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export function fmtLong(d) {
  return `${DAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
export function fmtShort(d) { return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }
export function fmtMD(d) { return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`; }
export function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function sameDay(a, b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
export function weekStart(d) { // Monday start
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - dow);
  return r;
}

// ----------- icons (inline SVG, no libs) -----------

export const Icon = {
  Check: (p) => (<svg width="12" height="12" viewBox="0 0 14 14" fill="none" {...p}><path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Plus: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>),
  X: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  Star: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M7 1.5l1.6 3.6 3.9.4-2.9 2.7.9 3.9L7 10.2l-3.5 2 .9-3.9L1.5 5.5l3.9-.4L7 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>),
  StarFill: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" {...p}><path d="M7 1.5l1.6 3.6 3.9.4-2.9 2.7.9 3.9L7 10.2l-3.5 2 .9-3.9L1.5 5.5l3.9-.4L7 1.5z"/></svg>),
  Kebab: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" {...p}><circle cx="3" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11" cy="7" r="1.3"/></svg>),
  Chevron: (p) => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...p}><path d="M3.5 4.5L6 7l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ChevL: (p) => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...p}><path d="M7.5 3L4 6l3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  ChevR: (p) => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none" {...p}><path d="M4.5 3L8 6l-3.5 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Cal: (p) => (<svg width="13" height="13" viewBox="0 0 14 14" fill="none" {...p}><rect x="2" y="3" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2 6h10M5 2v2M9 2v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
  Sun: (p) => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1.5v1.5M7 11v1.5M1.5 7H3M11 7h1.5M3 3l1 1M10 10l1 1M3 11l1-1M10 4l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
};

// ----------- Primitives -----------

export function Checkbox({ checked, onChange, accent, size = "md", circle = false }) {
  const cls = ["cb"];
  if (size === "sm") cls.push("cb--sm");
  if (size === "xs") cls.push("cb--xs");
  if (circle) cls.push("cb--circle");
  if (checked) cls.push("is-checked");
  return (
    <button type="button"
      className={cls.join(" ")}
      data-acc={accent || undefined}
      onClick={(e) => { e.stopPropagation(); onChange && onChange(!checked); }}
      aria-pressed={checked}
    >
      <Icon.Check />
    </button>
  );
}

export function AccountDot({ acc, big = false }) {
  return <span className={`dot dot--${acc}${big?" dot--lg":""}`} />;
}

export function StatusBadge({ status }) {
  const map = {
    "on-track": ["badge--green", "On Track"],
    "in-progress": ["badge--amber", "In Progress"],
    "below": ["badge--amber", "Below Target"],
    "needs": ["badge--amber", "Needs Improvement"],
    "completed": ["badge--grey", "Completed"],
    "overdue": ["badge--red", "Overdue"],
  };
  const [cls, label] = map[status] || ["badge--grey", status];
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ----------- Emoji rain -----------

const RAIN_EMOJI = ["🎉","✨","🌟","💫","🌈","🎊","🏆","💎","🔥","⭐","🌸","🍀","💚","🌻","☀️","🧡"];

export function EmojiRain({ duration = 2800, count = 56, onDone }) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      e: RAIN_EMOJI[Math.floor(Math.random() * RAIN_EMOJI.length)],
      left: Math.random() * 100,
      delay: Math.random() * 600,
      dur: 1800 + Math.random() * 1800,
      size: 22 + Math.random() * 22,
      rot: (Math.random() * 720 - 360) + "deg",
      key: i,
    }));
  }, [count]);

  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div className="emoji-rain" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.key}
          style={{
            left: p.left + "%",
            animationDelay: p.delay + "ms",
            animationDuration: p.dur + "ms",
            fontSize: p.size + "px",
            "--r": p.rot,
          }}>
          {p.e}
        </span>
      ))}
    </div>
  );
}

// ----------- Top bar -----------

export function TopBar({ route, setRoute, dateLabel, onHubTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(null); // which nav dropdown is open: "hub" | "social" | null

  const items = [
    { id: "checkin", label: "Daily Check-In" },
    { id: "hub", label: "Habits + Health", dropdown: true },
    { id: "social", label: "Social", dropdown: true },
  ];

  const rightItems = [
    { id: "todo", label: "To-Do List" },
  ];

  const hubTabs = [
    { id: "habits", label: "Habits" },
    { id: "routines", label: "Routines" },
    { id: "goals", label: "Goals" },
    { id: "wam", label: "WAM" },
  ];

  const socialTabs = [
    { id: "contacts", label: "Contacts" },
  ];

  useEffect(() => {
    if (!menuOpen && !dropOpen) return;
    const onDown = (e) => {
      if (!e.target.closest("[data-avatar-menu]")) setMenuOpen(false);
      if (!e.target.closest("[data-nav-drop]")) setDropOpen(null);
    };
    const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); setDropOpen(null); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, dropOpen]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <svg width="120" height="32" viewBox="0 0 160 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="8" y1="20" x2="20" y2="8" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
            <line x1="20" y1="8" x2="32" y2="20" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="20" x2="20" y2="32" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <line x1="20" y1="32" x2="32" y2="20" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <circle cx="8" cy="20" r="3.5" fill="#6C63FF"/>
            <circle cx="20" cy="8" r="3.5" fill="#6C63FF"/>
            <circle cx="32" cy="20" r="3.5" fill="#6C63FF"/>
            <circle cx="20" cy="32" r="2.5" fill="#6C63FF" opacity="0.35"/>
            <text x="46" y="27" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fontSize="22" fill="#1a1a2e" letterSpacing="0.5">
              <tspan fontWeight="300">teth</tspan><tspan fontWeight="600">er</tspan>
            </text>
          </svg>
        </div>
        <nav className="nav">
          {items.map((it) => {
            const isDropdown = it.dropdown;
            const tabs = it.id === "hub" ? hubTabs : it.id === "social" ? socialTabs : [];
            const isOpen = dropOpen === it.id;

            if (isDropdown) {
              return (
                <div key={it.id} data-nav-drop style={{ position: "relative" }}>
                  <button
                    className={route.page === it.id ? "active" : ""}
                    onClick={() => {
                      if (route.page === it.id) {
                        setDropOpen(isOpen ? null : it.id);
                      } else {
                        setRoute({ page: it.id });
                        setDropOpen(it.id);
                      }
                    }}>
                    {it.label}
                    <Icon.Chevron style={{ marginLeft: 2, opacity: 0.5 }} />
                  </button>
                  {isOpen && (
                    <div className="hub-dropdown fade-in">
                      {tabs.map((tab) => {
                        const active = it.id === "hub" && onHubTab?.current === tab.id;
                        return (
                          <button key={tab.id}
                            className={"hub-dropdown-item" + (active ? " is-active" : "")}
                            onClick={() => {
                              setRoute({ page: it.id });
                              if (it.id === "hub" && onHubTab?.set) onHubTab.set(tab.id);
                              setDropOpen(null);
                            }}>
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button key={it.id}
                className={route.page === it.id ? "active" : ""}
                onClick={() => setRoute({ page: it.id })}>
                {it.label}
              </button>
            );
          })}
        </nav>
        <div className="topbar-right">
          <nav className="nav nav--right">
            {rightItems.map((it) => (
              <button key={it.id}
                className={route.page === it.id ? "active" : ""}
                onClick={() => setRoute({ page: it.id })}>
                {it.label}
              </button>
            ))}
          </nav>
          <span className="nav-divider" />
          <span className="hint"><Icon.Sun /> Thu · {dateLabel}</span>
          <div data-avatar-menu style={{ position: "relative" }}>
            <button
              className={"avatar" + (route.page === "settings" ? " is-active" : "")}
              onClick={() => setMenuOpen((s) => !s)}
              aria-expanded={menuOpen}
              title="Account">
              JM
            </button>
            {menuOpen && (
              <div className="avatar-menu fade-in">
                <div className="avatar-menu-head">
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Jordan Mason</div>
                  <div className="tiny" style={{ marginTop: 2 }}>j@getro.com</div>
                </div>
                <div className="avatar-menu-list">
                  <button onClick={() => { setRoute({ page: "settings" }); setMenuOpen(false); }}>
                    <SettingsIcon /> Settings
                  </button>
                  <button onClick={() => setMenuOpen(false)}>
                    <HelpIcon /> Help &amp; feedback
                  </button>
                  <button onClick={() => setMenuOpen(false)}>
                    <KeyboardIcon /> Keyboard shortcuts
                  </button>
                </div>
                <div className="avatar-menu-divider" />
                <div className="avatar-menu-list">
                  <button onClick={() => setMenuOpen(false)} style={{ color: "var(--text-2)" }}>
                    <SignOutIcon /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M7 1.5v1.6M7 10.9v1.6M1.5 7h1.6M10.9 7h1.6M3 3l1.1 1.1M9.9 9.9L11 11M3 11l1.1-1.1M9.9 4.1L11 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5.5 5.5c0-.9.7-1.5 1.5-1.5s1.5.6 1.5 1.5c0 1-1.5 1-1.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="7" cy="10" r="0.7" fill="currentColor"/>
    </svg>
  );
}
function KeyboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="3.5" width="11" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M4 7h.01M7 7h.01M10 7h.01M4.5 9h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M8.5 4V2.5h-6v9h6V10M5.5 7h7M10 4.5L12.5 7 10 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
