import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  ArrowLeft,
  Phone,
  Radio,
  Navigation,
  Compass,
  Store as StoreIcon,
  MapPin,
  RefreshCw,
  Maximize2
} from 'lucide-react';

// Custom Map Marker Icons using SVG Data URIs
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
  className: 'drop-shadow-md',
});

const homeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
  className: 'drop-shadow-md',
});

const storeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/869/869636.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
  className: 'drop-shadow-md',
});

// Helper component to auto-pan or fit bounds
function MapController({ center, destination, autoPan = true }) {
  const map = useMap();

  useEffect(() => {
    if (center && autoPan) {
      map.panTo(center, { animate: true, duration: 1 });
    }
  }, [center, autoPan, map]);

  return null;
}

// Calculate Haversine distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function OrderTrack() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastTelemetry, setLastTelemetry] = useState(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [distanceKm, setDistanceKm] = useState(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState(null);

  const socketRef = useRef(null);
  const mapRef = useRef(null);

  // 1. Fetch Order Details
  const fetchOrder = async () => {
    try {
      setLoading(true);
      const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

      // Direct endpoint
      let matched = null;
      try {
        const res = await axios.get(`${API_BASE_URL}/api/orders/${id}`, { headers });
        if (res.data) matched = res.data;
      } catch (e) {
        console.warn('Direct order fetch failed, attempting list fallback...', e?.response?.status);
      }

      // Fallbacks if direct fetch is unauthorized or older backend
      if (!matched) {
        if (user?.role === 'admin') {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/all`, { headers });
            matched = res.data?.find((o) => o._id === id);
          } catch {}
        } else if (user?.role === 'delivery_partner') {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/partner-orders`, { headers });
            matched = res.data?.find((o) => o._id === id);
          } catch {}
        }

        if (!matched) {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/my-orders`, { headers });
            matched = res.data?.find((o) => o._id === id);
          } catch {}
        }
      }

      if (matched) {
        setOrder(matched);

        // Determine initial driver coordinates from lastDriverLocation, assigned partner's location, or near destination
        const driverLat =
          matched.lastDriverLocation?.lat ||
          matched.assignedPartner?.currentLocation?.lat ||
          (matched.deliveryAddress?.lat ? matched.deliveryAddress.lat - 0.015 : 17.7231);
        const driverLng =
          matched.lastDriverLocation?.lng ||
          matched.assignedPartner?.currentLocation?.lng ||
          (matched.deliveryAddress?.lng ? matched.deliveryAddress.lng - 0.015 : 83.3013);

        setDriverPos([driverLat, driverLng]);
        if (matched.lastDriverLocation?.updatedAt) {
          setLastTelemetry({
            speed: matched.lastDriverLocation.speed || 0,
            timestamp: new Date(matched.lastDriverLocation.updatedAt),
          });
        }
      }
    } catch (err) {
      console.error('Failed to load order', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id, user?.token]);

  // 2. Real-Time Socket Connection for Order Room
  useEffect(() => {
    socketRef.current = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    socketRef.current.emit('join_order_room', id);

    // Listen for live driver location pings
    socketRef.current.on('partner_location_stream', (data) => {
      if (data && data.lat !== undefined && data.lng !== undefined) {
        setDriverPos([Number(data.lat), Number(data.lng)]);
        setLastTelemetry({
          speed: data.speed || 32,
          heading: data.heading || 0,
          timestamp: new Date(data.timestamp || Date.now()),
        });
      }
    });

    // Listen for real-time status transitions (picked up, out for delivery, delivered)
    socketRef.current.on('order_status_updated', (data) => {
      if (data && (data.orderId === id || data._id === id)) {
        setOrder((prev) => (prev ? { ...prev, status: data.status, assignedPartner: data.assignedPartner || prev.assignedPartner } : prev));
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_order_room', id);
        socketRef.current.disconnect();
      }
    };
  }, [id]);

  // 3. Fetch Road Routing Geometry from Free OSRM API + ETA calculation
  useEffect(() => {
    if (!order || !driverPos || !order.deliveryAddress) return;

    const [dLat, dLng] = driverPos;
    const { lat: hLat, lng: hLng } = order.deliveryAddress;

    // Calculate straight-line / estimated distance
    const dist = calculateDistance(dLat, dLng, hLat, hLng);
    setDistanceKm(dist.toFixed(1));
    // Estimate ~2.5 mins per km in city traffic
    setEstimatedMinutes(Math.max(1, Math.round(dist * 2.5)));

    const fetchRoadRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${hLng},${hLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          const mappedCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRouteLine(mappedCoords);

          if (data.routes[0].distance) {
            const actualKm = data.routes[0].distance / 1000;
            setDistanceKm(actualKm.toFixed(1));
            setEstimatedMinutes(Math.max(1, Math.round(actualKm * 2.2)));
          }
        } else {
          setRouteLine([driverPos, [hLat, hLng]]);
        }
      } catch (e) {
        // Fallback straight line
        setRouteLine([driverPos, [hLat, hLng]]);
      }
    };

    fetchRoadRoute();
  }, [order, driverPos]);

  // Helper to fit entire route on map
  const fitRouteBounds = () => {
    if (mapRef.current && driverPos && order?.deliveryAddress) {
      const bounds = L.latLngBounds([
        driverPos,
        [order.deliveryAddress.lat, order.deliveryAddress.lng],
      ]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      setAutoFollow(false);
    }
  };

  const centerOnDriver = () => {
    if (mapRef.current && driverPos) {
      mapRef.current.panTo(driverPos, { animate: true });
      setAutoFollow(true);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Connecting to real-time delivery telemetry...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Order Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">
          This order does not exist or you do not have permission to view its telemetry.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Store
        </Link>
      </div>
    );
  }

  const destination = [order.deliveryAddress.lat, order.deliveryAddress.lng];
  const warehouse = [17.7231, 83.3013];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            to={user?.role === 'admin' ? '/admin' : user?.role === 'delivery_partner' ? '/partner' : '/my-orders'}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl shadow-2xs transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {user?.role === 'admin' ? 'Back to Admin Dispatch' : user?.role === 'delivery_partner' ? 'Driver Run' : 'My Orders'}
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">
                Live Delivery Tracking
              </h1>
              <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md">
                #{order._id.slice(-6).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time GPS satellite location & telemetry
            </p>
          </div>
        </div>

        {/* Live Signal Badge */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>GPS Broadcast Live</span>
          </div>

          <button
            onClick={fetchOrder}
            title="Refresh order data"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Delivery Partner Card & Milestones */}
        <div className="space-y-6">
          {/* Driver Telemetry HUD */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Assigned Delivery Partner
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                <Truck className="w-3 h-3" /> In Transit
              </span>
            </div>

            {order.assignedPartner ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                    {order.assignedPartner.name?.charAt(0).toUpperCase() || 'D'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{order.assignedPartner.name}</h3>
                    <p className="text-xs text-slate-500">Verified Courier Partner</p>
                    {lastTelemetry && (
                      <span className="text-[10px] text-emerald-600 font-medium">
                        • Moving at ~{lastTelemetry.speed || 30} km/h
                      </span>
                    )}
                  </div>
                </div>

                {order.assignedPartner.phone && (
                  <a
                    href={`tel:${order.assignedPartner.phone}`}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-sm transition"
                    title="Call delivery partner"
                  >
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-slate-400 text-xs">
                Awaiting partner assignment from warehouse dispatch...
              </div>
            )}

            {/* Estimated Arrival Time Metric Strip */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-center">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <span className="text-[10px] font-bold uppercase text-slate-400">Distance</span>
                <p className="font-extrabold text-slate-900 text-sm mt-0.5">
                  {distanceKm ? `${distanceKm} km` : 'Calculating...'}
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50/80 p-2.5">
                <span className="text-[10px] font-bold uppercase text-indigo-500">Est. Arrival</span>
                <p className="font-extrabold text-indigo-700 text-sm mt-0.5">
                  {estimatedMinutes ? `~${estimatedMinutes} mins` : 'Live Tracking'}
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Milestone Progress */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <h3 className="font-bold text-sm text-slate-800">Shipment Milestones</h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  order.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : order.status === 'out_for_delivery'
                    ? 'bg-amber-100 text-amber-800 animate-pulse'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-800">Order Confirmed</p>
                  <p className="text-slate-400 text-[11px]">Payment confirmed and items processed</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Package
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    ['processing', 'picked_up', 'out_for_delivery', 'delivered'].includes(order.status)
                      ? 'text-emerald-600'
                      : 'text-slate-300'
                  }`}
                />
                <div>
                  <p
                    className={`font-bold ${
                      ['processing', 'picked_up', 'out_for_delivery', 'delivered'].includes(order.status)
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    Partner Assigned
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    {order.assignedPartner?.name ? `${order.assignedPartner.name} accepted manifest` : 'Awaiting driver allocation'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Truck
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    ['picked_up', 'out_for_delivery', 'delivered'].includes(order.status)
                      ? 'text-emerald-600'
                      : 'text-slate-300'
                  }`}
                />
                <div>
                  <p
                    className={`font-bold ${
                      ['picked_up', 'out_for_delivery', 'delivered'].includes(order.status)
                        ? 'text-slate-800'
                        : 'text-slate-400'
                    }`}
                  >
                    Out for Delivery
                  </p>
                  <p className="text-slate-400 text-[11px]">Driver is en route to your doorstep</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    order.status === 'delivered' ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <div>
                  <p className={`font-bold ${order.status === 'delivered' ? 'text-slate-800' : 'text-slate-400'}`}>
                    Delivered to Customer
                  </p>
                  <p className="text-slate-400 text-[11px]">Parcel handed over safely</p>
                </div>
              </div>
            </div>

            {/* Address Details */}
            <div className="pt-3 border-t text-xs text-slate-500 space-y-1">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Destination:</strong> {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Total Amount: ₹{order.totalAmount}</span>
                <span className="capitalize">Method: {order.paymentMethod || 'COD'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Map with Interactive Controls */}
        <div className="lg:col-span-2 relative h-[560px] bg-slate-100 border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          {/* Map Controls Floating Bar */}
          <div className="absolute top-4 right-4 z-[1000] flex flex-wrap gap-2">
            <button
              onClick={centerOnDriver}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold backdrop-blur-md shadow-md transition ${
                autoFollow
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/95 text-slate-700 hover:bg-white border border-slate-200'
              }`}
              title="Focus map on driver"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Center Driver</span>
            </button>

            <button
              onClick={fitRouteBounds}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/95 backdrop-blur-md text-slate-700 hover:bg-white border border-slate-200 shadow-md transition"
              title="Show entire journey route"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full Route</span>
            </button>
          </div>

          {/* Real-time Status Overlay in corner of map */}
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-2 rounded-2xl shadow-lg text-xs space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-bold text-slate-800">
                {order.assignedPartner?.name || 'Driver'}: Live Telemetry
              </span>
            </div>
            {driverPos && (
              <p className="font-mono text-[10px] text-slate-400">
                Coords: {driverPos[0].toFixed(4)}, {driverPos[1].toFixed(4)}
              </p>
            )}
          </div>

          <MapContainer
            center={destination}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Warehouse Hub Marker */}
            <Marker position={warehouse} icon={storeIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>Central Dispatch Hub</strong>
                  <br />
                  Order fulfillment center
                </div>
              </Popup>
            </Marker>

            {/* Customer Home Destination Marker */}
            <Marker position={destination} icon={homeIcon}>
              <Popup>
                <div className="text-xs">
                  <strong>Customer Delivery Address</strong>
                  <br />
                  {order.deliveryAddress?.street}
                </div>
              </Popup>
            </Marker>

            {/* Live Moving Delivery Partner Marker */}
            {driverPos && (
              <Marker position={driverPos} icon={bikeIcon}>
                <Popup>
                  <div className="text-xs">
                    <strong>{order.assignedPartner?.name || 'Delivery Partner'}</strong>
                    <br />
                    Status: <span className="capitalize">{order.status.replace(/_/g, ' ')}</span>
                    <br />
                    Speed: ~{lastTelemetry?.speed || 30} km/h
                  </div>
                </Popup>
              </Marker>
            )}

            {/* OSRM Road Route Line */}
            {routeLine.length > 0 && (
              <Polyline
                positions={routeLine}
                color="#4f46e5"
                weight={5}
                opacity={0.85}
                dashArray="6, 6"
              />
            )}

            {/* Auto pan to driver if autoFollow is active */}
            {driverPos && <MapController center={driverPos} destination={destination} autoPan={autoFollow} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}