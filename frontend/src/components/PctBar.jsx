export default function PctBar({ pct = 0 }) {
  const color = pct >= 75 ? "#2e7d32" : pct >= 50 ? "#e65100" : "#c62828";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 7, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 40 }}>{pct}%</span>
    </div>
  );
}
