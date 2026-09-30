import { useEffect, useState } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import PctBar from "../components/PctBar";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

export default function Today() {
  const { branchId } = useAuth();
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState([]);
  const [trend,   setTrend]   = useState(null);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!branchId) return;
    load();
  }, [branchId]);

  async function load() {
    try {
      const [s, c, t] = await Promise.all([
        api.get(`/attendance/dashboard/today?branch_id=${branchId}`),
        api.get(`/attendance/dashboard/classes?branch_id=${branchId}`),
        api.get(`/admin/trend/weekly?branch_id=${branchId}`),
      ]);
      setSummary(s); setClasses(c); setTrend(t);
    } catch (e) { setError(e.message); }
  }

  if (error) return <p style={{ color: "#c62828" }}>{error}</p>;
  if (!summary) return <p style={{ color: "#9CA3AF" }}>Loading…</p>;

  return (
    <div>
      <h1 style={h1}>Today's Overview</h1>

      <div style={grid5}>
        <StatCard label="Total Students" value={summary.total_students} color="blue"   icon="🎒" />
        <StatCard label="Present"        value={summary.present}        color="green"  icon="✅" sub={`${summary.attendance_percentage}%`} />
        <StatCard label="Late"           value={summary.late}           color="orange" icon="⏰" />
        <StatCard label="On Leave"       value={summary.on_leave ?? 0}  color="yellow" icon="🏖" />
        <StatCard label="Absent"         value={summary.absent}         color="red"    icon="❌" />
      </div>

      <div style={grid2}>
        <Card title="Attendance Rate Today">
          {summary.total_students > 0 ? (
            <Doughnut
              data={{
                labels: ["Present", "Late", "Absent"],
                datasets: [{ data: [summary.present, summary.late, summary.absent],
                  backgroundColor: ["#2e7d32", "#e65100", "#c62828"], borderWidth: 0 }],
              }}
              options={{ plugins: { legend: { position: "bottom" } }, cutout: "68%" }}
            />
          ) : <p style={{ color: "#9CA3AF", textAlign: "center" }}>No students yet</p>}
        </Card>

        <Card title="Last 7 Days Trend">
          {trend && (
            <Bar
              data={{
                labels: trend.labels,
                datasets: [{ label: "Attendance %", data: trend.pcts,
                  backgroundColor: "#1F4E79", borderRadius: 4 }],
              }}
              options={{
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100, ticks: { callback: v => v + "%" } } },
              }}
            />
          )}
        </Card>
      </div>

      <Card title="Class-wise Breakdown">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Class","Section","Total","Present","Late","Absent","Rate"].map(h =>
              <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {classes.map((c, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                <td style={td}>{c.class_name}</td>
                <td style={td}>{c.section || "—"}</td>
                <td style={td}>{c.total}</td>
                <td style={{ ...td, color: "#2e7d32", fontWeight: 600 }}>{c.present}</td>
                <td style={{ ...td, color: "#e65100", fontWeight: 600 }}>{c.late}</td>
                <td style={{ ...td, color: "#c62828", fontWeight: 600 }}>{c.absent}</td>
                <td style={{ ...td, minWidth: 140 }}><PctBar pct={c.attendance_percentage} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const h1   = { fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 };
const grid5 = { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 20 };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 };
const th = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left" };
const td = { padding: "8px 12px", borderBottom: "1px solid #E5E7EB" };
