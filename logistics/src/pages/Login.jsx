import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      // Automatically persist token and role to this device's storage
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('user', JSON.stringify({ name: data.name, email: data.email }));

      // Automatically route according to role
      if (data.role === 'admin') {
        navigate('/admin');
      } else if (data.role === 'delivery_partner') {
        navigate('/delivery');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">TrackFlow Portal</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in with your admin, partner, or customer account</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@test.com"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}