import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import PctBar from "../components/PctBar";
import Btn from "../components/Btn";

export default function MonthlyReport() {
  const { branchId } = useAuth();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [cls,   setCls]   = useState("");
  const [data,  setData]  = useState(null);
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!branchId) return;
    setBusy(true); setError("");
    try {
      let url = `/reports/monthly?branch_id=${branchId}&year=${year}&month=${month}`;
      if (cls) url += `&class_name=${cls}`;
      setData(await api.get(url));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function exportExcel() {
    let url = `/reports/export/monthly/excel?branch_id=${branchId}&year=${year}&month=${month}`;
    if (cls) url += `&class_name=${cls}`;
    await api.download(url);
  }

  return (
    <div>
      <h1 style={h1}>Monthly Attendance Report</h1>
      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lbl}>Year
            <input type="number" value={year} min={2020} max={2030}
              onChange={e => setYear(e.target.value)} style={{ ...inp, width: 80 }} />
          </label>
          <label style={lbl}>Month
            <select value={month} onChange={e => setMonth(e.target.value)} style={inp}>
              {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) =>
                <option key={i} value={i+1}>{m}</option>)}
            </select>
          </label>
          <label style={lbl}>Class (optional)
            <input placeholder="e.g. 5" value={cls} onChange={e => setCls(e.target.value)} style={inp} />
          </label>
          <Btn onClick={load} disabled={busy}>{busy ? "Loading…" : "Load"}</Btn>
          {data && <Btn variant="green" size="sm" onClick={exportExcel}>⬇ Excel</Btn>}
        </div>
      </Card>

      {error && <p style={{ color: "#c62828", marginTop: 10 }}>{error}</p>}

      {data && (
        <>
          <div style={{ fontSize: 13, color: "#6B7280", margin: "12px 0" }}>
            Working days: <b>{data.working_days}</b> &nbsp;|&nbsp; Students: <b>{data.students.length}</b>
          </div>
          <Card>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>{["Roll","Name","Class","Working Days","Present","Late","Absent","Attendance %"].map(h =>
                  <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.students.map((s, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={td}>{s.roll_number}</td>
                    <td style={td}>{s.student_name}</td>
                    <td style={td}>{s.class_name}{s.section ? " "+s.section : ""}</td>
                    <td style={td}>{s.working_days}</td>
                    <td style={{ ...td, color: "#2e7d32", fontWeight: 600 }}>{s.present}</td>
                    <td style={{ ...td, color: "#e65100", fontWeight: 600 }}>{s.late}</td>
                    <td style={{ ...td, color: "#c62828", fontWeight: 600 }}>{s.absent}</td>
                    <td style={{ ...td, minWidth: 140 }}><PctBar pct={s.pct} /></td>
                  </tr>
                ))}
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
