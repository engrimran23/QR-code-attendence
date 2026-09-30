import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import PctBar from "../components/PctBar";
import Btn from "../components/Btn";

export default function LowAttendance() {
  const { branchId } = useAuth();
  const now = new Date();
  const [year,      setYear]      = useState(now.getFullYear());
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [threshold, setThreshold] = useState(75);
  const [data,      setData]      = useState(null);
  const [busy,      setBusy]      = useState(false);

  async function load() {
    if (!branchId) return;
    setBusy(true);
    const d = await api.get(
      `/reports/low-attendance?branch_id=${branchId}&year=${year}&month=${month}&threshold=${threshold}`
    );
    setData(d); setBusy(false);
  }

  async function sendAlerts() {
    if (!data?.students?.length) return;
    if (!window.confirm(`Send WhatsApp absence alerts to ${data.students.length} parents?`)) return;
    await api.post(`/notifications/send-absent-alerts?branch_id=${branchId}&target_date=${new Date(year, month-1, 1).toISOString().split("T")[0]}`, {});
    alert("Alerts sent!");
  }

  return (
    <div>
      <h1 style={h1}>⚠️ Low Attendance Alert</h1>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lbl}>Year
            <input type="number" value={year} min={2020} max={2030}
              onChange={e => setYear(e.target.value)} style={{ ...inp, width: 80 }} />
          </label>
          <label style={lbl}>Month
            <select value={month} onChange={e => setMonth(e.target.value)} style={inp}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m,i)=>
                <option key={i} value={i+1}>{m}</option>)}
            </select>
          </label>
          <label style={lbl}>Threshold (%)
            <input type="number" value={threshold} min={0} max={100}
              onChange={e => setThreshold(e.target.value)} style={{ ...inp, width: 80 }} />
          </label>
          <Btn onClick={load} disabled={busy}>{busy ? "Loading…" : "Check"}</Btn>
        </div>
      </Card>

      {data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 10px" }}>
            <p style={{ color: "#c62828", fontWeight: 600, fontSize: 14 }}>
              {data.flagged_count} student(s) below {threshold}% attendance
            </p>
            {data.flagged_count > 0 && (
              <Btn variant="orange" size="sm" onClick={sendAlerts}>📲 Notify Parents</Btn>
            )}
          </div>

          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                {["Roll","Name","Class","Working Days","Present","Late","Absent","Attendance %"].map(h=>
                  <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.students.map((s, i) => (
                  <tr key={i} style={{ background: "#FFF1F2" }}>
                    <td style={td}>{s.roll_number}</td>
                    <td style={td}>{s.student_name}</td>
                    <td style={td}>{s.class_name}{s.section ? " "+s.section : ""}</td>
                    <td style={td}>{s.working_days}</td>
                    <td style={{ ...td, color: "#2e7d32", fontWeight: 600 }}>{s.present}</td>
                    <td style={{ ...td, color: "#e65100", fontWeight: 600 }}>{s.late}</td>
                    <td style={{ ...td, color: "#c62828", fontWeight: 600 }}>{s.absent}</td>
                    <td style={{ ...td, minWidth: 150 }}><PctBar pct={s.pct} /></td>
                  </tr>
                ))}
                {data.flagged_count === 0 && (
                  <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "#2e7d32", fontWeight: 600 }}>
                    ✅ All students are above {threshold}%
                  </td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

const h1  = { fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#6B7280" };
const inp = { padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, marginTop: 2 };
const th  = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left" };
const td  = { padding: "8px 12px", borderBottom: "1px solid #E5E7EB" };
