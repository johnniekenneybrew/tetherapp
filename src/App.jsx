import React, { useState, useEffect, useRef } from 'react';
import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react';
import { ACCOUNTS, TODAY, fmtShort, TopBar, _registerToastHandler } from './shared';
import { DailyCheckIn } from './checkin';
import { TodoList } from './todo';
import { HabitsHub, PlansHub, SettingsTab } from './hub';
import { SocialPage } from './social';
import { useAppData } from './useAppData';

// ============================================================
// Pull-to-refresh (PWA / iOS home screen)
// ============================================================

const PTR_THRESHOLD = 72; // px of pull needed to trigger reload

function PullToRefresh() {
  const [pullY, setPullY] = useState(0);
  const startYRef = useRef(0);
  const activeRef = useRef(false);

  useEffect(() => {
    const onStart = (e) => {
      if (window.scrollY === 0) {
        startYRef.current = e.touches[0].clientY;
        activeRef.current = true;
      }
    };
    const onMove = (e) => {
      if (!activeRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      setPullY(dy > 0 ? Math.min(dy, PTR_THRESHOLD * 1.4) : 0);
    };
    const onEnd = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      setPullY((prev) => {
        if (prev >= PTR_THRESHOLD) {
          setTimeout(() => window.location.reload(), 100);
          return PTR_THRESHOLD; // hold until reload
        }
        return 0;
      });
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (pullY < 6) return null;
  const ready = pullY >= PTR_THRESHOLD;
  const rotate = Math.min(180, (pullY / PTR_THRESHOLD) * 180);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      display: "flex", justifyContent: "center",
      transform: `translateY(${Math.min(pullY - 20, 52)}px)`,
      transition: pullY === 0 ? "transform 0.2s ease" : "none",
      pointerEvents: "none",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: "var(--bg)", border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ready ? "#6C63FF" : "var(--text-3)",
        transition: "color 0.15s",
      }}>
        {ready ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "ptr-spin 0.6s linear infinite" }}>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: `rotate(${rotate}deg)`, transition: "transform 0.05s" }}>
            <path d="M7 2v8M7 10l-3-3M7 10l3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ============================================================
// App
// ============================================================

const DEFAULT_AREA_COLORS = { findem: "#FF9500", jones: "#10B981", personal: "#6366F1" };

function AuthedApp() {
  const { state, setState, loading, error, actions } = useAppData();
  const [route, setRoute] = useState({ page: "checkin" });
  const [hubSub, setHubSub] = useState("habits");
  const [plansSub, setPlansSub] = useState("goals");
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Register global toast handler
  useEffect(() => {
    _registerToastHandler((msg) => {
      clearTimeout(toastTimer.current);
      setToast(msg);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
    });
  }, []);

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
      <PullToRefresh />
      {toast && (
        <div className="toast">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {toast}
        </div>
      )}
      <TopBar route={route} setRoute={setRoute} dateLabel={dateLabel} onHubTab={{ current: hubSub, set: setHubSub }} onPlansTab={{ current: plansSub, set: setPlansSub }} />
      {route.page === "checkin" && (
        <DailyCheckIn state={state} setState={setState} navigateTo={navigateTo} actions={actions} />
      )}
      {route.page === "todo" && (
        <TodoList state={state} setState={setState} actions={actions} />
      )}
      {route.page === "hub" && (
        <HabitsHub state={state} setState={setState} sub={hubSub} setSub={setHubSub} actions={actions} />
      )}
      {route.page === "plans" && (
        <PlansHub state={state} setState={setState} sub={plansSub} setSub={setPlansSub} actions={actions} />
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
