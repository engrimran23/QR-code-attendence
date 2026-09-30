import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Change this to your server IP when running on a real device
// e.g. "http://192.168.1.5:8082"  (find with ipconfig)
export const API_BASE = "http://192.168.1.100:8082";

const client = axios.create({ baseURL: API_BASE, timeout: 8000 });

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (r) => r.data,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(["token", "user"]);
    }
    throw new Error(err.response?.data?.detail || err.message || "Request failed");
  }
);

export default {
  get:    (path)        => client.get(path),
  post:   (path, body)  => client.post(path, body),
  put:    (path, body)  => client.put(path, body),
  delete: (path)        => client.delete(path),
};
