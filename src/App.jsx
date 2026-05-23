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
  const [oauthBanner, setOauthBanner] = useState(null);

  const dateLabel = fmtShort(TODAY).split(", ")[1];
  const navigateTo = (r) => setRoute(r);

  // Handle Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get("google_auth");
    if (googleAuth) {
      if (googleAuth === "success") {
        setOauthBanner({ type: "success", msg: "Google Tasks connected successfully." });
      } else {
        const reason = params.get("reason") || "unknown";
        setOauthBanner({ type: "error", msg: `Google Tasks connection failed: ${reason}` });
      }
      // Remove query params without reload
      const clean = window.location.pathname;
      window.history.replaceState({}, "", clean);
      setTimeout(() => setOauthBanner(null), 6000);
    }
  }, []);

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
      {oauthBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          padding: "12px 20px", fontSize: 13, fontWeight: 500,
          background: oauthBanner.type === "success" ? "var(--green, #10B981)" : "var(--error, #EF4444)",
          color: "#fff", textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}>
          {oauthBanner.msg}
          <button onClick={() => setOauthBanner(null)} style={{
            marginLeft: 16, background: "none", border: "none", color: "#fff",
            cursor: "pointer", fontSize: 14, fontWeight: 700,
          }}>✕</button>
        </div>
      )}
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
