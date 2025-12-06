import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    if (token) {
      fetchMe();
    }
  }, [token]);

  const fetchMe = async () => {
    try {
      setLoadingUser(true);
      const res = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
    } catch (err) {
      console.error(err);
      logout();
    } finally {
      setLoadingUser(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const accessToken = res.data.access_token;
    setToken(accessToken);
    localStorage.setItem("token", accessToken);
    await fetchMe();
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider
      value={{ token, user, loadingUser, login, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
