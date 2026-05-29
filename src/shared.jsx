import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';

export { useState, useEffect, useRef, useMemo };

// ============================================================
// Toast (module-level singleton so any action can fire it)
// ============================================================

let _toastHandler = null;
export function _registerToastHandler(fn) { _toastHandler = fn; }
export function showToast(msg = "Saved") { _toastHandler?.(msg); }

// ============================================================
// Shared primitives + data helpers
// ============================================================

export const ACCOUNTS = [
  { id: "getro", short: "G", name: "Getro", emails: ["j@getro.com"] },
  { id: "jones", short: "Q", name: "Quit with Jones", emails: ["j@quitwithjones.com"] },
  { id: "personal", short: "P", name: "Personal", emails: ["j@me.com", "jordan.m@gmail.com"] },
];
export const accLookup = Object.fromEntries(ACCOUNTS.map((a) => [a.id, a]));

export const TODAY = new Date();

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
  Grip: (p) => (<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" {...p}><circle cx="3" cy="3.5" r="1.2"/><circle cx="7" cy="3.5" r="1.2"/><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="3" cy="10.5" r="1.2"/><circle cx="7" cy="10.5" r="1.2"/></svg>),
  GripH: (p) => (<svg width="14" height="6" viewBox="0 0 14 6" fill="currentColor" {...p}><circle cx="2" cy="1.5" r="1.1"/><circle cx="7" cy="1.5" r="1.1"/><circle cx="12" cy="1.5" r="1.1"/><circle cx="2" cy="4.5" r="1.1"/><circle cx="7" cy="4.5" r="1.1"/><circle cx="12" cy="4.5" r="1.1"/></svg>),
  Clock: (p) => (<svg width="13" height="13" viewBox="0 0 14 14" fill="none" {...p}><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 4V7l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>),
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

// ----------- Emoji confetti explosion -----------

const BURST_EMOJI = ["🎉","✨","🌟","💫","🌈","🎊","🏆","💎","🔥","⭐","🌸","🍀","💚","🌻","☀️","🧡"];
const CONFETTI_COLORS = ["#ff4757","#ffa502","#2ed573","#1e90ff","#ff6b81","#eccc68","#a29bfe","#fd79a8","#00cec9","#fdcb6e","#ff6348","#7bed9f"];

function makeParticle(speedMin, speedMax, upwardBias) {
  const angle = Math.random() * Math.PI * 2;
  const speed = speedMin + Math.random() * (speedMax - speedMin);
  return {
    tx: Math.round(Math.cos(angle) * speed) + "px",
    ty: Math.round(Math.sin(angle) * speed - upwardBias) + "px",
  };
}

export function EmojiRain({ duration = 4200, count = 260, onDone }) {
  const emojis = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    ...makeParticle(450, 1350, 800),
    e: BURST_EMOJI[Math.floor(Math.random() * BURST_EMOJI.length)],
    delay: Math.random() * 80,
    dur: 2200 + Math.random() * 2000,
    size: 44 + Math.random() * 84,   // 44–128px
    rot: (Math.random() * 1440 - 720) + "deg",
    key: i,
  })), [count]);

  const confetti = useMemo(() => Array.from({ length: 380 }).map((_, i) => {
    const isCircle = Math.random() < 0.3;
    return {
      ...makeParticle(430, 1300, 780),
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 80,
      dur: 2200 + Math.random() * 2000,
      sd: (0.2 + Math.random() * 0.4).toFixed(2) + "s",
      w: isCircle ? "18px" : (11 + Math.floor(Math.random() * 14)) + "px",
      h: isCircle ? "18px" : (18 + Math.floor(Math.random() * 12)) + "px",
      br: isCircle ? "50%" : "2px",
      key: i,
    };
  }), []);

  useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div className="emoji-rain" aria-hidden="true">
      {emojis.map((p) => (
        <span key={p.key} style={{
          "--tx": p.tx, "--ty": p.ty, "--r": p.rot,
          animationDelay: p.delay + "ms",
          animationDuration: p.dur + "ms",
          fontSize: p.size + "px",
        }}>{p.e}</span>
      ))}
      {confetti.map((c) => (
        <div key={c.key} className="confetti-piece" style={{
          "--tx": c.tx, "--ty": c.ty, "--dur": c.dur + "ms", "--sd": c.sd,
          animationDelay: c.delay + "ms",
          width: c.w, height: c.h,
          background: c.color, borderRadius: c.br,
        }} />
      ))}
    </div>
  );
}

