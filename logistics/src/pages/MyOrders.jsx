import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL, getSafeImageUrl } from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  MapPin,
  Truck,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  Radio
} from 'lucide-react';

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'completed'

  const fetchOrders = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/orders/my-orders`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load user orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.token]);

  const activeOrders = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  const pastOrders = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled');

  const displayedOrders = activeTab === 'active' ? activeOrders : pastOrders;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-indigo-600" /> My Orders & Live Tracking
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your delivery partner live in real-time or review order history
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tabs */}
          <div className="flex rounded-xl bg-slate-200 p-1 text-xs font-bold">
            <button
              onClick={() => setActiveTab('active')}
              className={`rounded-lg px-4 py-2 transition ${
                activeTab === 'active'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active Shipments ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`rounded-lg px-4 py-2 transition ${
                activeTab === 'completed'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past Deliveries ({pastOrders.length})
            </button>
          </div>

          <button
            onClick={fetchOrders}
            disabled={loading}
            title="Refresh order history"
            className="p-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <RefreshCw className="h-7 w-7 text-indigo-600 animate-spin" />
        </div>
      ) : displayedOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-lg mx-auto shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">
            {activeTab === 'active' ? 'No Active Shipments Right Now' : 'No Past Orders Found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            {activeTab === 'active'
              ? 'When you purchase goods from local merchants, your live delivery telemetry will display here.'
              : 'Your fulfilled deliveries will be listed here.'}
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition"
          >
            Explore Catalog <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedOrders.map((order) => {
            const isDelivering = order.status === 'out_for_delivery' || order.status === 'picked_up';
            return (
              <div
                key={order._id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-black text-slate-800">
                      ORDER #{order._id.slice(-6).toUpperCase()}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : isDelivering
                          ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300 animate-pulse'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {isDelivering && <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>}
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Items & Driver info row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  {/* Items Preview */}
                  <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                    {order.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl text-xs"
                      >
                        {item.product?.imageUrl && (
                          <img
                            src={getSafeImageUrl(item.product.imageUrl)}
                            alt={item.product?.name}
                            className="w-8 h-8 rounded-lg object-cover border"
                          />
                        )}
                        <div>
                          <span className="font-semibold text-slate-800">
                            {item.product?.name || 'Product item'}
                          </span>
                          <span className="text-slate-400 text-[11px] block">
                            Qty: {item.quantity} × ₹{item.price}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pricing */}
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Total Amount</span>
                    <span className="text-lg font-black text-slate-900">₹{order.totalAmount}</span>
                  </div>
                </div>

                {/* Delivery details and Track Action */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="truncate">
                      <strong>Destination:</strong> {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    {order.assignedPartner ? (
                      <div className="text-right text-xs hidden sm:block">
                        <span className="text-slate-400 text-[11px] block">Assigned Partner</span>
                        <span className="font-bold text-slate-800">{order.assignedPartner.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Assigning courier...</span>
                    )}

                    <Link
                      to={`/orders/${order._id}/track`}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm ${
                        isDelivering
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      <Radio className={`w-3.5 h-3.5 ${isDelivering ? 'text-emerald-400 animate-ping' : ''}`} />
                      <span>{order.status === 'delivered' ? 'View Delivery Route' : 'Track Live Partner'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
