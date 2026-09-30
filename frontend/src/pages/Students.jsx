import { useState, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import PctBar from "../components/PctBar";
import Btn from "../components/Btn";
import StatCard from "../components/StatCard";

export default function Students() {
  const { branchId } = useAuth();
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [selected,setSelected]= useState(null);
  const [report,  setReport]  = useState(null);
  const [fromDate,setFrom]    = useState("");
  const [toDate,  setTo]      = useState("");
  const [busy,    setBusy]    = useState(false);
  const timer = useRef(null);

  function onSearch(val) {
    setQuery(val);
    clearTimeout(timer.current);
    if (val.length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      if (!branchId) return;
      const data = await api.get(`/students/?branch_id=${branchId}&search=${encodeURIComponent(val)}`);
      setResults(data);
    }, 350);
  }

  async function loadReport(sid) {
    setSelected(sid); setBusy(true);
    let url = `/reports/student/${sid}`;
    const params = [];
    if (fromDate) params.push(`from_date=${fromDate}`);
    if (toDate)   params.push(`to_date=${toDate}`);
    if (params.length) url += "?" + params.join("&");
    setReport(await api.get(url));
    setBusy(false);
  }

  async function exportPdf() {
    let url = `/reports/export/student/${selected}/pdf`;
    const params = [];
    if (fromDate) params.push(`from_date=${fromDate}`);
    if (toDate)   params.push(`to_date=${toDate}`);
    if (params.length) url += "?" + params.join("&");
    await api.download(url);
  }

  const st = report?.stats;
  return (
    <div>
      <h1 style={h1}>Student Attendance</h1>

      <Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lbl}>Search student
            <input placeholder="Name or roll number…" value={query}
              onChange={e => onSearch(e.target.value)} style={{ ...inp, minWidth: 240 }} />
          </label>
          <label style={lbl}>From date <input type="date" value={fromDate} onChange={e => setFrom(e.target.value)} style={inp} /></label>
          <label style={lbl}>To date   <input type="date" value={toDate}   onChange={e => setTo(e.target.value)}   style={inp} /></label>
          {selected && <Btn variant="orange" size="sm" onClick={exportPdf}>⬇ PDF</Btn>}
        </div>

        {results.length > 0 && (
          <div style={{ marginTop: 12, border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={th}>Roll</th><th style={th}>Name</th><th style={th}>Class</th><th style={th}></th>
              </tr></thead>
              <tbody>
                {results.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={td}>{s.roll_number}</td>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.class_name}{s.section ? " "+s.section : ""}</td>
                    <td style={td}>
                      <Btn size="sm" onClick={() => loadReport(s.id)}>View Report</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {busy && <p style={{ color: "#9CA3AF", marginTop: 16 }}>Loading report…</p>}

      {report && !busy && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1F4E79", margin: "16px 0 12px" }}>
            {report.student.name} — {report.student.roll_number} | Class {report.student.class_name}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
            <StatCard label="Working Days" value={st.total}   color="blue"   />
            <StatCard label="Present"      value={st.present} color="green"  />
            <StatCard label="Late"         value={st.late}    color="orange" />
            <StatCard label="Absent"       value={st.absent}  color="red"    />
          </div>
          <Card>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#6B7280", marginRight: 10 }}>Attendance:</span>
              <PctBar pct={st.pct} />
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                {["#","Date","Day","Status","Check-in","Note"].map(h => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {report.records.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={td}>{i+1}</td>
                    <td style={td}>{r.date}</td>
                    <td style={td}>{new Date(r.date).toLocaleDateString("en",{weekday:"short"})}</td>
                    <td style={td}><Badge label={r.status} /></td>
                    <td style={td}>{r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString() : "—"}</td>
                    <td style={td}>{r.note || ""}</td>
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
