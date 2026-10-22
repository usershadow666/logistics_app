import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, getSafeImageUrl } from '../config/api';
import { useCart } from '../context/CartContext';
import { ShoppingBag } from 'lucide-react';

export default function Store() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

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
      <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Available Products</h1>
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