import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Image,
} from "react-native";
import { login } from "../services/auth";

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [busy,     setBusy]     = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert("Required", "Please enter email and password.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      onLogin(user);
    } catch (e) {
      Alert.alert("Login Failed", e.message);
    }
    setBusy(false);
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.card}>
        {/* Logo / header */}
        <View style={s.logoBox}>
          <Text style={s.logoIcon}>📋</Text>
          <Text style={s.logoTitle}>QR Attend</Text>
          <Text style={s.logoSub}>School Attendance System</Text>
        </View>

        <Text style={s.fieldLabel}>Email</Text>
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          placeholderTextColor="#9CA3AF"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={s.fieldLabel}>Password</Text>
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          placeholderTextColor="#9CA3AF"
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={busy}>
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <Text style={s.hint}>Contact your branch admin for credentials</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1F4E79", justifyContent: "center", padding: 24 },
  card:      { backgroundColor: "#fff", borderRadius: 20, padding: 28, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  logoBox:   { alignItems: "center", marginBottom: 28 },
  logoIcon:  { fontSize: 48, marginBottom: 6 },
  logoTitle: { fontSize: 26, fontWeight: "800", color: "#1F4E79" },
  logoSub:   { fontSize: 13, color: "#6B7280", marginTop: 2 },
  fieldLabel:{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input:     { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 13, fontSize: 15, color: "#111" },
  btn:       { backgroundColor: "#1F4E79", borderRadius: 12, padding: 15, alignItems: "center", marginTop: 24, shadowColor: "#1F4E79", shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  btnText:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint:      { textAlign: "center", color: "#9CA3AF", fontSize: 12, marginTop: 16 },
});
