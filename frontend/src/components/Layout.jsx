import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/",              icon: "🏠", label: "Today"          },
  { to: "/daily",         icon: "📅", label: "Daily Report"   },
  { to: "/monthly",       icon: "📊", label: "Monthly"        },
  { to: "/students",      icon: "🪪", label: "Students & QR"  },
  { to: "/mark-leave",    icon: "🏖", label: "Mark Leave"     },
  { to: "/low-attendance",icon: "⚠️", label: "Low Attendance" },
  { to: "/notifications", icon: "💬", label: "Notifications"  },
  { to: "/super-admin",   icon: "🏫", label: "Super Admin", superOnly: true },
];

export default function Layout({ children }) {
  const { user, branches, branchId, selectBranch, logout } = useAuth();
  const navigate = useNavigate();

  function doLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F0F4F8" }}>

      {/* Sidebar */}
      <aside style={{
        width: 220, background: "#1F4E79", color: "#fff",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50,
      }}>
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,.12)" }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>📋 QR Attend</div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>{user?.name}</div>
          <div style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>{user?.role?.replace("_", " ")}</div>
        </div>

        <nav style={{ flex: 1, paddingTop: 8 }}>
          {navItems.filter(n => !n.superOnly || user?.role === "super_admin").map(n => (
            <NavLink
              key={n.to} to={n.to} end={n.to === "/"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 20px", fontSize: 13,
                color: isActive ? "#fff" : "rgba(255,255,255,.72)",
                background: isActive ? "rgba(255,255,255,.14)" : "transparent",
                textDecoration: "none", transition: "background .15s",
              })}
            >
              <span style={{ width: 18, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,.12)", fontSize: 12 }}>
          <button
            onClick={doLogout}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.72)", cursor: "pointer", fontSize: 13 }}
          >🚪 Logout</button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: 220, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <header style={{
          background: "#fff", borderBottom: "1px solid #E5E7EB",
          padding: "12px 24px", display: "flex", alignItems: "center",
          justifyContent: "flex-end", gap: 12, position: "sticky", top: 0, zIndex: 40,
        }}>
          <span style={{ fontSize: 12, color: "#6B7280" }}>Branch:</span>
          <select
            value={branchId || ""}
            onChange={e => selectBranch(parseInt(e.target.value))}
            style={{
              padding: "6px 10px", border: "1px solid #E5E7EB",
              borderRadius: 8, fontSize: 13, background: "#fff",
            }}
          >
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </header>

        <main style={{ padding: 24, flex: 1 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
