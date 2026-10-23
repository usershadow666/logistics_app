import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import AddProductModal from '../components/AddProductModel';
import { API_BASE_URL as API_URL, getSafeImageUrl } from '../config/api';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Truck,
  Radio,
  Navigation,
  Eye,
  X,
  Phone,
  Package,
  Compass,
  CheckCircle2,
  Store as StoreIcon,
  Maximize2
} from 'lucide-react';

// Custom Map Marker Icons using SVG Data URIs
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
  className: 'drop-shadow-md',
});

const homeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
  className: 'drop-shadow-md',
});

const storeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/869/869636.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
  className: 'drop-shadow-md',
});

// Helper component to smoothly center Leaflet map on target coordinates
function MapCenterController({ center, zoom = 14 }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2 && !isNaN(center[0])) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function AdminDispatch() {
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'orders' | 'inventory'
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [partners, setPartners] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live Partner Real-Time Telemetry Map (partnerId -> telemetry)
  const [liveDriverLocations, setLiveDriverLocations] = useState({});
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [mapFocusTarget, setMapFocusTarget] = useState([17.7231, 83.3013]);
  const [quickTrackOrder, setQuickTrackOrder] = useState(null);

  const socketRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [resOrders, resProducts, resPartners] = await Promise.all([
        fetch(`${API_URL}/api/orders/all`, { headers }),
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

      const loadedOrders = Array.isArray(ordersData) ? ordersData : [];
      const loadedPartners = Array.isArray(partnersData) ? partnersData : [];

      setOrders(loadedOrders);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setPartners(loadedPartners);

      // Populate initial live driver coordinates from MongoDB database state
      const initialLocations = {};
      loadedPartners.forEach((p) => {
        if (p.currentLocation?.lat && p.currentLocation?.lng) {
          initialLocations[p._id] = {
            partnerId: p._id,
            partnerName: p.name,
            phone: p.phone,
            lat: p.currentLocation.lat,
            lng: p.currentLocation.lng,
            speed: 0,
            timestamp: p.currentLocation.updatedAt || new Date(),
          };
        }
      });

      // Also check orders for lastDriverLocation
      loadedOrders.forEach((o) => {
        if (o.assignedPartner?._id && o.lastDriverLocation?.lat) {
          initialLocations[o.assignedPartner._id] = {
            ...initialLocations[o.assignedPartner._id],
            partnerId: o.assignedPartner._id,
            partnerName: o.assignedPartner.name,
            lat: o.lastDriverLocation.lat,
            lng: o.lastDriverLocation.lng,
            speed: o.lastDriverLocation.speed || 0,
            orderId: o._id,
            timestamp: o.lastDriverLocation.updatedAt || new Date(),
          };
        }
      });

      setLiveDriverLocations((prev) => ({ ...initialLocations, ...prev }));
    } catch (err) {
      console.error('Failed to load admin dispatch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-Time Socket Connection for Admin Live Fleet Room
  useEffect(() => {
    socketRef.current = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socketRef.current.emit('join_admin_room');

    // Handle real-time driver GPS / simulated location pings
    socketRef.current.on('partner_location_stream', (data) => {
      if (data && data.lat !== undefined && data.lng !== undefined) {
        setLiveDriverLocations((prev) => {
          const partnerKey = data.partnerId || (data.orderId ? `order_${data.orderId}` : 'unknown');
          return {
            ...prev,
            [partnerKey]: {
              ...prev[partnerKey],
              ...data,
              lat: Number(data.lat),
              lng: Number(data.lng),
              timestamp: new Date(data.timestamp || Date.now()),
            },
          };
        });
      }
    });

    // Handle real-time order status updates (processing, out_for_delivery, delivered)
    socketRef.current.on('order_status_updated', (data) => {
      if (data && data.orderId) {
        setOrders((prev) =>
          prev.map((o) =>
            o._id === data.orderId
              ? { ...o, status: data.status, assignedPartner: data.assignedPartner || o.assignedPartner }
              : o
          )
        );
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_admin_room');
        socketRef.current.disconnect();
      }
    };
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
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to assign partner:', err);
    }
  };

  const handleProductAdded = (newProduct) => {
    setProducts((prev) => [newProduct, ...prev]);
  };

  // Find active order for a given partner
  const getPartnerActiveOrder = (partnerId) => {
    return orders.find(
      (o) =>
        (o.assignedPartner?._id === partnerId || o.assignedPartner === partnerId) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    );
  };

  const centralWarehouse = [17.7231, 83.3013];

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Merchant Operations & Logistics Dispatch
              </h1>
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" /> Live Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Track delivery partners live in real-time, dispatch orders, and manage inventory catalog
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Tabs */}
            <div className="flex rounded-xl bg-slate-200 p-1 text-xs font-bold">
              <button
                onClick={() => setActiveTab('fleet')}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 transition ${
                  activeTab === 'fleet'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio className="h-3.5 w-3.5 text-emerald-500" />
                <span>Live Fleet Map ({partners.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`rounded-lg px-3.5 py-2 transition ${
                  activeTab === 'orders'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('inventory')}
                className={`rounded-lg px-3.5 py-2 transition ${
                  activeTab === 'inventory'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Catalog Items ({products.length})
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh live data"
              className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Add Item Modal Trigger */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
            >
              <span>+</span> Sell New Product
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: LIVE FLEET TRACKING MAP PORTAL */}
        {/* ============================================================== */}
        {activeTab === 'fleet' && (
          <div className="mt-6 space-y-6">
            {/* Top Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Partners</span>
                <p className="text-xl font-black text-slate-900 mt-1">{partners.length}</p>
                <span className="text-[11px] text-slate-400">Registered courier fleet</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Active Live Stream</span>
                <p className="text-xl font-black text-emerald-600 mt-1 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                  {Object.keys(liveDriverLocations).length}
                </p>
                <span className="text-[11px] text-slate-400">Transmitting GPS telemetry</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">In Transit Orders</span>
                <p className="text-xl font-black text-indigo-600 mt-1">
                  {orders.filter((o) => o.status === 'out_for_delivery' || o.status === 'picked_up').length}
                </p>
                <span className="text-[11px] text-slate-400">En route to customers</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Dispatch</span>
                <p className="text-xl font-black text-amber-600 mt-1">
                  {orders.filter((o) => o.status === 'placed' || !o.assignedPartner).length}
                </p>
                <span className="text-[11px] text-slate-400">Need partner assignment</span>
              </div>
            </div>

            {/* Main Interactive Fleet Grid: Map + Active Drivers List */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Registered & Live Delivery Partners List */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-indigo-600" /> Courier Fleet Directory
                  </h3>
                  <span className="text-[11px] font-mono font-bold text-slate-400">
                    {partners.length} Drivers
                  </span>
                </div>

                {partners.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No delivery partners registered yet.
                    <br />
                    <Link to="/register" target="_blank" className="text-indigo-600 font-bold underline mt-1 block">
                      Register a Partner
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                    {partners.map((partner) => {
                      const telemetry = liveDriverLocations[partner._id];
                      const activeOrder = getPartnerActiveOrder(partner._id);
                      const isSelected = selectedPartner?._id === partner._id;
                      const partnerCoords = telemetry
                        ? [telemetry.lat, telemetry.lng]
                        : partner.currentLocation?.lat
                        ? [partner.currentLocation.lat, partner.currentLocation.lng]
                        : centralWarehouse;

                      return (
                        <div
                          key={partner._id}
                          onClick={() => {
                            setSelectedPartner(partner);
                            setMapFocusTarget(partnerCoords);
                          }}
                          className={`p-3.5 rounded-xl border transition cursor-pointer ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                  activeOrder ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {partner.name?.charAt(0).toUpperCase() || 'P'}
                              </div>
                              <div>
                                <h4 className="font-bold text-xs text-slate-900">{partner.name}</h4>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {partner.phone || 'Driver Partner'}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                activeOrder
                                  ? 'bg-amber-100 text-amber-800'
                                  : telemetry
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {telemetry && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>}
                              {activeOrder ? 'Delivering' : telemetry ? 'Online' : 'Standby'}
                            </span>
                          </div>

                          {/* Active Run context */}
                          {activeOrder ? (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] space-y-1">
                              <div className="flex justify-between text-slate-600">
                                <span>Order #{activeOrder._id.slice(-6).toUpperCase()}</span>
                                <span className="font-semibold text-indigo-700 capitalize">
                                  {activeOrder.status.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                Dest: {activeOrder.deliveryAddress?.street}
                              </p>
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-slate-400">Available at central hub</div>
                          )}

                          {/* Actions */}
                          <div className="mt-2.5 flex items-center justify-between pt-1">
                            <span className="font-mono text-[9px] text-slate-400">
                              Lat: {partnerCoords[0].toFixed(3)}, Lng: {partnerCoords[1].toFixed(3)}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPartner(partner);
                                setMapFocusTarget(partnerCoords);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                            >
                              <Navigation className="w-3 h-3" /> Focus Map
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right 2 Columns: Live Fleet Leaflet Map */}
              <div className="lg:col-span-2 relative h-[560px] bg-slate-100 border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                {/* Floating Map HUD */}
                <div className="absolute top-4 left-4 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 px-3.5 py-2 rounded-2xl shadow-md text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="font-bold text-slate-900">Live Satellite Telemetry</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Monitoring Visakhapatnam Dispatch Grid
                  </span>
                </div>

                <div className="absolute top-4 right-4 z-[1000] flex gap-2">
                  <button
                    onClick={() => setMapFocusTarget(centralWarehouse)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/95 backdrop-blur-md text-slate-700 hover:bg-white border border-slate-200 shadow-md transition"
                  >
                    <StoreIcon className="w-3.5 h-3.5 text-indigo-600" /> Center Hub
                  </button>
                </div>

                <MapContainer
                  center={centralWarehouse}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {/* Central Warehouse / Dispatch Hub Marker */}
                  <Marker position={centralWarehouse} icon={storeIcon}>
                    <Popup>
                      <div className="text-xs">
                        <strong>Central Logistics Hub</strong>
                        <br />
                        Visakhapatnam Warehouse
                      </div>
                    </Popup>
                  </Marker>

                  {/* Render Delivery Partners */}
                  {partners.map((partner) => {
                    const telemetry = liveDriverLocations[partner._id];
                    const activeOrder = getPartnerActiveOrder(partner._id);
                    const coords = telemetry
                      ? [telemetry.lat, telemetry.lng]
                      : partner.currentLocation?.lat
                      ? [partner.currentLocation.lat, partner.currentLocation.lng]
                      : null;

                    if (!coords) return null;

                    return (
                      <React.Fragment key={partner._id}>
                        {/* Driver Bike Marker */}
                        <Marker position={coords} icon={bikeIcon}>
                          <Popup>
                            <div className="text-xs space-y-1">
                              <strong className="text-indigo-700">{partner.name}</strong>
                              <br />
                              <span>Phone: {partner.phone || 'Driver'}</span>
                              <br />
                              <span>Speed: ~{telemetry?.speed || 30} km/h</span>
                              {activeOrder && (
                                <div className="mt-1 pt-1 border-t text-[11px]">
                                  <strong>Active Order:</strong> #{activeOrder._id.slice(-6).toUpperCase()}
                                  <br />
                                  <span>Customer: {activeOrder.customer?.name}</span>
                                  <br />
                                  <Link
                                    to={`/orders/${activeOrder._id}/track`}
                                    target="_blank"
                                    className="text-indigo-600 font-bold underline block mt-1"
                                  >
                                    Open Full Telemetry Route &rarr;
                                  </Link>
                                </div>
                              )}
                            </div>
                          </Popup>
                        </Marker>

                        {/* Customer Destination Marker & Connection Line for Active Order */}
                        {activeOrder?.deliveryAddress?.lat && (
                          <>
                            <Marker
                              position={[activeOrder.deliveryAddress.lat, activeOrder.deliveryAddress.lng]}
                              icon={homeIcon}
                            >
                              <Popup>
                                <div className="text-xs">
                                  <strong>Destination: Order #{activeOrder._id.slice(-6).toUpperCase()}</strong>
                                  <br />
                                  Recipient: {activeOrder.customer?.name}
                                  <br />
                                  {activeOrder.deliveryAddress.street}
                                </div>
                              </Popup>
                            </Marker>

                            <Polyline
                              positions={[
                                coords,
                                [activeOrder.deliveryAddress.lat, activeOrder.deliveryAddress.lng],
                              ]}
                              color="#6366f1"
                              weight={3}
                              opacity={0.7}
                              dashArray="5, 5"
                            />
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Map center controller */}
                  <MapCenterController center={mapFocusTarget} />
                </MapContainer>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: ORDERS DISPATCH TABLE */}
        {/* ============================================================== */}
        {activeTab === 'orders' && (
          <div className="mt-6">
            {/* Alert if no delivery partners exist */}
            {partners.length === 0 && (
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-200/80 p-4 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>No Delivery Partners Registered:</strong> You need at least one registered user with the <em>Delivery Partner</em> role to assign them to incoming customer orders.
                  </span>
                </div>
                <Link
                  to="/register"
                  target="_blank"
                  className="inline-flex items-center gap-1 font-bold text-amber-800 underline hover:text-amber-950 shrink-0"
                >
                  Register a Delivery Partner &rarr;
                </Link>
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Order ID</th>
                    <th className="px-5 py-3.5">Customer & Destination</th>
                    <th className="px-5 py-3.5">Total Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Assigned Partner</th>
                    <th className="px-5 py-3.5">Live Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-slate-400">
                        {loading ? 'Loading orders from backend...' : 'No orders in system'}
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isPartnerAssigned = !!order.assignedPartner;
                      const telemetry = order.assignedPartner?._id
                        ? liveDriverLocations[order.assignedPartner._id]
                        : null;

                      return (
                        <tr key={order._id} className="hover:bg-slate-50/60 transition">
                          <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-800">
                            #{order._id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">{order.customer?.name || 'Customer'}</div>
                            <div className="text-xs text-slate-400">
                              {order.deliveryAddress?.street || 'Local Address'}, {order.deliveryAddress?.city || 'City'}
                            </div>
                            {order.customer?.phone && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                📞 {order.customer.phone}
                              </div>
                            )}
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
                                  : order.status === 'processing'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {order.status.replace(/_/g, ' ')}
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
                                  {partner.name} ({partner.phone || 'Driver'})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/orders/${order._id}/track`}
                                target="_blank"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition shadow-2xs"
                                title="Open live GPS tracking map"
                              >
                                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Track Live</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </Link>

                              {telemetry && (
                                <span
                                  className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"
                                  title="Driver transmitting live GPS"
                                ></span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: INVENTORY CATALOG TABLE */}
        {/* ============================================================== */}
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

        {/* Sell Product Modal */}
        <AddProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onProductAdded={handleProductAdded}
        />
      </div>
    </div>
  );
}