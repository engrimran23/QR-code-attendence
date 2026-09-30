export default function Card({ title, children, action }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12,
      border: "1px solid #E5E7EB",
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      padding: 20,
    }}>
      {(title || action) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {title && <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1F4E79" }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
