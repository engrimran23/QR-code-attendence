import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,     setUser]     = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (saved && token) {
      setUser(JSON.parse(saved));
      loadBranches();
    } else {
      setLoading(false);
    }
  }, []);

  async function loadBranches() {
    try {
      const data = await api.get("/schools/branches/");
      setBranches(data);
      const saved = localStorage.getItem("branch_id");
      const id = saved ? parseInt(saved) : data[0]?.id;
      if (id) setBranchId(id);
    } catch (_) {}
    setLoading(false);
  }

  async function login(email, password) {
    const data = await api.post("/auth/login", { email, password });
    localStorage.setItem("token",   data.access_token);
    localStorage.setItem("user",    JSON.stringify(data.user));
    setUser(data.user);
    await loadBranches();
    return data.user;
  }

  function logout() {
    localStorage.clear();
    setUser(null);
    setBranches([]);
    setBranchId(null);
  }

  function selectBranch(id) {
    setBranchId(id);
    localStorage.setItem("branch_id", id);
  }

  return (
    <AuthContext.Provider value={{ user, branches, branchId, selectBranch, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
