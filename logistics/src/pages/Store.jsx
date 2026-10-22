import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, getSafeImageUrl } from '../config/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, PlusCircle, ArrowRight } from 'lucide-react';

export default function Store() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/products`);
        setProducts(res.data);
      } catch (err) {
        console.error('Failed to load catalog', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-slate-400">Loading catalog...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Merchant / Seller Banner */}
      {user?.role === 'admin' ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <div>
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
              🛍️ Merchant Storefront Control
            </h3>
            <p className="text-xs text-amber-700 mt-0.5">
              You are logged in as a Merchant/Admin. You can list new products, adjust inventory, and assign delivery drivers.
            </p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 shrink-0 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" /> Sell Goods & Add Items
          </Link>
        </div>
      ) : !user ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
          <div>
            <h3 className="font-bold text-indigo-900 text-sm">
              Want to sell your products on TrackFlow?
            </h3>
            <p className="text-xs text-indigo-700 mt-0.5">
              Register as an Admin / Merchant to list items, set stock, and have local drivers deliver your goods.
            </p>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm"
          >
            Start Selling <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : null}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Available Products</h1>
          <p className="text-sm text-slate-500">Browse and order goods from verified local merchants</p>
        </div>
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Manage Your Inventory &rarr;
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {products.map((prod) => (
          <div key={prod._id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
            <img src={getSafeImageUrl(prod.imageUrl)} alt={prod.name} className="h-48 w-full object-cover" />
            <div className="p-4">
              <h2 className="font-bold text-lg text-slate-800">{prod.name}</h2>
              <p className="text-sm text-slate-500 line-clamp-2 my-2">{prod.description}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xl font-black text-slate-900">₹{prod.price}</span>
                <button
                  onClick={() => addToCart(prod)}
                  className="bg-indigo-600 text-white px-3.5 py-1.5 rounded-lg text-sm flex items-center gap-1.5 hover:bg-indigo-700"
                >
                  <ShoppingBag className="w-4 h-4" /> Add
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}