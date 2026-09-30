import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

export async function login(email, password) {
  const data = await api.post("/auth/login", { email, password });
  await AsyncStorage.setItem("token", data.access_token);
  await AsyncStorage.setItem("user", JSON.stringify(data.user));
  await AsyncStorage.setItem("branch_id", String(data.user.branch_id || ""));
  return data.user;
}

export async function logout() {
  await AsyncStorage.multiRemove(["token", "user", "branch_id"]);
}

export async function getStoredUser() {
  const raw = await AsyncStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export async function getStoredBranchId() {
  const val = await AsyncStorage.getItem("branch_id");
  return val ? parseInt(val) : null;
}
