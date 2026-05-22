import React, { useState, useEffect } from 'react';
import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ACCOUNTS, TODAY, fmtShort, TopBar } from './shared';
import { DailyCheckIn } from './checkin';
import { TodoList } from './todo';
import { HabitsHub, SettingsTab } from './hub';
import { SocialPage } from './social';
import { useAppData } from './useAppData';

// ============================================================
// App
// ============================================================

const DEFAULT_AREA_COLORS = { getro: "#3B82F6", jones: "#8B5CF6", personal: "#64748B" };

function AuthedApp() {
  const { state, setState, loading, error, actions } = useAppData();
  const [route, setRoute] = useState({ page: "checkin" });
  const [hubSub, setHubSub] = useState("habits");

  const dateLabel = fmtShort(TODAY).split(", ")[1];
  const navigateTo = (r) => setRoute(r);

  // Sync area colors to CSS variables so dots/badges update live
  useEffect(() => {
    const areas = state.accounts || ACCOUNTS.map((a) => ({ ...a, color: DEFAULT_AREA_COLORS[a.id] }));
    const root = document.documentElement;
    areas.forEach((a) => {
      if (a.color) root.style.setProperty(`--acc-${a.id}`, a.color);
    });
  }, [state.accounts]);

  if (loading) {
    return (
      <div className="app">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "80vh", flexDirection: "column", gap: 14,
        }}>
          <svg width="48" height="48" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="6" y1="16" x2="16" y2="6" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
            <line x1="16" y1="6" x2="26" y2="16" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round"/>
            <line x1="6" y1="16" x2="16" y2="26" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            <line x1="16" y1="26" x2="26" y2="16" stroke="#6C63FF" strokeWidth="2" strokeLinecap="round" opacity="0.4"/>
            <circle cx="6" cy="16" r="3" fill="#6C63FF"/>
            <circle cx="16" cy="6" r="3" fill="#6C63FF"/>
            <circle cx="26" cy="16" r="3" fill="#6C63FF"/>
            <circle cx="16" cy="26" r="2.2" fill="#6C63FF" opacity="0.4"/>
          </svg>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Loading Tether…</div>
          <div className="tiny">Connecting to Notion</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "80vh", flexDirection: "column", gap: 14,
        }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Failed to load data</div>
          <div className="tiny" style={{ color: "var(--error)" }}>{error}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar route={route} setRoute={setRoute} dateLabel={dateLabel} onHubTab={{ current: hubSub, set: setHubSub }} />
      {route.page === "checkin" && (
        <DailyCheckIn state={state} setState={setState} navigateTo={navigateTo} actions={actions} />
      )}
      {route.page === "todo" && (
        <TodoList state={state} setState={setState} actions={actions} />
      )}
      {route.page === "hub" && (
        <HabitsHub state={state} setState={setState} sub={hubSub} setSub={setHubSub} actions={actions} />
      )}
      {route.page === "settings" && (
        <div className="page fade-in">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage accounts, integrations, and how the app feels.</p>
          <SettingsTab state={state} setState={setState} />
        </div>
      )}
      {route.page === "social" && (
        <SocialPage state={state} setState={setState} actions={actions} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <>
      <SignedIn>
        <AuthedApp />
      </SignedIn>
      <SignedOut>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", background: "var(--bg)",
        }}>
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </>
  );
}
