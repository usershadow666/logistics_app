import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Package, ShieldCheck, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex justify-between items-center sticky top-0 z-50">
      <Link to="/" className="text-xl font-bold flex items-center gap-2 text-indigo-400">
        <Package className="w-6 h-6" /> UNIFIED LOGISTICS
      </Link>

      <div className="flex items-center gap-6">
        {user?.role === 'customer' && (
          <>
            <Link to="/" className="hover:text-indigo-300">Catalog</Link>
            <Link to="/my-orders" className="hover:text-indigo-300 flex items-center gap-1.5 font-medium">
              <Package className="w-4 h-4 text-indigo-400" /> My Orders & Tracking
            </Link>
            <Link to="/cart" className="relative flex items-center hover:text-indigo-300">
              <ShoppingCart className="w-5 h-5" />
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                  {cartItems.length}
                </span>
              )}
            </Link>
          </>
        )}

        {user?.role === 'admin' && (
          <Link to="/admin" className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg text-sm transition">
            <ShieldCheck className="w-4 h-4" /> Merchant & Fleet Dispatch
          </Link>
        )}

        {user?.role === 'delivery_partner' && (
          <Link to="/partner" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium">
            <Truck className="w-5 h-5" /> Driver Portal
          </Link>
        )}

        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {user.name} <span className="text-xs uppercase bg-slate-800 px-2 py-0.5 rounded text-indigo-400 font-semibold">{user.role === 'admin' ? 'Merchant / Admin' : user.role}</span>
            </span>
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link to="/register" className="hidden sm:inline-block text-xs font-semibold text-amber-400 hover:text-amber-300">
              🛍️ Sell on TrackFlow
            </Link>
            <Link to="/login" className="hover:text-indigo-300 text-sm">Login</Link>
            <Link to="/register" className="bg-indigo-600 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-indigo-500">Sign Up</Link>
          </div>
        )}
      </div>
    </nav>
  );
}