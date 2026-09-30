import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Badge from "../components/Badge";

const LEAVE_TYPES = [
  { value: "sick",    label: "Sick Leave",   icon: "🤒", color: "#ef4444" },
  { value: "urgent",  label: "Urgent Work",  icon: "⚡", color: "#f97316" },
  { value: "other",   label: "Other Leave",  icon: "📋", color: "#6366f1" },
];

export default function MarkLeave() {
  const { branchId } = useAuth();
  const today = new Date().toISOString().split("T")[0];

  const [date,      setDate]      = useState(today);
  const [classFilter, setClass]   = useState("");
  const [students,  setStudents]  = useState([]);
  const [leaves,    setLeaves]    = useState({});   // student_id → {type, reason}
  const [existing,  setExisting]  = useState({});   // student_id → AttendanceOut
  const [busy,      setBusy]      = useState(false);
  const [saving,    setSaving]    = useState({});
  const [success,   setSuccess]   = useState({});
  const [error,     setError]     = useState("");

  useEffect(() => { if (branchId) loadStudents(); }, [branchId, classFilter]);
  useEffect(() => { if (branchId && students.length) loadExisting(); }, [date, students]);

  async function loadStudents() {
    setBusy(true);
    try {
      let url = `/students/?branch_id=${branchId}`;
      if (classFilter) url += `&class_name=${encodeURIComponent(classFilter)}`;
      setStudents(await api.get(url));
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function loadExisting() {
    try {
      let url = `/attendance/leave?branch_id=${branchId}&leave_date=${date}`;
      if (classFilter) url += `&class_name=${encodeURIComponent(classFilter)}`;
      const recs = await api.get(url);
      const map = {};
      recs.forEach(r => { map[r.student_id] = r; });
      setExisting(map);
    } catch (_) {}
  }

  function setLeave(sid, key, val) {
    setLeaves(prev => ({ ...prev, [sid]: { ...(prev[sid] || {}), [key]: val } }));
  }

  async function submitLeave(student) {
    const lv = leaves[student.id];
    if (!lv?.type) return;
    setSaving(s => ({ ...s, [student.id]: true }));
    setSuccess(s => ({ ...s, [student.id]: false }));
    try {
      const rec = await api.post("/attendance/leave", {
        student_id:  student.id,
        date,
        leave_type:  lv.type,
        reason:      lv.reason || "",
      });
      setExisting(e => ({ ...e, [student.id]: rec }));
      setSuccess(s => ({ ...s, [student.id]: true }));
      setLeaves(l => { const n = { ...l }; delete n[student.id]; return n; });
      setTimeout(() => setSuccess(s => ({ ...s, [student.id]: false })), 2500);
    } catch (e) { setError(e.message); }
    setSaving(s => ({ ...s, [student.id]: false }));
  }

  async function cancelLeave(student) {
    // To cancel, mark as absent (reuse manual endpoint)
    setSaving(s => ({ ...s, [student.id]: true }));
    try {
      await api.post("/attendance/manual", {
        student_id: student.id,
        status: "absent",
        date,
        note: "",
      });
      setExisting(e => { const n = { ...e }; delete n[student.id]; return n; });
    } catch (e) { setError(e.message); }
    setSaving(s => ({ ...s, [student.id]: false }));
  }

  const classes = [...new Set(students.map(s => s.class_name))].sort();
  const onLeaveCount = Object.keys(existing).length;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 }}>
        Mark Student Leave
      </h1>

      {/* filters */}
      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={lbl}>Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </label>
          <label style={lbl}>Class
            <select value={classFilter} onChange={e => setClass(e.target.value)} style={inp}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </label>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            {onLeaveCount > 0 && (
              <span style={{ background: "#FEF9C3", color: "#854D0E", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {onLeaveCount} on leave today
              </span>
            )}
          </div>
        </div>
      </Card>

      {error && <div style={{ ...errBox, margin: "12px 0" }}>{error}</div>}

      {/* leave type legend */}
      <div style={{ display: "flex", gap: 10, margin: "14px 0" }}>
        {LEAVE_TYPES.map(t => (
          <div key={t.value} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
            <span>{t.icon}</span>
            <span style={{ fontWeight: 600, color: t.color }}>{t.label}</span>
          </div>
        ))}
      </div>

      {busy && <p style={{ color: "#9CA3AF", fontSize: 13 }}>Loading students…</p>}

      {!busy && students.length === 0 && (
        <Card><p style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 20 }}>No students found. Select a class above.</p></Card>
      )}

      {!busy && students.length > 0 && (
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["#", "Roll", "Student Name", "Class", "Current Status", "Leave Type", "Reason", "Action"].map(h =>
                  <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const rec = existing[s.id];
                const lv  = leaves[s.id] || {};
                const isSaving = saving[s.id];
                const isOk   = success[s.id];

                return (
                  <tr key={s.id} style={{ background: rec ? "#FFFBEB" : i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td}><strong>{s.roll_number}</strong></td>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.class_name}{s.section ? ` — ${s.section}` : ""}</td>

                    {/* current status */}
                    <td style={td}>
                      {rec ? (
                        <div>
                          <Badge label="leave" />
                          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{rec.note}</div>
                        </div>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: 12 }}>Not marked</span>
                      )}
                    </td>

                    {/* leave type selector */}
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {LEAVE_TYPES.map(t => (
                          <button key={t.value} onClick={() => setLeave(s.id, "type", t.value)}
                            style={{
                              padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                              border: lv.type === t.value ? `2px solid ${t.color}` : "1px solid #E5E7EB",
                              background: lv.type === t.value ? t.color : "#fff",
                              color: lv.type === t.value ? "#fff" : "#374151",
                            }}>
                            {t.icon} {t.label}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* reason */}
                    <td style={td}>
                      <input
                        placeholder="Reason (optional)"
                        value={lv.reason || ""}
                        onChange={e => setLeave(s.id, "reason", e.target.value)}
                        style={{ ...inp, width: 160, fontSize: 12 }}
                      />
                    </td>

                    {/* action */}
                    <td style={td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {isOk ? (
                          <span style={{ color: "#16A34A", fontWeight: 700, fontSize: 12 }}>✓ Saved</span>
                        ) : (
                          <Btn size="sm" variant="orange" disabled={!lv.type || isSaving}
                            onClick={() => submitLeave(s)}>
                            {isSaving ? "…" : "Mark Leave"}
                          </Btn>
                        )}
                        {rec && !isSaving && (
                          <Btn size="sm" variant="red" onClick={() => cancelLeave(s)}>
                            Cancel
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

const lbl    = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#6B7280" };
const inp    = { padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, marginTop: 2, outline: "none" };
const th     = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left", fontSize: 12, whiteSpace: "nowrap" };
const td     = { padding: "8px 10px", borderBottom: "1px solid #E5E7EB", verticalAlign: "middle" };
const errBox = { background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626" };
