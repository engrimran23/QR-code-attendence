import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]   = useState("");
  const [pass,  setPass]    = useState("");
  const [error, setError]   = useState("");
  const [busy,  setBusy]    = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, pass);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#1F4E79",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: "40px 44px",
        width: 380, boxShadow: "0 12px 40px rgba(0,0,0,.22)",
      }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>📋</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1F4E79", textAlign: "center", marginBottom: 4 }}>
          QR Attendance
        </h2>
        <p style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", marginBottom: 28 }}>
          Sign in to the admin panel
        </p>

        <form onSubmit={submit}>
          <input
            type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password" value={pass}
            onChange={e => setPass(e.target.value)} required
            style={inputStyle}
          />
          {error && <p style={{ color: "#c62828", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button
            type="submit" disabled={busy}
            style={{
              width: "100%", padding: "11px", background: "#1F4E79",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 15, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >{busy ? "Signing in…" : "Sign In"}</button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "10px 14px", border: "1px solid #E5E7EB",
  borderRadius: 8, fontSize: 14, marginBottom: 12,
  display: "block", boxSizing: "border-box",
};
