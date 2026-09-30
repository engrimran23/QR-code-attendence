export default function StatCard({ label, value, color = "blue", icon, sub }) {
  const colors = {
    blue:   { bg: "#EFF6FF", num: "#1565C0", border: "#BFDBFE" },
    green:  { bg: "#F0FDF4", num: "#2e7d32", border: "#BBF7D0" },
    orange: { bg: "#FFF7ED", num: "#e65100", border: "#FED7AA" },
    red:    { bg: "#FFF1F2", num: "#c62828", border: "#FECDD3" },
    yellow: { bg: "#FFFBEB", num: "#92400E", border: "#FDE68A" },
    purple: { bg: "#FAF5FF", num: "#6B21A8", border: "#E9D5FF" },
  };
  const c = colors[color] || colors.blue;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6 }}>{icon} {label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: c.num, lineHeight: 1 }}>{value ?? "—"}</div>
      {sub && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
