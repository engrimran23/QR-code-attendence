import { useState, useEffect } from "react";

// Offline banner
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (!offline) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: "#92400E", color: "#fff",
      padding: "8px 16px", textAlign: "center", fontSize: 13, fontWeight: 600,
    }}>
      📶 You are offline — cached data shown. Changes will sync when connected.
    </div>
  );
}

// Install prompt (Android Chrome shows "Add to Home Screen")
export function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [shown,  setShown]  = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_dismissed") === "1"
  );

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show after 8 seconds if not dismissed
  useEffect(() => {
    if (prompt && !dismissed) {
      const t = setTimeout(() => setShown(true), 8000);
      return () => clearTimeout(t);
    }
  }, [prompt, dismissed]);

  function install() {
    prompt.prompt();
    prompt.userChoice.then(() => { setPrompt(null); setShown(false); });
  }

  function dismiss() {
    setShown(false);
    setDismissed(true);
    localStorage.setItem("pwa_dismissed", "1");
  }

  if (!shown || !prompt) return null;

  return (
    <div style={{
      position: "fixed", bottom: 20, left: 16, right: 16, zIndex: 9998,
      background: "#1F4E79", borderRadius: 16, padding: "16px 18px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ fontSize: 36 }}>📱</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Install QR Attend</div>
        <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 }}>
          Add to home screen for quick access — works offline
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button onClick={install} style={{
          background: "#f97316", color: "#fff", border: "none",
          borderRadius: 8, padding: "7px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}>Install</button>
        <button onClick={dismiss} style={{
          background: "rgba(255,255,255,0.15)", color: "#fff", border: "none",
          borderRadius: 8, padding: "6px 14px", fontSize: 11, cursor: "pointer",
        }}>Not now</button>
      </div>
    </div>
  );
}
