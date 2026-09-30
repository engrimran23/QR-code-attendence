import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import PctBar from "../components/PctBar";
import Btn from "../components/Btn";
import Badge from "../components/Badge";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const TABS = ["Overview", "Schools", "Branches", "Users"];

export default function SuperAdmin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("Overview");

  if (user?.role !== "super_admin")
    return <div style={{ color: "#c62828", padding: 20 }}>⛔ Super Admin access only.</div>;

  return (
    <div>
      <h1 style={h1}>🏫 Super Admin Panel</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "1px solid #E5E7EB",
              background: tab === t ? "#1F4E79" : "#fff",
              color: tab === t ? "#fff" : "#374151",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>{t}</button>
        ))}
      </div>

      {tab === "Overview"  && <OverviewTab />}
      {tab === "Schools"   && <SchoolsTab />}
      {tab === "Branches"  && <BranchesTab />}
      {tab === "Users"     && <UsersTab />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats,   setStats]   = useState(null);
  const [schools, setSchools] = useState([]);
  const [selSchool, setSelSchool] = useState(null);
  const [cross,   setCross]   = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then(setStats);
    api.get("/admin/schools/overview").then(d => { setSchools(d); if (d.length) setSelSchool(d[0].id); });
  }, []);

  useEffect(() => {
    if (!selSchool) return;
    api.get(`/admin/cross-branch?school_id=${selSchool}`).then(setCross);
  }, [selSchool]);

  return (
    <>
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Schools"    value={stats.total_schools}  color="blue"   icon="🏫" />
          <StatCard label="Branches"   value={stats.total_branches} color="purple" icon="🏢" />
          <StatCard label="Students"   value={stats.total_students} color="green"  icon="🎒" />
          <StatCard label="Staff"      value={stats.total_users}    color="orange" icon="👤" />
          <StatCard label="Scans Today"value={stats.scans_today}    color="blue"   icon="📷" />
          <StatCard label="Msgs Today" value={stats.notifications_today} color="green" icon="💬" />
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="All Schools — Today's Attendance">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>
              {["School","Branches","Students","Present","Rate"].map(h => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {schools.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                  <td style={td}>{s.name}</td>
                  <td style={td}>{s.branch_count}</td>
                  <td style={td}>{s.student_count}</td>
                  <td style={{ ...td, color: "#2e7d32", fontWeight: 600 }}>{s.present_today}</td>
                  <td style={{ ...td, minWidth: 130 }}><PctBar pct={s.attendance_pct_today} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Cross-Branch Comparison" action={
          <select value={selSchool || ""} onChange={e => setSelSchool(e.target.value)}
            style={{ padding: "5px 8px", border: "1px solid #E5E7EB", borderRadius: 6, fontSize: 12 }}>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        }>
          {cross && (
            <Bar
              data={{
                labels: cross.branches.map(b => b.branch_name),
                datasets: [
                  { label: "Present", data: cross.branches.map(b => b.present), backgroundColor: "#2e7d32", borderRadius: 4 },
                  { label: "Absent",  data: cross.branches.map(b => b.absent),  backgroundColor: "#c62828", borderRadius: 4 },
                ],
              }}
              options={{
                plugins: { legend: { position: "bottom" } },
                scales: { x: { stacked: true }, y: { stacked: true } },
              }}
            />
          )}
        </Card>
      </div>
    </>
  );
}

// ── Schools CRUD ─────────────────────────────────────────────────────────────

function SchoolsTab() {
  const [schools, setSchools] = useState([]);
  const [form,    setForm]    = useState({ name: "", address: "", phone: "", email: "" });
  const [editing, setEditing] = useState(null);
  const [busy,    setBusy]    = useState(false);

  useEffect(() => { load(); }, []);
  async function load() { setSchools(await api.get("/schools/")); }

  async function save() {
    setBusy(true);
    try {
      if (editing) await api.put(`/schools/${editing}`, form);
      else         await api.post("/schools/", form);
      setForm({ name: "", address: "", phone: "", email: "" }); setEditing(null);
      load();
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  function startEdit(s) {
    setEditing(s.id);
    setForm({ name: s.name, address: s.address || "", phone: s.phone || "", email: s.email || "" });
  }

  async function toggleActive(s) {
    await api.put(`/schools/${s.id}`, { is_active: !s.is_active });
    load();
  }

  return (
    <>
      <Card title={editing ? "Edit School" : "Add New School"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[["name","School Name *"],["address","Address"],["phone","Phone"],["email","Email"]].map(([k,p]) => (
            <input key={k} placeholder={p} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
              style={{ ...inp, ...(k === "name" ? { gridColumn: "span 2"} : {}) }} />
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <Btn onClick={save} disabled={busy || !form.name}>{editing ? "Update" : "Add School"}</Btn>
          {editing && <Btn variant="ghost" onClick={() => { setEditing(null); setForm({ name:"",address:"",phone:"",email:"" }); }}>Cancel</Btn>}
        </div>
      </Card>

      <Card title="All Schools" style={{ marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Name","Phone","Email","Status","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {schools.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                <td style={td}><b>{s.name}</b></td>
                <td style={td}>{s.phone || "—"}</td>
                <td style={td}>{s.email || "—"}</td>
                <td style={td}><Badge label={s.is_active ? "active" : "inactive"} /></td>
                <td style={{ ...td, display: "flex", gap: 6 }}>
                  <Btn size="sm" onClick={() => startEdit(s)}>Edit</Btn>
                  <Btn size="sm" variant={s.is_active ? "red" : "green"} onClick={() => toggleActive(s)}>
                    {s.is_active ? "Disable" : "Enable"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ── Branches CRUD ─────────────────────────────────────────────────────────────

function BranchesTab() {
  const [schools,  setSchools]  = useState([]);
  const [branches, setBranches] = useState([]);
  const [selSch,   setSelSch]   = useState("");
  const [form,     setForm]     = useState({ name: "", address: "", phone: "", school_start_time: "", late_cutoff_time: "" });
  const [editing,  setEditing]  = useState(null);
  const [busy,     setBusy]     = useState(false);

  useEffect(() => {
    api.get("/schools/").then(d => { setSchools(d); if (d.length) setSelSch(d[0].id); });
  }, []);
  useEffect(() => { if (selSch) api.get(`/schools/branches/?school_id=${selSch}`).then(setBranches); }, [selSch]);

  async function save() {
    setBusy(true);
    try {
      if (editing) await api.put(`/schools/branches/${editing}`, form);
      else         await api.post("/schools/branches/", { ...form, school_id: parseInt(selSch) });
      setForm({ name:"",address:"",phone:"",school_start_time:"",late_cutoff_time:"" }); setEditing(null);
      api.get(`/schools/branches/?school_id=${selSch}`).then(setBranches);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  function startEdit(b) {
    setEditing(b.id);
    setForm({ name: b.name, address: b.address||"", phone: b.phone||"",
      school_start_time: "", late_cutoff_time: "" });
  }

  return (
    <>
      <Card title="Branch Management">
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 4 }}>School</label>
          <select value={selSch} onChange={e => setSelSch(e.target.value)} style={inp}>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {[["name","Branch Name *"],["address","Address"],["phone","Phone"],
            ["school_start_time","School Start (HH:MM)"],["late_cutoff_time","Late After (HH:MM)"]].map(([k,p]) => (
            <input key={k} placeholder={p} value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})} style={inp} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={save} disabled={busy || !form.name}>{editing ? "Update" : "Add Branch"}</Btn>
          {editing && <Btn variant="ghost" onClick={() => { setEditing(null); setForm({ name:"",address:"",phone:"",school_start_time:"",late_cutoff_time:"" }); }}>Cancel</Btn>}
        </div>
      </Card>

      <Card title={`Branches${selSch ? "" : ""}`} style={{ marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Name","Phone","Start Time","Late After","Status","Actions"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {branches.map((b, i) => (
              <tr key={b.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                <td style={td}><b>{b.name}</b></td>
                <td style={td}>{b.phone || "—"}</td>
                <td style={td}>{b.school_start_time || "—"}</td>
                <td style={td}>{b.late_cutoff_time || "—"}</td>
                <td style={td}><Badge label={b.is_active ? "active" : "inactive"} /></td>
                <td style={td}><Btn size="sm" onClick={() => startEdit(b)}>Edit</Btn></td>
              </tr>
            ))}
            {branches.length === 0 && <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>No branches yet</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ── Users CRUD ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users,   setUsers]   = useState([]);
  const [schools, setSchools] = useState([]);
  const [branches,setBranches]= useState([]);
  const [form,    setForm]    = useState({ name:"", email:"", password:"", role:"teacher", school_id:"", branch_id:"" });
  const [busy,    setBusy]    = useState(false);

  const ROLES = ["super_admin","school_admin","branch_admin","teacher","gate_staff"];

  useEffect(() => {
    api.get("/admin/users").then(setUsers);
    api.get("/schools/").then(setSchools);
  }, []);

  async function onSchoolChange(sid) {
    setForm(f => ({...f, school_id: sid, branch_id: ""}));
    if (sid) api.get(`/schools/branches/?school_id=${sid}`).then(setBranches);
    else setBranches([]);
  }

  async function createUser() {
    setBusy(true);
    try {
      const body = { ...form, school_id: form.school_id ? parseInt(form.school_id) : null,
        branch_id: form.branch_id ? parseInt(form.branch_id) : null };
      await api.post("/users/", body);
      setForm({ name:"",email:"",password:"",role:"teacher",school_id:"",branch_id:"" });
      api.get("/admin/users").then(setUsers);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  async function toggleUser(u) {
    await api.put(`/users/${u.id}`, { is_active: !u.is_active });
    api.get("/admin/users").then(setUsers);
  }

  return (
    <>
      <Card title="Create User Account">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <input placeholder="Full Name *" value={form.name} onChange={e => setForm({...form,name:e.target.value})} style={inp} />
          <input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} style={inp} />
          <input placeholder="Password *" type="password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} style={inp} />
          <select value={form.role} onChange={e => setForm({...form,role:e.target.value})} style={inp}>
            {ROLES.map(r => <option key={r} value={r}>{r.replace("_"," ")}</option>)}
          </select>
          <select value={form.school_id} onChange={e => onSchoolChange(e.target.value)} style={inp}>
            <option value="">Select School</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={form.branch_id} onChange={e => setForm({...form,branch_id:e.target.value})} style={inp}>
            <option value="">Select Branch</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 10 }}>
          <Btn onClick={createUser} disabled={busy || !form.name || !form.email || !form.password}>Create User</Btn>
        </div>
      </Card>

      <Card title="All Users" style={{ marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr>{["Name","Email","Role","Branch","Status","Action"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                <td style={td}>{u.name}</td>
                <td style={td}>{u.email}</td>
                <td style={td}><Badge label={u.role} /></td>
                <td style={td}>{u.branch_id || "—"}</td>
                <td style={td}><Badge label={u.is_active ? "active" : "inactive"} /></td>
                <td style={td}>
                  <Btn size="sm" variant={u.is_active ? "red" : "green"} onClick={() => toggleUser(u)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

const h1  = { fontSize: 20, fontWeight: 700, color: "#1F4E79", marginBottom: 20 };
const th  = { background: "#1F4E79", color: "#fff", padding: "9px 12px", textAlign: "left" };
const td  = { padding: "8px 12px", borderBottom: "1px solid #E5E7EB" };
const inp = { padding: "7px 10px", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, background: "#fff" };
