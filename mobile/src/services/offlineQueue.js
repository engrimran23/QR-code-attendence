import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

const QUEUE_KEY = "offline_scan_queue";

export async function enqueue(scan) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({ ...scan, queued_at: new Date().toISOString() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function syncQueue(branchId) {
  const queue = await getQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  try {
    const result = await api.post("/attendance/offline-sync", {
      branch_id: branchId,
      scans: queue.map((s) => ({
        qr_token: s.qr_token,
        scanned_at: s.queued_at,
      })),
    });
    await clearQueue();
    return { synced: result.processed, failed: result.failed };
  } catch {
    return { synced: 0, failed: queue.length };
  }
}
