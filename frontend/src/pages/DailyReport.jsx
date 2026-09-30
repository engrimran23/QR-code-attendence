import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Btn from "../components/Btn";

export default function DailyReport() {
  const { branchId } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [date,    setDate]    = useState(today);
  const [cls,     setCls]     = useState("");
  const [section, setSection] = useState("");
  const [data,    setData]    = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [error,   setError]   = useState("");

  async function load() {
    if (!branchId) return;
    setBusy(true); setError("");
    try {
      let url = `/reports/daily?branch_id=${branchId}&report_date=${date}`;
      if (cls)     url += `&class_name=${cls}`;
      if (section) url += `&section=${section}`;
      setData(await api.get(url));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function exportFile(fmt) {
    let url = `/reports/export/daily/${fmt}?branch_id=${branchId}&report_date=${date}`;
    if (cls) url += `&class_name=${cls}`;
    await api.download(url, `daily_${date}.${fmt === "excel" ? "xlsx" : "pdf"}`);
  }

  const s = data?.summary;
  return (
    <div>
      <h1 style={h1}>Daily Attendance Report</h1>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lbl}>Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Class
            <input placeholder="e.g. 5" value={cls} onChange={e => setCls(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Section
            <input placeholder="A" value={section} onChange={e => setSection(e.target.value)} style={inp} />
          </label>
          <Btn onClick={load} disabled={busy}>{busy ? "Loading…" : "Load"}</Btn>
          {data && <>
            <Btn variant="green" size="sm" onClick={() => exportFile("excel")}>⬇ Excel</Btn>
            <Btn variant="orange" size="sm" onClick={() => exportFile("pdf")}>⬇ PDF</Btn>
          </>}
        </div>
      </Card>

      {error && <p style={{ color: "#c62828", marginTop: 10 }}>{error}</p>}

      {s && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, margin: "16px 0" }}>
          {[
            { label: "Total",    value: s.total,        color: "#1565C0" },
            { label: "Present",  value: s.present,      color: "#2e7d32" },
            { label: "Late",     value: s.late,         color: "#e65100" },
            { label: "On Leave", value: s.on_leave ?? 0,color: "#92400E" },
            { label: "Absent",   value: s.absent,       color: "#c62828" },
            { label: "Rate",     value: s.pct+"%",      color: "#1F4E79" },
          ].map(x => (
            <div key={x.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{x.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: x.color }}>{x.value}</div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["#","Roll","Name","Class","Section","Status","Check-in","Note / Leave Reason"].map(h =>
                <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i} style={{ background: r.status === "leave" ? "#FFFBEB" : i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                  <td style={td}>{i+1}</td>
                  <td style={td}>{r.roll_number}</td>
                  <td style={td}>{r.student_name}</td>
                  <td style={td}>{r.class_name}</td>
                  <td style={td}>{r.section || "—"}</td>
                  <td style={td}><Badge label={r.status} /></td>
                  <td style={td}>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "—"}</td>
                  <td style={td}>{r.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const h1  = { fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#6B7280" };
const inp = { padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, marginTop: 2 };
const th  = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left" };
const td  = { padding: "8px 12px", borderBottom: "1px solid #E5E7EB" };
