const map = {
  present: { bg: "#DCFCE7", color: "#166534" },
  late:    { bg: "#FEF9C3", color: "#854D0E" },
  absent:  { bg: "#FEE2E2", color: "#991B1B" },
  leave:   { bg: "#FEF9C3", color: "#92400E", border: "1px solid #FDE68A" },
  sent:    { bg: "#DCFCE7", color: "#166534" },
  failed:  { bg: "#FEE2E2", color: "#991B1B" },
  skipped: { bg: "#F3F4F6", color: "#6B7280" },
  arrival: { bg: "#DCFCE7", color: "#166534" },
  custom:  { bg: "#EDE9FE", color: "#5B21B6" },
};

export default function Badge({ label }) {
  const s = map[label?.toLowerCase()] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: s.border || "none",
      padding: "2px 10px", borderRadius: 12,
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    }}>{label}</span>
  );
}
