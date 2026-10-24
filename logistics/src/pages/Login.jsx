import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config/api';
import { ShieldCheck, User, Truck, Sparkles, ArrowRight } from 'lucide-react';

export default function Login() {
  const [selectedRole, setSelectedRole] = useState('admin'); // 'admin' | 'customer' | 'delivery_partner'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRoleTabClick = (role) => {
    setSelectedRole(role);
    setError('');
    setEmail('');
    setPassword('');
  };

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

      // Sync user data to AuthContext and localStorage
      login(data);

      // Automatically route according to role
      if (data.role === 'admin') {
        navigate('/admin');
      } else if (data.role === 'delivery_partner') {
        navigate('/partner');
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
    <div className="flex min-h-[90vh] items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Unified Logistics</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in to your account</p>
        </div>

        {/* Role Select Tabs */}
        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">
            Select Your Account Role
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1.5">
            <button
              type="button"
              onClick={() => handleRoleTabClick('admin')}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-2 text-xs font-bold transition ${
                selectedRole === 'admin'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Merchant / Admin</span>
              <span className="text-[10px] font-normal text-amber-600">Sell Goods</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabClick('customer')}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-2 text-xs font-bold transition ${
                selectedRole === 'customer'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Customer</span>
              <span className="text-[10px] font-normal text-slate-400">Order & Track</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleTabClick('delivery_partner')}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-2 text-xs font-bold transition ${
                selectedRole === 'delivery_partner'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Delivery</span>
              <span className="text-[10px] font-normal text-emerald-600">Earn & Deliver</span>
            </button>
          </div>
        </div>

        {/* Role Context Notice (Without exposed credentials) */}
        {selectedRole === 'admin' && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-900">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Merchant & Admin Portal:</span>
              <p className="text-amber-700 mt-0.5">
                Authorized sellers and administrators have access to catalog management, inventory control, and order dispatch.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-600">
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
              placeholder="name@example.com"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Authenticating...' : `Sign In as ${selectedRole === 'admin' ? 'Merchant / Admin' : selectedRole === 'delivery_partner' ? 'Delivery Partner' : 'Customer'}`}
          </button>
        </form>

        {/* Register Section */}
        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <p className="text-xs text-slate-500 mb-2">Want to sell your goods or become a delivery partner?</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            Create an Account as Merchant / Admin or Partner <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
