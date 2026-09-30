import { useState, useRef, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import Card from "../components/Card";
import Btn from "../components/Btn";
import Badge from "../components/Badge";

const BASE = import.meta.env.VITE_API_URL || "/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem("token") || ""; }

async function downloadFile(path, filename) {
  const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) { alert("Download failed: " + (await res.json().catch(() => ({detail:"unknown"}))).detail); return; }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── QR Card preview (inline base64 image) ──────────────────────────────────

function QRCardPreview({ studentId, studentName, rollNumber }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/students/${studentId}/qr`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.blob())
      .then(b => { setSrc(URL.createObjectURL(b)); setLoading(false); })
      .catch(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div style={previewBox}><span style={{ color: "#9CA3AF", fontSize: 13 }}>Loading card…</span></div>;
  if (!src)    return <div style={previewBox}><span style={{ color: "#EF4444", fontSize: 13 }}>Could not load card</span></div>;

  return (
    <div style={{ textAlign: "center" }}>
      <img src={src} alt="QR Card" style={{ maxWidth: 280, border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,.1)" }} />
      <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
        <Btn variant="download" onClick={() => downloadFile(`/students/${studentId}/qr`, `${rollNumber}_qr_card.png`)}>
          ⬇ Download Card
        </Btn>
        <Btn variant="print" onClick={() => window.open(src, "_blank")}>
          🖨 Print / View
        </Btn>
      </div>
    </div>
  );
}

const previewBox = { display:"flex", alignItems:"center", justifyContent:"center", height:200, border:"2px dashed #E5E7EB", borderRadius:10 };

// ─── Add Student Tab ─────────────────────────────────────────────────────────

function AddStudentTab({ branchId, onCreated }) {
  const blank = { name:"", roll_number:"", class_name:"", section:"", parent_name:"", parent_phone:"", address:"" };
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [created, setCreated] = useState(null);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const payload = {
        branch_id:    branchId,
        name:         form.name.trim(),
        roll_number:  form.roll_number.trim(),
        class_name:   form.class_name.trim(),
        section:      form.section.trim() || null,
        parent_name:  form.parent_name.trim() || null,
        parent_phone: form.parent_phone.trim() || null,
        address:      form.address.trim() || null,
      };
      const student = await api.post("/students/", payload);
      setCreated(student);
      setForm(blank);
      if (onCreated) onCreated();
    } catch (ex) {
      setErr(ex.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      {/* form */}
      <Card>
        <h2 style={sectionHead}>New Student Details</h2>
        {err && <div style={errBox}>{err}</div>}
        <form onSubmit={submit}>
          <div style={grid2}>
            <Field label="Full Name *"    value={form.name}         onChange={v => set("name", v)}         placeholder="e.g. Ali Ahmed" />
            <Field label="Roll Number *"  value={form.roll_number}  onChange={v => set("roll_number", v)}  placeholder="e.g. 2024-001" />
            <Field label="Class *"        value={form.class_name}   onChange={v => set("class_name", v)}   placeholder="e.g. 10" />
            <Field label="Section"        value={form.section}      onChange={v => set("section", v)}      placeholder="e.g. A" />
            <Field label="Parent Name"    value={form.parent_name}  onChange={v => set("parent_name", v)}  placeholder="e.g. Mr. Ahmed" />
            <Field label="Parent Phone"   value={form.parent_phone} onChange={v => set("parent_phone", v)} placeholder="e.g. 0300-1234567" />
          </div>
          <div style={{ marginTop: 8 }}>
            <Field label="Address" value={form.address} onChange={v => set("address", v)} placeholder="Home address (optional)" />
          </div>
          <div style={{ marginTop: 18 }}>
            <Btn type="submit" size="lg" disabled={busy || !branchId}>
              {busy ? "Creating…" : "✚ Create Student & Generate QR"}
            </Btn>
          </div>
        </form>
      </Card>

      {/* QR card preview */}
      <Card>
        <h2 style={sectionHead}>QR Identity Card Preview</h2>
        {created ? (
          <div>
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <span style={{ color: "#16A34A", fontWeight: 600, fontSize: 13 }}>Student created successfully!</span>
              <span style={{ color: "#6B7280", fontSize: 12, marginLeft: 8 }}>{created.name} — Roll {created.roll_number}</span>
            </div>
            <QRCardPreview studentId={created.id} studentName={created.name} rollNumber={created.roll_number} />
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <Btn size="sm" variant="ghost" onClick={() => setCreated(null)}>Add Another Student</Btn>
            </div>
          </div>
        ) : (
          <div style={previewBox}>
            <div style={{ textAlign: "center", color: "#9CA3AF" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🪪</div>
              <p style={{ fontSize: 13 }}>QR card will appear here<br />after you create the student</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── All Students Tab ────────────────────────────────────────────────────────

function AllStudentsTab({ branchId }) {
  const [students, setStudents] = useState([]);
  const [search,   setSearch]   = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [preview,  setPreview]  = useState(null); // student object
  const [busy,     setBusy]     = useState(false);
  const timer = useRef(null);

  useEffect(() => { if (branchId) load(); }, [branchId]);

  async function load(q = "", cls = "") {
    setBusy(true);
    let url = `/students/?branch_id=${branchId}`;
    if (q)   url += `&search=${encodeURIComponent(q)}`;
    if (cls) url += `&class_name=${encodeURIComponent(cls)}`;
    try { setStudents(await api.get(url)); } catch(_) {}
    setBusy(false);
  }

  function onSearch(v) {
    setSearch(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(v, classFilter), 350);
  }

  function onClass(v) {
    setClassFilter(v);
    load(search, v);
  }

  const classes = [...new Set(students.map(s => s.class_name))].sort();

  return (
    <div>
      <Card>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end", marginBottom:16 }}>
          <label style={lbl}>Search
            <input value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Name or roll number…" style={{ ...inp, minWidth:220 }} />
          </label>
          <label style={lbl}>Class
            <select value={classFilter} onChange={e => onClass(e.target.value)} style={inp}>
              <option value="">All classes</option>
              {classes.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </label>
          <div style={{ marginLeft: "auto", display:"flex", gap:8 }}>
            <Btn size="sm" variant="orange"
              onClick={() => downloadFile(`/students/bulk-qr/${branchId}${classFilter ? `?class_name=${classFilter}` : ""}`, `qr_cards.zip`)}>
              Download All QR Cards (ZIP)
            </Btn>
          </div>
        </div>

        {busy && <p style={{ color:"#9CA3AF", fontSize:13 }}>Loading…</p>}

        {!busy && students.length === 0 && (
          <p style={{ color:"#9CA3AF", fontSize:13, textAlign:"center", padding:24 }}>No students found.</p>
        )}

        {!busy && students.length > 0 && (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr>
                  {["#","Roll No","Name","Class","Section","Parent","Actions"].map(h => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={s.id} style={{ background: i%2===0 ? "#fff" : "#F8FAFC" }}>
                    <td style={td}>{i+1}</td>
                    <td style={td}><strong>{s.roll_number}</strong></td>
                    <td style={td}>{s.name}</td>
                    <td style={td}>{s.class_name}</td>
                    <td style={td}>{s.section || "—"}</td>
                    <td style={td}>{s.parent_name || "—"}</td>
                    <td style={td}>
                      <div style={{ display:"flex", gap:6 }}>
                        <Btn size="sm" onClick={() => setPreview(s)}>View QR Card</Btn>
                        <Btn size="sm" variant="orange"
                          onClick={() => downloadFile(`/students/${s.id}/qr`, `${s.roll_number}_qr_card.png`)}>
                          Download
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* QR card preview modal */}
      {preview && (
        <div style={modalOverlay} onClick={() => setPreview(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:15, color:"#1F4E79" }}>{preview.name} — Roll {preview.roll_number}</h3>
              <button onClick={() => setPreview(null)} style={closeBtn}>✕</button>
            </div>
            <QRCardPreview studentId={preview.id} studentName={preview.name} rollNumber={preview.roll_number} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Import Tab ─────────────────────────────────────────────────────────

function BulkImportTab({ branchId }) {
  const [file,    setFile]    = useState(null);
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);
  const [drag,    setDrag]    = useState(false);
  const fileRef = useRef();

  async function doImport() {
    if (!file || !branchId) return;
    setBusy(true); setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${BASE}/students/bulk-import/${branchId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      setResult(data);
      setFile(null);
    } catch(ex) {
      setResult({ created:0, failed:-1, errors:[ex.message] });
    }
    setBusy(false);
  }

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
      {/* instructions + template */}
      <Card>
        <h2 style={sectionHead}>Bulk Import via Excel</h2>
        <p style={{ fontSize:13, color:"#6B7280", lineHeight:1.7 }}>
          Upload an Excel file (.xlsx / .xls) to register multiple students at once.
          Each student will automatically receive a unique QR code.
        </p>

        <div style={{ margin:"16px 0", background:"#F8FAFC", borderRadius:8, padding:14, border:"1px solid #E5E7EB" }}>
          <p style={{ fontSize:12, fontWeight:600, color:"#374151", marginBottom:8 }}>Required columns:</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["name","roll_number","class_name"].map(c => (
              <span key={c} style={{ background:"#1F4E79", color:"#fff", borderRadius:4, padding:"2px 8px", fontSize:11 }}>{c} *</span>
            ))}
            {["section","parent_name","parent_phone"].map(c => (
              <span key={c} style={{ background:"#E5E7EB", color:"#374151", borderRadius:4, padding:"2px 8px", fontSize:11 }}>{c}</span>
            ))}
          </div>
        </div>

        <Btn variant="ghost" size="sm" onClick={() => downloadFile("/students/template", "student_import_template.xlsx")}>
          Download Excel Template
        </Btn>

        <div style={{ marginTop:16, fontSize:12, color:"#9CA3AF" }}>
          <strong>Tip:</strong> You can also use Word mail merge — export the students list from Excel, create a Word template with QR image fields, then merge. Download the ZIP of QR cards below to get all images.
        </div>
      </Card>

      {/* upload */}
      <Card>
        <h2 style={sectionHead}>Upload File</h2>

        <div
          style={{ ...dropZone, borderColor: drag ? "#1F4E79" : "#E5E7EB", background: drag ? "#EFF6FF" : "#FAFAFA" }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current.click()}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }}
            onChange={e => setFile(e.target.files[0])} />
          {file ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>📄</div>
              <p style={{ fontSize:13, fontWeight:600, color:"#1F4E79" }}>{file.name}</p>
              <p style={{ fontSize:11, color:"#9CA3AF" }}>Click to change file</p>
            </div>
          ) : (
            <div style={{ textAlign:"center", color:"#9CA3AF" }}>
              <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
              <p style={{ fontSize:13 }}>Drag & drop Excel file here<br/>or click to browse</p>
              <p style={{ fontSize:11, marginTop:4 }}>.xlsx / .xls accepted</p>
            </div>
          )}
        </div>

        {file && (
          <div style={{ marginTop:16 }}>
            <Btn onClick={doImport} disabled={busy}>
              {busy ? "Importing…" : `Import Students`}
            </Btn>
          </div>
        )}

        {result && (
          <div style={{ marginTop:16 }}>
            {result.failed === -1 ? (
              <div style={errBox}>{result.errors[0]}</div>
            ) : (
              <>
                <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                  <div style={{ ...pill, background:"#DCFCE7", color:"#16A34A" }}>{result.created} created</div>
                  {result.failed > 0 && <div style={{ ...pill, background:"#FEE2E2", color:"#DC2626" }}>{result.failed} failed</div>}
                </div>
                {result.errors.length > 0 && (
                  <div style={{ background:"#FEF9C3", border:"1px solid #FDE047", borderRadius:8, padding:10, fontSize:11, color:"#713F12" }}>
                    <strong>Errors:</strong>
                    <ul style={{ margin:"6px 0 0 14px", padding:0 }}>
                      {result.errors.map((e,i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type="text" }) {
  return (
    <label style={lbl}>
      {label}
      <input type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} style={inp} />
    </label>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = ["Add Student", "All Students", "Bulk Import"];

export default function StudentManagement() {
  const { branchId } = useAuth();
  const [tab, setTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div>
      <h1 style={{ fontSize:20, fontWeight:700, color:"#1F4E79", marginBottom:20 }}>
        Student Management & QR Cards
      </h1>

      {/* tab bar */}
      <div style={{ display:"flex", gap:0, marginBottom:24, borderBottom:"2px solid #E5E7EB" }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            style={{
              padding:"10px 22px", border:"none", background:"none", cursor:"pointer",
              fontSize:13, fontWeight: tab===i ? 700 : 500,
              color: tab===i ? "#1F4E79" : "#6B7280",
              borderBottom: tab===i ? "2px solid #1F4E79" : "2px solid transparent",
              marginBottom:-2,
            }}>
            {t}
          </button>
        ))}
      </div>

      {!branchId && (
        <Card><p style={{ color:"#EF4444", fontSize:13 }}>Please select a branch first.</p></Card>
      )}

      {branchId && tab === 0 && (
        <AddStudentTab branchId={branchId} onCreated={() => setRefreshKey(k => k+1)} />
      )}
      {branchId && tab === 1 && (
        <AllStudentsTab key={refreshKey} branchId={branchId} />
      )}
      {branchId && tab === 2 && (
        <BulkImportTab branchId={branchId} />
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const sectionHead  = { fontSize:15, fontWeight:700, color:"#1F4E79", marginBottom:16, marginTop:0 };
const lbl          = { display:"flex", flexDirection:"column", gap:4, fontSize:12, color:"#6B7280" };
const inp          = { padding:"7px 10px", border:"1px solid #E5E7EB", borderRadius:8, fontSize:13, marginTop:2, outline:"none" };
const grid2        = { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 };
const errBox       = { background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#DC2626", marginBottom:14 };
const th           = { background:"#1F4E79", color:"#fff", padding:"9px 12px", textAlign:"left", fontSize:12, whiteSpace:"nowrap" };
const td           = { padding:"8px 12px", borderBottom:"1px solid #E5E7EB", fontSize:13 };
const modalOverlay = { position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 };
const modalBox     = { background:"#fff", borderRadius:16, padding:28, minWidth:340, maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,.2)" };
const closeBtn     = { background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#6B7280", lineHeight:1 };
const dropZone     = { border:"2px dashed", borderRadius:12, padding:32, cursor:"pointer", transition:"all .2s", minHeight:160, display:"flex", alignItems:"center", justifyContent:"center" };
const pill         = { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 };
