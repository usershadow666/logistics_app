import React, { useState, useEffect } from 'react';
// Verify filename matches AddProductModal vs AddProductModel
import AddProductModal from '../components/AddProductModel';

import { API_BASE_URL as API_URL, getSafeImageUrl } from '../config/api';

export default function AdminDispatch() {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'inventory'
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [resOrders, resProducts, resPartners] = await Promise.all([
        fetch(`${API_URL}/api/orders`, { headers }),
        fetch(`${API_URL}/api/products`),
        fetch(`${API_URL}/api/auth/delivery-partners`, { headers }),
      ]);

      if (resOrders.status === 401 || resPartners.status === 401) {
        console.warn('Session expired or unauthorized token.');
        return;
      }

      const ordersData = await resOrders.json();
      const productsData = await resProducts.json();
      const partnersData = await resPartners.json();

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setPartners(Array.isArray(partnersData) ? partnersData : []);
    } catch (err) {
      console.error('Failed to load admin dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle assigning an order to a delivery partner
  const handleAssignPartner = async (orderId, partnerId) => {
    if (!partnerId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/orders/${orderId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ partnerId }),
      });
      const updatedOrder = await res.json();
      setOrders((prev) => prev.map((o) => (o._id === orderId ? updatedOrder : o)));
    } catch (err) {
      console.error('Failed to assign partner:', err);
    }
  };

  const handleProductAdded = (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Logistics Dispatch & Operations
            </h1>
            <p className="text-sm text-slate-500">
              Assign active drivers, track shipments, and manage store stock
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Tabs */}
            <div className="flex rounded-xl bg-slate-200 p-1 text-sm font-semibold">
              <button
                onClick={() => setActiveTab('orders')}
                className={`rounded-lg px-4 py-1.5 transition ${
                  activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Live Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`rounded-lg px-4 py-1.5 transition ${
                  activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                Catalog Items ({products.length})
              </button>
            </div>

            {/* Add Item Modal Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <span className="text-base font-bold">+</span> Add Item
            </button>
          </div>
        </div>

        {/* Tab 1: Orders Dispatch Table */}
        {activeTab === 'orders' && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Order ID</th>
                  <th className="px-5 py-3.5">Customer & Destination</th>
                  <th className="px-5 py-3.5">Total Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Assigned Partner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-400">
                      {loading ? 'Loading orders from Render backend...' : 'No orders in system'}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800">
                        #{order._id.slice(-6).toUpperCase()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">{order.customer?.name || 'Guest'}</div>
                        <div className="text-xs text-slate-400">
                          {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        ₹{order.totalAmount}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            order.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'out_for_delivery'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={order.assignedPartner?._id || ''}
                          onChange={(e) => handleAssignPartner(order._id, e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-500 focus:outline-none"
                        >
                          <option value="">-- Assign Driver --</option>
                          {partners.map((partner) => (
                            <option key={partner._id} value={partner._id}>
                              {partner.name} ({partner.phone || 'No Phone'})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Inventory Catalog Table */}
        {activeTab === 'inventory' && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Product</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Price</th>
                  <th className="px-5 py-3.5">Stock Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400">
                      {loading ? 'Loading catalog...' : 'No products available'}
                    </td>
                  </tr>
                ) : (
                  products.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition">
                      <td className="flex items-center gap-3 px-5 py-3.5 font-medium text-slate-900">
                        <img
                          src={getSafeImageUrl(item.imageUrl)}
                          alt={item.name}
                          className="h-10 w-10 rounded-lg object-cover border"
                        />
                        <span>{item.name}</span>
                      </td>
                      <td className="px-5 py-3.5">{item.category}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800">₹{item.price}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {item.stock} units
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Form Modal */}
        <AddProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onProductAdded={handleProductAdded}
        />
      </div>
    </div>
  );
}