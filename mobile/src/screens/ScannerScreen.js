import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Animated, Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import NetInfo from "@react-native-community/netinfo";
import api from "../services/api";
import { enqueue, getQueue, syncQueue } from "../services/offlineQueue";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STATUS_COLORS = {
  present: "#16a34a",
  late:    "#f97316",
  already: "#6366f1",
  offline: "#64748b",
  error:   "#dc2626",
};

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,   setScanning]   = useState(true);
  const [result,     setResult]     = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline,   setIsOnline]   = useState(true);
  const [branchId,   setBranchId]   = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBranch();
    refreshQueue();
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected);
      if (state.isConnected) trySyncQueue();
    });
    return unsub;
  }, []);

  async function loadBranch() {
    const id = await AsyncStorage.getItem("branch_id");
    if (id) setBranchId(parseInt(id));
  }

  async function refreshQueue() {
    const q = await getQueue();
    setQueueCount(q.length);
  }

  async function trySyncQueue() {
    if (!branchId) return;
    const { synced } = await syncQueue(branchId);
    if (synced > 0) refreshQueue();
  }

  async function handleScan({ data: token }) {
    if (!scanning || !branchId) return;
    setScanning(false);
    Vibration.vibrate(80);

    if (!isOnline) {
      await enqueue({ qr_token: token });
      await refreshQueue();
      showResult({ status: "offline", student_name: "Scan saved offline", message: "Will sync when connected" });
      return;
    }

    try {
      const res = await api.post("/attendance/scan", { qr_token: token, branch_id: branchId });
      if (res.already_scanned) {
        showResult({ status: "already", student_name: res.student_name, message: `Already marked — ${res.status}` });
      } else {
        showResult({ status: res.status, student_name: res.student_name, message: res.message });
      }
    } catch (e) {
      showResult({ status: "error", student_name: "Error", message: e.message });
    }
  }

  function showResult(data) {
    setResult(data);
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setResult(null);
      setScanning(true);
    });
  }

  if (!permission) return <View style={s.center}><Text>Requesting camera…</Text></View>;
  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.permText}>Camera permission needed to scan QR codes</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = result ? (STATUS_COLORS[result.status] || "#374151") : "#1F4E79";

  return (
    <View style={s.container}>
      {/* Status bar */}
      <View style={[s.topBar, { backgroundColor: isOnline ? "#1F4E79" : "#64748b" }]}>
        <Text style={s.topText}>{isOnline ? "🟢 Online" : "🔴 Offline"}</Text>
        {queueCount > 0 && (
          <TouchableOpacity onPress={trySyncQueue}>
            <Text style={s.syncBadge}>{queueCount} pending sync ↑</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Camera */}
      <CameraView
        style={s.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleScan : undefined}
      />

      {/* Scanner frame overlay */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame}>
          <View style={[s.corner, s.tl]} />
          <View style={[s.corner, s.tr]} />
          <View style={[s.corner, s.bl]} />
          <View style={[s.corner, s.br]} />
        </View>
        <Text style={s.hint}>Point camera at student's QR card</Text>
      </View>

      {/* Result card */}
      {result && (
        <Animated.View style={[s.resultCard, { opacity: fadeAnim, borderLeftColor: statusColor }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.resultName}>{result.student_name}</Text>
            <Text style={s.resultMsg}>{result.message}</Text>
          </View>
          <Text style={[s.statusLabel, { color: statusColor }]}>
            {result.status?.toUpperCase()}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const FRAME = 240;
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#1F4E79" },
  permText:  { color: "#fff", fontSize: 16, textAlign: "center", marginBottom: 20 },
  permBtn:   { backgroundColor: "#f97316", padding: 14, borderRadius: 12 },
  topBar:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, paddingTop: 44 },
  topText:   { color: "#fff", fontWeight: "700", fontSize: 13 },
  syncBadge: { color: "#FDE68A", fontWeight: "700", fontSize: 12, backgroundColor: "rgba(0,0,0,0.3)", padding: 5, borderRadius: 8 },
  camera:    { flex: 1 },
  overlay:   { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  frame:     { width: FRAME, height: FRAME, position: "relative" },
  hint:      { color: "#fff", marginTop: 20, fontSize: 14, fontWeight: "600", textShadowColor: "#000", textShadowRadius: 4 },
  corner:    { position: "absolute", width: 36, height: 36, borderColor: "#fff", borderWidth: 3 },
  tl:        { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
  tr:        { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
  bl:        { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
  br:        { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
  resultCard:{ position: "absolute", bottom: 40, left: 20, right: 20, backgroundColor: "#fff", borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", gap: 12, borderLeftWidth: 5, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  resultName:{ fontSize: 16, fontWeight: "700", color: "#111" },
  resultMsg: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  statusLabel:{ fontSize: 12, fontWeight: "800" },
});