// ----------- Top bar -----------

export function TopBar({ route, setRoute, dateLabel, onHubTab }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuTimer = useRef(null);
  const dropTimer = useRef(null);
  const mobileNavRef = useRef(null);
  const { user } = useUser();
  const { signOut } = useClerk();

  const fullName = user?.fullName || user?.firstName || "Account";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const initials = fullName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

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

  const allNavItems = [
    { id: "checkin", label: "Daily Check-In" },
    { id: "hub", label: "Habits + Health" },
    { id: "social", label: "Social" },
    { id: "todo", label: "To-Do List" },
  ];
  const currentNavLabel = allNavItems.find(p => p.id === route.page)?.label ?? "Menu";

  useEffect(() => {
    if (!menuOpen && !dropOpen && !mobileNavOpen) return;
    const onKey = (e) => { if (e.key === "Escape") { setMenuOpen(false); setDropOpen(null); setMobileNavOpen(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, dropOpen, mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onClick = (e) => {
      if (mobileNavRef.current && !mobileNavRef.current.contains(e.target)) {
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [mobileNavOpen]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand" onClick={() => setRoute({ page: "checkin" })} style={{ cursor: "pointer" }}>
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
        {/* Mobile nav dropdown - visible only on small screens */}
        <div className="mobile-nav" ref={mobileNavRef}>
          <button
            className={"mobile-nav-btn" + (mobileNavOpen ? " is-open" : "")}
            onClick={() => setMobileNavOpen(o => !o)}
          >
            {currentNavLabel}
            <Icon.Chevron />
          </button>
          {mobileNavOpen && (
            <div className="mobile-nav-menu fade-in">
              {allNavItems.map(it => (
                <button
                  key={it.id}
                  className={"mobile-nav-item" + (route.page === it.id ? " is-active" : "")}
                  onClick={() => { setRoute({ page: it.id }); setMobileNavOpen(false); }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="nav">
          {items.map((it) => {
            const isDropdown = it.dropdown;
            const tabs = it.id === "hub" ? hubTabs : it.id === "social" ? socialTabs : [];
            const isOpen = dropOpen === it.id;

            if (isDropdown) {
              return (
                <div key={it.id} data-nav-drop style={{ position: "relative" }}
                  onMouseEnter={() => { clearTimeout(dropTimer.current); setDropOpen(it.id); }}
                  onMouseLeave={() => { dropTimer.current = setTimeout(() => setDropOpen(null), 150); }}>
                  <button
                    className={route.page === it.id ? "active" : ""}
                    onClick={() => setRoute({ page: it.id })}>
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
                onClick={() => setRoute({ page: it.id })}
                style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {it.label}
                {it.id === "todo" && (
                  <span style={{
                    fontSize: 8.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                    color: "#6C63FF", background: "rgba(108,99,255,0.15)", border: "1px solid rgba(108,99,255,0.3)",
                    borderRadius: 3, padding: "1px 4px", lineHeight: 1.2,
                  }}>beta</span>
                )}
              </button>
            ))}
          </nav>
          <span className="nav-divider" />
          <span className="hint"><Icon.Sun /> {DAYS[TODAY.getDay()]} · {dateLabel}</span>
          <div data-avatar-menu style={{ position: "relative" }}
            onMouseEnter={() => { clearTimeout(menuTimer.current); setMenuOpen(true); }}
            onMouseLeave={() => { menuTimer.current = setTimeout(() => setMenuOpen(false), 150); }}>
            <button
              className={"avatar" + (route.page === "settings" ? " is-active" : "")}
              aria-expanded={menuOpen}
              title="Account">
              {initials}
            </button>
            {menuOpen && (
              <div className="avatar-menu fade-in">
                <div className="avatar-menu-head">
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{fullName}</div>
                  {email && <div className="tiny" style={{ marginTop: 2 }}>{email}</div>}
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
                  <button onClick={() => signOut()} style={{ color: "var(--text-2)" }}>
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
