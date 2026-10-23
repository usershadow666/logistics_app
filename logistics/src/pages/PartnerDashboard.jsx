import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { Truck, Navigation, CheckCircle2, PackageCheck, Radio, AlertCircle } from 'lucide-react';

export default function PartnerDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBroadcastingGps, setIsBroadcastingGps] = useState(false);
  const [currentCoords, setCurrentCoords] = useState({ lat: 17.7231, lng: 83.3013 }); // Default warehouse/hub
  const [simProgress, setSimProgress] = useState(0);

  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const simIntervalRef = useRef(null);

  // Initialize Socket.io connection
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, []);

  // Fetch assigned orders
  const fetchAssignedRuns = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/orders/partner-orders`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setOrders(res.data);
      if (!activeOrder && res.data.length > 0) {
        // Pick the first non-delivered order
        const pending = res.data.find((o) => o.status !== 'delivered');
        if (pending) setActiveOrder(pending);
      }
    } catch (err) {
      console.error('Failed to load assigned runs', err);
    }
  };

  useEffect(() => {
    if (user?.token) fetchAssignedRuns();
  }, [user]);

  // Join the order's specific tracking room
  useEffect(() => {
    if (activeOrder && socketRef.current) {
      socketRef.current.emit('join_order_room', activeOrder._id);
    }
  }, [activeOrder]);

  // Handle Order Status Transitions
  const handleStatusUpdate = async (newStatus) => {
    if (!activeOrder) return;
    try {
      await axios.patch(
        `${API_BASE_URL}/api/orders/${activeOrder._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setActiveOrder((prev) => ({ ...prev, status: newStatus }));
      fetchAssignedRuns();

      if (socketRef.current) {
        socketRef.current.emit('driver_status_ping', {
          orderId: activeOrder._id,
          status: newStatus,
          partnerId: user?._id,
        });
      }

      if (newStatus === 'delivered') {
        stopSimulation();
        stopRealGps();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Status transition failed');
    }
  };

  // 1. Live Device GPS Stream
  const toggleRealGps = () => {
    if (isBroadcastingGps) {
      stopRealGps();
    } else {
      if (!navigator.geolocation) return alert('Geolocation is not supported by your browser.');
      stopSimulation();
      setIsBroadcastingGps(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentCoords(coords);
          socketRef.current?.emit('driver_location_ping', {
            orderId: activeOrder?._id,
            partnerId: user?._id,
            partnerName: user?.name,
            lat: coords.lat,
            lng: coords.lng,
            speed: pos.coords.speed || 30,
            heading: pos.coords.heading || 0,
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }
  };

  const stopRealGps = () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    setIsBroadcastingGps(false);
  };

  // 2. Automated Step-by-Step Route Simulator
  const toggleSimulation = () => {
    if (isSimulating) {
      stopSimulation();
    } else {
      if (!activeOrder) return alert('Select an active order first');
      stopRealGps();
      setIsSimulating(true);

      const targetLat = activeOrder.deliveryAddress?.lat || 17.7384;
      const targetLng = activeOrder.deliveryAddress?.lng || 83.3364;
      let stepCount = 0;
      const totalSteps = 40; // 40 increments of smooth simulated motion

      simIntervalRef.current = setInterval(() => {
        stepCount++;
        const ratio = stepCount / totalSteps;
        setSimProgress(Math.min(100, Math.round(ratio * 100)));

        setCurrentCoords((prev) => {
          const nextLat = prev.lat + (targetLat - prev.lat) * 0.08;
          const nextLng = prev.lng + (targetLng - prev.lng) * 0.08;

          socketRef.current?.emit('driver_location_ping', {
            orderId: activeOrder._id,
            partnerId: user?._id,
            partnerName: user?.name,
            lat: nextLat,
            lng: nextLng,
            speed: 38,
            heading: 45,
          });

          return { lat: nextLat, lng: nextLng };
        });

        if (stepCount >= totalSteps) {
          clearInterval(simIntervalRef.current);
          setIsSimulating(false);
        }
      }, 1500); // Emit every 1.5s
    }
  };

  const stopSimulation = () => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    setIsSimulating(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" /> Driver Delivery Run
          </h1>
          <p className="text-sm text-slate-500">Manage order milestones and transmit telemetry</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-mono">
          <Radio className={`w-4 h-4 ${isSimulating || isBroadcastingGps ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
          {isSimulating ? 'SIMULATOR ACTIVE' : isBroadcastingGps ? 'LIVE GPS BROADCAST' : 'IDLE (NOT STREAMING)'}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border p-12 rounded-2xl text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">No Orders Assigned Yet</h3>
          <p className="text-sm text-slate-500 mt-1">Wait for warehouse dispatch to assign orders to your profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order Selector List */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Manifest</h2>
            {orders.map((order) => (
              <div
                key={order._id}
                onClick={() => {
                  stopSimulation();
                  stopRealGps();
                  setActiveOrder(order);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  activeOrder?._id === order._id
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                    : 'bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-bold text-slate-700">#{order._id.slice(-6)}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate">{order.deliveryAddress.street}</p>
                <p className="text-xs font-semibold text-slate-900 mt-1">₹{order.totalAmount}</p>
              </div>
            ))}
          </div>

          {/* Active Run Telemetry & Milestone Console */}
          {activeOrder && (
            <div className="md:col-span-2 space-y-6">
              {/* Telemetry Card */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-indigo-400" /> GPS Telemetry Broadcaster
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
                  </span>
                </div>

                {isSimulating && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Simulating Route to Customer</span>
                      <span>{simProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${simProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <button
                    onClick={toggleRealGps}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isBroadcastingGps ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    {isBroadcastingGps ? 'Stop Real Device GPS' : 'Transmit Real Device GPS'}
                  </button>

                  <button
                    onClick={toggleSimulation}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isSimulating ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    <Navigation className="w-4 h-4" />
                    {isSimulating ? 'Halt Simulation' : 'Auto-Simulate Route'}
                  </button>
                </div>
              </div>

              {/* Order Milestone Actions */}
              <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800">Delivery Status Milestones</h3>
                <p className="text-xs text-slate-500">
                  Update customer and admin on the order lifecycle stage.
                </p>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={() => handleStatusUpdate('picked_up')}
                    disabled={activeOrder.status === 'delivered'}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition ${
                      activeOrder.status === 'picked_up' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <PackageCheck className="w-5 h-5 text-indigo-600" />
                    1. Picked Up
                  </button>

                  <button
                    onClick={() => handleStatusUpdate('out_for_delivery')}
                    disabled={activeOrder.status === 'delivered'}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition ${
                      activeOrder.status === 'out_for_delivery' ? 'border-amber-500 bg-amber-50 text-amber-700 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-amber-600" />
                    2. Out for Delivery
                  </button>

                  <button
                    onClick={() => handleStatusUpdate('delivered')}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition ${
                      activeOrder.status === 'delivered' ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-bold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    3. Delivered
                  </button>
                </div>

                <div className="border-t pt-4 mt-4 text-xs text-slate-500 space-y-1">
                  <div><strong>Customer:</strong> {activeOrder.customer?.name} ({activeOrder.customer?.phone || 'No phone'})</div>
                  <div><strong>Address:</strong> {activeOrder.deliveryAddress.street}, {activeOrder.deliveryAddress.city}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}