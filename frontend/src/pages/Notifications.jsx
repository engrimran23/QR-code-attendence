import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import Badge from "../components/Badge";
import Btn from "../components/Btn";
import StatCard from "../components/StatCard";

export default function Notifications() {
  const { branchId } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [stats,    setStats]    = useState(null);
  const [logs,     setLogs]     = useState([]);
  const [type,     setType]     = useState("");
  const [status,   setStatus]   = useState("");
  const [alertDate,setAlertDate]= useState(today);
  const [alertRes, setAlertRes] = useState("");

  useEffect(() => { if (branchId) { loadStats(); loadLogs(); } }, [branchId]);

  async function loadStats() {
    setStats(await api.get(`/notifications/stats?branch_id=${branchId}`));
  }

  async function loadLogs() {
    let url = `/notifications/logs?branch_id=${branchId}`;
    if (type)   url += `&notification_type=${type}`;
    if (status) url += `&status=${status}`;
    setLogs(await api.get(url));
  }

  async function sendAbsent() {
    if (!window.confirm("Send absent alerts to all parents for this date?")) return;
    try {
      const r = await api.post(`/notifications/send-absent-alerts?branch_id=${branchId}&target_date=${alertDate}`, {});
      setAlertRes(`✅ Sent: ${r.sent} | Skipped (no phone): ${r.skipped_no_phone}`);
      loadStats(); loadLogs();
    } catch (e) { setAlertRes("❌ " + e.message); }
  }

  return (
    <div>
      <h1 style={h1}>💬 WhatsApp Notifications</h1>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Total Today"   value={stats.total}   color="blue"   />
          <StatCard label="Sent"          value={stats.sent}    color="green"  />
          <StatCard label="Failed"        value={stats.failed}  color="red"    />
          <StatCard label="Skipped"       value={stats.skipped} color="orange" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {stats && (
          <Card title="By Type">
            {[["arrival","✅ Arrival"],["late","⏰ Late"],["absent","❌ Absent"],["custom","📢 Custom"]].map(([k,l]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 }}>
                <span>{l}</span>
                <b>{stats.by_type[k]}</b>
              </div>
            ))}
          </Card>
        )}

        <Card title="Send Absent Alerts">
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
            Sends WhatsApp to all parents of absent students for selected date.
          </p>
          <input type="date" value={alertDate} onChange={e => setAlertDate(e.target.value)}
            style={{ ...inp, width: "100%", marginBottom: 10 }} />
          <Btn onClick={sendAbsent}>📲 Send Absent Alerts</Btn>
          {alertRes && <p style={{ fontSize: 13, marginTop: 8, color: alertRes.startsWith("✅") ? "#2e7d32" : "#c62828" }}>{alertRes}</p>}
        </Card>
      </div>

      <Card title="Notification Logs">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={inp}>
            <option value="">All Types</option>
            <option value="arrival">Arrival</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="custom">Custom</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
            <option value="">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
          <Btn size="sm" onClick={loadLogs}>Load</Btn>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>
            {["Time","Student","Type","Phone","Status","Error"].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                <td style={td}>{new Date(l.sent_at).toLocaleString()}</td>
                <td style={td}>{l.student_name || l.student_id}</td>
                <td style={td}><Badge label={l.notification_type} /></td>
                <td style={td}>{l.recipient_phone}</td>
                <td style={td}><Badge label={l.status} /></td>
                <td style={{ ...td, fontSize: 11, color: "#c62828", maxWidth: 200, whiteSpace: "normal" }}>{l.error_message || ""}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>No logs yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const h1  = { fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 };
const inp = { padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13 };
const th  = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left" };
const td  = { padding: "8px 12px", borderBottom: "1px solid #E5E7EB" };
