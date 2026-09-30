import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { syncQueue, getQueue } from "../services/offlineQueue";

function StatBox({ label, value, color, icon }) {
  return (
    <View style={[s.statBox, { borderTopColor: color }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value ?? "—"}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [summary,    setSummary]    = useState(null);
  const [user,       setUser]       = useState(null);
  const [branchId,   setBranchId]   = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const raw = await AsyncStorage.getItem("user");
    const bid = await AsyncStorage.getItem("branch_id");
    if (raw) setUser(JSON.parse(raw));
    if (bid) setBranchId(parseInt(bid));
    const q = await getQueue();
    setQueueCount(q.length);
    if (bid) loadSummary(parseInt(bid));
  }

  async function loadSummary(bid) {
    try {
      const data = await api.get(`/attendance/dashboard/today?branch_id=${bid}`);
      setSummary(data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (branchId) {
      await syncQueue(branchId);
      const q = await getQueue();
      setQueueCount(q.length);
      await loadSummary(branchId);
    }
    setRefreshing(false);
  }, [branchId]);

  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1F4E79" />}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.welcome}>Good {getGreeting()}, {user?.name?.split(" ")[0] || "User"}</Text>
          <Text style={s.role}>{user?.role?.replace("_", " ").toUpperCase()}</Text>
          <Text style={s.date}>{today}</Text>
        </View>
        <Text style={s.headerIcon}>📋</Text>
      </View>

      {/* Sync alert */}
      {queueCount > 0 && (
        <TouchableOpacity style={s.syncAlert} onPress={onRefresh}>
          <Text style={s.syncText}>⚡ {queueCount} offline scan{queueCount > 1 ? "s" : ""} pending sync — Tap to sync</Text>
        </TouchableOpacity>
      )}

      {error ? (
        <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
      ) : !summary ? (
        <View style={s.loadBox}><Text style={s.loadText}>Pull down to refresh…</Text></View>
      ) : (
        <>
          {/* Stats grid */}
          <View style={s.statsGrid}>
            <StatBox label="Total"    value={summary.total_students}        color="#1565C0" icon="🎒" />
            <StatBox label="Present"  value={summary.present}               color="#16a34a" icon="✅" />
            <StatBox label="Late"     value={summary.late}                   color="#f97316" icon="⏰" />
            <StatBox label="On Leave" value={summary.on_leave ?? 0}          color="#92400E" icon="🏖" />
            <StatBox label="Absent"   value={summary.absent}                 color="#dc2626" icon="❌" />
            <StatBox label="Rate"     value={summary.attendance_percentage + "%"} color="#1F4E79" icon="📊" />
          </View>

          {/* Rate bar */}
          <View style={s.rateCard}>
            <Text style={s.rateLabel}>Attendance Rate</Text>
            <View style={s.rateBarBg}>
              <View style={[s.rateBarFill, { width: `${summary.attendance_percentage}%` }]} />
            </View>
            <Text style={s.ratePct}>{summary.attendance_percentage}%</Text>
          </View>
        </>
      )}

      <Text style={s.footer}>Pull to refresh · Data as of {new Date().toLocaleTimeString()}</Text>
    </ScrollView>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#F0F4F8" },
  header:     { backgroundColor: "#1F4E79", padding: 24, paddingTop: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  welcome:    { color: "#fff", fontSize: 20, fontWeight: "800" },
  role:       { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2, letterSpacing: 1 },
  date:       { color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 6 },
  headerIcon: { fontSize: 40 },
  syncAlert:  { backgroundColor: "#FEF9C3", margin: 14, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: "#F59E0B" },
  syncText:   { color: "#92400E", fontWeight: "700", fontSize: 13 },
  errorBox:   { margin: 14, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 14 },
  errorText:  { color: "#dc2626", fontSize: 13 },
  loadBox:    { margin: 14, padding: 40, alignItems: "center" },
  loadText:   { color: "#9CA3AF", fontSize: 14 },
  statsGrid:  { flexDirection: "row", flexWrap: "wrap", padding: 10, gap: 0 },
  statBox:    { width: "33.3%", backgroundColor: "#fff", borderTopWidth: 3, padding: 16, alignItems: "center" },
  statIcon:   { fontSize: 22, marginBottom: 4 },
  statValue:  { fontSize: 28, fontWeight: "800" },
  statLabel:  { fontSize: 11, color: "#6B7280", marginTop: 2 },
  rateCard:   { backgroundColor: "#fff", margin: 14, borderRadius: 14, padding: 18 },
  rateLabel:  { fontSize: 13, fontWeight: "700", color: "#1F4E79", marginBottom: 10 },
  rateBarBg:  { height: 10, backgroundColor: "#E5E7EB", borderRadius: 5, overflow: "hidden" },
  rateBarFill:{ height: "100%", backgroundColor: "#1F4E79", borderRadius: 5 },
  ratePct:    { fontSize: 24, fontWeight: "800", color: "#1F4E79", textAlign: "right", marginTop: 8 },
  footer:     { textAlign: "center", color: "#9CA3AF", fontSize: 11, padding: 20 },
});
