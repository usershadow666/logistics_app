import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';
import { Package, Truck, CheckCircle, Clock, ArrowLeft } from 'lucide-react';

// Custom Map Marker Icons using SVG Data URIs
const bikeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/2972/2972185.png',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19],
});

const homeIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

// Helper component to auto-pan map as driver moves
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center, { animate: true });
    }
  }, [center, map]);
  return null;
}

export default function OrderTrack() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [routeLine, setRouteLine] = useState([]);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);

  // 1. Fetch Order Details
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        let matched = null;
        const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

        // 1. Try role-specific endpoints
        if (user?.role === 'admin') {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/all`, { headers });
            matched = res.data.find((o) => o._id === id);
          } catch (e) {
            console.error('Failed fetching all orders:', e);
          }
        } else if (user?.role === 'delivery_partner') {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/partner-orders`, { headers });
            matched = res.data.find((o) => o._id === id);
          } catch (e) {
            console.error('Failed fetching partner orders:', e);
          }
        }

        // 2. Fallback to customer's own orders
        if (!matched) {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/my-orders`, { headers });
            matched = res.data.find((o) => o._id === id);
          } catch (e) {
            console.error('Failed fetching my orders:', e);
          }
        }

        // 3. Fallback for admin if not already tried
        if (!matched && user?.role === 'admin') {
          try {
            const res = await axios.get(`${API_BASE_URL}/api/orders/all`, { headers });
            matched = res.data.find((o) => o._id === id);
          } catch (e) {
            console.error('Failed fallback orders fetch:', e);
          }
        }

        if (matched) {
          setOrder(matched);
          // Initial position defaults to driver's location or near destination
          const initialDriverLat =
            matched.assignedPartner?.currentLocation?.lat ||
            (matched.deliveryAddress?.lat ? matched.deliveryAddress.lat - 0.015 : 17.7231);
          const initialDriverLng =
            matched.assignedPartner?.currentLocation?.lng ||
            (matched.deliveryAddress?.lng ? matched.deliveryAddress.lng - 0.015 : 83.3013);
          setDriverPos([initialDriverLat, initialDriverLng]);
        }
      } catch (err) {
        console.error('Failed to load order', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.token) fetchOrder();
  }, [id, user]);

  // 2. Real-Time Socket Connection
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.emit('join_order_room', id);

    socketRef.current.on('partner_location_stream', (data) => {
      setDriverPos([data.lat, data.lng]);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [id]);

  // 3. Fetch Road Routing Geometry from Free OSRM API
  useEffect(() => {
    if (!order || !driverPos) return;

    const fetchRoadRoute = async () => {
      try {
        const [dLat, dLng] = driverPos;
        const { lat: hLat, lng: hLng } = order.deliveryAddress;
        
        const url = `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${hLng},${hLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes[0]) {
          // OSRM returns coordinates in [lng, lat] format, Leaflet requires [lat, lng]
          const mappedCoords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRouteLine(mappedCoords);
        }
      } catch (e) {
        // Fallback straight line if external OSRM service is rate-limited
        setRouteLine([driverPos, [order.deliveryAddress.lat, order.deliveryAddress.lng]]);
      }
    };

    fetchRoadRoute();
  }, [order, driverPos]);

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading delivery details...</div>;
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <h2 className="text-xl font-bold text-slate-800">Order not found</h2>
        <Link to="/" className="text-indigo-600 underline mt-2 inline-block">Return to Store</Link>
      </div>
    );
  }

  const destination = [order.deliveryAddress.lat, order.deliveryAddress.lng];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Status & Shipment Details */}
        <div className="space-y-4">
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="font-mono text-xs font-bold text-slate-500">#{order._id.slice(-6)}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                order.status === 'out_for_delivery' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                'bg-blue-100 text-blue-800'
              }`}>
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>

            <h2 className="font-bold text-lg text-slate-800">Tracking Shipment</h2>

            {/* Step Milestones */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-emerald-600 font-medium">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>Order Placed & Confirmed</span>
              </div>
              <div className={`flex items-center gap-3 ${
                ['processing', 'picked_up', 'out_for_delivery', 'delivered'].includes(order.status)
                  ? 'text-emerald-600 font-medium' : 'text-slate-400'
              }`}>
                <Package className="w-5 h-5 shrink-0" />
                <span>Assigned to Courier</span>
              </div>
              <div className={`flex items-center gap-3 ${
                ['out_for_delivery', 'delivered'].includes(order.status)
                  ? 'text-emerald-600 font-medium' : 'text-slate-400'
              }`}>
                <Truck className="w-5 h-5 shrink-0" />
                <span>Out for Delivery</span>
              </div>
              <div className={`flex items-center gap-3 ${
                order.status === 'delivered' ? 'text-emerald-600 font-medium' : 'text-slate-400'
              }`}>
                <Clock className="w-5 h-5 shrink-0" />
                <span>Delivered to Doorstep</span>
              </div>
            </div>

            <div className="pt-3 border-t text-xs text-slate-500 space-y-1">
              <div><strong>Recipient Address:</strong> {order.deliveryAddress.street}, {order.deliveryAddress.city}</div>
              <div><strong>Rider:</strong> {order.assignedPartner?.name || 'Assigning soon...'}</div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Map */}
        <div className="lg:col-span-2 h-[480px] bg-white border rounded-2xl overflow-hidden shadow-sm relative">
          <MapContainer center={destination} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Destination Marker */}
            <Marker position={destination} icon={homeIcon}>
              <Popup>Delivery Address: {order.deliveryAddress.street}</Popup>
            </Marker>

            {/* Live Moving Driver Marker */}
            {driverPos && (
              <Marker position={driverPos} icon={bikeIcon}>
                <Popup>Delivery Partner is here</Popup>
              </Marker>
            )}

            {/* Road Polyline */}
            {routeLine.length > 0 && (
              <Polyline positions={routeLine} color="#4f46e5" weight={4} opacity={0.8} dashArray="8, 8" />
            )}

            {/* Dynamic Center Tracking */}
            {driverPos && <MapUpdater center={driverPos} />}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}