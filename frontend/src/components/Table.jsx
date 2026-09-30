export default function Table({ columns, rows, emptyText = "No data." }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{
                background: "#1F4E79", color: "#fff",
                padding: "9px 12px", textAlign: "left",
                whiteSpace: "nowrap",
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>{emptyText}</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
              {columns.map((c) => (
                <td key={c.key} style={{ padding: "8px 12px", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
