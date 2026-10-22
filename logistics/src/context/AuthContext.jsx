import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('logistics_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse logistics_user', e);
      }
    }
    // Fallback to separate keys if available
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const rawUser = localStorage.getItem('user');
    if (token && role) {
      try {
        const parsed = rawUser ? JSON.parse(rawUser) : {};
        return { ...parsed, token, role };
      } catch {
        return { token, role };
      }
    }
    return null;
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('logistics_user', JSON.stringify(userData));
    if (userData?.token) localStorage.setItem('token', userData.token);
    if (userData?.role) localStorage.setItem('role', userData.role);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('logistics_user');
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);