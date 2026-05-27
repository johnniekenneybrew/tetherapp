import React from "react";
import { ClerkProvider, SignIn, useUser, useAuth } from "@clerk/chrome-extension";
import SidePanel from "./SidePanel.jsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function AuthGate() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="sign-in-screen">
        <div className="sign-in-header">
          <img src="icons/icon48.png" alt="Tether" className="sign-in-logo" />
          <h1>Tether</h1>
          <p>Sign in to access your tasks and contacts</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: { width: "100%" },
              card: { boxShadow: "none", padding: "0" },
            },
          }}
        />
      </div>
    );
  }

  return <SidePanel />;
}

export default function App() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="error-screen">
        <p>Missing <code>VITE_CLERK_PUBLISHABLE_KEY</code>.</p>
        <p>Add it to <code>extension/.env</code> and rebuild.</p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <AuthGate />
    </ClerkProvider>
  );
}
