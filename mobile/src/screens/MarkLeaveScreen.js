import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const LEAVE_TYPES = [
  { value: "sick",   label: "🤒 Sick",   color: "#ef4444" },
  { value: "urgent", label: "⚡ Urgent",  color: "#f97316" },
  { value: "other",  label: "📋 Other",   color: "#6366f1" },
];

function LeaveTypeBtn({ type, selected, onSelect }) {
  return (
    <TouchableOpacity
      onPress={() => onSelect(type.value)}
      style={[s.typeBtn, selected && { backgroundColor: type.color, borderColor: type.color }]}
    >
      <Text style={[s.typeBtnText, selected && { color: "#fff" }]}>{type.label}</Text>
    </TouchableOpacity>
  );
}

export default function MarkLeaveScreen() {
  const [students,  setStudents]  = useState([]);
  const [search,    setSearch]    = useState("");
  const [branchId,  setBranchId]  = useState(null);
  const [leaves,    setLeaves]    = useState({});   // id → {type, reason}
  const [saved,     setSaved]     = useState({});   // id → bool
  const [busy,      setBusy]      = useState(false);
  const [saving,    setSaving]    = useState({});
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => { init(); }, []);

  async function init() {
    const bid = await AsyncStorage.getItem("branch_id");
    if (bid) { setBranchId(parseInt(bid)); loadStudents(parseInt(bid)); }
  }

  async function loadStudents(bid) {
    setBusy(true);
    try {
      const data = await api.get(`/students/?branch_id=${bid}`);
      setStudents(data);
    } catch (e) { Alert.alert("Error", e.message); }
    setBusy(false);
  }

  function setLeave(id, key, val) {
    setLeaves(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: val } }));
  }

  async function markLeave(student) {
    const lv = leaves[student.id];
    if (!lv?.type) { Alert.alert("Select Type", "Please select a leave type."); return; }
    setSaving(s => ({ ...s, [student.id]: true }));
    try {
      await api.post("/attendance/leave", {
        student_id: student.id,
        date:       today,
        leave_type: lv.type,
        reason:     lv.reason || "",
      });
      setSaved(s => ({ ...s, [student.id]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [student.id]: false })), 3000);
    } catch (e) { Alert.alert("Failed", e.message); }
    setSaving(s => ({ ...s, [student.id]: false }));
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.includes(search)
  );

  const renderItem = ({ item: s }) => {
    const lv = leaves[s.id] || {};
    return (
      <View style={s_card.card}>
        <View style={s_card.header}>
          <View>
            <Text style={s_card.name}>{s.name}</Text>
            <Text style={s_card.sub}>Roll: {s.roll_number} · Class {s.class_name}{s.section ? ` — ${s.section}` : ""}</Text>
          </View>
          {saved[s.id] && <Text style={s_card.savedBadge}>✓ Saved</Text>}
        </View>

        <View style={s_card.types}>
          {LEAVE_TYPES.map(t => (
            <LeaveTypeBtn key={t.value} type={t} selected={lv.type === t.value} onSelect={(v) => setLeave(s.id, "type", v)} />
          ))}
        </View>

        <TextInput
          style={s_card.reasonInput}
          placeholder="Reason (optional)…"
          placeholderTextColor="#9CA3AF"
          value={lv.reason || ""}
          onChangeText={v => setLeave(s.id, "reason", v)}
        />

        <TouchableOpacity
          style={[s_card.markBtn, (!lv.type || saving[s.id]) && s_card.markBtnDisabled]}
          onPress={() => markLeave(s)}
          disabled={!lv.type || saving[s.id]}
        >
          {saving[s.id]
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s_card.markBtnText}>Mark Leave</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Mark Leave</Text>
        <Text style={s.dateText}>{today}</Text>
      </View>

      <TextInput
        style={s.search}
        placeholder="Search by name or roll number…"
        placeholderTextColor="#9CA3AF"
        value={search}
        onChangeText={setSearch}
      />

      {busy
        ? <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1F4E79" />
        : (
          <FlatList
            data={filtered}
            keyExtractor={i => String(i.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
            ListEmptyComponent={<Text style={s.empty}>No students found.</Text>}
          />
        )
      }
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F0F4F8" },
  header:    { backgroundColor: "#1F4E79", padding: 20, paddingTop: 50, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title:     { color: "#fff", fontSize: 22, fontWeight: "800" },
  dateText:  { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  search:    { margin: 12, backgroundColor: "#fff", borderRadius: 12, padding: 13, fontSize: 14, borderWidth: 1, borderColor: "#E5E7EB" },
  empty:     { textAlign: "center", color: "#9CA3AF", marginTop: 40, fontSize: 14 },
});

const s_card = StyleSheet.create({
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  name:        { fontSize: 16, fontWeight: "700", color: "#111" },
  sub:         { fontSize: 12, color: "#6B7280", marginTop: 2 },
  savedBadge:  { backgroundColor: "#DCFCE7", color: "#16A34A", fontWeight: "700", fontSize: 12, padding: 5, borderRadius: 8 },
  types:       { flexDirection: "row", gap: 8, marginBottom: 10 },
  typeBtn:     { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 8, padding: 8, alignItems: "center" },
  typeBtnText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  reasonInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 10, fontSize: 13, color: "#111", marginBottom: 12 },
  markBtn:     { backgroundColor: "#f97316", borderRadius: 10, padding: 12, alignItems: "center" },
  markBtnDisabled: { opacity: 0.4 },
  markBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
