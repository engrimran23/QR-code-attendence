import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { logout } from "../services/auth";
import { API_BASE } from "../services/api";
import { getQueue, syncQueue } from "../services/offlineQueue";

export default function ProfileScreen({ onLogout }) {
  const [user,       setUser]       = useState(null);
  const [branchId,   setBranchId]   = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [serverUrl,  setServerUrl]  = useState(API_BASE);
  const [editing,    setEditing]    = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const raw = await AsyncStorage.getItem("user");
    const bid = await AsyncStorage.getItem("branch_id");
    const url = await AsyncStorage.getItem("server_url") || API_BASE;
    if (raw) setUser(JSON.parse(raw));
    if (bid) setBranchId(bid);
    setServerUrl(url);
    const q = await getQueue();
    setQueueCount(q.length);
  }

  async function saveServerUrl() {
    await AsyncStorage.setItem("server_url", serverUrl);
    setEditing(false);
    Alert.alert("Saved", "Server URL updated. Restart the app to apply.");
  }

  async function handleSync() {
    const { synced, failed } = await syncQueue(parseInt(branchId));
    Alert.alert("Sync Complete", `Synced: ${synced}  Failed: ${failed}`);
    const q = await getQueue();
    setQueueCount(q.length);
  }

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); onLogout(); } },
    ]);
  }

  const Row = ({ icon, label, value }) => (
    <View style={s.row}>
      <Text style={s.rowIcon}>{icon}</Text>
      <View>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowValue}>{value || "—"}</Text>
      </View>
    </View>
  );

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <View style={s.avatar}><Text style={s.avatarText}>{user?.name?.[0] || "U"}</Text></View>
        <Text style={s.name}>{user?.name}</Text>
        <Text style={s.role}>{user?.role?.replace(/_/g, " ").toUpperCase()}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Account</Text>
        <Row icon="📧" label="Email"    value={user?.email} />
        <Row icon="🏫" label="Branch ID" value={branchId} />
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Server</Text>
        {editing ? (
          <View style={{ padding: 14, gap: 8 }}>
            <TextInput style={s.urlInput} value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" />
            <TouchableOpacity style={s.saveBtn} onPress={saveServerUrl}>
              <Text style={s.saveBtnText}>Save URL</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)}>
            <Row icon="🌐" label="API Server (tap to edit)" value={serverUrl} />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Offline Queue</Text>
        <Row icon="📶" label="Pending scans" value={String(queueCount)} />
        {queueCount > 0 && (
          <TouchableOpacity style={s.syncBtn} onPress={handleSync}>
            <Text style={s.syncBtnText}>⬆ Sync {queueCount} scan{queueCount > 1 ? "s" : ""} now</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutText}>🚪 Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F0F4F8" },
  header:       { backgroundColor: "#1F4E79", alignItems: "center", paddingTop: 60, paddingBottom: 30 },
  avatar:       { width: 72, height: 72, borderRadius: 36, backgroundColor: "#f97316", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  avatarText:   { color: "#fff", fontSize: 32, fontWeight: "800" },
  name:         { color: "#fff", fontSize: 20, fontWeight: "800" },
  role:         { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4, letterSpacing: 1 },
  section:      { backgroundColor: "#fff", margin: 12, borderRadius: 14, overflow: "hidden" },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", padding: 14, paddingBottom: 6, letterSpacing: 1 },
  row:          { flexDirection: "row", alignItems: "center", padding: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6", gap: 12 },
  rowIcon:      { fontSize: 20 },
  rowLabel:     { fontSize: 11, color: "#9CA3AF" },
  rowValue:     { fontSize: 14, fontWeight: "600", color: "#111", marginTop: 2 },
  urlInput:     { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 10, fontSize: 13 },
  saveBtn:      { backgroundColor: "#1F4E79", borderRadius: 8, padding: 11, alignItems: "center" },
  saveBtnText:  { color: "#fff", fontWeight: "700" },
  syncBtn:      { margin: 14, marginTop: 4, backgroundColor: "#FEF9C3", borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: "#FDE68A" },
  syncBtnText:  { color: "#92400E", fontWeight: "700", fontSize: 14 },
  logoutBtn:    { margin: 14, backgroundColor: "#FEE2E2", borderRadius: 14, padding: 16, alignItems: "center" },
  logoutText:   { color: "#dc2626", fontWeight: "700", fontSize: 16 },
});
