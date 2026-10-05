const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("token") || "";
}

async function request(path, opts = {}) {
  const url = BASE + path;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/app/login";
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;  // return raw response for file downloads
}

export const api = {
  get:    (path)         => request(path),
  post:   (path, body)   => request(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    (path, body)   => request(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: (path)         => request(path, { method: "DELETE" }),

  async download(path, filename) {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { alert("Export failed"); return; }
    const cd = res.headers.get("Content-Disposition") || "";
    const fname = cd.split("filename=")[1] || filename || "report";
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
  },
};
