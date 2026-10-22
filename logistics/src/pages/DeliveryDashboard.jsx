import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

const BACKEND_URL = API_BASE_URL;

export default function DeliveryDashboard() {
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsMode, setGpsMode] = useState('idle'); // 'idle' | 'real' | 'simulating'
  const [currentCoords, setCurrentCoords] = useState({ lat: 17.7231, lng: 83.3013 });
  const [statusFeedback, setStatusFeedback] = useState('');

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const simIntervalRef = useRef(null);
  const token = localStorage.getItem('token');

  // Initialize Socket.io connection
  useEffect(() => {
    socketRef.current = io(BACKEND_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to logistics socket gateway:', socketRef.current.id);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      stopTracking();
    };
  }, []);

  // Fetch driver run sheet
  const fetchAssignedOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/orders/my-runsheet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const orderList = Array.isArray(data) ? data : [];
      setOrders(orderList);

      // Default the active tracking session to the first out_for_delivery or picked_up order
      if (!activeOrder && orderList.length > 0) {
        const inTransit = orderList.find(
          (o) => o.status === 'out_for_delivery' || o.status === 'picked_up'
        );
        setActiveOrder(inTransit || orderList[0]);
      }
    } catch (err) {
      console.error('Failed to load runsheet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedOrders();
  }, []);

  // Update order status in backend
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Status update failed');
      const updated = await res.json();

      setOrders((prev) => prev.map((o) => (o._id === orderId ? updated : o)));
      if (activeOrder?._id === orderId) {
        setActiveOrder(updated);
      }

      setStatusFeedback(`Order marked as ${newStatus.replace('_', ' ')}`);
      setTimeout(() => setStatusFeedback(''), 3000);

      if (newStatus === 'delivered') {
        stopTracking();
      }
    } catch (err) {
      console.error(err);
      alert('Could not update order status.');
    }
  };

  // Stop any active GPS watcher or simulator
  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    setGpsMode('idle');
  };

  // Start real browser geolocation stream
  const startRealGps = () => {
    if (!activeOrder) return alert('Select an active order first!');
    if (!navigator.geolocation) return alert('Geolocation not supported on this browser.');

    stopTracking();
    setGpsMode('real');

    // Notify backend room
    socketRef.current.emit('join_order_room', activeOrder._id);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentCoords(newCoords);
        socketRef.current.emit('driver_location_ping', {
          orderId: activeOrder._id,
          lat: newCoords.lat,
          lng: newCoords.lng,
        });
      },
      (err) => {
        console.error('Geolocation watch error:', err);
        alert(`Location permission denied or unavailable: ${err.message}`);
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 1000 }
    );
  };

  // Start smooth route simulation towards delivery address
  const startSimulation = () => {
    if (!activeOrder) return alert('Select an active order first!');
    stopTracking();
    setGpsMode('simulating');

    socketRef.current.emit('join_order_room', activeOrder._id);

    const targetLat = activeOrder.deliveryAddress?.lat || 17.7280;
    const targetLng = activeOrder.deliveryAddress?.lng || 83.3100;

    simIntervalRef.current = setInterval(() => {
      setCurrentCoords((prev) => {
        // Step 6% closer to target destination every 2 seconds
        const deltaLat = (targetLat - prev.lat) * 0.06;
        const deltaLng = (targetLng - prev.lng) * 0.06;

        // If very close, stop simulation
        if (Math.abs(targetLat - prev.lat) < 0.0001 && Math.abs(targetLng - prev.lng) < 0.0001) {
          stopTracking();
          return prev;
        }

        const next = { lat: prev.lat + deltaLat, lng: prev.lng + deltaLng };

        socketRef.current.emit('driver_location_ping', {
          orderId: activeOrder._id,
          lat: next.lat,
          lng: next.lng,
        });

        return next;
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse"></span>
              <h1 className="text-2xl font-black tracking-tight">Delivery Agent Telemetry Hub</h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Assigned Runsheet & Live GPS Gateway
            </p>
          </div>

          {statusFeedback && (
            <div className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              {statusFeedback}
            </div>
          )}
        </div>

        {/* Live Tracking Console Panel */}
        {activeOrder && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Dispatch Stream
                </span>
                <h2 className="text-lg font-bold text-slate-900">
                  Order #{activeOrder._id.slice(-6).toUpperCase()} — {activeOrder.customer?.name || 'Customer'}
                </h2>
                <p className="text-xs text-slate-500">
                  Destination: {activeOrder.deliveryAddress?.street}, {activeOrder.deliveryAddress?.city}
                </p>
              </div>

              {/* Status Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleUpdateStatus(activeOrder._id, 'picked_up')}
                  disabled={activeOrder.status === 'picked_up' || activeOrder.status === 'out_for_delivery' || activeOrder.status === 'delivered'}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Mark Picked Up
                </button>
                <button
                  onClick={() => handleUpdateStatus(activeOrder._id, 'out_for_delivery')}
                  disabled={activeOrder.status === 'out_for_delivery' || activeOrder.status === 'delivered'}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-40"
                >
                  Out for Delivery
                </button>
                <button
                  onClick={() => handleUpdateStatus(activeOrder._id, 'delivered')}
                  disabled={activeOrder.status === 'delivered'}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                >
                  Mark Delivered
                </button>
              </div>
            </div>

            {/* GPS Transmission Controls */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Transmitting Telemetry
                </span>
                <p className="font-mono text-xs font-bold text-slate-800 mt-1">
                  Lat: {currentCoords.lat.toFixed(5)} <br />
                  Lng: {currentCoords.lng.toFixed(5)}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      gpsMode !== 'idle' ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                    }`}
                  ></span>
                  <span className="text-[11px] font-medium text-slate-500 capitalize">
                    Mode: {gpsMode}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-wrap gap-3">
                <button
                  onClick={startRealGps}
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold transition shadow-sm ${
                    gpsMode === 'real'
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  📡 Stream Device GPS
                </button>

                <button
                  onClick={startSimulation}
                  className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold transition shadow-sm ${
                    gpsMode === 'simulating'
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  🚗 Auto-Simulate Route
                </button>

                {gpsMode !== 'idle' && (
                  <button
                    onClick={stopTracking}
                    className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-100"
                  >
                    Stop Broadcast
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assigned Orders Run Sheet */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Today's Delivery Runsheet ({orders.length})
            </h3>
            <button
              onClick={fetchAssignedOrders}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading assigned runs...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No orders currently assigned to you. Contact the dispatcher!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map((order) => {
                const isSelected = activeOrder?._id === order._id;
                return (
                  <div
                    key={order._id}
                    onClick={() => setActiveOrder(order)}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 transition cursor-pointer ${
                      isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          #{order._id.slice(-6).toUpperCase()}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            order.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'out_for_delivery'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {order.status.replace('_', ' ')}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Streaming Target
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                      </div>
                      <div className="text-xs text-slate-500">
                        Recipient: {order.customer?.name} ({order.customer?.phone || 'No phone'})
                      </div>
                    </div>

                    <div className="mt-3 sm:mt-0 flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Collect / Value</div>
                        <div className="font-bold text-slate-900">₹{order.totalAmount}</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveOrder(order);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}